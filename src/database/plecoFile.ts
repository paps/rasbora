/**
 * Everything that is true of *any* Pleco export, whatever page is looking at
 * it: opening the file, getting typed values out of sql.js, and finding the
 * tables whose names are not fixed.
 *
 * Queries that answer one page's question live in that page's `*.db.ts`
 * companion, which imports from here. Being useful to several pages is not a
 * reason to move something in — two pages asking similar questions will drift
 * as each question sharpens, and that is easier when they were never joined.
 * Copy the query instead.
 *
 * What is here is here because a per-page version would be *wrong*, not merely
 * repeated: sql.js needs exactly one WebAssembly compilation, a NULL has to
 * mean the same thing on every page, and a hand-written score table name
 * quietly answers for one scorefile instead of all of them.
 *
 * `pleco-export-format.md` describes the schema and lists the traps. It is
 * still the authority; this file only implements the traps that are too easy
 * to walk into by hand.
 */

import initSqlJs from "sql.js";
import type { BindParams, Database, SqlJsStatic, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";

/* -------------------------------------------------------------------------
 * Reading values out of sql.js
 *
 * `database.exec()` returns results as `SqlValue[][]` — SQLite columns are
 * dynamically typed, so every read has to be narrowed by hand. These four
 * helpers are that narrowing, and they are shared so that a NULL means the
 * same thing on every page.
 * ---------------------------------------------------------------------- */

/** All rows of the first result set, or none if the statement returned none. */
export const rowsOf = (
  database: Database,
  sql: string,
  params?: BindParams,
): SqlValue[][] => database.exec(sql, params)[0]?.values ?? [];

/** The first column of the first row, for `count(*)` and friends. */
export const firstValueOf = (
  database: Database,
  sql: string,
  params?: BindParams,
): SqlValue | null => rowsOf(database, sql, params)[0]?.[0] ?? null;

/** Reads a value as text. NULL and blobs come back as an empty string. */
export const asText = (value: SqlValue | null): string => {
  if (typeof value === "string") {
    return value;
  }

  return typeof value === "number" ? String(value) : "";
};

/** Reads a value as a number. NULL and anything non-numeric come back as 0. */
export const asCount = (value: SqlValue | null): number =>
  typeof value === "number" ? value : 0;

/* -------------------------------------------------------------------------
 * Opening an export
 *
 * A `.pqb` is a plain SQLite database that identifies itself through
 * `pleco_flash_properties`. sql.js compiles its WebAssembly module on first
 * use, so the whole app shares one compilation.
 * ---------------------------------------------------------------------- */

/** Value of the `FormatString` property that identifies a Pleco export. */
const PLECO_FORMAT_STRING = "Pleco SQL Flashcard Database";

let sqlJs: Promise<SqlJsStatic> | undefined;

const loadSqlJs = () => {
  sqlJs ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlJs;
};

/** Reads one row of `pleco_flash_properties`, the export's own metadata. */
export const readProperty = (database: Database, propid: string): string =>
  asText(
    firstValueOf(
      database,
      "select propvalue from pleco_flash_properties where propid = ?",
      [propid],
    ),
  );

/**
 * Returns the export's `FormatString`, or null when the file cannot be read as
 * a Pleco database at all — either it is not SQLite, or it has no properties
 * table. sql.js only reports both cases when a statement is executed.
 */
const readFormatString = (database: Database): string | null => {
  try {
    return readProperty(database, "FormatString");
  } catch {
    return null;
  }
};

/**
 * Opens a Pleco flashcard export. The returned database is held in memory and
 * should be closed once it is no longer needed.
 *
 * @throws if the file is not a Pleco export.
 */
export const openPlecoDatabase = async (file: File): Promise<Database> => {
  const SQL = await loadSqlJs();
  const database = new SQL.Database(new Uint8Array(await file.arrayBuffer()));

  if (readFormatString(database) !== PLECO_FORMAT_STRING) {
    database.close();
    throw new Error(`"${file.name}" is not a Pleco flashcard export.`);
  }

  return database;
};

/* -------------------------------------------------------------------------
 * Score tables
 *
 * Review state — score, difficulty, the per-review history — does not live in
 * one table. It lives in `pleco_flash_scores_<N>`, one per scorefile, named
 * after that scorefile's id. Ids are sparse, so the tables must be discovered
 * at runtime and **never hardcoded**: writing `pleco_flash_scores_1` by hand
 * silently ignores every other scorefile rather than failing.
 *
 * This is shared because more than one page reads review state, and because
 * getting it wrong produces a plausible-looking wrong number.
 * ---------------------------------------------------------------------- */

export interface Scorefile {
  id: number;
  name: string;
  /**
   * Name of this scorefile's scores table, or null when the export does not
   * contain one. Safe to interpolate into SQL: it comes from the table list,
   * not from user input, and table names cannot be bound as parameters.
   */
  table: string | null;
}

/** Every scorefile in the export, in the order Pleco shows them. */
export const listScorefiles = (database: Database): Scorefile[] => {
  const tables = new Set(
    rowsOf(database, "select name from sqlite_master where type = 'table'").map(
      (row) => asText(row[0] ?? null),
    ),
  );

  return rowsOf(
    database,
    "select id, name from pleco_flash_scorefiles order by sort",
  )
    .map((row) => ({
      id: asCount(row[0] ?? null),
      name: asText(row[1] ?? null),
    }))
    .filter((scorefile) => Number.isInteger(scorefile.id))
    .map((scorefile) => {
      const table = `pleco_flash_scores_${String(scorefile.id)}`;

      return { ...scorefile, table: tables.has(table) ? table : null };
    });
};
