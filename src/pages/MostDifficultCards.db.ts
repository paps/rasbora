/** The query behind `MostDifficultCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { asCount, asText, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/**
 * How many cards the page shows. "Most difficult" is open-ended; this is the
 * one criterion for now — the cards failed the most often — so the list is
 * capped rather than shown in full.
 */
const MOST_DIFFICULT_LIMIT = 1000;

/**
 * A Unix-seconds column as a timestamp, or null when missing or zero. Pleco
 * leaves a timestamp at 0 as readily as it leaves it NULL, and both mean "this
 * never happened" rather than "January 1970".
 */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/**
 * The cards the profile has failed most often, hardest first.
 *
 * Difficulty is asked of one profile, never of the export: a card carries
 * independent review state in every scorefile, and the profile says which one
 * counts. Cards outside the profile's categories are left out even when they
 * have review state, since the profile never puts them in front of the user.
 * Cards that have never failed are left out too — they are not difficult, and
 * they would pad the tail with the whole deck.
 *
 * The review log and the four review timestamps come from that same scorefile
 * row, so they describe the card as this profile has studied it; `created` and
 * `modified` are the card's own and are the same under every profile.
 *
 * The scores table is named after its scorefile id and discovered at runtime;
 * its name is safe to interpolate because it comes from the table list, and so
 * are the category ids, which `listProfiles` resolved to integers.
 */
export const readMostDifficultCards = (
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
     where s.incorrect > 0
       and c.id in (select card from pleco_flash_categoryassigns
                    where cat in (${profile.categoryIds.join(", ")}))
     order by s.incorrect desc, s.reviewed desc, c.id
     limit ${String(MOST_DIFFICULT_LIMIT)}`,
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
