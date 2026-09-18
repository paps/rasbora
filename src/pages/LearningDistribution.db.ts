/** The query behind `LearningDistribution.tsx`, and nothing else. */

import type { Database } from "sql.js";
import { asCount, asText, rowsOf } from "@/database/plecoFile";
import { runOf } from "@/database/reviewLog";
import type { Profile } from "@/database/plecoFile";

/** Series key of the cards the profile has never put in front of the reader. */
export const NEVER_SERIES = "never";

/**
 * Series key of the cards that were asked and got the last one wrong. Their
 * run is zero, which is no run at all — the perfect/weaker split below says
 * nothing about them, and an empty run would answer "all perfect" vacuously.
 */
export const LAPSED_SERIES = "lapsed";

/** Series key of the runs made of nothing but "remembered perfectly". */
export const PERFECT_SERIES = "perfect";

/** Series key of the runs holding at least one answer graded below that. */
export const WEAKER_SERIES = "weaker";

export interface StreakBucket {
  /**
   * The run this bucket counts, in reviews — or null for the cards the profile
   * has never reviewed at all, which are held apart from the zero bucket
   * rather than summed into it.
   */
  streak: number | null;
  /** Cards under each series key. Every key is present on every bucket. */
  counts: Record<string, number>;
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
 * answers, each bar split by whether that run is made of perfect answers or
 * carries weaker ones.
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
 * regex and no way to count a prefix — so the walk is `runOf`, run once per
 * distinct log instead of once per card.
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

  // streak -> series key -> cards.
  const counted = new Map<number, Map<string, number>>();
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

    const { length, perfect } = runOf(history);
    const key =
      length === 0 ? LAPSED_SERIES : perfect ? PERFECT_SERIES : WEAKER_SERIES;
    const series = counted.get(length) ?? new Map<string, number>();

    series.set(key, (series.get(key) ?? 0) + cards);
    counted.set(length, series);
    longestStreak = Math.max(longestStreak, length);
  }

  const buckets: StreakBucket[] = [
    {
      streak: null,
      counts: {
        [NEVER_SERIES]: newCards,
        [LAPSED_SERIES]: 0,
        [PERFECT_SERIES]: 0,
        [WEAKER_SERIES]: 0,
      },
    },
  ];

  for (let streak = 0; streak <= longestStreak; streak += 1) {
    const series = counted.get(streak);

    buckets.push({
      streak,
      counts: {
        [NEVER_SERIES]: 0,
        [LAPSED_SERIES]: series?.get(LAPSED_SERIES) ?? 0,
        [PERFECT_SERIES]: series?.get(PERFECT_SERIES) ?? 0,
        [WEAKER_SERIES]: series?.get(WEAKER_SERIES) ?? 0,
      },
    });
  }

  return {
    buckets,
    newCards,
    lapsedCards: counted.get(0)?.get(LAPSED_SERIES) ?? 0,
    totalCards,
    longestStreak,
  };
};
