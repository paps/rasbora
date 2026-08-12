/** The queries behind `LoadFlashcards.tsx`, and nothing else. */

import type { Database } from "sql.js";
import {
  asCount,
  asText,
  firstValueOf,
  listScorefiles,
  readProperty,
  rowsOf,
} from "@/database/plecoFile";

export interface ScorefileSummary {
  id: number;
  name: string;
  reviewedCards: number;
}

export interface PlecoSummary {
  formatVersion: string;
  platform: string;
  cardCount: number;
  categoryCount: number;
  profiles: string[];
  scorefiles: ScorefileSummary[];
}

/**
 * How many cards a scorefile holds review state for. A scorefile whose table
 * is missing counts as having no reviews instead of failing.
 */
const countReviewedCards = (
  database: Database,
  table: string | null,
): number =>
  table === null
    ? 0
    : asCount(firstValueOf(database, `select count(*) from ${table}`));

/** Reads enough of an export to show that it was parsed correctly. */
export const readSummary = (database: Database): PlecoSummary => ({
  formatVersion: readProperty(database, "FormatVersion"),
  platform: readProperty(database, "FilePlatform"),
  cardCount: asCount(
    firstValueOf(database, "select count(*) from pleco_flash_cards"),
  ),
  categoryCount: asCount(
    firstValueOf(database, "select count(*) from pleco_flash_categories"),
  ),
  profiles: rowsOf(
    database,
    "select name from pleco_flash_profiles order by sort",
  ).map((row) => asText(row[0] ?? null)),
  scorefiles: listScorefiles(database).map((scorefile) => ({
    id: scorefile.id,
    name: scorefile.name,
    reviewedCards: countReviewedCards(database, scorefile.table),
  })),
});
