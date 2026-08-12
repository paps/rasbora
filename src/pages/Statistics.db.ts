/** The queries behind `Statistics.tsx`, and nothing else. */

import type { Database } from "sql.js";
import { asCount, asText, firstValueOf, rowsOf } from "@/database/plecoFile";

/** Series key of the line counting every card, categorised or not. */
export const TOTAL_SERIES = "total";

/** Series key of the line counting cards that are in no category. */
export const UNCATEGORISED_SERIES = "uncategorised";

/** Series key of the line grouping the categories that did not get their own. */
export const OTHER_SERIES = "other";

/**
 * Categories beyond this many are grouped into one "Other categories" series.
 * A chart with a line per category stops being readable well before that, and
 * an export may hold dozens of them.
 */
const MAX_CATEGORY_SERIES = 6;

export interface CardsOverTimeSeries {
  /** Key under which this series' count appears in every point. */
  key: string;
  /** Name of the series, for the chart legend. */
  label: string;
}

export interface CardsOverTimePoint {
  /** The month these counts describe, as `YYYY-MM`. */
  month: string;
  /** Card count for each series key. Every key is present on every point. */
  counts: Record<string, number>;
}

export interface CardsOverTime {
  series: CardsOverTimeSeries[];
  /** Cards created during each month. */
  monthly: CardsOverTimePoint[];
  /** Cards created up to and including each month. */
  cumulative: CardsOverTimePoint[];
  /** Names of the categories grouped into the "Other categories" series. */
  groupedCategories: string[];
  /** Cards left out because their `created` timestamp is missing or zero. */
  undatedCards: number;
}

/** `YYYY-MM` to a month number, so that ranges can be iterated over. */
const monthToIndex = (month: string): number => {
  const [year, ordinal] = month.split("-");

  return Number(year) * 12 + (Number(ordinal) - 1);
};

const indexToMonth = (index: number): string =>
  `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(
    (index % 12) + 1,
  ).padStart(2, "0")}`;

/**
 * A card's creation month, computed by SQLite so that the counting happens
 * there too. `created` is Unix seconds; rows without one are dropped, since
 * they cannot be placed on a time axis.
 */
const CREATED_MONTH = "strftime('%Y-%m', c.created, 'unixepoch')";

const DATED_CARD = "c.created is not null and c.created > 0";

/**
 * A card only counts towards a category that still exists: assignments
 * outlive the categories they point at, and the export's ids are sparse.
 */
const CATEGORISED_CARD = `
  select 1 from pleco_flash_categoryassigns a
  join pleco_flash_categories t on t.id = a.cat
  where a.card = c.id`;

/** Reads `[key, month, count]` triples into `counts[month][key]`. */
const collect = (
  into: Map<string, Map<string, number>>,
  key: string,
  month: string,
  count: number,
) => {
  const months = into.get(month) ?? new Map<string, number>();

  months.set(key, (months.get(key) ?? 0) + count);
  into.set(month, months);
};

/**
 * Counts cards by the month they were created in, one series per category
 * plus a total and, when there are any, one for cards in no category.
 *
 * Note that the export records no history of category membership, so a card
 * counts towards the categories it is in *now*, at the month it was created
 * in. Cards in several categories count towards each of them, which is why
 * the category lines can add up to more than the total.
 */
