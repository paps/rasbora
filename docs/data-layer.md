# The data layer

**Queries live with the page that asks them.** A page that needs data gets a
`<Page>.db.ts` companion next to it, holding that page's SQL and returning
typed results; the `.tsx` renders and never runs a query itself. Start there
every time, including when a query looks reusable. Two pages running
near-identical SQL is not a problem to fix — they will diverge as each page's
question sharpens, and a shared helper bent to serve both is worse than two
straightforward queries.

`src/database/` holds only what is true of _any_ export, whatever page is
looking at it. `plecoFile.ts` handles the shared reads below;
`reviewSchedule.ts` holds the pure score-to-days and due-time arithmetic, and
`reviewLog.ts` the grade encoding and the run at the head of a card's log.

`reviewLog.ts` is there on the correctness test rather than because three pages
wanted it: `Learning distribution` counts cards into run buckets and `Streaks`
lists the cards in one of them — or in a band of them — so a bar saying 530
that opens a list of 529 is a bug, and two copies of that walk are exactly how
it happens. `Lapses` reads
the same encoding for its own question. Like `reviewSchedule.ts` it runs no
query — it is arithmetic over columns a page already read.

`wholeDaysUntil()` in `reviewSchedule.ts` is there on the same test, one page
later: `Incoming reviews` counts cards into whole-day buckets and `Due cards`
lists the cards in one of them, so the floor that decides which bucket -0.2
days lands in has to be one line and not two. It is a division and a
`Math.floor`, which is exactly the size of thing that gets quietly rewritten
with a `Math.round` in one of the two places.

- **Opening an export** — the sql.js bootstrap, the cached WebAssembly
  compilation, and the `FormatString` assertion. One compilation for the whole
  app, and `DatabaseProvider` owns the lifecycle. The bare `openSqlite(bytes)`
  underneath is exported too, because the export is not the only SQLite the app
  reads — the bundled dictionary is one as well — and both going through it is
  what keeps that "one compilation" true.
- **Reading values** — `rowsOf`, `firstValueOf`, `asText`, `asCount`. SQLite is
  dynamically typed and sql.js hands back `SqlValue[][]`, so every read is
  narrowed by hand. These are shared so that a NULL means the same thing
  everywhere; do not re-roll them per page — the dictionary reads through them
  too.
- **Score tables** — `listScorefiles()`. Review state lives in
  `pleco_flash_scores_<N>`, ids are sparse, and the tables have to be found at
  runtime. Hardcoding `pleco_flash_scores_1` does not fail, it silently ignores
  the other scorefiles, which is exactly why this one is shared.
- **Profiles** — `listProfiles()`. Every page reads through a profile, so its
  two links out have to be resolved before anything else can run, and both are
  traps: `pro_scorefile` names the scorefile and does _not_ match the profile's
  own id, and `pro_categories` is comma-**terminated**. The returned
  `categoryIds` also descend into child categories — inferred, since no export
  seen so far nests them, but a profile naming a parent and quietly losing its
  children would undercount every page. Ids come back as integers, so a page
  can interpolate them into an `in (…)` clause.
- **Card points per day** — `readCardPointsPerDay()`. Read through the profile
  id even if two profiles share a scorefile. Missing, nonfinite or nonpositive
  settings return null, never an assumed rate of 100. `reviewSchedule.ts`
  centralizes conversion so no page mixes seconds and days or counts the
  interval from a score-change date instead of the last review.
- **Profile settings** — `readProfileSetting()` and `readSettingNumbers()`.
  Both are traps rather than conveniences: the settings bag is keyed by
  `propset`, which is the _profile_ id, so a page reaching for
  `pro_scoreautomax` with the wrong column gets a plausible answer from another
  profile; and multi-valued settings are comma-**terminated**, so a naive
  `split(",")` appends a NaN to the score thresholds every card is compared
  against. What a setting _means_ still belongs to the page that reads it.

Note what is _not_ a reason to add to `plecoFile.ts`: several pages needing it.
Shared code here earns its place by correctness — **a per-page version would be
wrong, not just repeated.** A query stays with its page however data-layerish
it feels. Its predecessor `plecoDatabase.ts` filled up because "it belongs in
the data layer" was reason enough, which is what a grab bag sounds like from
the inside.

[pleco-export-format.md](../pleco-export-format.md) stays the authority on the schema, and its gotchas
checklist now has to be respected in each `.db.ts` rather than in one place.
`plecoFile.ts` implements only the traps that are too easy to walk into by
hand; read the checklist before writing a new query.

**A page query takes the profile.** `readCardsOverTime(database, profile)`,
`readLeeches(database, profile)`: the scope comes in as an argument
rather than being decided inside the SQL, so a page cannot accidentally answer
for the whole export. A page that has no profile in view renders its "import a
set of flashcards" sentence instead of querying — which is a link to
`/load`, since that is the one thing the reader can do about it.

`readFileSummary()` in `LoadFile.db.ts` is the **one** exception, and is meant
to stay the only one: it counts the whole export because the page asking is
about the whole export. That is not a loophole in "everything hangs off a
profile" — it is the one page in the app whose subject is the file. A query that
wants export-wide numbers to say something about _cards_ is the thing that rule
is there to stop, and it still stops it.

Note that a query function cannot simply live in the `.tsx`:
`react-refresh/only-export-components` fails the check when a file exports both
a component and a function, which is the other reason for the companion file.

See [Imports and storage](imports-and-storage.md) for the database lifecycle
and [Architecture](architecture.md#static-assets) for the WebAssembly asset.
