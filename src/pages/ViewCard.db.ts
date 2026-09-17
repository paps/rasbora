/** The search behind `ViewCard.tsx`, and nothing else. */

import type { Database, SqlValue } from "sql.js";
import type { FlashcardData } from "@/components/Flashcard";
import { asCount, asText, firstValueOf, rowsOf } from "@/database/plecoFile";
import type { Profile } from "@/database/plecoFile";

/**
 * How many cards the page shows. Three, because the page is for reading *a*
 * card rather than a list of them — the whole display is shown for each hit, so
 * a fourth would push the first off the screen. A search that matches more says
 * so and asks for a narrower one; it does not quietly show the first three of
 * fifty.
 */
export const VIEW_CARD_LIMIT = 3;

/** A Unix-seconds column as a timestamp, or null when missing or zero. */
const asTime = (value: SqlValue | null): number | null => {
  const seconds = asCount(value);

  return seconds > 0 ? seconds : null;
};

/* -------------------------------------------------------------------------
 * Reducing a reading to something a typed query can meet
 *
 * `pron` is numbered pinyin, `@`-separated by syllable, and carries Pleco's
 * own notation around the edges: `ping2@chang2`, but also `you1-`, `ru4, `,
 * `bao4//@ming2` and the odd `…`. A reader types `ping chang`, `píng cháng` or
 * `pingchang`, and none of those is that string.
 *
 * So both sides are reduced to the same shape, and there are two of them:
 *
 * - **toneless** — letters only, lowercase, `ü` folded to `u`: `pingchang`.
 *   This is what every query matches against, so typing no tones at all works.
 * - **numbered** — the same, but keeping the tone digits: `ping2chang2`. Used
 *   *in addition* when the query carried tones, so that they narrow rather
 *   than merely being tolerated.
 *
 * `ü` folds to `u` on both sides, so `lu` finds 綠 as well as 路. That is a
 * deliberate widening: a reader who cannot type `ü` should not be shut out of
 * the cards that need it.
 *
 * Note this is *not* `canonicalPinyin()` from `src/cc-cedict/context.ts`, and
 * must not be merged with it. That one is one half of a contract with
 * `cc-cedict/build.mjs` — the two have to agree exactly or the dictionary join
 * stops resolving — and it keeps syllable spacing, which a substring search
 * has to drop. Two reducers with two different jobs.
 * ---------------------------------------------------------------------- */

/**
 * What is dropped from a stored reading before it is matched: Pleco's
 * separator, its separable-word marker, and the punctuation it hangs off the
 * end of a syllable. The characters here are the complete non-letter set found
 * in `pron` across the sample export, `ü` and the tone digits aside.
 */
const PRON_NOISE = ["@", "/", "-", ",", " ", "…"];

/** The tone digits, dropped for the toneless form and kept for the other. */
const TONE_DIGITS = ["1", "2", "3", "4", "5"];

/**
 * SQL that reduces a reading column to one of the two forms above.
 *
 * Built rather than written out because it is a dozen nested `replace()` calls
 * either way, and the two forms differ only in whether the digits are among
 * what is dropped. SQLite has no regex and `lower()` leaves `ü` alone, which is
 * why that one is a fold rather than part of the strip.
 */
const readingSql = (column: string, withTones: boolean): string => {
  const dropped = withTones ? PRON_NOISE : [...PRON_NOISE, ...TONE_DIGITS];
  const stripped = dropped.reduce(
    (sql, char) => `replace(${sql}, '${char}', '')`,
    `lower(${column})`,
  );

  return `replace(${stripped}, 'ü', 'u')`;
};

/** A headword column with Pleco's syllable separator taken out. */
const headwordSql = (column: string): string => `replace(${column}, '@', '')`;

/**
 * Plain vowel and the four toned forms of it, first tone first — the same table
 * `chinese.ts` holds, read the other way round. It is duplicated rather than
 * imported because that file exports a component's helper set for rendering and
 * this is the inverse mapping, wanted only here; the two are small, literal and
 * independently obvious.
 *
 * `ǖǘǚǜ` folds onto `u` alongside `ūúǔù`, matching the `ü` fold on the SQL side.
 */
const TONED_VOWELS: { plain: string; marked: string[] }[] = [
  { plain: "a", marked: ["ā", "á", "ǎ", "à"] },
  { plain: "e", marked: ["ē", "é", "ě", "è"] },
  { plain: "i", marked: ["ī", "í", "ǐ", "ì"] },
  { plain: "o", marked: ["ō", "ó", "ǒ", "ò"] },
  { plain: "u", marked: ["ū", "ú", "ǔ", "ù"] },
  { plain: "u", marked: ["ǖ", "ǘ", "ǚ", "ǜ"] },
];

