# cc-cedict

Build tooling for the bundled Chinese dictionary. A Pleco export carries
headwords, pinyin and study history but almost no meanings — `defn` is a user's
own note and is empty on 97.6% of cards — so the definitions come from
[CC-CEDICT], a community dictionary, joined to each card on its headword and
reading.

`build.mjs` turns CC-CEDICT's text dump into the indexed SQLite file the app
serves:

```
node cc-cedict/build.mjs
```

It downloads the latest CC-CEDICT from MDBG, parses it, and writes
`src/cc-cedict/cedict.sqlite` — a table of `(simplified, traditional, pinyin,
gloss)` indexed both ways. That file is committed and shipped as a static asset;
re-run this to refresh it. Nothing here is imported by the app, and it is not
part of the app's TypeScript project (ESLint ignores this folder), so it is free
to be plain Node.

**No dependencies, on purpose.** Node's own `node:sqlite` writes the database
and `node:zlib` unpacks the download, so this needs nothing from npm and the
app's no-new-dependencies rule is untouched. Node 22.5+ is required for
`node:sqlite`.

**The one invariant to keep.** `canonicalPinyin()` here and the function of the
same name in `src/cc-cedict/context.ts` must reduce a reading to the identical
string, or the join stops matching. Change one, change both. Against a real
14,887-card export the join resolves 91% of cards, 90% with an exact
reading-level match that disambiguates homographs (行 xíng vs háng); the rest are
mostly multi-word phrases CC-CEDICT does not carry, which simply show no gloss.

## Licensing

CC-CEDICT is distributed under [CC BY-SA 4.0]. Shipping it obliges attribution
and carrying the same licence, which the app does: every card that shows a gloss
credits CC-CEDICT, and `readme.md` names it. The generated file also stores the
source, licence and CC-CEDICT build date in its `meta` table.

[CC-CEDICT]: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
[CC BY-SA 4.0]: https://creativecommons.org/licenses/by-sa/4.0/
