/** Tenths below ten days, whole days beyond; retain the overdue sign near zero. */
export const formatDays = (days: number | null): string => {
  if (days === null || !Number.isFinite(days)) return "—";

  const magnitude = Math.abs(days);
  if (magnitude > 0 && magnitude < 0.1) {
    return `${days < 0 ? "-" : ""}<${(0.1).toLocaleString()} days`;
  }

  const precision = magnitude < 10 ? 10 : 1;
  const rounded = Math.round(magnitude * precision) / precision;
  return `${days < 0 ? "-" : ""}${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${rounded === 1 ? "day" : "days"}`;
};
