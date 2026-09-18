/** The query behind `NewCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { asCount, asText, firstValueOf, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `LearnedCards.db.ts` for the reason. */
const NEW_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

export interface NewCards {
  /** Cards never reviewed, longest waiting first. Capped. */
  cards: FlashcardData[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * The cards the profile holds but has never put in front of the reader.
 *
 * "Never reviewed" is an empty review log rather than a missing scorefile row,
 * because both happen: a card the profile has never shown may have no row at
 * all, or a row Pleco created with nothing in it. `coalesce(s.history, '')`
 * reads the two the same way, which is also how `Learning distribution` counts
 * its first bar — the two have to agree, since that bar links here.
 *
 * A profile with no scorefile has reviewed nothing at all, so every card it
 * draws is new. That is a `where` clause the join cannot express, so it is its
 * own query rather than a null table name interpolated into the other.
 *
 * Oldest first, by when the card was created: with no review state there is no
 * other age to sort on, and the cards that have been waiting longest are the
 * ones worth seeing first. Cards the export never dated sort last, where a zero
 * would otherwise read as 1970 and put unknowns at the top of a list about age.
 */
export const readNewCards = (
  database: Database,
  profile: Profile,
): NewCards => {
  if (profile.categoryIds.length === 0) {
    return { cards: [], total: 0 };
  }

  const table = profile.scorefile?.table ?? null;
  const inProfile = `c.id in (select card from pleco_flash_categoryassigns
                              where cat in (${profile.categoryIds.join(", ")}))`;
  const source =
    table === null
      ? `from pleco_flash_cards c where ${inProfile}`
      : `from pleco_flash_cards c
         left join ${table} s on s.card = c.id
         where coalesce(s.history, '') = '' and ${inProfile}`;
  // Undated cards last rather than first, which is what a bare `order by
  // c.created` would do with a NULL or a zero.
  const oldestFirst = `order by
      case when c.created is null or c.created = 0 then 1 else 0 end,
      c.created, c.id`;

  const cards = rowsOf(
    database,
    `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
            c.created, c.modified
     ${source}
     ${oldestFirst}
     limit ${String(NEW_LIMIT)}`,
  ).map((row) => ({
    id: asCount(row[0] ?? null),
    hw: asText(row[1] ?? null),
    althw: asText(row[2] ?? null),
    pron: asText(row[3] ?? null),
    defn: asText(row[4] ?? null),
    created: asTime(row[5] ?? null),
    modified: asTime(row[6] ?? null),
    // Everything below is what a never-reviewed card has to say for itself:
    // no tallies, no log, no dates, and so no due date to estimate either.
    correct: 0,
    incorrect: 0,
    reviewed: 0,
    history: "",
    firstReviewed: null,
    lastReviewed: null,
    scoreIncreased: null,
    scoreDecreased: null,
    nextReview: null,
  }));

  return {
    cards,
    total: asCount(firstValueOf(database, `select count(*) ${source}`)),
  };
};
