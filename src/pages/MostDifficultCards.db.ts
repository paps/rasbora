/** The query behind `MostDifficultCards.tsx`, and nothing else. */

import type { Database } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { asCount, asText, listScorefiles, rowsOf } from "@/database/plecoFile";

/**
 * How many cards the page shows. "Most difficult" is open-ended; this is the
 * one criterion for now — the cards failed the most often — so the list is
 * capped rather than shown in full.
 */
const MOST_DIFFICULT_LIMIT = 1000;

/**
 * The cards failed most often, hardest first. A card's failures are its
 * `incorrect` reviews summed across every scorefile, because a card carries
 * independent review state in each one and the question is how hard the card
 * is, not how hard it is in one study mode. Cards that have never failed are
 * left out — they are not difficult, and including them would just pad the tail
 * with the whole deck.
 *
 * The scores tables are named after their scorefile id and discovered at
 * runtime; their names are safe to interpolate because they come from the table
 * list, not from user input.
 */
export const readMostDifficultCards = (database: Database): FlashcardData[] => {
  const tables = listScorefiles(database)
    .map((scorefile) => scorefile.table)
    .filter((table) => table !== null);

  if (tables.length === 0) {
    return [];
  }

  const reviewState = tables
    .map((table) => `select card, correct, incorrect, reviewed from ${table}`)
    .join(" union all ");

  return rowsOf(
    database,
    `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
            sum(s.correct) as correct,
            sum(s.incorrect) as incorrect,
            sum(s.reviewed) as reviewed
     from pleco_flash_cards c
     join (${reviewState}) s on s.card = c.id
     group by c.id
     having sum(s.incorrect) > 0
     order by sum(s.incorrect) desc, sum(s.reviewed) desc, c.id
     limit ${String(MOST_DIFFICULT_LIMIT)}`,
  ).map((row) => ({
    id: asCount(row[0] ?? null),
    hw: asText(row[1] ?? null),
    althw: asText(row[2] ?? null),
    pron: asText(row[3] ?? null),
    defn: asText(row[4] ?? null),
    correct: asCount(row[5] ?? null),
    incorrect: asCount(row[6] ?? null),
    reviewed: asCount(row[7] ?? null),
  }));
};
