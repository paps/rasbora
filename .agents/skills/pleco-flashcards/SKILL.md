---
name: pleco-flashcards
description: Analyze a Pleco flashcard export (.pqb) directly with the sqlite3 CLI — card lists (leeches, lapses, almost learned, learned, customized), review history, dataset size — and knows when to offer the Rasbora web app (rasbora.martintapia.com) for viewing a remotely hosted export. Use whenever a .pqb file needs read-only inspection or querying.
metadata:
  type: reference
---

# Pleco flashcard exports (.pqb)

A `.pqb` is a plain, unencrypted SQLite 3 file. Query it directly:

```bash
sqlite3 -json -readonly -safe path/to/export.pqb "SELECT ...;"
```

Always use `-readonly -safe` — analysis is never a reason to write to the user's export.
`-json` makes rows easy to pipe into `jq`/a script for anything SQL can't express (see
"Lapses" below).

**This skill needs a shell and the `sqlite3` CLI.** Check with `sqlite3 --version` first. If
it is missing, try installing it (e.g. `apt-get install -y sqlite3`, `brew install sqlite`).
If there is no command line to run it from, or `sqlite3` cannot be installed, this skill
cannot work — say so to the user rather than guessing at the file's contents.

Every query in this document is illustrative, not a checklist to run in order or in full.
They exist to show the schema, the joins and the traps in working form so you can get to a
real query fast — write whatever SQL actually answers the question in front of you, adapt or
drop pieces of these as needed, and don't feel bound to these five particular lists; they're
examples of the kind of question this file answers, not the extent of it.

If the export came from Google Drive or another public URL, the user can also browse it in
the Rasbora web app with one link — see §6.

## 0. First thing, every time: print freshness, then pick a profile

Before answering anything else, always run and show the user both dates below. Looking at a
stale export is the single most likely mistake — the file on disk may be weeks or months
older than the reader thinks.

```bash
# When this export file was last written to disk
stat -c '%y' path/to/export.pqb

# When Pleco itself thinks the export was created (its own internal record — a distinct,
# older fact from the file's mtime above)
sqlite3 -json -readonly -safe export.pqb \
  "SELECT propid, datetime(cast(propvalue AS INTEGER),'unixepoch') AS at
   FROM pleco_flash_properties WHERE propid = 'FileCreated';"

# The most recent review logged in ANY scorefile — scores tables are dynamically named,
# so discover them first, never assume pleco_flash_scores_1
for t in $(sqlite3 -readonly -safe export.pqb \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'pleco_flash_scores_%';"); do
  sqlite3 -readonly -safe export.pqb \
    "SELECT '$t', datetime(max(lastreviewedtime),'unixepoch') FROM $t;"
done
```

