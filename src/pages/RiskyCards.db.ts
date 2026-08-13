/** The query behind `RiskyCards.tsx`, and the reading of the review log. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { asCount, asText, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `LearnedCards.db.ts` for the reason. */
const RISKY_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/** What the page's two controls mean, in reviews. */
export interface RiskSettings {
  /** How long the run of correct answers has to have been. */
  runLength: number;
  /** How many of the most recent reviews the failure has to be inside. */
  recentWindow: number;
}

/** A card that was going well and then stopped. */
export interface RiskyCard extends FlashcardData {
  /** The run of correct answers the failure broke, in reviews. */
  brokenRun: number;
  /** Reviews since that run ended, the failure among them. */
  reviewsSince: number;
}

export interface RiskyCards {
  /** The cards, worst break first. Capped. */
  cards: RiskyCard[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * Whether a grade counts as a right answer. `4`, `5` and `6` are the correct
 * half of Pleco's six-point scale, and the split is exact rather than
 * approximate: every scorefile's `correct` tally equals the count of those
 * three digits. Anything else — including a digit no export has ever held —
 * reads as not correct.
 */
const isCorrect = (grade: string): boolean =>
  grade === "4" || grade === "5" || grade === "6";

/**
 * What the review log says about a card that has slipped, or null when it has
 * not slipped by these settings.
 *
 * `history` is **newest first**, so index 0 is the most recent review and the
 * search runs forwards into the past: find the oldest failure inside the
 * recent window, then count the unbroken correct answers immediately before
 * it. A card qualifies when that run is long enough — it was known, and then
 * it was not.
 *
 * Taking the *oldest* failure in the window rather than the newest is what
 * makes a widened window include more cards rather than different ones: the
 * run has to have been broken by the first of the recent failures, and
 * anything after it is part of the slipping.
 */
const riskOf = (
  history: string,
  { runLength, recentWindow }: RiskSettings,
): { brokenRun: number; reviewsSince: number } | null => {
  const window = Math.min(recentWindow, history.length);
  let failure = -1;

  for (let index = 0; index < window; index++) {
    if (!isCorrect(history[index] ?? "")) {
      failure = index;
    }
  }

  if (failure < 0) {
    return null;
  }

  let brokenRun = 0;

  // Runs off the end of the string on a card whose whole log is one run, where
  // the missing character reads as not correct and stops the count.
  while (isCorrect(history[failure + 1 + brokenRun] ?? "")) {
    brokenRun += 1;
  }

  return brokenRun >= runLength
    ? { brokenRun, reviewsSince: failure + 1 }
    : null;
};

/**
 * The cards among `candidates` that were known and are now being failed, worst
 * break first: the longest run lost comes first, and a card that broke the
 * same length of run more recently comes before one that broke it long ago.
 *
 * This is a filter over rows already read rather than SQL because the two
 * thresholds are the page's controls: SQLite cannot walk a digit string
 * anyway, and re-reading the export on every keystroke to answer a question
 * about strings already in memory would be the slower way round.
 */
export const selectRiskyCards = (
  candidates: FlashcardData[],
  settings: RiskSettings,
): RiskyCards => {
  const risky = candidates
    .flatMap((card) => {
      const risk = riskOf(card.history, settings);

      return risk === null ? [] : [{ ...card, ...risk }];
    })
    .sort(
      (left, right) =>
        right.brokenRun - left.brokenRun ||
        (right.lastReviewed ?? 0) - (left.lastReviewed ?? 0) ||
        left.id - right.id,
    );

  return { cards: risky.slice(0, RISKY_LIMIT), total: risky.length };
};

/**
 * Every card the profile has both failed and answered correctly, which is as
 * far as SQL can narrow "was going well and then stopped": the rest of the
 * question is the shape of the review log, and `selectRiskyCards` reads that.
 *
 * The whole candidate set is read once, so the page's controls re-filter in
 * memory. It is a few thousand short strings at most — `history` is one digit
 * per review and the longest in this export is 83.
 */
export const readRiskyCandidates = (
  database: Database,
  profile: Profile,
): FlashcardData[] => {
  const table = profile.scorefile?.table ?? null;

  if (table === null || profile.categoryIds.length === 0) {
    return [];
  }

  return rowsOf(
    database,
    `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
            c.created, c.modified,
            s.correct, s.incorrect, s.reviewed, coalesce(s.history, '') as history,
            s.firstreviewedtime, s.lastreviewedtime,
            s.scoreinctime, s.scoredectime
     from pleco_flash_cards c
     join ${table} s on s.card = c.id
     where s.incorrect > 0 and s.correct > 0 and coalesce(s.history, '') <> ''
       and c.id in (select card from pleco_flash_categoryassigns
                    where cat in (${profile.categoryIds.join(", ")}))`,
  ).map((row) => ({
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
    lastReviewed: asTime(row[12] ?? null),
    scoreIncreased: asTime(row[13] ?? null),
    scoreDecreased: asTime(row[14] ?? null),
  }));
};
