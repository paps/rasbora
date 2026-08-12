# Rasbora

A single page app built with React, TypeScript, Vite, Mantine, sql.js, ESLint
and Prettier. Everything is bog standard and must stay that way. Follow best
practices at all times.

See `readme.md` for what the app is meant to do, and
`pleco-export-format.md` for the shape of the Pleco flashcard export it
ingests.

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
src/
  main.tsx              Mounts <App /> and imports the Mantine stylesheets
  App.tsx               <MantineProvider> + <DatabaseProvider> + router
  Layout.tsx            <AppShell>: the title bar and the sidebar
  database/             What every page shares, and nothing more
    plecoFile.ts        Opening an export, reading sql.js values, score tables
    context.ts          DatabaseContext + the useDatabase() hook
    DatabaseProvider.tsx  Holds the imported export for the whole app
  pages/                One file per route, plus its queries
    LoadFlashcards.tsx  + LoadFlashcards.db.ts
    Statistics.tsx      + Statistics.db.ts
    Recommendations.tsx
    MostDifficultCards.tsx
    NotFound.tsx
```

Routing lives entirely in `src/App.tsx`; adding a page means adding a file
under `src/pages/`, a `<Route>`, and an entry in `Layout.tsx`'s `PAGES` list.
Page titles are just a `<Title>` at the top of each page, so there is no title
plumbing to keep in sync.

`Layout.tsx` wraps every route. Its `PAGES` list is the sidebar: each entry
says whether the page needs an imported export, and those are disabled until
one is. Disabling a link is a convenience, not a guard — the route still
answers if it is typed in, so a page that needs data has to handle
`database === null` itself.

`LoadFlashcards.tsx` imports an export and shows a summary of it.
`Statistics.tsx` charts cards over time. `Recommendations.tsx` and
`MostDifficultCards.tsx` are deliberately empty placeholders, and
`NotFound.tsx` is still just a heading.

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
  app, and `DatabaseProvider` owns the lifecycle.
- **Reading values** — `rowsOf`, `firstValueOf`, `asText`, `asCount`. SQLite is
  dynamically typed and sql.js hands back `SqlValue[][]`, so every read is
  narrowed by hand. These are shared so that a NULL means the same thing
  everywhere; do not re-roll them per page.
- **Score tables** — `listScorefiles()`. Review state lives in
  `pleco_flash_scores_<N>`, ids are sparse, and the tables have to be found at
  runtime. Hardcoding `pleco_flash_scores_1` does not fail, it silently ignores
  the other scorefiles, which is exactly why this one is shared.

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

The imported database lives **in memory only**. Reloading the page drops it and
the user has to pick the file again; there is deliberately no persistence yet.
Nothing downstream depends on where the bytes came from, so caching them in
IndexedDB later is a change to `DatabaseProvider` alone.

sql.js needs its WebAssembly module at runtime. It is wired up with Vite's
`?url` import in `plecoFile.ts`, which emits a hashed asset at build time — so
there is no `public/` directory and nothing to copy by hand.

Note that a query function cannot simply live in the `.tsx`:
`react-refresh/only-export-components` fails the check when a file exports both
a component and a function, which is the other reason for the companion file.

## Charts

`@mantine/charts` (and its `recharts` peer) is installed for the Statistics
page. It is the only reason either package is here, so keep chart work on
`<LineChart>` and friends rather than dropping to raw recharts.

`Statistics.db.ts` shapes the data and names the series; `Statistics.tsx` picks
the colours. Two things there are load-bearing:

- **The series count is capped.** An export can hold dozens of categories, and
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

Prettier has no config file on purpose — the defaults are fine.

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
- When you make visual changes, the humans controlling you appreciate a
  screenshot of the changed area. If you are working within a PR, put it in the
  PR description.
- Mantine ships documentation written for LLMs at https://mantine.dev/llms.txt,
  which is an index of per-topic Markdown files under https://mantine.dev/llms/.
  Fetch the relevant one rather than answering from memory.
- TypeScript is pinned to 6.x rather than 7.x because typescript-eslint does not
  support the TypeScript 7 API yet
  (https://github.com/typescript-eslint/typescript-eslint/issues/10940). Bump it
  once that lands.
