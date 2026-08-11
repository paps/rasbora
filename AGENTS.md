# Rasbora

A single page app built with React, TypeScript, Vite, Mantine, ESLint and
Prettier. Everything is bog standard and must stay that way. Follow best
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
  main.tsx              Mounts <App /> and imports the Mantine stylesheet
  App.tsx               <MantineProvider> + router
  pages/                One file per route
    Home.tsx
    NotFound.tsx
```

Routing lives entirely in `src/App.tsx`; adding a page means adding a file
under `src/pages/` and a `<Route>`. Page titles are just a `<Title>` at the top
of each page, so there is no title plumbing to keep in sync.

The app is currently an empty shell — the two pages render a heading and
nothing else. There is no Pleco parsing, no state and no data layer yet.

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

This app runs locally only. There is no deploy target and no hosting config.

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
  — only `@mantine/core` and `@mantine/hooks` are installed, on purpose.
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
