/** Convert a score using this profile's points per day, never a default rate. */
export const scoreToDays = (
  score: number | null,
  pointsPerDay: number | null,
): number | null => {
  if (
    score === null ||
    !Number.isFinite(score) ||
    score < 0 ||
    pointsPerDay === null ||
    !Number.isFinite(pointsPerDay) ||
    pointsPerDay <= 0
  ) {
    return null;
  }

  const days = score / pointsPerDay;
  return Number.isFinite(days) ? days : null;
};

/** Estimated due time in Unix seconds. Zero/missing review dates are unknown. */
export const nextReviewTime = (
  score: number | null,
  lastReviewed: number | null,
  pointsPerDay: number | null,
): number | null => {
  const days = scoreToDays(score, pointsPerDay);
  if (
    days === null ||
    lastReviewed === null ||
    !Number.isFinite(lastReviewed) ||
    lastReviewed <= 0
  ) {
    return null;
  }

  const due = lastReviewed + days * 86_400;
  // Keep the timestamp representable by the browser's Date for its tooltip.
  return Number.isFinite(due) && due <= 8_640_000_000_000 ? due : null;
};

/**
 * Whole days from `now` until an estimated due time, rounded **down** so an
 * overdue card keeps its sign: -0.2 days belongs to -1, and 0 means the next
 * 24 hours rather than "already due".
 *
 * It is here rather than in either page for the reason `runOf` is in
 * `reviewLog.ts`: `Incoming reviews` counts cards into these buckets and
 * `Due cards` lists the cards in one of them, so a bar saying 530 that opens a
 * list of 529 is a bug, and two copies of this one line are exactly how it
 * happens. Both pages read their own clock on mount, so a card sitting on a
 * day boundary can still move a bucket between the two — that is the same
 * "the clock is read when the display mounts" rule every countdown follows,
 * and both pages say they recalculate when opened.
 */
export const wholeDaysUntil = (due: number, now: number): number =>
  Math.floor((due - now) / 86_400);