interface Vowel {
  /** The letter the mark sits on, once the mark is taken off. */
  plain: string;
  /** The tone the mark says, as the digit Pleco stores. */
  tone: string;
}

/** Marked vowel → the letter it is and the tone it carries. */
const MARKED_VOWELS = new Map<string, Vowel>(
  TONED_VOWELS.flatMap(({ plain, marked }) =>
    marked.map((char, index): [string, Vowel] => [
      char,
      { plain, tone: String(index + 1) },
    ]),
  ),
);

interface Token {
  /** The token's letters, lowercase, `ü` and every tone mark folded away. */
  letters: string;
  /**
   * The token in numbered form, or null when its tones could not be placed —
   * which is what `píngcháng`, two readings in one word with no space to split
   * them on, comes out as.
   */
  numbered: string | null;
  /** Whether the reader gave this token a tone at all, by mark or by digit. */
  toned: boolean;
}

/**
 * One whitespace-delimited piece of what the reader typed.
 *
 * Three shapes arrive, and they are told apart by what they contain rather than
 * guessed at:
 *
 * - **Already numbered** (`ping2`, `ping2chang2`) — the digits are where they
 *   belong, so the letters and digits are kept in the order they were typed.
 * - **Tone-marked** (`píng`) — one mark, so its digit can only go at the end.
 * - **Marked more than once** (`píngcháng`) — the second reading starts
 *   somewhere inside the token and nothing here knows where, so the tones are
 *   dropped rather than put in the wrong place.
 */
const readToken = (token: string): Token => {
  const numbered: string[] = [];
  let letters = "";
  let marks = 0;
  let digits = 0;
  let mark = "";

  for (const char of token) {
    const vowel = MARKED_VOWELS.get(char);

    if (vowel) {
      letters += vowel.plain;
      numbered.push(vowel.plain);
      marks += 1;
      mark = vowel.tone;
      continue;
    }

    if (TONE_DIGITS.includes(char)) {
      numbered.push(char);
      digits += 1;
      continue;
    }

    // `ü` folds to `u` here too, so a reader who types it and one who does not
    // reach the same cards.
    const letter = char === "ü" ? "u" : char;

    if (letter >= "a" && letter <= "z") {
      letters += letter;
      numbered.push(letter);
    }
  }

  if (digits > 0) {
    return { letters, numbered: numbered.join(""), toned: true };
  }

  if (marks === 1) {
    // The single mark's digit belongs at the end of the syllable, which for a
    // token with one reading in it is the end of the token.
    return { letters, numbered: letters + mark, toned: true };
  }

  return { letters, numbered: marks === 0 ? letters : null, toned: false };
};

interface SearchQuery {
  /** What the reader typed, trimmed. Matched against headwords as it stands. */
  text: string;
  /** The reading with no tones in it, or "" when nothing was typed but digits. */
  toneless: string;
  /**
   * The reading in numbered form, or null when the tones cannot be used —
   * because none were typed, because only some tokens carried one, or because
   * a token carried more than one and there is no saying where they go.
   */
  numbered: string | null;
  /** The card id, when the whole query is a number and so could be one. */
  id: number | null;
}

/**
 * What the reader typed, in the forms the query needs it in.
 *
 * Tones are used only when **every** token carries one. A half-toned query like
 * `ping chang2` cannot be turned into a numbered string that matches anything —
 * `pingchang2` is not how the card reads — so it falls back to the toneless
 * form and finds the card anyway, which is the behaviour a reader who tones
 * some syllables and not others is after.
 */
const parseSearch = (raw: string): SearchQuery => {
  const text = raw.trim();
  const tokens = text
    .toLowerCase()
    .split(/\s+/u)
    .filter(Boolean)
    .map(readToken);

  const toneless = tokens.map((token) => token.letters).join("");
  const toned =
    tokens.length > 0 &&
    tokens.every((token) => token.toned && token.numbered !== null);

  return {
    text,
    toneless,
    numbered: toned
      ? tokens.map((token) => token.numbered ?? "").join("")
      : null,
    id: /^\d+$/u.test(text) ? Number(text) : null,
  };
};

/**
 * Escapes what SQLite's `LIKE` would otherwise read as a wildcard. A reader
 * searching for `%` wants the character, and a headword note could hold one.
 */
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/gu, (char) => `\\${char}`);

