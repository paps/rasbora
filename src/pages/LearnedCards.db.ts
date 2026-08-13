/** The query behind `LearnedCards.tsx`, and nothing else. */

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

/**
 * How many cards the page lists. A profile can have thousands of cards at the
 * ceiling — a third of this export's deck — so the list is capped and the page
 * says what the cap left out.
 */
const LEARNED_LIMIT = 1000;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/** A score column, or null when the scorefile holds none for the card. */
const asScore = (value: SqlValue | null): number | null =>
  typeof value === "number" ? value : null;

export interface LearnedCards {
  /**
   * The bounds this profile scores against. Its `max` is the ceiling that
   * defines the page; null when the profile records none, which is the one
   * case where the page cannot say what "learned" means.
   */
  scoreRange: ScoreRange | null;
  /** Cards at the ceiling, longest since last reviewed first. Capped. */
  cards: CardListData[];
  /** How many there are in all, which may be more than were returned. */
  total: number;
}

/**
 * The cards the profile has finished with: those whose score has reached the
 * profile's own maximum, so Pleco has nowhere further to push them and they
 * come back as rarely as this profile ever shows a card.
 *
 * The ceiling is read from the profile rather than assumed. `pro_scoreautomax`
 * is 51,200 in every export seen so far, but it is configuration, and a
 * hardcoded bound would quietly list nothing for a profile that lowered it.
 *
 * Oldest first means longest since the profile last put the card in front of
 * the user: the export has no per-review dates, so `lastreviewedtime` is the
 * only "when" a saturated card carries. Cards the scorefile never dated sort
 * last rather than first, where a zero would read as 1970 and put unknowns at
 * the top of a list that is about age.
 */
export const readLearnedCards = (
  database: Database,
  profile: Profile,
): LearnedCards => {
  const table = profile.scorefile?.table ?? null;
  const scoreRange = readScoreRange(database, profile);
  const ceiling = scoreRange?.max ?? null;

  if (table === null || ceiling === null || profile.categoryIds.length === 0) {
    return { scoreRange, cards: [], total: 0 };
  }

  const scope = `where s.score >= ?
     and c.id in (select card from pleco_flash_categoryassigns
                  where cat in (${profile.categoryIds.join(", ")}))`;

  return {
    scoreRange,
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
       limit ${String(LEARNED_LIMIT)}`,
      [ceiling],
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
        `select count(*) from pleco_flash_cards c
         join ${table} s on s.card = c.id
         ${scope}`,
        [ceiling],
      ),
    ),
  };
};
