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