export const readCardsOverTime = (database: Database): CardsOverTime => {
  const categoryNames = new Map(
    rowsOf(database, "select id, name from pleco_flash_categories").map(
      (row) => [asCount(row[0] ?? null), asText(row[1] ?? null)] as const,
    ),
  );

  // month -> series key -> count, before the smallest categories are grouped.
  const byMonth = new Map<string, Map<string, number>>();
  const categoryTotals = new Map<number, number>();

  for (const row of rowsOf(
    database,
    `select a.cat, ${CREATED_MONTH} as month, count(*)
     from pleco_flash_cards c
     join pleco_flash_categoryassigns a on a.card = c.id
     join pleco_flash_categories t on t.id = a.cat
     where ${DATED_CARD}
     group by a.cat, month`,
  )) {
    const category = asCount(row[0] ?? null);
    const count = asCount(row[2] ?? null);

    collect(
      byMonth,
      `category-${String(category)}`,
      asText(row[1] ?? null),
      count,
    );
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + count);
  }

  for (const row of rowsOf(
    database,
    `select ${CREATED_MONTH} as month, count(*)
     from pleco_flash_cards c
     where ${DATED_CARD}
     group by month`,
  )) {
    collect(
      byMonth,
      TOTAL_SERIES,
      asText(row[0] ?? null),
      asCount(row[1] ?? null),
    );
  }

  for (const row of rowsOf(
    database,
    `select ${CREATED_MONTH} as month, count(*)
     from pleco_flash_cards c
     where ${DATED_CARD} and not exists (${CATEGORISED_CARD})
     group by month`,
  )) {
    collect(
      byMonth,
      UNCATEGORISED_SERIES,
      asText(row[0] ?? null),
      asCount(row[1] ?? null),
    );
  }

  // The biggest categories keep their own line; the rest share one. Ties break
  // on the category id so that a given export always draws the same chart.
  const ranked = [...categoryTotals.entries()].sort(
    ([leftId, left], [rightId, right]) => right - left || leftId - rightId,
  );
  const named = ranked.slice(0, MAX_CATEGORY_SERIES);
  const grouped = ranked.slice(MAX_CATEGORY_SERIES);
  const groupedKeys = new Set(grouped.map(([id]) => `category-${String(id)}`));

  const series: CardsOverTimeSeries[] = named.map(([id]) => ({
    key: `category-${String(id)}`,
    label: categoryNames.get(id) ?? `Category ${String(id)}`,
  }));

  if (grouped.length > 0) {
    series.push({ key: OTHER_SERIES, label: "Other categories" });
  }

  // A flat line at zero says nothing, so the series is only offered when the
  // export actually has cards outside every category.
  if (
    [...byMonth.values()].some((counts) => counts.has(UNCATEGORISED_SERIES))
  ) {
    series.push({ key: UNCATEGORISED_SERIES, label: "Uncategorised" });
  }

  // Last, so that the chart draws the total on top of the categories it sums:
  // one category usually holds nearly every card, and the two lines overlap.
  series.push({ key: TOTAL_SERIES, label: "All cards" });

  const months = [...byMonth.keys()]
    .map(monthToIndex)
    .sort((left, right) => left - right);
  // An empty export leaves first > last, so the loop below runs no iterations.
  const first = months[0] ?? 0;
  const last = months[months.length - 1] ?? -1;
  const running = new Map<string, number>();
  const monthly: CardsOverTimePoint[] = [];
  const cumulative: CardsOverTimePoint[] = [];

  // Months with no new cards still need a point, or the axis would compress
  // the quiet stretches and the lines would misreport when growth happened.
  for (let index = first; index <= last; index += 1) {
    const month = indexToMonth(index);
    const counts = byMonth.get(month) ?? new Map<string, number>();
    const point: Record<string, number> = {};
    const total: Record<string, number> = {};

    for (const { key } of series) {
      const count =
        key === OTHER_SERIES
          ? [...counts]
              .filter(([countKey]) => groupedKeys.has(countKey))
              .reduce((sum, [, value]) => sum + value, 0)
          : (counts.get(key) ?? 0);

      point[key] = count;
      running.set(key, (running.get(key) ?? 0) + count);
      total[key] = running.get(key) ?? 0;
    }

    monthly.push({ month, counts: point });
    cumulative.push({ month, counts: total });
  }

  return {
    series,
    monthly,
    cumulative,
    groupedCategories: grouped.map(
      ([id]) => categoryNames.get(id) ?? `Category ${String(id)}`,
    ),
    undatedCards: asCount(
      firstValueOf(
        database,
        `select count(*) from pleco_flash_cards c where not (${DATED_CARD})`,
      ),
    ),
  };
};
