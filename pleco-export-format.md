# Pleco Flashcard Export (`.pqb`) — Format Reference

Analysis of `flashbackup-2608061921.pqb`, a real Pleco export (Android, 14,887 cards,
2021-10-09 → 2026-08-05). Everything below was verified against that file. Claims that are
inference rather than measurement are marked **(inferred)**.

A single export is one user's whole flashcard state, so treat the observations here as
descriptive of _this_ file — a second sample may widen some of the ranges.

## 1. Container

A plain SQLite 3 database. The `.pqb` extension is Pleco's naming, nothing more.

```
SQLite 3.x database, page size 1024, written by SQLite 3.11, UTF-8
```

No encryption, no custom encoding, no password. Opens read-only with any SQLite driver.
No foreign keys, no triggers, no views — every relationship is by convention only.

`pleco_flash_properties` self-identifies the file:

| propid               | value                          |
| -------------------- | ------------------------------ |
| `FormatString`       | `Pleco SQL Flashcard Database` |
| `FormatVersion`      | `8`                            |
| `FileGenerator`      | `Pleco Engine 2.0`             |
| `FilePlatform`       | `Android`                      |
| `FileCreated`        | `1633818525`                   |
| `FileID`             | `-1330574386`                  |
| `FileCreator`        | `19089542`                     |
| `FileCantoActivated` | `1`                            |

An ingester should assert `FormatString` and `FormatVersion` before trusting anything else.
`FilePlatform` is likely `iOS` in other exports **(inferred)**.

## 2. Tables

| Table                                |              Rows | Role                              |
| ------------------------------------ | ----------------: | --------------------------------- |
| `pleco_flash_cards`                  |            14,887 | The vocabulary items              |
| `pleco_flash_categories`             |                 3 | User's folders / lists            |
| `pleco_flash_categoryassigns`        |            15,073 | card ↔ category join table        |
| `pleco_flash_profiles`               |                 3 | Study session configs             |
| `pleco_flash_profilesettings`        |               444 | 148 settings × 3 profiles         |
| `pleco_flash_scorefiles`             |                 3 | Named containers for review state |
| `pleco_flash_scores_1` / `_4` / `_5` | 14,607 / 55 / 119 | **Per-scorefile** review state    |
| `pleco_flash_properties`             |                 8 | File-level metadata               |
| `pleco_flash_imports`                |                 3 | Import audit log                  |

### The one structural quirk: dynamically named score tables

Review state does not live in one table. It lives in `pleco_flash_scores_<N>`, where `N` is
`pleco_flash_scorefiles.id`. This file has scorefiles 1, 4 and 5, hence
`pleco_flash_scores_1`, `pleco_flash_scores_4`, `pleco_flash_scores_5`. IDs are sparse
(2 and 3 were deleted), so **the table list must be discovered at runtime** from
`pleco_flash_scorefiles` or `sqlite_master` — never hardcoded.

## 3. `pleco_flash_cards`

```sql
CREATE TABLE 'pleco_flash_cards' (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "lang" INTEGER,
  "hw" TEXT COLLATE NOCASE,        -- headword, simplified
  "althw" TEXT COLLATE NOCASE,     -- headword, traditional
  "pron" TEXT COLLATE NOCASE,      -- numbered pinyin
  "defn" TEXT,                     -- user-written definition, usually NULL
  "dictcreator" INTEGER,
  "dictid" INTEGER,
  "dictentry" INTEGER,             -- pointer into Pleco's own dictionary
  "altdictrefs" TEXT,
  "wordlength" INTEGER,
  "created" INTEGER,               -- Unix seconds
  "modified" INTEGER               -- Unix seconds
);
-- indexed on hw, althw, pron, dictentry
```

### `@` is a per-syllable separator

`hw`, `althw` and `pron` all use `@` to delimit syllables, **aligned index-for-index**:

```
hw     锻@炼
althw  鍛@煉
pron   duan4@lian4
```