export interface CardSearch {
  /** The matches, best first. At most `VIEW_CARD_LIMIT` of them. */
  cards: FlashcardData[];
  /** How many matched in all, which may be more than were returned. */
  total: number;
}

/**
 * The cards in the profile matching what the reader typed.
 *
 * Four things are searched, and a card matching any of them is a hit: the
 * headword in either script, the reading with or without tones, and the card's
 * own id. The id is there because it is the one handle on a card that is
 * unique — `hw` is not, and this export holds 平常 twice — so it is the way to
 * say "that one" about two cards that read alike.
 *
 * Scope is the profile's, like every other card page: its categories decide
 * which cards exist and its scorefile supplies the review state. The scorefile
 * is joined rather than required, as on `Customized cards`, because a card the
 * profile has never put in front of anyone still has a headword and a reading
 * to find it by — only its tallies come back empty.
 *
 * Results are ordered by how squarely they answer: an exact match first, then a
 * match at the start, then one anywhere, and `c.id` inside each band so the
 * order is stable while the reader types. That is what makes a cap of three
 * usable — searching `shi` puts the cards that *are* shi above the ones that
 * merely contain it.
 */
export const searchCards = (
  database: Database,
  profile: Profile,
  raw: string,
): CardSearch => {
  const query = parseSearch(raw);
  const table = profile.scorefile?.table ?? null;

  if (query.text === "" || profile.categoryIds.length === 0) {
    return { cards: [], total: 0 };
  }

  const headword = headwordSql("c.hw");
  const alternate = headwordSql("c.althw");
  const toneless = readingSql("c.pron", false);
  const numbered = readingSql("c.pron", true);

  // Built as a list because which of them apply depends on what was typed: a
  // query of nothing but digits has no letters to match a reading against, and
  // `like '%%'` would match the whole export rather than nothing.
  const matches: string[] = [`c.id = $id`];
  const params: Record<string, SqlValue> = {
    $id: query.id,
    $text: `%${escapeLike(query.text)}%`,
    $exact: query.text,
    $prefix: `${escapeLike(query.text)}%`,
  };

  matches.push(
    `${headword} like $text escape '\\'`,
    `${alternate} like $text escape '\\'`,
  );

  if (query.toneless !== "") {
    params.$toneless = `%${escapeLike(query.toneless)}%`;
    params.$tonelessExact = query.toneless;
    params.$tonelessPrefix = `${escapeLike(query.toneless)}%`;

    // The tones narrow rather than replace: the toneless form still has to
    // match, and the numbered one is an extra hurdle when it can be built.
    if (query.numbered === null) {
      matches.push(`${toneless} like $toneless escape '\\'`);
    } else {
      params.$numbered = `%${escapeLike(query.numbered)}%`;
      matches.push(
        `(${toneless} like $toneless escape '\\'
          and ${numbered} like $numbered escape '\\')`,
      );
    }
  }

  const scope = `where (${matches.join(" or ")})
     and c.id in (select card from pleco_flash_categoryassigns
                  where cat in (${profile.categoryIds.join(", ")}))`;

  // Without a scorefile there is no `s` to read, so the review columns are
  // written as the empty state `asCount` and `asTime` would give them anyway.
  const join = table === null ? "" : `left join ${table} s on s.card = c.id`;
  const review =
    table === null
      ? `0, 0, 0, '', null, null, null, null`
      : `s.correct, s.incorrect, s.reviewed, coalesce(s.history, ''),
         s.firstreviewedtime, s.lastreviewedtime,
         s.scoreinctime, s.scoredectime`;
  const rank = `case
      when c.id = $id then 0
      when ${headword} = $exact or ${alternate} = $exact
        ${query.toneless === "" ? "" : `or ${toneless} = $tonelessExact`} then 1
      when ${headword} like $prefix escape '\\'
        or ${alternate} like $prefix escape '\\'
        ${query.toneless === "" ? "" : `or ${toneless} like $tonelessPrefix escape '\\'`} then 2
      else 3
    end`;

  return {
    cards: rowsOf(
      database,
      `select c.id, c.hw, c.althw, c.pron, coalesce(c.defn, '') as defn,
              c.created, c.modified, ${review}
       from pleco_flash_cards c
       ${join}
       ${scope}
       order by ${rank}, c.id
       limit ${String(VIEW_CARD_LIMIT)}`,
      params,
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
    })),
    total: asCount(
      firstValueOf(
        database,
        `select count(*) from pleco_flash_cards c ${scope}`,
        params,
      ),
    ),
  };
};
