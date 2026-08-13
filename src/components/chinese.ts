/**
 * Turning the raw fields of a Pleco card into something a reader recognises.
 *
 * A headword is spread across three columns — `hw` (simplified), `althw`
 * (traditional) and `pron` (numbered pinyin) — each `@`-separated and aligned
 * index-for-index, so `锻@炼` / `鍛@煉` / `duan4@lian4` describes two syllables.
 * The pronunciation is stored as numbered pinyin (`duan4`) rather than the
 * accented form a reader expects (`duàn`).
 *
 * Both the difficult-cards table and the flashcard display need this, and it is
 * pure presentation with no query in it, so it lives here rather than in a
 * page's `.db.ts`.
 */

/** One syllable of a headword, with its three representations aligned. */
export interface Syllable {
  /** Simplified character(s). */
  simplified: string;
  /** Traditional character(s); equal to `simplified` when there is no variant. */
  traditional: string;
  /** Pinyin, with a tone mark instead of the stored trailing digit. */
  pinyin: string;
}

/** Plain vowel → its five forms: [neutral, first, second, third, fourth]. */
const TONE_MARKS: Record<string, readonly string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

/**
 * Which vowel of a syllable carries the tone mark. The standard rules: an `a`
 * or `e` always takes it; in `ou` the `o` does; otherwise it falls on the last
 * vowel (which handles `iu`, `ui`, and single-vowel syllables alike).
 */
const tonalVowelIndex = (letters: string): number => {
  const a = letters.indexOf("a");
  if (a !== -1) {
    return a;
  }

  const e = letters.indexOf("e");
  if (e !== -1) {
    return e;
  }

  const ou = letters.indexOf("ou");
  if (ou !== -1) {
    return ou;
  }

  for (let i = letters.length - 1; i >= 0; i -= 1) {
    const letter = letters[i];
    if (letter !== undefined && letter in TONE_MARKS) {
      return i;
    }
  }

  return -1;
};

/**
 * Numbered pinyin for one syllable (`duan4`, `lü3`, `ma5`, `r5`) to the accented
 * form (`duàn`, `lǚ`, `ma`, `r`). Tone `5` is the neutral tone and carries no
 * mark; a syllable with no vowel (an erhua `r`, say) is left as its letters.
 */
export const toneSyllable = (numbered: string): string => {
  const tone = Number(numbered.slice(-1));
  if (!Number.isInteger(tone) || tone < 1 || tone > 5) {
    return numbered;
  }

  const letters = numbered.slice(0, -1);
  if (tone === 5) {
    return letters;
  }

  const index = tonalVowelIndex(letters);
  const vowel = letters[index];
  if (vowel === undefined) {
    return letters;
  }

  const marked = TONE_MARKS[vowel]?.[tone] ?? vowel;

  return letters.slice(0, index) + marked + letters.slice(index + 1);
};

/**
 * Splits a card's headword into aligned syllables. Missing `althw` falls back
 * to the simplified form, and a syllable with no matching pinyin (a ragged
 * export) is left with an empty reading rather than dropping the character.
 *
 * Pleco marks separable words (离合词) with a `//` in the pinyin — `bao4//@ming2`
 * for 报名 — flagging where the compound can split. That is dictionary metadata,
 * not part of the reading, so it is dropped before the syllable is toned.
 */
export const splitHeadword = (
  hw: string,
  althw: string,
  pron: string,
): Syllable[] => {
  const simplified = hw.split("@");
  const traditional = (althw || hw).split("@");
  const pinyin = pron.replace(/\//g, "").split("@");

  return simplified.map((character, index) => ({
    simplified: character,
    traditional: traditional[index] ?? character,
    pinyin: toneSyllable(pinyin[index] ?? ""),
  }));
};
