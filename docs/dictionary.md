# The bundled dictionary: where meanings come from

An export barely contains meanings. `defn` is a user's own note and is NULL on
97.6% of cards; the real definitions are references into Pleco's licensed
dictionaries, whose bytes are not in the file. So the meaning has to come from
elsewhere, and that is **CC-CEDICT** — a free community dictionary shipped with
the app as an indexed SQLite file, `src/cc-cedict/cedict.sqlite`.

Like the script preference and unlike the export, it is app-wide reference data:
the same before any import, untouched by one, and read by no query over the
export. Hence `src/cc-cedict/`, a `DictionaryProvider` beside `ScriptProvider`,
its own `useScript`-shaped `useDictionary()` hook — and, like the script, read
by `Flashcard` itself rather than passed in.

Four things to keep in mind when touching this:

- **The lookup is a whole-word join keyed by reading.** CC-CEDICT is keyed by
  the whole headword (锻炼, not 锻 + 炼), so the key is `hw` with its `@`s
  removed, not a syllable. A headword can have several readings with different
  meanings (行 is xíng _or_ háng), so the card's own pinyin picks the sense; when
  none matches, the first entry shows rather than nothing.
- **`canonicalPinyin()` exists twice and must agree.** The card's `pron` and a
  CC-CEDICT reading only meet if both reduce to the same string. The reducer in
  `src/cc-cedict/context.ts` and the one in `cc-cedict/build.mjs` are that
  contract; change one, change both. Against the sample export the join resolves
  91% of cards, 90% with an exact reading-level match.
- **It loads lazily and fails soft.** A few megabytes, and no card is shown
  before an import anyway, so the fetch runs in the background from mount and
  never blocks first paint. Until it resolves — or if it never does — `lookup`
  returns null and the card simply shows no gloss, exactly as for a headword the
  dictionary does not have. The asset is content-hashed, so a rebuilt dictionary
  busts the browser cache on its own.
- **It is CC BY-SA 4.0, so it is credited where shown.** Every card that
  displays a gloss carries the CC-CEDICT attribution; do not remove it. The file
  itself is built and refreshed by [`cc-cedict/`](../cc-cedict/readme.md) and
  committed as a binary — it is not generated at build time.
