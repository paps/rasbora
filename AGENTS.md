# Rasbora

A single page app built with React, TypeScript, Vite, Mantine, sql.js, ESLint
and Prettier. Everything is bog standard and must stay that way. Follow best
practices at all times.

See `readme.md` for what the app is meant to do, and
`pleco-export-format.md` for the shape of the Pleco flashcard export it
ingests.

## The mental model: everything flows from a profile

This is how a Pleco user thinks, and the app has to keep matching it.

A **profile** is the top of Pleco's model. It is what the user picks before a
review session, and from it flows: the **scorefile** the session reads and
writes, the **cards** it reviews (through the categories the profile loads —
often one, sometimes several), and the **settings** it runs under. Scores,
difficulty and review history live per scorefile, so the same card can be
saturated in one profile and unseen in another; a number read without knowing
its profile means nothing.

Everything the app shows therefore hangs off one selected profile:

- The profile is **global state**, held by `DatabaseProvider` next to the
  imported file, and picked in the title bar so it is visible on every page.
- A page reads through `profile.scorefile` and `profile.categoryIds`, never
  across the whole export. Summing a card's reviews over every scorefile
  answers a question nobody asked.
- Pages with no profile in view say so; they do not fall back to whole-file
  numbers.

If a new feature seems to need export-wide numbers, that is a signal worth
questioning before writing it.

## The other global: which script cards are written in

A Pleco card carries both written forms — `hw` is simplified, `althw`
traditional — and a learner reads one of them. Which one is app-wide state, held
by `ScriptProvider` and picked in the title bar beside the profile.

It is global for the same reason the profile is: the same card appears in a
table and again in a drawer, and the two have to agree. A page that had to ask
for the script could forget to, and would then render a card in the form the
rest of the app is not using.

Three things follow, and they are the ones to keep in mind when touching this:

- **It is not export state, so it does not live in `src/database/`.** It
  outlives every import, means the same thing before one has happened, and no
  query reads it. `src/script/` is its own small provider for that reason.
- **The `Script` values are the `Syllable` field names.** `"simplified"` and
  `"traditional"` are exactly the fields `splitHeadword()` returns, so anything
  rendering a character writes `syllable[script]` and cannot reach for the wrong
  one. `otherScript()` gives the form shown underneath it on a flashcard.
- **The choice persists, in `localStorage` under `rasbora-script`.** This is the
  one thing in the app that survives a reload, and deliberately so: it is a
  preference rather than data. `getInitialValueInEffect: false` is load-bearing
  — Mantine otherwise reads storage in an effect after the first render, which
  would show a frame of traditional to a reader who chose simplified.

The default is **traditional**. Cards with no traditional variant are unaffected
either way: `splitHeadword()` already falls back to the simplified form, so both
scripts render the same characters for them.

Note what this does _not_ touch. Category names, profile names and anything else
the user typed into Pleco are stored strings, not headwords with two forms, so
they render as written whatever the setting says. Converting them would take a
conversion table the app does not have and will not be adding.

