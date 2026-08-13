/** The queries behind `ProfileInfo.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import {
  asCount,
  asText,
  firstValueOf,
  listScorefiles,
  readProperty,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

export interface ProfileCategory {
  id: number;
  name: string;
  /** Cards assigned to this category, whatever profile is looking. */
  cardCount: number;
}

export interface ProfileSetting {
  /** The `propid`, as Pleco names it — `pro_cardcount` and friends. */
  key: string;
  value: string;
}

export interface ProfileDetails {
  created: number | null;
  modified: number | null;
  lastSessionStart: number | null;
  lastSessionEnd: number | null;
  /** Name of the scorefile this profile reviews into, if it has one. */
  scorefileName: string | null;
  /** Cards the scorefile holds review state for. */
  scoredCards: number;
  /** The categories the profile draws from, parents and descendants alike. */
  categories: ProfileCategory[];
  /** Distinct cards across those categories — the profile's whole deck. */
  cardCount: number;
  /** Every setting of the profile, `propid` order. Around 150 of them. */
  settings: ProfileSetting[];
}

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

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

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
 * Everything the export records about one profile: when it was used, what it
 * reviews into, what it draws from, and its full settings bag.
 *
 * The category ids are interpolated rather than bound because they are
 * integers resolved by `listProfiles`, and a bound parameter cannot stand in
 * for a list.
 */
export const readProfileDetails = (
  database: Database,
  profile: Profile,
): ProfileDetails => {
  const row =
    rowsOf(
      database,
      "select created, modified, laststart, lastend from pleco_flash_profiles where id = ?",
      [profile.id],
    )[0] ?? [];
  const categoryIds = profile.categoryIds.join(", ");

  return {
    created: asTime(row[0] ?? null),
    modified: asTime(row[1] ?? null),
    lastSessionStart: asTime(row[2] ?? null),
    lastSessionEnd: asTime(row[3] ?? null),
    scorefileName: profile.scorefile?.name ?? null,
    scoredCards: countRows(database, profile.scorefile?.table ?? null),
    categories:
      profile.categoryIds.length === 0
        ? []
        : rowsOf(
            database,
            `select t.id, t.name, count(a.card)
             from pleco_flash_categories t
             left join pleco_flash_categoryassigns a on a.cat = t.id
             where t.id in (${categoryIds})
             group by t.id
             order by t.sort, t.id`,
          ).map((category) => ({
            id: asCount(category[0] ?? null),
            name: asText(category[1] ?? null),
            cardCount: asCount(category[2] ?? null),
          })),
    cardCount:
      profile.categoryIds.length === 0
        ? 0
        : asCount(
            firstValueOf(
              database,
              `select count(distinct card) from pleco_flash_categoryassigns
               where cat in (${categoryIds})`,
            ),
          ),
    settings: rowsOf(
      database,
      "select propid, propvalue from pleco_flash_profilesettings where propset = ? order by propid",
      [profile.id],
    ).map((setting) => ({
      key: asText(setting[0] ?? null),
      value: asText(setting[1] ?? null),
    })),
  };
};

/** The facts that belong to the imported file rather than to any profile. */
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
