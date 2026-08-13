/**
 * The bundled Chinese dictionary, and how a card is looked up in it.
 *
 * A Pleco export gives headwords, pinyin and study history but almost no
 * meanings: `defn` is a user's own note and is NULL on 97.6% of cards, and the
 * real definitions live in Pleco's licensed dictionaries, whose bytes are not
 * in the export. So the meaning has to come from somewhere else, and that is
 * CC-CEDICT — a community dictionary shipped as an indexed SQLite file next to
 * this module and served as a static asset. `cc-cedict/build.mjs` produces it.
 *
 * It is app-wide reference data, like the script preference and unlike the
 * export: it is the same before any file is imported, no query over the export
 * touches it, and it outlives every import. Hence its own `src/dictionary/`
 * rather than a home in `src/database/`.
 *
 * The lookup is a whole-word join, not per-syllable: CC-CEDICT is keyed by the
 * whole headword (锻炼, not 锻 + 炼). A headword can have several readings with
 * different meanings (行 is xíng *or* háng), so the card's own pinyin picks the
 * matching sense; when none matches, the first entry is shown rather than
 * nothing.
 */

import { createContext, use } from "react";
import type { Database } from "sql.js";
import { asText, rowsOf } from "@/database/plecoFile";

/** A dictionary entry for a headword: its reading and its senses. */
export interface DictionaryEntry {
  /** Canonical numbered pinyin, e.g. `duan4 lian4`. */
  pinyin: string;
  /** The senses, in CC-CEDICT's order. */
  senses: string[];
}

/**
 * The canonical pinyin key a reading reduces to, so a card's `pron` and a
 * CC-CEDICT reading meet on the same string. This MUST stay in step with
 * `canonicalPinyin()` in `cc-cedict/build.mjs`, which normalises the stored
 * side: lowercase, `ü` written as `ü`, each syllable trimmed to its letters and
 * one tone digit, joined by single spaces. The card side never contains `u:`,
 * but the digit-and-letters extraction and the lowercasing are the same.
 */
const canonicalPinyin = (pron: string): string =>
  pron
    .split("@")
    .map((syllable) => {
      const match = /([a-zü]+)([1-5])?/i.exec(syllable);
      return match ? (match[1] ?? "").toLowerCase() + (match[2] ?? "") : "";
    })
    .filter(Boolean)
    .join(" ");

/** Splits a raw `sense/sense` gloss into its senses, dropping any blanks. */
const sensesOf = (gloss: string): string[] =>
  gloss.split("/").filter((sense) => sense !== "");

/**
 * Looks a card up by its whole headword. Simplified first; a card whose `hw` is
 * blank keeps its characters in `althw`, so traditional is the fallback —
 * mirroring `splitHeadword()`. Among a headword's entries the one whose reading
 * matches the card's pinyin wins, else the first is returned. `null` means the
 * headword is not in CC-CEDICT, which is common for multi-word phrases and
 * user-made cards and is not an error.
 */
export const lookupCard = (
  dictionary: Database,
  hw: string,
  althw: string,
  pron: string,
): DictionaryEntry | null => {
  const simplified = hw.split("@").join("");
  const traditional = althw.split("@").join("");

  let rows = rowsOf(
    dictionary,
    "select pinyin, gloss from entries where simplified = ?",
    [simplified],
  );
  if (rows.length === 0 && traditional !== "") {
    rows = rowsOf(
      dictionary,
      "select pinyin, gloss from entries where traditional = ?",
      [traditional],
    );
  }
  if (rows.length === 0) {
    return null;
  }

  const key = canonicalPinyin(pron);
  const match = rows.find((row) => asText(row[0] ?? null) === key) ?? rows[0];
  if (!match) {
    return null;
  }

  return {
    pinyin: asText(match[0] ?? null),
    senses: sensesOf(asText(match[1] ?? null)),
  };
};

export interface DictionaryContextValue {
  /**
   * The card's dictionary entry, or `null` when the dictionary has no headword
   * for it or has not finished loading. A consumer treats both the same: it
   * shows the gloss when there is one and nothing when there is not.
   */
  lookup: (hw: string, althw: string, pron: string) => DictionaryEntry | null;
}

export const DictionaryContext = createContext<DictionaryContextValue | null>(
  null,
);

export const useDictionary = (): DictionaryContextValue => {
  const value = use(DictionaryContext);

  if (!value) {
    throw new Error("useDictionary must be used inside a <DictionaryProvider>");
  }

  return value;
};
