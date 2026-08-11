import initSqlJs from "sql.js";
import type { BindParams, Database, SqlJsStatic, SqlValue } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm-browser.wasm?url";

/** Value of the `FormatString` property that identifies a Pleco export. */
const PLECO_FORMAT_STRING = "Pleco SQL Flashcard Database";

/**
 * sql.js compiles its WebAssembly module on first use, so the promise is kept
 * around and reused rather than recompiling on every import.
 */
let sqlJs: Promise<SqlJsStatic> | undefined;

const loadSqlJs = () => {
  sqlJs ??= initSqlJs({ locateFile: () => wasmUrl });
  return sqlJs;
};

const rowsOf = (
  database: Database,
  sql: string,
  params?: BindParams,
): SqlValue[][] => database.exec(sql, params)[0]?.values ?? [];

const firstValueOf = (
  database: Database,
  sql: string,
  params?: BindParams,
): SqlValue | null => rowsOf(database, sql, params)[0]?.[0] ?? null;

/** SQLite columns are dynamically typed, so every read is narrowed by hand. */
const asText = (value: SqlValue | null): string => {
  if (typeof value === "string") {
    return value;
  }

  return typeof value === "number" ? String(value) : "";
};

const asCount = (value: SqlValue | null): number =>
  typeof value === "number" ? value : 0;

const readProperty = (database: Database, propid: string): string =>
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
 * Review state lives in one table per scorefile, named after that scorefile's
 * id (`pleco_flash_scores_4`, …), so the tables have to be discovered at
 * runtime rather than hardcoded. See `pleco-export-format.md`. A scorefile
 * whose table is missing counts as having no reviews instead of failing.
 */
const readScorefiles = (database: Database): ScorefileSummary[] => {
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
      // The id is a SQLite integer; table names cannot be bound as parameters.
      const table = `pleco_flash_scores_${String(scorefile.id)}`;

      return {
        ...scorefile,
        reviewedCards: tables.has(table)
          ? asCount(firstValueOf(database, `select count(*) from ${table}`))
          : 0,
      };
    });
};

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
  scorefiles: readScorefiles(database),
});
