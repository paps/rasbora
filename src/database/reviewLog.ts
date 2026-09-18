/**
 * Reading Pleco's review log: what a grade means, and the run of correct
 * answers at the head of it.
 *
 * This is here rather than beside a page for the reason `plecoFile.ts`
 * documents: a per-page version would be *wrong*, not merely repeated. The
 * `Learning distribution` chart counts cards into run buckets and `Streaks`
 * lists the cards in one of them, so the two have to agree exactly — a bar
 * saying 530 that opens a list of 529 is a bug, and two copies of this walk
 * are how that happens. `Lapses` reads the same encoding for its own question.
 *
 * Like `reviewSchedule.ts` it is pure arithmetic over values a query already
 * read, and runs no query itself.
 */

/**
 * Whether a grade counts as a right answer. `4`, `5` and `6` are the correct
 * half of Pleco's six-point scale, and the split is exact rather than
 * approximate: every scorefile's `correct` tally equals the count of those
 * three digits. Anything else — including a digit no export has ever held —
 * reads as not correct.
 */
export const isCorrect = (grade: string): boolean =>
  grade === "4" || grade === "5" || grade === "6";

/**
 * The default a plain right answer records, and the only grade that grows the
 * review interval at the card's full rate.
 *
 * A `4` ("barely remembered") and a `5` ("remembered") are correct, so they
 * extend a run — but `pro_scoreintervalmult4` is 90 against
 * `pro_scoreintervalmult6` at 110, and a `4` also takes `pro_scorediffchange4`
 * off the card's difficulty, which is the very multiplier the interval grows
 * by (`difficulty / pro_scorediffdivisor`). A run of them decays its own
 * multiplier towards the difficulty floor, so the card keeps coming back in
 * weeks while the run grows without bound.
 */
export const isPerfect = (grade: string): boolean => grade === "6";

export interface Run {
  /** Correct answers at the head of the log, counted back to the last failure. */
  length: number;
  /**
   * Whether every one of them was "remembered perfectly". False for a run of
   * zero, which is no run at all: an empty run would answer this vacuously.
   */
  perfect: boolean;
}

/**
 * The run a card is currently on, counted back from its most recent review to
 * the failure that ended the previous run — or to the start of the log, for a
 * card that has never been failed.
 *
 * `history` is **newest first**, so the run is the prefix: index 0 is the last
 * review and the walk stops at the first digit that is not a right answer. A
 * card whose whole log is one run stops by running off the end of the string,
 * where the missing character reads as not correct.
 *
 * Whether every answer in it was perfect is settled in the same walk, since
 * both questions are about the same prefix.
 */
export const runOf = (history: string): Run => {
  let length = 0;
  let perfect = true;

  while (isCorrect(history[length] ?? "")) {
    perfect = perfect && isPerfect(history[length] ?? "");
    length += 1;
  }

  return { length, perfect: length > 0 && perfect };
};