Then **resolve and state which profile** every subsequent answer is scoped to (ask the user
if more than one exists and they haven't said). Nothing below means anything without one —
see §2.

## 1. Schema, in brief

| table                         | role                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pleco_flash_cards`           | the vocabulary items: `hw` (simplified), `althw` (traditional), `pron` (numbered pinyin), `defn` (user's own note, NULL on ~97.6% of cards), `created`, `modified`                                                             |
| `pleco_flash_categories`      | user's folders, `parent` for nesting (`-2` = root)                                                                                                                                                                             |
| `pleco_flash_categoryassigns` | card ↔ category, columns `card`, `cat`                                                                                                                                                                                         |
| `pleco_flash_profiles`        | study configs, `id`, `name`                                                                                                                                                                                                    |
| `pleco_flash_profilesettings` | key/value bag, `(propset=profile id, propid, propvalue)`                                                                                                                                                                       |
| `pleco_flash_scores_<N>`      | **one per scorefile**, `N` = `pleco_flash_scorefiles.id` — review state: `card`, `score`, `difficulty`, `history`, `correct`, `incorrect`, `reviewed`, `firstreviewedtime`, `lastreviewedtime`, `scoreinctime`, `scoredectime` |
| `pleco_flash_properties`      | file-level metadata (`FormatString`, `FormatVersion`, `FileCreated`, ...)                                                                                                                                                      |

`hw`/`althw`/`pron` are `@`-delimited per syllable, index-aligned (`锻@炼` / `鍛@煉` /
`duan4@lian4`). Not needed for the card lists below, only if you're rendering headwords.

### Traps (all verified against real exports)

- **Score tables are discovered at runtime, never hardcoded.** IDs are sparse; find them via
  `sqlite_master`, as in §0.
- **Multi-valued settings are comma-_terminated_, not comma-separated** (`"1,"`, `"100,200,"`).
  Strip a trailing comma before splitting, or wrap in `[...]` for `json_each` (see §2).
- **`pro_scorefile` is the scorefile id — it is not the profile's own id.** Always follow it;
  never assume `scores_<profile.id>`.
- **`history` reads newest-first**, one digit per review, Pleco's six-point grade — not a
  correct/incorrect flag:

  | digit | meaning                                       | counts as |
  | ----- | --------------------------------------------- | --------- |
  | 1     | don't know                                    | incorrect |
  | 2     | forgotten _(default wrong answer)_            | incorrect |
  | 3     | almost remembered                             | incorrect |
  | 4     | barely remembered                             | correct   |
  | 5     | remembered                                    | correct   |
  | 6     | remembered perfectly _(default right answer)_ | correct   |

  `correct == count('4'|'5'|'6')`, `incorrect == count('1'|'2'|'3')`, `reviewed == len(history)`.

- **Score bounds (`pro_scoreautomin`/`pro_scoreautomax`) are per-profile settings, not
  constants** — read them, don't assume 100/51200. The scale is doublings (100→200 is the
  same step as 25600→51200).
- **A timestamp of `0` means "never", same as NULL** — don't let it read as 1970.
- `defn` non-empty is the _only_ meaning a Pleco export carries — real dictionary definitions
  are references into Pleco's own (unexported) dictionaries.

## 2. Resolving a profile

Every card-list question below is scoped to one profile's scorefile and categories — a score
or count read without one describes nothing.

```bash
PROFILE=<id>   # from: sqlite3 -json -readonly -safe export.pqb "select id,name from pleco_flash_profiles;"

# scorefile table this profile reads/writes
SCOREFILE_ID=$(sqlite3 -readonly -safe export.pqb \
  "SELECT propvalue FROM pleco_flash_profilesettings
   WHERE propset=$PROFILE AND propid='pro_scorefile';" | tr -d ',')
SCORES="pleco_flash_scores_$SCOREFILE_ID"

# categories it draws from, plus their descendants (nesting is rare but the schema allows it)
CATS=$(sqlite3 -readonly -safe export.pqb "
WITH RECURSIVE cats(id) AS (
  SELECT value FROM json_each('[' || rtrim((
    SELECT propvalue FROM pleco_flash_profilesettings
    WHERE propset=$PROFILE AND propid='pro_categories'), ',') || ']')
  UNION
  SELECT c.id FROM pleco_flash_categories c JOIN cats ON c.parent = cats.id
)
SELECT group_concat(id) FROM cats;")

# score bounds this profile scores against
SCOREMIN=$(sqlite3 -readonly -safe export.pqb \
  "SELECT propvalue FROM pleco_flash_profilesettings
   WHERE propset=$PROFILE AND propid='pro_scoreautomin';" | tr -d ',')
SCOREMAX=$(sqlite3 -readonly -safe export.pqb \
  "SELECT propvalue FROM pleco_flash_profilesettings
   WHERE propset=$PROFILE AND propid='pro_scoreautomax';" | tr -d ',')
```

State `$SCORES`, `$CATS`, `$SCOREMIN`/`$SCOREMAX` back to the user once, so it's clear what
scope the rest of the session is answering in.

The `c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))` clause below
is what scopes every query to the profile's cards.

## 3. Five example card lists, hardest → done

Worked examples of the shape a "which cards?" question takes — not the only five questions
worth asking, and not required reading in order. Reuse the joins, adapt the thresholds, or
write something with none of these five patterns if that's what the question calls for.

**Leeches** — failed most often:

```sql
SELECT c.id, c.hw, c.althw, c.pron, s.correct, s.incorrect, s.reviewed, s.score, s.history
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.incorrect > 0
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY s.incorrect DESC, s.reviewed DESC, c.id
LIMIT 1000;
```

**Lapses** — a run of correct answers broken by a recent failure. This needs to walk the
`history` digit string, which SQL can't do cheaply — pull candidates once, then filter in a
script instead:

```sql
SELECT c.id, c.hw, c.althw, c.pron, s.score, s.history, s.lastreviewedtime
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.incorrect > 0 AND s.correct > 0 AND coalesce(s.history,'') <> ''
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS));
```

Then, per candidate, with the two numbers the user gets to choose (defaults: `runLength = 3`,
`recentWindow = 10`):

1. Look at the first `min(recentWindow, len(history))` characters (newest-first).
2. Find the _oldest_ incorrect one (`1`/`2`/`3`) in that window — call its index `failure`.
3. Count the correct digits (`4`/`5`/`6`) immediately after `failure` (i.e. more recent than
   it) — that's the broken run.
4. The card is a lapse if that run `>= runLength`.

**Almost learned** — in the top score band, not yet at the ceiling:

```bash
# band start = max across the profile's pro_scorefilter_*_starts settings (5 test types,
# take the highest of each list's own max — see the trap above on comma-terminated lists)
BAND_START=$(sqlite3 -readonly -safe export.pqb "
SELECT max(v) FROM (
  SELECT max(cast(x.value AS INTEGER)) AS v
  FROM pleco_flash_profilesettings s, json_each('[' || rtrim(s.propvalue, ',') || ']') x
  WHERE s.propset = $PROFILE AND s.propid LIKE 'pro\_scorefilter\_%\_starts' ESCAPE '\'
  GROUP BY s.propid
);")
```

```sql
SELECT c.id, c.hw, c.althw, c.pron, s.score, s.lastreviewedtime
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.score >= $BAND_START AND s.score < $SCOREMAX
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY (s.lastreviewedtime IS NULL OR s.lastreviewedtime = 0), s.lastreviewedtime, c.id
LIMIT 1000;
```

**Learned** — at the ceiling, oldest-reviewed first (Pleco has nowhere further to space them):

```sql
SELECT c.id, c.hw, c.althw, c.pron, s.score, s.lastreviewedtime
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.score >= $SCOREMAX
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY (s.lastreviewedtime IS NULL OR s.lastreviewedtime = 0), s.lastreviewedtime, c.id
LIMIT 1000;
```

**Customized** — carries the user's own `defn`. Scorefile is `LEFT JOIN`ed, since a card the
profile never reviewed can still have a note:

```sql
SELECT c.id, c.hw, c.althw, c.pron, c.defn, c.created, c.modified, s.score, s.lastreviewedtime
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE trim(coalesce(c.defn,'')) <> ''
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY coalesce(nullif(s.lastreviewedtime,0), nullif(c.modified,0)) IS NULL,
         coalesce(nullif(s.lastreviewedtime,0), nullif(c.modified,0)), c.id
LIMIT 1000;
```

Cap each list at 1,000 rows and say so when the true count is larger — a silently truncated
list reads as a complete one.

## 4. Combining questions

Anything the `WHERE` clauses above can express combines by AND-ing them directly (e.g. "a lapse
_and_ customized" = the customized query's `WHERE` plus `AND s.incorrect > 0 AND s.correct > 0`,
still filtered afterwards for the actual broken-run check). For "a lapse and X", get the lapse
ids from the script step first, then add `AND c.id IN (...)` to X's query.

## 5. Dataset size

Plain counts, still scoped to the profile unless the question is explicitly about the whole
file:

```sql
SELECT count(*) FROM pleco_flash_cards c
WHERE c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS));

