/** The queries behind `AlmostLearnedCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import {
  asCount,
  asText,
  firstValueOf,
  readProfileSetting,
  readSettingNumbers,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `LearnedCards.db.ts` for the reason. */
const ALMOST_LEARNED_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/**
 * A card in the top band, with the score that put it there. `FlashcardData`
 * leaves `score` out because the number means nothing on its own; the page
 * shows the two bounds beside it, which is what makes it readable here.
 */
export interface AlmostLearnedCard extends FlashcardData {
  score: number;
}

export interface AlmostLearnedCards {
  /** Where the profile's longest review interval starts. Null if unknown. */
  threshold: number | null;
  /** The profile's `pro_scoreautomax`, above which a card is learned. */
  ceiling: number | null;
  /** Cards in that band, longest since last reviewed first. Capped. */
  cards: AlmostLearnedCard[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * Where the profile's top score band begins: the last threshold of its
 * `pro_scorefilter_*_starts` settings, which are the score buckets Pleco
 * spaces reviews by. A card above it is in the band that comes back least
 * often without being finished.
 *
 * There are five of those settings, one per test type (free, multi, review,
 * self, tones), and the profile does not say which one a session runs —
 * `pro_type` is the only candidate and reads the same value on every profile
 * seen so far, so its mapping to the five names is unverified. The highest of
 * the five is taken instead: identical to any other choice while the user has
 * not set them apart, and the conservative reading when they have, since a
 * card past it is in the top bucket whichever test type runs.
 */
const readTopBandStart = (
  database: Database,
  profile: Profile,
): number | null => {
  const starts = rowsOf(
    database,
    `select propvalue from pleco_flash_profilesettings
     where propset = ? and propid like 'pro\\_scorefilter\\_%\\_starts' escape '\\'`,
    [profile.id],
  ).flatMap((row) => {
    const bands = readSettingNumbers(asText(row[0] ?? null));
    const top = bands[bands.length - 1];

    return top === undefined ? [] : [top];
  });

  return starts.length === 0 ? null : Math.max(...starts);
};

/**
 * The cards the profile has nearly finished with: in its top score band, but
 * not yet at the ceiling that would make them learned. They still come back,
 * at the longest interval the profile has, which is what makes them the ones
 * worth watching — a failure here costs the most.
 *
 * Both bounds come from the profile's own settings, and the page says so: the
 * same card is "almost learned" under one profile and freshly seen under
 * another. Ordering matches the learned list — longest since last reviewed
 * first, undated cards last.
 */
export const readAlmostLearnedCards = (
  database: Database,
  profile: Profile,
): AlmostLearnedCards => {
  const table = profile.scorefile?.table ?? null;
  const threshold = readTopBandStart(database, profile);
  const ceiling =
    readSettingNumbers(
      readProfileSetting(database, profile.id, "pro_scoreautomax"),
    )[0] ?? null;

  if (
    table === null ||
    threshold === null ||
    ceiling === null ||
    profile.categoryIds.length === 0
  ) {
    return { threshold, ceiling, cards: [], total: 0 };
  }

  const scope = `where s.score >= ? and s.score < ?
     and c.id in (select card from pleco_flash_categoryassigns
                  where cat in (${profile.categoryIds.join(", ")}))`;

  return {
    threshold,
    ceiling,
    cards: rowsOf(
      database,
      `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
              c.created, c.modified,
              s.correct, s.incorrect, s.reviewed, coalesce(s.history, '') as history,
              s.firstreviewedtime, s.lastreviewedtime,
              s.scoreinctime, s.scoredectime, s.score
       from pleco_flash_cards c
       join ${table} s on s.card = c.id
       ${scope}
       order by nullif(s.lastreviewedtime, 0) is null,
                nullif(s.lastreviewedtime, 0), c.id
       limit ${String(ALMOST_LEARNED_LIMIT)}`,
      [threshold, ceiling],
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
      score: asCount(row[15] ?? null),
    })),
    total: asCount(
      firstValueOf(
        database,
        `select count(*) from pleco_flash_cards c
         join ${table} s on s.card = c.id
         ${scope}`,
        [threshold, ceiling],
      ),
    ),
  };
};