Free character↔pinyin alignment, no segmenter needed. 13,631 cards contain `@`; the
remainder are single characters. `hw == althw` for 6,007 cards (no differing traditional
form). Splitting on `@` and zipping the three fields is the natural parse.

### Definitions are almost entirely absent

**`defn` is NULL for 97.6% of cards — only 356 of 14,887 have text.** Pleco stores a
reference (`dictid` + `dictentry`) into its own bundled dictionary, and _those bytes are not
in the export_. The 356 populated rows are user-written notes, and they are free-form and
inconsistent:

```
足        foot; attain, satisfy, enough\nReading test: 促
婴@儿     noun: baby; infant (less than 1 yo)
绑@架     verb 1 kidnap 2 argriculture (-//-) stake 给黄瓜绑架 gěi huángguabǎngjià stake the cucumbers
发@觉     1 to become aware\n2 to detect\n3 to realize\n4 to perceive\nDifferent from 發掘 which is …
```

They contain embedded newlines, mixed Chinese/pinyin/English, ad-hoc numbering, and personal
mnemonics. Do not expect to parse them into structure.

> **Architectural consequence.** An export gives you headwords, pinyin and study history but
> essentially no meanings. Any feature that needs semantics (AI analysis, semantic grouping,
> definition display) requires an external source — CC-CEDICT being the obvious candidate,
> joined on `(hw, pron)` or `(althw, pron)`.

### Other columns

- `wordlength` — character count. 1: 1,250 · 2: 9,754 · 3: 2,425 · 4: 1,235 · 5: 125 ·
  6: 52 · 7: 25 · 8: 16 · 9: 2 · 10: 3.
- `lang` — `4096` on every row. Presumably a Chinese constant **(inferred)**.
- `dictcreator` / `dictid` — identify the source dictionary. Five distinct pairs here, two
  covering 95% of cards. `(-1, -1)` on 352 cards and `(19089542, -1256948559)` on 292 mark
  user-created cards **(inferred — `19089542` also appears as `FileCreator`)**.
- `dictentry` — offset into that dictionary. Meaningless without Pleco's data files.
- `altdictrefs` — NULL on all 14,887 rows.
- `created` / `modified` — Unix seconds.
- 61 headwords are duplicated, so **`hw` is not a key**.

## 4. Review state: `pleco_flash_scores_<N>`

```sql
CREATE TABLE 'pleco_flash_scores_1' (
  "card" INTEGER PRIMARY KEY,
  "score" INTEGER,
  "difficulty" INTEGER,
  "history" TEXT,
  "correct" INTEGER,
  "incorrect" INTEGER,
  "reviewed" INTEGER,
  "sincelastchange" INTEGER,
  "firstreviewedtime" INTEGER,
  "lastreviewedtime" INTEGER,
  "scoreinctime" INTEGER,          -- last time score went up
  "scoredectime" INTEGER           -- last time score went down
);
```

One row = one card's state **in one scorefile**. A card studied under three profiles has
three independent rows in three tables.

### `score`

Continuous, clamped to `[100, 51200]` — matching the owning profile's `pro_scoreautomin` /
`pro_scoreautomax`, so **the bounds are per-profile configuration, not constants**. Read them
from settings rather than hardcoding.

Distribution in `pleco_flash_scores_1` is strongly bimodal:

| bucket        | cards |
| ------------- | ----: |
| 100–399       | 1,035 |
| 400–799       |   988 |
| 800–1,599     |    11 |
| 1,600–3,199   |   452 |
| 3,200–6,399   | 1,182 |
| 6,400–12,799  | 1,118 |
| 12,800–25,599 | 2,446 |
| 25,600–51,199 | 2,743 |
| 51,200 (max)  | 4,632 |

**4,632 cards (31.7%) are saturated at the ceiling** and carry no further signal — precisely
the population that "organization recommendations" should surface for retirement. Another
2,023 sit at the 100–600 floor: the chronic-failure pile.

### `difficulty`

Range 50–132, mean 106.7. Moves in steps configured per profile
(`pro_scorediffchange1..6`, `pro_scorediffdivisor`).

### `history` — a complete per-review log

