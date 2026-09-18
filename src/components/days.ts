/** Fractional days, retaining the sign even within a tenth of a day of due. */
export const formatDays = (days: number | null): string => {
  if (days === null || !Number.isFinite(days)) return "—";

  const magnitude = Math.abs(days);
  if (magnitude > 0 && magnitude < 0.1) {
    return `${days < 0 ? "-" : ""}<${(0.1).toLocaleString()} days`;
  }

  const rounded = Math.round(magnitude * 10) / 10;
  return `${days < 0 ? "-" : ""}${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${rounded === 1 ? "day" : "days"}`;
};
