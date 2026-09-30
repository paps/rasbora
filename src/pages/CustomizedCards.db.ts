/** The query behind `CustomizedCards.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { nextReviewTime } from "@/database/reviewSchedule";
import {
  isUserDictionaryReference,
  readCardPointsPerDay,
  asCount,
  asText,
  rowsOf,
} from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/** How many cards the page lists; see `Streaks.db.ts` for the reason. */
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

export type CustomizedCardType = "content" | "usr" | "all";

export interface CustomizedCards {
  /** Custom content or USR-linked cards matching the selected type. Capped. */
  cards: FlashcardData[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * Cards with custom content or definitions held in a user dictionary (USR).
 * Inline content takes precedence, making the two filtered groups disjoint.
 * Filter before counting and capping so each view gets its own full total.
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
  type: CustomizedCardType,
): CustomizedCards => {
  const table = profile.scorefile?.table ?? null;
  const pointsPerDay = readCardPointsPerDay(database, profile);

  if (profile.categoryIds.length === 0) {
    return { cards: [], total: 0 };
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
  const scope = `where c.id in (select card from pleco_flash_categoryassigns
                  where cat in (${profile.categoryIds.join(", ")}))`;

  // Read this profile's rows in display order, then classify with the same
  // creator helper and whitespace handling as Flashcard. Applying the limit
  // afterwards prevents one type from crowding the other out of its view.
  const rows = rowsOf(
    database,
    `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
            c.created, c.modified, ${review}, c.dictcreator
     from pleco_flash_cards c
     ${join}
     ${scope}
     order by ${age} is null, ${age}, c.id`,
  ).filter((row) => {
    const hasContent = asText(row[4] ?? null).trim() !== "";
    const isUsr = !hasContent && isUserDictionaryReference(row[16] ?? null);

    return type === "content"
      ? hasContent
      : type === "usr"
        ? isUsr
        : hasContent || isUsr;
  });

  return {
    cards: rows.slice(0, CUSTOMIZED_LIMIT).map((row) => ({
      id: asCount(row[0] ?? null),
      hw: asText(row[1] ?? null),
      althw: asText(row[2] ?? null),
      pron: asText(row[3] ?? null),
      defn: asText(row[4] ?? null),
      hasUserDictionaryReference: isUserDictionaryReference(row[16] ?? null),
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
      nextReview: nextReviewTime(
        asScore(row[15] ?? null),
        asTime(row[12] ?? null),
        pointsPerDay,
      ),
    })),
    total: rows.length,
  };
};