A digit-per-review string. Verified encoding:

| digit | meaning   | occurrences |
| ----- | --------- | ----------: |
| `6`   | correct   |     106,709 |
| `2`   | incorrect |      56,422 |
| `4`   | correct   |       5,909 |
| `1`   | unknown   |          55 |
| `3`   | unknown   |           8 |
| `5`   | unknown   |           1 |

- `correct == count('6') + count('4')` holds for **14,606 of 14,607 rows**.
- `incorrect == count('2')` holds for 14,555 of 14,607.
- `reviewed == len(history)` holds for **all 14,607 rows**, max length 83 — so the log is
  complete and, at least at this volume, never truncated.

**Ordering is newest-first.** Evidence: of the 12,006 cards whose most recent review raised
the score, the _first_ character is a correct-marker 100% of the time; the last character
only 58%. The score-decrease group confirms it — of 2,601 such cards, the 1,566 whose history
starts with `6` all sit at exactly 51,200, i.e. a correct answer at the ceiling is logged as
a decrease event; all 1,035 starting with `2` are below the ceiling.

`4` and `6` both count as correct and appear in long same-digit runs, suggesting they
distinguish test type or session mode rather than degree of correctness **(inferred,
unconfirmed)**. `1`/`3`/`5` are negligible and their semantics are unknown.

### No per-review timestamps

Only `firstreviewedtime`, `lastreviewedtime`, `scoreinctime`, `scoredectime` exist. You can
reconstruct the exact _sequence_ of every review but not _when_ each one happened.

> **Architectural consequence.** Any "activity over time" view is limited to those four
> timestamps — unless Rasbora keeps its own snapshots across successive imports and diffs
> them. That argues for an append-only ingest model rather than replace-on-import, and it is
> cheap to adopt on day one and expensive to retrofit.

### Dead / unused columns

`sincelastchange` is `0` on every row in this file.

## 5. Profiles, categories, scorefiles

**The profile is the top of Pleco's model.** It is what a user picks before reviewing, and
everything else hangs off it: `pro_scorefile` says which scores table the session reads and
writes, `pro_categories` says which cards it draws, and the remaining ~146 settings say how
the session behaves. Nothing else in the export points _back_ at a profile, so a score or a
category count read without one is an answer to a question no user asked.

```sql
CREATE TABLE 'pleco_flash_categories' (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT, "created" INTEGER,
  "modified" INTEGER, "parent" INTEGER, "sort" INTEGER, "hidden" INTEGER,
  "class" INTEGER, UNIQUE ("name","parent"));

CREATE TABLE 'pleco_flash_categoryassigns' (
  "card" INTEGER, "cat" INTEGER, "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  UNIQUE ("card","cat"));
```

Categories are nearly vestigial here — 3 rows, all with `parent = -2` (a root sentinel), and
14,608 of 15,073 assignments point at a single category. The schema _supports_ a hierarchy
via `parent`, so other exports may be deeply nested; handle the tree case.

- `hidden` holds `-5`, `0` and `35` — **not a boolean**, semantics unknown.
- `class` is NULL throughout.
- `pleco_flash_imports` references category IDs 2–92, so ~90 categories were deleted at some
  point. **The ID space is sparse and non-contiguous.**

The three entity types line up 1:1:1 by convention, wired through profile settings:

| profile | name                    | `pro_scorefile` | `pro_categories` | scores table           |
| ------- | ----------------------- | --------------- | ---------------- | ---------------------- |
| 2       | Audio+chars input (big) | 1               | `1,`             | `pleco_flash_scores_1` |
| 6       | Component input (micro) | 4               | `93,`            | `pleco_flash_scores_4` |
| 7       | Chars input (small)     | 5               | `94,`            | `pleco_flash_scores_5` |

Nothing enforces this alignment — it is a convention of how the user set things up, and a
robust ingester should follow `pro_scorefile` rather than assume `profile.id == scorefile.id`
(it is false here for all three).

### `pleco_flash_profilesettings`

