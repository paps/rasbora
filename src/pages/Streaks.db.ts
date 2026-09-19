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

/**
 * How many cards the page lists. A single run can hold thousands — a third of
 * the sample export's deck sits on one of them — so every list in the app is
 * capped at this and says what the cap left out. A silently truncated list
 * reads as a complete one.
 */
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
  /** The cards on a run in that range, soonest due first. Capped. */
  cards: StreakCard[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * The runs a list covers, both ends included.
 *
 * A single run is `from` and `to` being equal rather than a second shape, so
 * one filter answers both and the exactness the `Learning distribution` chart
 * needs is the range's degenerate case rather than a separate path through
 * the code.
 */
export interface StreakRange {
  /** The shortest run listed, and the only one when `to` equals it. */
  from: number;
  /** The longest run listed. Callers keep it at or above `from`. */
  to: number;
}

export interface StreakCandidates {
  /** Every card the profile has reviewed at least once, with its run. */
  candidates: StreakCard[];
  /** The longest run in the profile, so the page can say what it holds. */
  longestRun: number;
}

/**
 * The cards on a run between `from` and `to`, both ends included, soonest due
 * first.
 *
 * A range of one is **exact**, not "at least": this page is what the
 * `Learning distribution` chart opens when a bar is clicked, and that link
 * carries the run alone, so a bar of 530 still has to open a list of 530.
 * Both sides count through `runOf`, which is in `src/database/` rather than
 * beside either page for that reason.
 *
 * Soonest due first whatever the range, because the question the list answers
 * — which of these to look at next — does not change when it widens, and the
 * run each card is on is a column rather than the order. Cards with no usable
 * due date sort last, where an absent timestamp would otherwise read as 1970
 * and put unknowns at the top of a list about what is coming back.
 */
export const selectStreaks = (
  candidates: StreakCard[],
  { from, to }: StreakRange,
): StreakCards => {
  const matching = candidates
    .filter((card) => card.run >= from && card.run <= to)
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
