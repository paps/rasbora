// Builds the bundled dictionary the app serves: turns CC-CEDICT's text dump
// into an indexed SQLite file at `src/cc-cedict/cedict.sqlite`, which is
// committed and shipped as a static asset. Run it to refresh the dictionary:
//
//   node cc-cedict/build.mjs
//
// Zero dependencies on purpose — Node's own `node:sqlite` writes the database
// and `node:zlib` unpacks the download, so this needs nothing from npm and the
// app's "no new dependencies" rule is untouched. Node 22.5+ is required for
// `node:sqlite`.
//
// CC-CEDICT is community-maintained and CC BY-SA 4.0; shipping it obliges
// attribution, which the app and `readme.md` carry. See `cc-cedict/readme.md`.

import { gunzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz";
const OUTPUT = fileURLToPath(
  new URL("../src/cc-cedict/cedict.sqlite", import.meta.url),
);

/**
 * The canonical pinyin key both sides of the join reduce to. A card's `pron`
 * (`duan4@lian4`) and a CC-CEDICT reading (`[duan4 lian4]`) have to land on the
 * same string for the disambiguation-by-reading to work, so the rules here MUST
 * match `canonicalPinyin()` in `src/cc-cedict/context.ts`:
 *
 *   - `u:` (CC-CEDICT's way of writing ü) becomes the literal `ü`,
 *   - everything is lowercased (proper nouns are capitalised on both sides),
 *   - each syllable keeps only its letters and a single tone digit, dropping
 *     the punctuation Pleco and CC-CEDICT hang off a reading,
 *   - syllables are joined by single spaces.
 */
const canonicalPinyin = (reading) =>
  reading
    .replace(/u:/gi, "ü")
    .toLowerCase()
    .split(/\s+/)
    .map((syllable) => {
      const match = /([a-zü]+)([1-5])?/.exec(syllable);
      return match ? match[1] + (match[2] ?? "") : "";
    })
    .filter(Boolean)
    .join(" ");

// `trad simp [pin1 yin1] /sense/sense/` — the shape of every non-comment line.
const ENTRY = /^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/;

const log = (message) => process.stdout.write(`${message}\n`);

log(`Downloading ${SOURCE}`);
const response = await fetch(SOURCE);
if (!response.ok) {
  throw new Error(
    `Download failed: ${String(response.status)} ${response.statusText}`,
  );
}
const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString(
  "utf8",
);
const lines = text.split("\n");
log(`Read ${lines.length.toLocaleString()} lines`);

// CC-CEDICT stamps its build date in a `#! date=...` header; keep it as
// provenance for the shipped file.
const dateLine = lines.find((line) => line.startsWith("#! date="));
const sourceDate = dateLine
  ? dateLine.slice("#! date=".length).trim()
  : "unknown";

mkdirSync(fileURLToPath(new URL("../src/cc-cedict/", import.meta.url)), {
  recursive: true,
});
rmSync(OUTPUT, { force: true });

const db = new DatabaseSync(OUTPUT);
db.exec(`
  CREATE TABLE entries (
    simplified  TEXT NOT NULL,
    traditional TEXT NOT NULL,
    pinyin      TEXT NOT NULL,  -- canonical key, see canonicalPinyin()
    gloss       TEXT NOT NULL   -- senses joined by '/', no surrounding slashes
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const insert = db.prepare(
  "INSERT INTO entries (simplified, traditional, pinyin, gloss) VALUES (?, ?, ?, ?)",
);

let count = 0;
let skipped = 0;
db.exec("BEGIN");
for (const line of lines) {
  if (line.startsWith("#") || line.trim() === "") {
    continue;
  }
  const match = ENTRY.exec(line);
  if (!match) {
    skipped += 1;
    continue;
  }
  const [, traditional, simplified, reading, gloss] = match;
  insert.run(simplified, traditional, canonicalPinyin(reading), gloss);
  count += 1;
}
db.exec("COMMIT");

// Indexed both ways: lookups key on the simplified headword, but a handful of
// cards store their characters in the traditional field with `hw` left blank,
// so that fallback has to be fast too.
db.exec(`
  CREATE INDEX idx_entries_simplified ON entries (simplified);
  CREATE INDEX idx_entries_traditional ON entries (traditional);
`);

const setMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
setMeta.run(
  "source",
  "CC-CEDICT (https://www.mdbg.net/chinese/dictionary?page=cc-cedict)",
);
setMeta.run("license", "CC BY-SA 4.0");
setMeta.run("date", sourceDate);
setMeta.run("entries", String(count));

// VACUUM after the indexes so the shipped file is as small as it will go.
db.exec("VACUUM");
db.close();

log(
  `Wrote ${count.toLocaleString()} entries to ${OUTPUT}` +
    (skipped ? ` (${String(skipped)} unparseable lines skipped)` : ""),
);
log(`CC-CEDICT date: ${sourceDate}`);
