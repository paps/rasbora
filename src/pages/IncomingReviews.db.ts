/** The daily review estimates behind `IncomingReviews.tsx`. */

import type { Database } from "sql.js";
import { asCount, readCardPointsPerDay, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";
import { nextReviewTime } from "@/database/reviewSchedule";

/** Series keys for estimates that are already due and those still ahead. */
export const DUE_SERIES = "due";
export const UPCOMING_SERIES = "upcoming";

export interface IncomingReviewsDistribution {
  /** Every whole day from the earliest estimate to the latest, including gaps. */
  buckets: {
    day: number;
    [DUE_SERIES]: number;
    [UPCOMING_SERIES]: number;
  }[];
  totalCards: number;
  /** Cards in negative-day buckets: their estimated review time has passed. */
  dueCards: number;
  /** In-scope cards without enough data to estimate a review date. */
  unknownCards: number;
}

export const readIncomingReviews = (
  database: Database,
  profile: Profile,
  now: number,
): IncomingReviewsDistribution => {
  if (profile.categoryIds.length === 0) {
    return { buckets: [], totalCards: 0, dueCards: 0, unknownCards: 0 };
  }

  const table = profile.scorefile?.table ?? null;
  const pointsPerDay = readCardPointsPerDay(database, profile);
  // A left join keeps never-reviewed cards in the total. The membership
  // subquery counts each card once even when several selected categories hold it.
  const rows = rowsOf(
    database,
    table === null
      ? `select null, null, count(*)
         from pleco_flash_cards c
         where c.id in (select card from pleco_flash_categoryassigns
                        where cat in (${profile.categoryIds.join(", ")}))`
      : `select s.score, s.lastreviewedtime, count(*)
         from pleco_flash_cards c
         left join ${table} s on s.card = c.id
         where c.id in (select card from pleco_flash_categoryassigns
                        where cat in (${profile.categoryIds.join(", ")}))
         group by s.score, s.lastreviewedtime`,
  );

  const counts = new Map<number, number>();
  let totalCards = 0;
  let dueCards = 0;
  let unknownCards = 0;
  let firstDay = Infinity;
  let lastDay = -Infinity;

  for (const row of rows) {
    const cards = asCount(row[2] ?? null);
    totalCards += cards;

    const due = nextReviewTime(
      typeof row[0] === "number" ? row[0] : null,
      typeof row[1] === "number" ? row[1] : null,
      pointsPerDay,
    );

    if (due === null) {
      unknownCards += cards;
      continue;
    }

    // `now` is Unix seconds captured when the page opens. Floor preserves
    // overdue signs: -0.2 days belongs to -1; 0 means the next 24 hours.
    const day = Math.floor((due - now) / 86_400);
    counts.set(day, (counts.get(day) ?? 0) + cards);
    if (day < 0) dueCards += cards;
    firstDay = Math.min(firstDay, day);
    lastDay = Math.max(lastDay, day);
  }

  const buckets: IncomingReviewsDistribution["buckets"] = [];
  for (let day = firstDay; day <= lastDay; day += 1) {
    const cards = counts.get(day) ?? 0;
    buckets.push({
      day,
      [DUE_SERIES]: day < 0 ? cards : 0,
      [UPCOMING_SERIES]: day < 0 ? 0 : cards,
    });
  }

  return { buckets, totalCards, dueCards, unknownCards };
};
