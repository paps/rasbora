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
 *
 * Matched case-insensitively. Proper nouns are capitalised in the export
 * (`Ao4`, `Ou1`, `A1`), and a capital vowel carries the tone like any other —
 * matching lowercase only marks the wrong vowel, or none at all.
 */
const tonalVowelIndex = (letters: string): number => {
  const lower = letters.toLowerCase();

  const a = lower.indexOf("a");
  if (a !== -1) {
    return a;
  }

  const e = lower.indexOf("e");
  if (e !== -1) {
    return e;
  }

  const ou = lower.indexOf("ou");
  if (ou !== -1) {
    return ou;
  }

  for (let i = lower.length - 1; i >= 0; i -= 1) {
    const letter = lower[i];
    if (letter !== undefined && letter in TONE_MARKS) {
      return i;
    }
  }

  return -1;
};

/**
 * A syllable's letters and the tone digit that ends them. The digit is not
 * reliably the last character: Pleco hangs its own notation off the end, so
 * `ti3 `, `you1-`, `ru4, ` and `Lai2'` all occur — 1,219 of 14,887 cards in
 * the sample export carry one. That notation is punctuation around the
 * reading rather than part of it, so it is dropped like the `//` marker
 * below, and only the toned letters are kept.
 */
const TONED_LETTERS = /([a-zü]+)([1-5])/i;

/**
 * Numbered pinyin for one syllable (`duan4`, `lü3`, `ma5`, `r5`) to the accented
 * form (`duàn`, `lǚ`, `ma`, `r`). Tone `5` is the neutral tone and carries no
 * mark; a syllable with no vowel (an erhua `r`, say) is left as its letters,
 * and one with no tone digit at all is left alone.
 */
export const toneSyllable = (numbered: string): string => {
  const match = TONED_LETTERS.exec(numbered);
  if (!match) {
    return numbered.trim();
  }

  const [, letters = "", digit = ""] = match;
  const tone = Number(digit);
  if (tone === 5) {
    return letters;
  }

  const index = tonalVowelIndex(letters);
  const vowel = letters[index];
  if (vowel === undefined) {
    return letters;
  }

  // `TONE_MARKS` is keyed by the plain lowercase vowel, so a capital one is
  // looked up folded and re-capitalised afterwards: `Ao4` has to give `Ào`.
  const marked = TONE_MARKS[vowel.toLowerCase()]?.[tone] ?? vowel;
  const cased = vowel === vowel.toUpperCase() ? marked.toUpperCase() : marked;

  return letters.slice(0, index) + cased + letters.slice(index + 1);
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

  // Counting `hw`'s syllables alone is not enough: a few cards have an empty
  // `hw` with the characters sitting in `althw`, and taking `hw`'s length there
  // yields one blank syllable and silently drops the rest of the word.
  const count = Math.max(simplified.length, traditional.length, pinyin.length);

  return Array.from({ length: count }, (_, index) => {
    // Falling back on an empty string and not just a missing one is the point:
    // on those cards `hw` is present but blank.
    const character = simplified[index] ?? "";
    const variant = traditional[index] ?? "";
    const shown = character || variant;

    return {
      simplified: shown,
      traditional: variant || shown,
      pinyin: toneSyllable(pinyin[index] ?? ""),
    };
  });
};
