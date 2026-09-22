---
name: pleco-flashcards
description: Help a learner understand their Pleco flashcards from a .pqb export, find words needing practice, estimate upcoming reviews, and open relevant cards and views in Rasbora.
metadata:
  type: reference
---

# Help with Pleco flashcards

Answer the learner's question directly: which words need attention, what their review patterns show, or when cards are likely to come up again. Use the export as evidence and offer a useful next step when it follows from the findings.

Pleco is a Chinese dictionary and flashcard app; a `.pqb` export contains the learner's cards, study profiles, and saved review history. Work from the export the user provides. This file contains all the analysis guidance and examples needed; no Rasbora repository, companion files, or running website is required to analyze the export.

Rasbora is an optional web app at `https://rasbora.martintapia.com` for exploring that export through charts, card lists, and individual cards with definitions and review history. Introduce it briefly when first offering a link; the user may never have used it.

## How to answer

- Lead with the finding and identify the study profile by name. Show words in the user's preferred script, with readable pinyin and relevant review information.
- Keep SQL, table names, internal IDs, raw settings, and tool setup internal unless the user asks for them or they explain a limitation. This applies to progress updates as well as the final answer.
- Prefer “estimated due in 3 days,” “forgotten 8 times,” or “4 correct answers in a row” to raw scores and encoded history. Use only the detail needed for the question.
- Give a manageable selection of cards unless the user wants a full list. Say how many match and whether you are showing only a subset; link to the relevant Rasbora view when useful.
- Distinguish evidence from interpretation. A long correct streak can include “barely remembered” answers; a maximum score does not establish mastery. Suggested mnemonics or explanations are study help, not facts recorded in the export.
- Most cards have no exported definition. Distinguish the user's notes from meanings supplied through another source or your own explanation.

## Read the export

A `.pqb` is a SQLite database. Use `sqlite3 -json -readonly` when available, or another existing SQLite tool in read-only mode. Never modify the export. If you cannot read it, explain the limitation without guessing at its contents.