## The bundled dictionary: where meanings come from

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
  itself is built and refreshed by `cc-cedict/` (see that folder's readme) and
  committed as a binary — it is not generated at build time.

## Principles

- **Keep it simple.** This app is meant to be easy to maintain, not clever.
  Prefer the boring, standard solution.
- **No dead code or dead dependencies.** If something stops being used, remove
  it in the same change.
- **Mantine only, with its default theme.** We are building an app, not
  inventing a design system. Use the Mantine components and their style props
  (`<Group gap="md">`, `<Card padding="lg">`, …) rather than writing CSS.
  `<MantineProvider>` takes no theme override, and should keep taking none
  unless there is a real reason.
- **Almost no custom CSS.** There is currently zero hand-written CSS, and that
  is the goal. If you must add some, build it from Mantine's CSS variables
  (`var(--mantine-spacing-md)`, `var(--mantine-color-gray-2)`, …) so it follows
  the theme automatically. There is no Tailwind and no CSS framework.
- **No PostCSS.** Mantine's docs recommend `postcss-preset-mantine`, but it
  only exists to power its mixins and `rem()` helper inside hand-written CSS.
  Since we write none, it would be a build step that buys nothing. If custom
  CSS ever becomes substantial enough to want the mixins, adding it back is the
  moment to reconsider — not before.

## Layout

```
index.html
vite.config.js          Vite config (JS on purpose, so it needs no @types/node)
eslint.config.js        Flat config: typescript-eslint + @eslint-react +
                        react-hooks + react-refresh
tsconfig.json           Strict, with the "@/*" -> "./src/*" path alias
cc-cedict/              Build tooling for the bundled dictionary (see its readme)
  build.mjs             CC-CEDICT text dump → src/cc-cedict/cedict.sqlite
public/
  favicon.svg           Served as-is at /favicon.svg; see "The data layer"
src/
  main.tsx              Mounts <App /> and imports the Mantine stylesheets
  App.tsx               <MantineProvider> + <ScriptProvider> +
                        <DictionaryProvider> + <DatabaseProvider> + router
  Layout.tsx            <AppShell>: the title bar and the sidebar
  database/             What every page shares, and nothing more
    plecoFile.ts        Opening an export, the shared sql.js opener, reading
                        sql.js values, score tables, profiles
    context.ts          DatabaseContext + the useDatabase() hook
    DatabaseProvider.tsx  Holds the export and the selected profile app-wide
  script/               The written form cards are shown in
    context.ts          Script, otherScript() + the useScript() hook
    ScriptProvider.tsx  Holds the choice app-wide, in localStorage
  cc-cedict/           Where card meanings come from; see "The bundled dictionary"
    cedict.sqlite       CC-CEDICT, committed and served as a static asset
    context.ts          lookupCard(), the useDictionary() hook
    DictionaryProvider.tsx  Loads the dictionary once, app-wide
  components/           Reusable presentational pieces, shared across pages
    Flashcard.tsx       The card display, opened from any list of cards
    chinese.ts          Headword splitting and numbered-pinyin → tone marks
  pages/                One file per route, plus its queries
    ProfileInfo.tsx     + ProfileInfo.db.ts
    Statistics.tsx      + Statistics.db.ts
    Recommendations.tsx
    MostDifficultCards.tsx  + MostDifficultCards.db.ts
    NotFound.tsx
```

Routing lives entirely in `src/App.tsx`; adding a page means adding a file
under `src/pages/`, a `<Route>`, and an entry in `Layout.tsx`'s `PAGES` list.
Page titles are just a `<Title>` at the top of each page, so there is no title
plumbing to keep in sync.

`Layout.tsx` wraps every route, and its title bar holds the app's mark and name
on the left and the three controls that are global to the app on the right: the
imported file, the profile everything is read through, and the script cards are
written in. Before an import it shows one button; after one it shows the file
name, a subdued **Change** button that reopens the picker, a `<Select>` of the
export's profiles, and a 繁/简 `<SegmentedControl>` whose tooltip names the
current script in English and the one a click switches to, since the two
characters only distinguish themselves to someone who can already read them.
All three belong here rather than on a page because every page depends on them.

Fitting three controls costs the app's name below `xs`, where it is hidden and
the mark alone identifies the app. That is the constraint to respect when adding
a fourth: the title bar is full at 360 px.

Its `PAGES` list is the sidebar, and **no link is ever disabled** — a page with
nothing to read says so in a sentence instead. That is not a courtesy: routes
answer when typed in, so a page has to handle `database === null` and
`profile === null` anyway, and a disabled link would only hide the explanation.

`ProfileInfo.tsx` is the landing page and describes the selected profile: what
it reviews into, what it draws from, its session settings (the documented ones
spelled out, all ~150 raw in an `<Accordion>`), and a smaller section of
file-level facts. `Statistics.tsx` charts the profile's cards over time.
`MostDifficultCards.tsx` lists the cards the profile has failed most, and opens
one in a `<Drawer>` on click. `Recommendations.tsx` is a deliberately empty
placeholder, and `NotFound.tsx` is still just a heading.

## The data layer

**Queries live with the page that asks them.** A page that needs data gets a
`<Page>.db.ts` companion next to it, holding that page's SQL and returning
typed results; the `.tsx` renders and never runs a query itself. Start there
every time, including when a query looks reusable. Two pages running
near-identical SQL is not a problem to fix — they will diverge as each page's
question sharpens, and a shared helper bent to serve both is worse than two
straightforward queries.

`src/database/` holds only what is true of _any_ export, whatever page is
looking at it, and `plecoFile.ts` is all of it:

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

Note what is _not_ a reason to add to `plecoFile.ts`: several pages needing it.
Shared code here earns its place by correctness — **a per-page version would be
wrong, not just repeated.** A query stays with its page however data-layerish
it feels. Its predecessor `plecoDatabase.ts` filled up because "it belongs in
the data layer" was reason enough, which is what a grab bag sounds like from
the inside.

`pleco-export-format.md` stays the authority on the schema, and its gotchas
checklist now has to be respected in each `.db.ts` rather than in one place.
`plecoFile.ts` implements only the traps that are too easy to walk into by
hand; read the checklist before writing a new query.

**A page query takes the profile.** `readCardsOverTime(database, profile)`,
`readMostDifficultCards(database, profile)`: the scope comes in as an argument
rather than being decided inside the SQL, so a page cannot accidentally answer
for the whole export. A page that has no profile in view renders its "import a
set of flashcards" sentence instead of querying.

The imported database lives **in memory only**, and so does the profile
selection, which resets to the export's first profile on every import.
Reloading the page drops both and the user has to pick the file again; no
_export data_ is persisted yet. Nothing downstream depends on where the bytes
came from, so caching them in IndexedDB later is a change to `DatabaseProvider`
alone.

The script preference is the one exception, and is not export data: see "The
other global" above.

sql.js needs its WebAssembly module at runtime. It is wired up with Vite's
`?url` import in `plecoFile.ts`, which emits a hashed asset at build time — so
no asset the code refers to has to be copied by hand. The bundled dictionary,
`src/cc-cedict/cedict.sqlite`, is the second such asset: a committed binary
imported `?url` and fetched at runtime, hashed and cached like the wasm.

`public/` holds only what has to keep a fixed URL and so cannot be hashed:
today that is `favicon.svg` alone. Anything the code imports belongs in `src/`
with a `?url` import instead, which is why the directory stayed empty until a
favicon needed it. `Layout.tsx` showing the same file beside the title is not
an exception to that: it writes the fixed `/favicon.svg` URL rather than
importing it, so the tab icon and the one in the title bar stay the same
picture and the file is served once.

Note that a query function cannot simply live in the `.tsx`:
`react-refresh/only-export-components` fails the check when a file exports both
a component and a function, which is the other reason for the companion file.

## Components

`src/components/` is for presentation that more than one page renders — and here
being shared is the whole point, unlike the data layer, where sharing has to
earn itself. A card looks the same wherever it is shown, so the display lives in
one place and pages hand it data.

`Flashcard.tsx` is that display and is meant to be _the_ way a single card is
shown app-wide: give it a `FlashcardData` and it renders the headword, pinyin,
any note and the review tally, holding no state. Its `FlashcardData` is the
vocabulary item plus the review counts read from the caller's profile scorefile.
`score` and `difficulty` are left out because they only mean something next to
the profile settings that bound them. A page that needs more can widen the
contract; do not fork the component.

It reads two globals for itself. `useScript()`, which decides which form the big
glyphs show and which is dimmed underneath; and `useDictionary()`, for the
CC-CEDICT gloss shown below the user's own note. Both are deliberately hooks
rather than props, for the same reason — a page could forget to pass them and
show a card out of step with the rest of the app. It stays a rendering component
either way: these are the only things it reaches for, and it still owns no
state.

`chinese.ts` is the pure text side of that: splitting a headword on `@` into
aligned simplified/traditional/pinyin syllables, and turning numbered pinyin
(`duan4`) into tone marks (`duàn`). The difficult-cards table and the flashcard
both call it, so it is here and not in either. It runs no query — a page's
`.db.ts` returns the raw columns and this shapes them for the eye.

## Charts

`@mantine/charts` (and its `recharts` peer) is installed for the Statistics
page. It is the only reason either package is here, so keep chart work on
`<LineChart>` and friends rather than dropping to raw recharts.

`Statistics.db.ts` shapes the data and names the series; `Statistics.tsx` picks
the colours. Three things there are load-bearing:

- **The chart is the profile's, not the file's.** Only the categories the
  profile draws from get a line, and the total counts cards in those categories
  — distinctly, since a card in two of them is still one card. There is no
  "uncategorised" series any more: within a profile, every card in scope is in
  one of its categories by definition.
- **The series count is capped.** A profile can load dozens of categories, and
  a line each would be unreadable, so the biggest six keep their own line and
  the rest are summed into "Other categories" — named in the caption under the
  chart, because a silently dropped category reads as a category with no cards.
- **`CATEGORY_COLORS` was checked, not chosen by eye.** The order is
  colourblind-safe as a set and every entry clears the lightness and chroma
  bands against a white surface. Reordering it or adding to it silently
  invalidates that, so re-check it if you do.

The chart can only say when a card was _created_: the export keeps no history
of category membership, so a card counts towards the categories it is in today.
That caveat is in the caption and should stay there.

## Commands

There are deliberately no `dev`/`build` npm scripts, because `npx` already does
the job:

- `npx vite` serves the site on the standard port (5173).
- `npx vite build` writes the production build to `dist/`.
- `npm run check` runs ESLint and TypeScript. Run this systematically. If it
  passes it does not mean your change is correct, but it is a good start. It
  uses `--max-warnings 0`, so an ESLint warning fails the check exactly like an
  error does — do not leave warnings behind.
- `npm run format` runs Prettier. Run this when your work is done, before
  committing or pushing.
- `npx wrangler deploy` publishes `dist/` to Cloudflare. It uploads what is
  already there and never builds, so `npx vite build` has to have run first.

Prettier has no config file on purpose — the defaults are fine.

## Deployment

The app is static, so Cloudflare serves `dist/` and no Worker code runs:
`wrangler.jsonc` has no `main`, and is five settings long because that is all
an assets-only Worker needs — four of them, plus `send_metrics: false` to keep
Wrangler from reporting usage back to Cloudflare.

`not_found_handling: "single-page-application"` is the one line that is not
boilerplate. Routing is client-side, so `/statistics` matches no file in
`dist/`; this returns `index.html` for those requests and lets React Router
read the URL. Without it every route but `/` 404s when reloaded or opened from
a link, and `NotFound.tsx` would never render.

Deploys are manual and there is no CI: build, then deploy. That is deliberate,
for the same reason there are no `dev`/`build` scripts — two `npx` commands do
not need a wrapper.

## Why there are three React ESLint plugins

They do not overlap by accident, so please do not try to consolidate them:

- **`eslint-plugin-react-hooks`** owns everything about hooks. It is maintained
  by the React team and is the only source of the React Compiler rules
  (`config`, `gating`, `incompatible-library`, `preserve-manual-memoization`,
  `void-use-memo`).
- **`@eslint-react/eslint-plugin`** owns component and JSX rules — most
  importantly `no-missing-key`, which nothing else here catches. It stands in
  for `eslint-plugin-react`, which crashes on ESLint 10 and has not shipped
  since 2025-04.
- **`eslint-plugin-react-refresh`** owns fast-refresh correctness.
  `@eslint-react` has no equivalent rule, so this cannot be folded in.

`@eslint-react`'s `recommended-typescript` preset also enables 9 hook rules that
duplicate `eslint-plugin-react-hooks`. The block of `"off"` entries in
`eslint.config.js` exists to silence those duplicates — removing it makes every
hook problem get reported twice.

## Important information for agents

- You are strictly not allowed to add dependencies, unless explicitly asked to
  do so by the humans controlling you. If you think a dependency is needed,
  explain why and ask for permission. This applies to `@mantine/*` packages too
  — only `@mantine/core`, `@mantine/hooks` and `@mantine/charts` are installed,
  on purpose. `recharts` is here only because `@mantine/charts` needs it.
- Mantine ships documentation written for LLMs at https://mantine.dev/llms.txt,
  which is an index of per-topic Markdown files under https://mantine.dev/llms/.
  Fetch the relevant one rather than answering from memory.
- TypeScript is pinned to 6.x rather than 7.x because typescript-eslint does not
  support the TypeScript 7 API yet
  (https://github.com/typescript-eslint/typescript-eslint/issues/10940). Bump it
  once that lands.
