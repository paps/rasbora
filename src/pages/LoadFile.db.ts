/** The queries behind `LoadFile.tsx`, and nothing else. */

import type { Database } from "sql.js";
import {
  asCount,
  firstValueOf,
  listScorefiles,
  readProperty,
} from "@/database/plecoFile";

export interface FileScorefile {
  id: number;
  name: string;
  reviewedCards: number;
}

export interface FileSummary {
  formatVersion: string;
  platform: string;
  generator: string;
  created: number | null;
  cardCount: number;
  categoryCount: number;
  profileCount: number;
  scorefiles: FileScorefile[];
}

/**
 * A timestamp out of `pleco_flash_properties`, whose values are all TEXT —
 * unlike the profile columns, which really are integers.
 */
const readTimeProperty = (
  database: Database,
  propid: string,
): number | null => {
  const seconds = Number(readProperty(database, propid));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

/**
 * How many cards a scores table holds state for. A scorefile whose table is
 * missing counts as having no reviews instead of failing.
 */
const countRows = (database: Database, table: string | null): number =>
  table === null
    ? 0
    : asCount(firstValueOf(database, `select count(*) from ${table}`));

/**
 * The facts that belong to the imported file rather than to any profile: how
 * it was written, what is in it, and what review state it carries.
 *
 * This is the one query in the app that is deliberately **not** read through a
 * profile, and the only one that ever should be. Everything else answers for
 * one profile; these numbers are the file's, and the page they are on is about
 * the file.
 */
export const readFileSummary = (database: Database): FileSummary => ({
  formatVersion: readProperty(database, "FormatVersion"),
  platform: readProperty(database, "FilePlatform"),
  generator: readProperty(database, "FileGenerator"),
  created: readTimeProperty(database, "FileCreated"),
  cardCount: asCount(
    firstValueOf(database, "select count(*) from pleco_flash_cards"),
  ),
  categoryCount: asCount(
    firstValueOf(database, "select count(*) from pleco_flash_categories"),
  ),
  profileCount: asCount(
    firstValueOf(database, "select count(*) from pleco_flash_profiles"),
  ),
  scorefiles: listScorefiles(database).map((scorefile) => ({
    id: scorefile.id,
    name: scorefile.name,
    reviewedCards: countRows(database, scorefile.table),
  })),
});