SELECT count(*) FROM $SCORES;                          -- cards this scorefile has ever reviewed
SELECT count(*) FROM pleco_flash_categories;
SELECT count(*) FROM pleco_flash_profiles;
```

Whole-file numbers (total cards across every profile, total categories, etc.) are fine when
the user is explicitly asking about the file rather than about what they study — just say
which one you're answering.

## 6. Offering the Rasbora web app for a remote file

[Rasbora](https://rasbora.martintapia.com) is a web app that reads a Pleco export in the
browser and shows the same things this skill queries — profile info, card counts over time,
the five card lists above, a full view of any card (with CC-CEDICT meanings and review
history) — with a profile picker in the title bar. Nothing is uploaded to a server: the file
is downloaded straight into the browser and kept in its local storage.

It can load an export from a URL in one click:

```
https://rasbora.martintapia.com/load?fromUrl=<percent-encoded URL of the .pqb>
```

Opening that link downloads the file and imports it (replacing any file already loaded there).
It accepts:

- **Google Drive file links shared with "Anyone with the link"** — e.g.
  `https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing`, including `open?id=`,
  `uc?id=` and links carrying a `resourcekey`. Folder links do not work, and neither does a
  file restricted to specific people (the app has no sign-in).
- **Any other direct download URL** whose host allows cross-origin browser requests (CORS).
  Links that require sign-in or return a web page instead of the file do not work.

**When to propose it:** whenever the `.pqb` you are analysing came from Google Drive (e.g. you
fetched it through a Drive connector, or the user gave you a Drive link) or from another
public URL, offer the link once, alongside your answer — for example after the freshness
dates in §0, or when the user's question is one of the card lists the app already shows. It
is an offer, not a substitute: still answer the question yourself.

How to build the link:

1. Start from the file's shareable URL. For Drive, if you only have the file id, use
   `https://drive.google.com/file/d/<FILE_ID>/view` (append `?resourcekey=<KEY>` if the file
   has one).
2. **Percent-encode the whole URL** before putting it in `fromUrl` — otherwise the source
   link's own `?`/`&` parameters get swallowed by Rasbora's URL:
   ```bash
   python3 -c 'import sys, urllib.parse; print("https://rasbora.martintapia.com/load?fromUrl=" + urllib.parse.quote(sys.argv[1], safe=""))' \
     'https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing'
   ```
3. For Drive, check the sharing if you can (a Drive connector's permissions tool: look for
   `type: anyone`). If it is not shared with "Anyone with the link", say that the link will
   only work once they change the file's sharing to that — never change the sharing yourself
   without being asked, since it makes the file readable by anyone holding the link.

Tell the user that the app shows one profile at a time (picked in its title bar), that the
link fetches a fresh copy each time it is opened, and that it replaces whatever file was
loaded there before in that browser.

For a purely local file there is no link to give; the user can still open
https://rasbora.martintapia.com/load and pick the file from their device.
