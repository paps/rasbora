/** The query behind `LearningDistribution.tsx`, and nothing else. */

import type { Database } from "sql.js";
import { asCount, asText, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/**
 * Whether a grade counts as a right answer. `4`, `5` and `6` are the correct
 * half of Pleco's six-point scale, and the split is exact rather than
 * approximate: every scorefile's `correct` tally equals the count of those
 * three digits. Anything else — including a digit no export has ever held —
 * reads as not correct.
 *
 * `RiskyCards.db.ts` reads the same encoding for its own question. The two are
 * deliberately not shared: each page owns what it asks of the review log, and
 * this one asks about the run at the head of it rather than a break inside it.
 */
const isCorrect = (grade: string): boolean =>
  grade === "4" || grade === "5" || grade === "6";

/**
 * How many correct answers a card is currently on, counted back from its most
 * recent review to the failure that ended the previous run — or to the start
 * of the log, for a card that has never been failed.
 *
 * `history` is **newest first**, so the run is the prefix: index 0 is the last
 * review and the walk stops at the first digit that is not a right answer. A
 * card whose whole log is one run stops by running off the end of the string,
 * where the missing character reads as not correct.
 */
const streakOf = (history: string): number => {
  let streak = 0;

  while (isCorrect(history[streak] ?? "")) {
    streak += 1;
  }

  return streak;
};

export interface StreakBucket {
  /**
   * The run this bucket counts, in reviews — or null for the cards the profile
   * has never reviewed at all, which are held apart from the zero bucket
   * rather than summed into it.
   */
  streak: number | null;
  /** How many of the profile's cards are on that run. */
  cards: number;
}

export interface LearningDistribution {
  /**
   * One bucket per run length, `null` first and then every integer from 0 to
   * the longest run in the profile. Runs nobody is on still get a bucket: a
   * gap left out would compress the axis and misreport where the deck sits.
   */
  buckets: StreakBucket[];
  /** Cards the profile has never put in front of the reader. */
  newCards: number;
  /** Cards whose most recent review was a failure, so their run is zero. */
  lapsedCards: number;
  /** Every card the profile draws, whatever its run. */
  totalCards: number;
  /** The longest run in the profile, in reviews. Zero when nothing is on one. */
  longestStreak: number;
}

const EMPTY: LearningDistribution = {
  buckets: [],
  newCards: 0,
  lapsedCards: 0,
  totalCards: 0,
  longestStreak: 0,
};

/**
 * How the profile's cards are spread across their current run of correct
 * answers: the shape of a deck at a glance, from the cards it has never asked
 * about to the ones it has not got wrong in twenty sittings.
 *
 * The scorefile is joined rather than required, as on `Customized cards`: a
 * card the profile holds but has never shown still belongs to the profile, and
 * it is exactly the "just added" end of this chart. Such a card has no run
 * rather than a run of zero — `streak: null` — because a zero here means the
 * card was asked and failed, which is the opposite thing to know about it.
 *
 * The rows are grouped by the log itself rather than read one per card: the
 * same short digit string is shared by thousands of cards in a real export,
 * and the run only depends on that string. SQLite cannot walk it — there is no
 * regex and no way to count a prefix — so the walk is `streakOf` above, run
 * once per distinct log instead of once per card.
 */
export const readLearningDistribution = (
  database: Database,
  profile: Profile,
): LearningDistribution => {
  if (profile.categoryIds.length === 0) {
    return EMPTY;
  }

  const table = profile.scorefile?.table ?? null;
  // Without a scorefile the profile has scored nothing, so every card it draws
  // is one it has never reviewed. `'' as history` says that in the same shape
  // the join below returns, rather than making the caller handle a second one.
  const logs = rowsOf(
    database,
    table === null
      ? `select '' as history, count(*)
         from pleco_flash_cards c
         where c.id in (select card from pleco_flash_categoryassigns
                        where cat in (${profile.categoryIds.join(", ")}))`
      : `select coalesce(s.history, '') as history, count(*)
         from pleco_flash_cards c
         left join ${table} s on s.card = c.id
         where c.id in (select card from pleco_flash_categoryassigns
                        where cat in (${profile.categoryIds.join(", ")}))
         group by history`,
  );

  const counts = new Map<number, number>();
  let newCards = 0;
  let totalCards = 0;
  let longestStreak = 0;

  for (const row of logs) {
    const history = asText(row[0] ?? null);
    const cards = asCount(row[1] ?? null);

    totalCards += cards;

    if (history === "") {
      newCards += cards;
      continue;
    }

    const streak = streakOf(history);

    counts.set(streak, (counts.get(streak) ?? 0) + cards);
    longestStreak = Math.max(longestStreak, streak);
  }

  const buckets: StreakBucket[] = [{ streak: null, cards: newCards }];

  for (let streak = 0; streak <= longestStreak; streak += 1) {
    buckets.push({ streak, cards: counts.get(streak) ?? 0 });
  }

  return {
    buckets,
    newCards,
    lapsedCards: counts.get(0) ?? 0,
    totalCards,
    longestStreak,
  };
};
