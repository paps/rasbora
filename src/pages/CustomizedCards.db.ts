/** The query behind `CustomizedCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { CardListData } from "@/components/CardList";
import {
  asCount,
  asText,
  firstValueOf,
  readScoreRange,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile, ScoreRange } from "@/database/plecoFile";

/** How many cards the page lists; see `LearnedCards.db.ts` for the reason. */
const CUSTOMIZED_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/**
 * A score column, or null when there is none — which on this page is a real
 * case rather than a defensive one: the scorefile is joined in rather than
 * required, so a card the profile has never reviewed reaches the list.
 */
const asScore = (value: SqlValue | null): number | null =>
  typeof value === "number" ? value : null;

export interface CustomizedCards {
  /** Cards with a definition of the user's own. Capped. */
  cards: CardListData[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
  /** The bounds the list draws its score bars against. */
  scoreRange: ScoreRange | null;
}

/**
 * The cards the user has written a definition on. Pleco leaves `defn` NULL on
 * a card that only points at its own dictionary — 97.6% of this export — so a
 * card with text here is one the user typed something into, and that text is
 * the only meaning the export carries at all.
 *
 * A definition belongs to the card rather than to a scorefile, so the review
 * state is joined in rather than required: a card the profile has never put in
 * front of the user still has whatever the user wrote on it. That is also why
 * a profile with no scorefile still gets a list here where the other card
 * pages have nothing to say — only the review columns go missing.
 *
 * The scope is still the profile's, since a definition on a card this profile
 * never reviews is not this profile's business, and the ordering matches the
 * other lists: longest since last reviewed first, falling back to when the
 * card itself was last edited for one the profile has never reviewed.
 */
export const readCustomizedCards = (
  database: Database,
  profile: Profile,
): CustomizedCards => {
  const table = profile.scorefile?.table ?? null;
  const scoreRange = readScoreRange(database, profile);

  if (profile.categoryIds.length === 0) {
    return { cards: [], total: 0, scoreRange };
  }

  // Without a scorefile there is no `s` to read, so the review columns are
  // written as the empty state `asCount` and `asTime` would give them anyway.
  const join = table === null ? "" : `left join ${table} s on s.card = c.id`;
  const review =
    table === null
      ? `0, 0, 0, '', null, null, null, null, null`
      : `s.correct, s.incorrect, s.reviewed, coalesce(s.history, ''),
         s.firstreviewedtime, s.lastreviewedtime,
         s.scoreinctime, s.scoredectime, s.score`;
  const age =
    table === null
      ? "nullif(c.modified, 0)"
      : "coalesce(nullif(s.lastreviewedtime, 0), nullif(c.modified, 0))";
  const scope = `where trim(coalesce(c.defn, '')) <> ''
     and c.id in (select card from pleco_flash_categoryassigns
                  where cat in (${profile.categoryIds.join(", ")}))`;

  return {
    cards: rowsOf(
      database,
      `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
              c.created, c.modified, ${review}
       from pleco_flash_cards c
       ${join}
       ${scope}
       order by ${age} is null, ${age}, c.id
       limit ${String(CUSTOMIZED_LIMIT)}`,
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
      score: asScore(row[15] ?? null),
    })),
    total: asCount(
      firstValueOf(
        database,
        `select count(*) from pleco_flash_cards c ${scope}`,
      ),
    ),
    scoreRange,
  };
};