Generic key/value bag, 148 keys per profile, with `propisstring` as a type tag. Same schema
as `pleco_flash_properties`, keyed by `(propset, propid)` where `propset` is the profile id.

Most keys are UI chrome (fonts, colors, button layout) and can be ignored. The semantically
useful ones:

| key                                               | meaning                                                |
| ------------------------------------------------- | ------------------------------------------------------ |
| `pro_scorefile`                                   | which `scores_<N>` table this profile writes to        |
| `pro_categories`                                  | which categories it draws from (comma-terminated list) |
| `pro_scoreautomin` / `pro_scoreautomax`           | score bounds (100 / 51200 here)                        |
| `pro_scorediffchange1..6`, `pro_scorediffdivisor` | difficulty adjustment curve                            |
| `pro_cardcount`                                   | cards per session (50 / 10 / 50)                       |
| `pro_limitlengthstart` / `pro_limitlengthend`     | word-length filter (1–4)                               |
| `pro_limitunlearnedmaxcards`                      | new-card cap (500 / 20 / 10)                           |
| `pro_scorefilter_*_starts` / `_asks` / `_shows`   | SRS bucket thresholds                                  |
| `pro_language`                                    | `4096`, matching `cards.lang`                          |

**Multi-valued settings are comma-_terminated_, not comma-separated** — `pro_categories=1,`
and `pro_scorefilter_free_starts=100,200,400,800,1600,3200,6400,12800,`. A naive
`split(',')` yields a trailing empty element.

## 6. `pleco_flash_imports`

Audit log of prior imports _into_ Pleco, recording start/end id ranges per entity type
(`startcard`/`endcard`, `startcat`/`endcat`, …). Three rows here, from 2021 and 2022. Useful
only as forensic evidence of provenance; the ranges reference long-deleted ids.

## 7. Data quality — checked

| check                                    | result                       |
| ---------------------------------------- | ---------------------------- |
| Cards with no score row in any scorefile | 180 (never studied)          |
| Cards with no category                   | 33                           |
| Cards in >1 category                     | 216 (213 in two, 3 in three) |
| `categoryassigns.card` → missing card    | 0                            |
| `scores_1.card` → missing card           | 0                            |
| Duplicate `hw`                           | 61                           |
| `defn` non-empty                         | 356 (2.4%)                   |
| `altdictrefs` non-NULL                   | 0                            |
| `sincelastchange` non-zero               | 0                            |

Referential integrity is clean in both directions despite no declared foreign keys.

## 8. Open questions for Rasbora's design

1. **Definitions.** 97.6% of cards have none. Bundle CC-CEDICT, call an API, or ship without
   meanings?
2. **Ingest model.** Snapshot-replace loses all history between imports, since the export has
   no per-review timestamps. Append-only + diff is the only way to ever show trends.
3. **Card identity across imports.** Pleco ids are `AUTOINCREMENT` and sparse after deletion.
   Stable within one device's history, but almost certainly **not** stable across a re-install
   or device migration **(inferred)**. Key on Pleco id, or on a content hash of
   `(hw, pron, dictentry)`?
4. **Multi-scorefile modelling.** A card has independent state per scorefile. Is a "card" in
   Rasbora the vocabulary item, or the (card, scorefile) pair? Dashboard statistics read very
   differently under each.
5. **`4` vs `6` in `history`.** Worth confirming against a second export before building
   anything that depends on the distinction.

## Appendix: gotchas checklist

- [ ] Discover `scores_<N>` tables at runtime; never hardcode.
- [ ] `history` reads **newest-first**.
- [ ] Split `hw`/`althw`/`pron` on `@`; the three are index-aligned.
- [ ] Multi-valued settings are comma-**terminated**.
- [ ] Follow `pro_scorefile`; `profile.id != scorefile.id`.
- [ ] `categories.hidden` is not a boolean.
- [ ] Score bounds come from profile settings, not constants.
- [ ] Entity ids are sparse and non-contiguous.
- [ ] `hw` is not unique.
- [ ] A correct answer at the score ceiling is logged in `scoredectime`, not `scoreinctime`.
