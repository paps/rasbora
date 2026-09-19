/** The query behind `DueCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { nextReviewTime, wholeDaysUntil } from "@/database/reviewSchedule";
import {
  asCount,
  asText,
  readCardPointsPerDay,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `Streaks.db.ts` for the reason. */
const DUE_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/** A score column, or null when the scorefile holds none for the card. */
const asScore = (value: SqlValue | null): number | null =>
  typeof value === "number" ? value : null;

/** A card with the whole-day bucket its estimate falls in already worked out. */
export interface DueCard extends FlashcardData {
  /** Whole days until the estimated review, floored, so negative is overdue. */
  day: number;
}

export interface DueCards {
  /** The cards falling in that range of days, soonest due first. Capped. */
  cards: DueCard[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * The days a list covers, both ends included.
 *
 * Both ends can be negative — a card three weeks overdue sits on -21 — and a
 * single day is `from` and `to` being equal rather than a second shape, so the
 * exactness a bar of the `Incoming reviews` chart needs is the range's
 * degenerate case rather than its own path through the code.
 */
export interface DueRange {
  /** The earliest day listed, and the only one when `to` equals it. */
  from: number;
  /** The latest day listed. Callers keep it at or above `from`. */
  to: number;
}

export interface DueCandidates {
  /** Every in-scope card with an estimated review date, with its day. */
  candidates: DueCard[];
  /** The earliest and latest days any card falls on, or null when none do. */
  earliestDay: number | null;
  latestDay: number | null;
  /** In-scope cards without enough data to estimate a review date. */
  unknownCards: number;
  /** Cards the profile holds, estimated or not. */
  totalCards: number;
}

/**
 * The cards due between `from` and `to` days from now, both ends included,
 * soonest due first.
 *
 * A range of one day is **exact**, not "by then": this page is what the
 * `Incoming reviews` chart opens when a bar is clicked, and that link carries
 * one day, so a bar of 530 still has to open a list of 530. Both sides bucket
 * through `wholeDaysUntil`, which is in `src/database/` for that reason.
 *
 * Soonest due first whatever the range — the question the list answers is
 * which card to pick up next, and widening the range does not change it. The
 * shared `Next review` column carries where in the range each card sits, so
 * there is no day column repeating it.
 */
export const selectDueCards = (
  candidates: DueCard[],
  { from, to }: DueRange,
): DueCards => {
  const matching = candidates
    .filter((card) => card.day >= from && card.day <= to)
    .sort(
      (left, right) =>
        (left.nextReview ?? Infinity) - (right.nextReview ?? Infinity) ||
        left.id - right.id,
    );

  return { cards: matching.slice(0, DUE_LIMIT), total: matching.length };
};

/**
 * Every card the profile holds that has an estimated review date, each
 * carrying the whole day it falls on.
 *
 * `now` is Unix seconds captured when the page opens, as on `Incoming
 * reviews`: an estimate is only a number of days away from some moment, and
 * reading the clock per render would move cards between buckets while the
 * reader is looking at them.
 *
 * The whole set is read once per profile and the controls re-filter it, as on
 * `Streaks`: the estimate cannot be expressed in SQL without repeating the
 * arithmetic `reviewSchedule.ts` owns, and a keystroke would otherwise re-read
 * the export to answer a question about numbers already in memory.
 *
 * Cards with no usable estimate are counted rather than listed. A card with no
 * score, no last review date or a profile with no usable points per day has no
 * day to sit on, and inventing one would put it in a bar the chart never drew.
 */
export const readDueCandidates = (
  database: Database,
  profile: Profile,
  now: number,
): DueCandidates => {
  if (profile.categoryIds.length === 0) {
    return {
      candidates: [],
      earliestDay: null,
      latestDay: null,
      unknownCards: 0,
      totalCards: 0,
    };
  }

  const table = profile.scorefile?.table ?? null;
  const pointsPerDay = readCardPointsPerDay(database, profile);
  // The membership subquery counts each card once even when several selected
  // categories hold it, and the left join keeps the cards the profile has
  // never reviewed in the total — they are the bulk of what has no estimate.
  const inProfile = `c.id in (select card from pleco_flash_categoryassigns
                              where cat in (${profile.categoryIds.join(", ")}))`;
  const rows = rowsOf(
    database,
    table === null
      ? `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
                c.created, c.modified,
                0, 0, 0, '', null, null, null, null, null
         from pleco_flash_cards c
         where ${inProfile}`
      : `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
                c.created, c.modified,
                s.correct, s.incorrect, s.reviewed, coalesce(s.history, ''),
                s.firstreviewedtime, s.lastreviewedtime,
                s.scoreinctime, s.scoredectime, s.score
         from pleco_flash_cards c
         left join ${table} s on s.card = c.id
         where ${inProfile}`,
  );

  const candidates: DueCard[] = [];
  let earliestDay: number | null = null;
  let latestDay: number | null = null;
  let unknownCards = 0;

  for (const row of rows) {
    const lastReviewed = asTime(row[12] ?? null);
    const nextReview = nextReviewTime(
      asScore(row[15] ?? null),
      lastReviewed,
      pointsPerDay,
    );

    if (nextReview === null) {
      unknownCards += 1;
      continue;
    }

    const day = wholeDaysUntil(nextReview, now);

    candidates.push({
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
      history: asText(row[10] ?? null),
      firstReviewed: asTime(row[11] ?? null),
      lastReviewed,
      scoreIncreased: asTime(row[13] ?? null),
      scoreDecreased: asTime(row[14] ?? null),
      nextReview,
      day,
    });

    earliestDay = earliestDay === null ? day : Math.min(earliestDay, day);
    latestDay = latestDay === null ? day : Math.max(latestDay, day);
  }

  return {
    candidates,
    earliestDay,
    latestDay,
    unknownCards,
    totalCards: rows.length,
  };
};
