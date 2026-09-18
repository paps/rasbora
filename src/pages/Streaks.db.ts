/** The query behind `Streaks.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { nextReviewTime } from "@/database/reviewSchedule";
import { runOf } from "@/database/reviewLog";
import {
  readCardPointsPerDay,
  asCount,
  asText,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `LearnedCards.db.ts` for the reason. */
const STREAK_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/** A score column, or null when the scorefile holds none for the card. */
const asScore = (value: SqlValue | null): number | null =>
  typeof value === "number" ? value : null;

/** A card with the run it is currently on already worked out. */
export interface StreakCard extends FlashcardData {
  /** Correct answers in a row, counted back to the last failure. */
  run: number;
  /** Whether every one of them was "remembered perfectly". */
  perfect: boolean;
}

export interface StreakCards {
  /** The cards on that exact run, soonest due first. Capped. */
  cards: StreakCard[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

export interface StreakCandidates {
  /** Every card the profile has reviewed at least once, with its run. */
  candidates: StreakCard[];
  /** The longest run in the profile, so the page can say what it holds. */
  longestRun: number;
}

/**
 * The cards on exactly `run` correct answers in a row, soonest due first.
 *
 * **Exactly**, not "at least": this page is what the `Learning distribution`
 * chart opens when a bar is clicked, so a bar of 530 has to open a list of 530.
 * Both sides count through `runOf`, which is in `src/database/` rather than
 * beside either page for that reason.
 *
 * Soonest due first because every card here shares a run, so the run cannot
 * order them and the next review is the one thing left that says which to look
 * at. Cards with no usable due date sort last, where an absent timestamp would
 * otherwise read as 1970 and put unknowns at the top of the list.
 */
export const selectStreak = (
  candidates: StreakCard[],
  run: number,
): StreakCards => {
  const matching = candidates
    .filter((card) => card.run === run)
    .sort(
      (left, right) =>
        (left.nextReview ?? Infinity) - (right.nextReview ?? Infinity) ||
        left.id - right.id,
    );

  return { cards: matching.slice(0, STREAK_LIMIT), total: matching.length };
};

/**
 * Every card the profile has put in front of the reader at least once, each
 * carrying the run it is on.
 *
 * Cards with an empty log are left out rather than counted as a run of zero:
 * never having been asked and having just been failed are different things,
 * and `New cards` is the page for the first of them. The chart splits them the
 * same way, which is what keeps a bar and the list it opens agreeing.
 *
 * The whole set is read once per profile and the control re-filters it, as on
 * `Lapses`: the run cannot be expressed in SQL — SQLite has no regex and no way
 * to count a prefix — so re-querying on a keystroke would re-read the export to
 * answer a question about strings already in memory.
 */
export const readStreakCandidates = (
  database: Database,
  profile: Profile,
): StreakCandidates => {
  const table = profile.scorefile?.table ?? null;
  const pointsPerDay = readCardPointsPerDay(database, profile);

  if (table === null || profile.categoryIds.length === 0) {
    return { candidates: [], longestRun: 0 };
  }

  const candidates = rowsOf(
    database,
    `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
            c.created, c.modified,
            s.correct, s.incorrect, s.reviewed, s.history,
            s.firstreviewedtime, s.lastreviewedtime,
            s.scoreinctime, s.scoredectime, s.score
     from pleco_flash_cards c
     join ${table} s on s.card = c.id
     where coalesce(s.history, '') <> ''
       and c.id in (select card from pleco_flash_categoryassigns
                    where cat in (${profile.categoryIds.join(", ")}))`,
  ).map((row) => {
    const history = asText(row[10] ?? null);
    const { length, perfect } = runOf(history);

    return {
      id: asCount(row[0] ?? null),
      hw: asText(row[1] ?? null),
      althw: asText(row[2] ?? null),
      pron: asText(row[3] ?? null),
      defn: asText(row[4] ?? null),
      created: asTime(row[5] ?? null),
      modified: asTime(row[6] ?? null),
      correct: asCount(row[7] ?? null),
      incorrect: asCount(row[8] ?? null),
      reviewed: asCount(row[9] ?? null),
      history,
      firstReviewed: asTime(row[11] ?? null),
      lastReviewed: asTime(row[12] ?? null),
      scoreIncreased: asTime(row[13] ?? null),
      scoreDecreased: asTime(row[14] ?? null),
      nextReview: nextReviewTime(
        asScore(row[15] ?? null),
        asTime(row[12] ?? null),
        pointsPerDay,
      ),
      run: length,
      perfect,
    };
  });

  return {
    candidates,
    longestRun: candidates.reduce(
      (longest, card) => Math.max(longest, card.run),
      0,
    ),
  };
};