Use the [technical reference at the end of this file](#technical-reference) for schema details, example SQL, review calculations, and link construction. Its examples are internal working material, not a checklist or a response template; adapt them to the question.

Resolve the selected profile once and reuse it. If several profiles exist and the conversation does not identify one, ask which the user studies with. Scope every card query to that profile's categories and scorefile; without a profile, explain what is missing rather than substituting whole-export totals. Whole-file questions are the exception.

Check the latest recorded review in scope to understand freshness. Mention it when it affects the answer, especially estimates about what is due now. Neither the file's modification time nor `FileCreated` proves when the snapshot was exported. Do not prepend a diagnostic report to every answer.

Review history is newest-first: grades 1–3 are incorrect, 4–6 correct, and only 6 means “remembered perfectly.” Individual reviews have no timestamps, so the export cannot reconstruct a daily study log.

## Estimate reviews

Use the selected profile's `pro_cardpointsday`: interval in days = score / points per day. Add that interval to the last review, then subtract current time to estimate time remaining. Negative means overdue. Missing or invalid scheduling data means unknown; never assume a rate of 100.

Describe dates as estimates from the saved reviews. For links to day buckets, round days remaining down: -0.2 belongs to -1; day 0 means the next 24 hours. The [review estimates reference](#review-estimates-and-due-ranges) gives the exact arithmetic and examples.

## Link to Rasbora

Rasbora reads the export in the user's browser and keeps it there; nothing is uploaded to Rasbora. Answer the question yourself and offer a relevant link alongside the answer.

**Every Rasbora page link except `/load` must include both `profileId` and `lastSessionStart` from the selected profile.** Read `id` and the exact raw `laststart` value from `pleco_flash_profiles`; keep the timestamp in Unix seconds, including zero. Do not round it, substitute another date, or omit these parameters on pages without card filters, including `/`. If metadata is missing or unusable, do not fabricate a targeted link; offer `/load` and explain that a matching export is needed.

Use `https://rasbora.martintapia.com` plus one of these paths. The table shows page-specific parameters; append both profile parameters to every non-load path.

| What the learner wants | Path and supported page parameters |
| --- | --- |
| About Rasbora | `/` |
| Load a local or remote export | `/load`, optionally `?fromUrl=<encoded source URL>`; no profile parameters |
| Profile and session settings | `/profile` |
| Cards added over time | `/card-count` |
| Current correct streaks across the deck | `/learning-distribution` |
| Upcoming and overdue reviews | `/incoming-reviews` |
| One specific card | `/card?search=<card ID>` |
| Search by characters or pinyin | `/card?search=<encoded text>` |
| Never-reviewed cards | `/new` |
| Most frequently forgotten words | `/leeches` |
| Correct runs broken by recent failures | `/lapses` |
| Cards with a correct streak of a chosen length | `/streaks?run=4`, optionally `&runTo=10` |
| Overdue cards, or a chosen due-date range | `/due` for all overdue; `/due?days=-3`, optionally `&daysTo=7` |
| Cards with user-written definitions | `/customized` |

Use a card's ID for an exact link because headwords can be duplicated; label it with the word, not the ID. Streak and day ranges include both ends. Lapse controls are not URL parameters; do not invent filter parameters for that page or other pages.

Before offering page links to a first-time user, explain that they need to load the same export in Rasbora using `/load`, then open the page link. Reading the export with this skill does not load it into their browser. Page links use the export already loaded in the browser. A profile/session mismatch clears that loaded copy and opens `/load`; the user must load the matching export and follow the original link again. These parameters check profile/session metadata, not file identity byte for byte.

For a remote export, offer a separate `/load?fromUrl=…` link once. Encode the entire source URL. Public Drive file links work when shared with “Anyone with the link”; preserve any `resourcekey` and never change sharing without being asked. Other hosts must permit direct HTTPS browser downloads. Mention that opening a load link fetches a fresh copy and replaces the browser's current export. For a local file, use `/load` and its file picker.

---

## Technical reference

**For the agent's internal use; do not include this reference or its technical details in learner-facing answers unless requested.**

Read the sections needed for the task. Queries are adaptable examples rather than required steps or a limit on what can be asked.

### Contents

- [Schema and profile resolution](#schema-and-profile-resolution)
- [Card lists, search, and counts](#card-lists-search-and-counts)
- [Streaks and lapses](#streaks-and-lapses)
- [Review estimates and due ranges](#review-estimates-and-due-ranges)
- [Rasbora links](#rasbora-links)

### Schema and profile resolution

A profile is a Pleco study configuration. Its categories select which cards are in scope, and its scorefile holds those cards' review state. Profiles can share a scorefile while having different settings; resolve both relationships rather than assuming one profile means one separate set of scores.

Open with `sqlite3 -json -readonly export.pqb 'SELECT …'`, or an existing SQLite driver in read-only mode. For Python, `sqlite3.connect(Path(path).resolve().as_uri() + '?mode=ro', uri=True)` opens read-only. Do not install tools if an available reader suffices.

| Table | Relevant columns |
| --- | --- |
| `pleco_flash_cards` | `id`, `hw` (simplified), `althw` (traditional), `pron` (numbered pinyin), `defn` (user's note), `created`, `modified` |
| `pleco_flash_categories` | `id`, `name`, `parent` (`-2` = root) |
| `pleco_flash_categoryassigns` | `card`, `cat` |
| `pleco_flash_profiles` | `id`, `name`, `laststart`, `sort` |
| `pleco_flash_profilesettings` | `propset` (profile ID), `propid`, `propvalue` |
| `pleco_flash_scorefiles` | `id`, `name` |
| `pleco_flash_scores_<N>` | `card`, `score`, `difficulty`, `history`, `correct`, `incorrect`, `reviewed`, `firstreviewedtime`, `lastreviewedtime`, `scoreinctime`, `scoredectime` |
| `pleco_flash_properties` | `propid`, `propvalue` (including `FormatString`, `FormatVersion`, `FileCreated`) |

Headwords and pinyin use aligned `@` syllable separators. Remove them for displayed characters and replace them with spaces for pinyin; fall back to `hw` when `althw` is empty. Headwords are not unique. Dictionary references are not definitions: only nonempty `defn` carries meaning in the export.

Review timestamps are Unix seconds; NULL or zero means unknown/never, not 1970. `laststart` has a separate use in links: preserve its exact raw value, including zero. `FileCreated` is database metadata, not a reliable snapshot export date.

```sql
SELECT propid, propvalue FROM pleco_flash_properties
WHERE propid IN ('FormatString', 'FormatVersion');

SELECT id, name, laststart FROM pleco_flash_profiles ORDER BY sort, id;

SELECT name FROM sqlite_master
WHERE type = 'table' AND name GLOB 'pleco_flash_scores_[0-9]*';

SELECT propid, propvalue FROM pleco_flash_profilesettings
WHERE propset = :profile_id
  AND propid IN ('pro_scorefile', 'pro_categories', 'pro_cardpointsday',
                'pro_scoreautomin', 'pro_scoreautomax',
                'pro_cardcount', 'pro_limitunlearnedmaxcards');
```

Expected format string: `Pleco SQL Flashcard Database`; the documented schema is version 8. Inspect schema differences before applying examples to another version. Profile info can use these settings for cards per session, new-card cap, and interval bounds (score bounds divided by points per day).

Settings can be comma-terminated (`1,` or `100,200,`). Split, trim, discard empty tokens, and validate numbers. `pro_scorefile` names the scorefile ID, **not** the profile ID. Resolve it to a discovered table with a numeric suffix; IDs are sparse. Validate points per day as a finite positive number rather than relying on SQLite's permissive text casts.

Expand the profile's selected categories to include descendants. In this example, bind `:category_ids_json` to a JSON array of the validated IDs from `pro_categories`:

```sql
WITH RECURSIVE cats(id) AS (
  SELECT value FROM json_each(:category_ids_json)
  UNION
  SELECT c.id FROM pleco_flash_categories c JOIN cats ON c.parent = cats.id
)
SELECT id, name FROM pleco_flash_categories WHERE id IN (SELECT id FROM cats);
```

Below, `$SCORES` and `$CATS` are substitution markers, not SQL bind parameters: replace them with the validated table name and comma-separated integer category IDs. Bind `:named` values through your SQLite reader. Do not interpolate user search text. An empty category set means no cards. If there is no scorefile, omit its join and return unknown review fields: scoped cards can still be counted, searched, or customized, and all are new.

### Card lists, search, and counts

Use `IN` for category membership so cards in multiple categories count once. Keep that scope even when filtering by a specific card ID. Queries with `LIMIT 1000` mirror the app's list cap; compute the full matching count before limiting when reporting totals. Do not limit candidates before filtering or aggregating in a script.

#### Most frequently forgotten (leeches)

```sql
SELECT c.id, c.hw, c.althw, c.pron, s.correct, s.incorrect,
       s.reviewed, s.score, s.history, s.lastreviewedtime
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.incorrect > 0
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY s.incorrect DESC, s.reviewed DESC, c.id
LIMIT 1000;
```

#### Never reviewed (new cards)

An empty history counts as new even when a score row exists.

```sql
SELECT c.id, c.hw, c.althw, c.pron, c.created
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE coalesce(s.history, '') = ''
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY nullif(c.created, 0) IS NULL, c.created, c.id
LIMIT 1000;
```

#### User-written definitions (customized cards)

```sql
SELECT c.id, c.hw, c.althw, c.pron, c.defn, s.history, s.lastreviewedtime
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE trim(coalesce(c.defn, '')) <> ''
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY coalesce(nullif(s.lastreviewedtime, 0), nullif(c.modified, 0)) IS NULL,
         coalesce(nullif(s.lastreviewedtime, 0), nullif(c.modified, 0)), c.id
LIMIT 1000;
```

#### Single-card details and search

```sql
SELECT c.id, c.hw, c.althw, c.pron, c.defn, c.created, c.modified,
       s.score, s.history, s.correct, s.incorrect, s.reviewed,
       s.firstreviewedtime, s.lastreviewedtime
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE c.id = :card_id
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS));
```

For a character search, replace `c.id = :card_id` with `instr(replace(c.hw, '@', ''), :text) > 0 OR instr(replace(c.althw, '@', ''), :text) > 0`, enclosing the entire OR expression in parentheses before the category condition. For pinyin, normalize both stored readings and the search: lowercase, remove separators/punctuation, and fold `ü` to `u`. Compare without tones unless all syllables supply tones; then compare numbered tones. The website accepts tone-marked, numbered, or toneless pinyin and shows at most three matches. Link by ID when identifying one card.

#### Counts and latest recorded review

```sql
SELECT count(*) AS cards,
       sum(CASE WHEN coalesce(s.history, '') = '' THEN 1 ELSE 0 END) AS new_cards,
       sum(CASE WHEN coalesce(s.history, '') <> '' THEN 1 ELSE 0 END) AS reviewed_cards,
       max(nullif(s.lastreviewedtime, 0)) AS latest_review
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS));
```

Treat NULL sums on an empty set as zero. Counting all rows of `$SCORES` would include cards outside the profile and can include unreviewed cards. Only an explicit question about the file warrants whole-export counts of cards, categories, or profiles.

#### Cards added over time

```sql
SELECT strftime('%Y-%m', c.created, 'unixepoch') AS month, count(*) AS added
FROM pleco_flash_cards c
WHERE c.created > 0
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
GROUP BY month ORDER BY month;
```

Fill missing months with zero and accumulate for a cumulative total. For category series, join category assignments and group by category and month; the overall total still counts each card once. This measures card creation under **current** category membership, not study activity or historical category membership. Count undated cards separately.

### Streaks and lapses

Grades are newest-first: `1` don't know, `2` forgotten (default wrong), `3` almost remembered, `4` barely remembered, `5` remembered, `6` remembered perfectly (default right). Grades 1–3 count as incorrect and 4–6 as correct. The history records sequence, not dates for each review; do not infer daily activity from it.

Read candidates once for streaks, the learning distribution, or lapses:

```sql
SELECT c.id, c.hw, c.althw, c.pron, c.defn,
       coalesce(s.history, '') AS history, s.score, s.lastreviewedtime
FROM pleco_flash_cards c LEFT JOIN $SCORES s ON s.card = c.id
WHERE c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS));
```

Example Python for a current streak and the app's lapse definition:

```python
def streak(history):
    length = 0
    while length < len(history) and history[length] in '456':
        length += 1
    perfect = length > 0 and all(grade == '6' for grade in history[:length])
    return length, perfect


def lapse(history, run_length=4, recent_window=3):
    failures = [i for i, grade in enumerate(history[:recent_window]) if grade in '123']
    if not failures:
        return None
    failure = failures[-1]  # Oldest failure within the recent window.
    broken_run, _ = streak(history[failure + 1:])  # Older reviews, before that failure.
    return (broken_run, failure + 1) if broken_run >= run_length else None
```

For the learning distribution, count empty histories as **new**, separately from reviewed cards with a streak of zero. Group positive streaks by length and whether every grade in the streak is 6. Include empty intermediate lengths. For `/streaks`, exclude new cards, filter to the inclusive requested length range, and sort by estimated due time ascending (unknown last), then ID.

For lapses, defaults are a broken run of at least **4** correct answers and a failure within the last **3** reviews. Sort by broken-run length descending, last-review time descending, then ID. The second tuple value is reviews since the break, including the failure. Custom thresholds are supported by the page's controls but not its URL.

Combine questions by adding SQL predicates or filtering the candidate rows before sorting and limiting. For example, a customized lapse needs nonempty `defn` as well as a qualifying broken run. Scores at or near a profile's ceiling can be queried with `pro_scoreautomax` and its score-band settings, but these are not “learned” website pages or proof of mastery.

### Review estimates and due ranges

Read `pro_cardpointsday` through the selected profile, even when another profile shares its scorefile. Use one current Unix-seconds timestamp for an analysis. With a finite nonnegative score, finite positive rate, and finite positive last-review timestamp:

```text
interval_days = score / points_per_day
due_unix_seconds = lastreviewedtime + interval_days * 86400
days_remaining = (due_unix_seconds - now_unix_seconds) / 86400
day_bucket = floor(days_remaining)
```

Missing/invalid values leave the estimate unknown. Do not use score-change dates, `FileCreated`, or filesystem dates in this calculation. A score of 250 at 100 points per day gives a 2.5-day interval; three days after review it is 0.5 days overdue, in bucket -1. Day 0 is due within the next 24 hours. Estimates do not account for reviews after export or Pleco's session-selection rules.

After validating and binding `:points_per_day` and `:now`, this query returns scheduling candidates without requiring SQLite's optional math functions:

```sql
SELECT c.id, c.hw, c.althw, c.pron,
       s.lastreviewedtime + (1.0 * s.score / :points_per_day) * 86400 AS due,
       (s.lastreviewedtime - :now) / 86400.0
         + 1.0 * s.score / :points_per_day AS days_remaining
FROM pleco_flash_cards c JOIN $SCORES s ON s.card = c.id
WHERE s.score IS NOT NULL AND s.score >= 0 AND s.lastreviewedtime > 0
  AND c.id IN (SELECT card FROM pleco_flash_categoryassigns WHERE cat IN ($CATS))
ORDER BY due, c.id;
```

For incoming reviews, group candidates by `math.floor(days_remaining)` and fill intermediate days with zeros; count unknown estimates separately against the full scoped card count. For a due range `from_day..to_day`, retain `from_day <= days_remaining < to_day + 1`, which matches the inclusive bucket range. Without a range, `/due` means all candidates with `days_remaining < 0`. Apply any list limit after filtering; the app shows at most 1,000.

### Rasbora links

Use the [page map above](#link-to-rasbora). **Include both profile parameters on every non-load page**, including About and Profile info. Use `id` as `profileId` and raw `laststart` as `lastSessionStart` from the same selected profile row. Both must be nonnegative integers; do not replace a missing timestamp with zero. These constraints select the profile and reject a mismatched loaded export. They are not a unique file fingerprint.

Example construction from already-read values (Python):

```python
from urllib.parse import urlencode

base = 'https://rasbora.martintapia.com'
context = {'profileId': profile_id, 'lastSessionStart': laststart}
card_url = base + '/card?' + urlencode({'search': card_id, **context})
due_url = base + '/due?' + urlencode({'days': -3, 'daysTo': 7, **context})
streak_url = base + '/streaks?' + urlencode({'run': 4, 'runTo': 10, **context})
profile_url = base + '/profile?' + urlencode(context)
about_url = base + '/?' + urlencode(context)
load_url = base + '/load?' + urlencode({'fromUrl': source_url})
```

Streak bounds are integers 0–100; default is exactly 4. Day bounds are integers -36,500–36,500; no bounds means all overdue. A single lower bound selects one exact bucket. Keep the upper bound at least the lower one; invalid ranges fall back in the app. The app recomputes due times when a page opens, so cards at a boundary may move since analysis. Only `/card` accepts `search`; do not imply that `/lapses` or `/leeches` can reproduce arbitrary analysis filters through query parameters.

For a Drive file, use its shareable file URL, such as `https://drive.google.com/file/d/<FILE_ID>/view`, preserving `resourcekey` if present. Public file links using `open?id=` or `uc?id=` also work; folders and sign-in-only files do not. Connector access does not imply public browser access. Check sharing when available; if restricted, explain the public-link requirement or offer local loading without changing permissions. Other direct HTTPS URLs require browser cross-origin access. Encode the complete source URL through `urlencode`, including any `&`, `+`, or `#`.

`fromUrl` belongs only on `/load`; keep loading separate from navigation. A non-load link uses the saved export. If the profile/session constraints fail, Rasbora clears the loaded copy and redirects to `/load`, losing the destination; the user must load the matching file and reopen the original link. Explain that recovery only when relevant. A load link fetches again every time it opens and replaces the previously loaded file.
