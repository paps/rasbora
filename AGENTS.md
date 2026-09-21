# Rasbora

A single page app built with React, TypeScript, Vite, Mantine, sql.js, ESLint and Prettier. Everything is bog standard and must stay that way. Follow best practices at all times.

See [readme.md](readme.md) for what the app is meant to do, and [pleco-export-format.md](pleco-export-format.md) for the shape of the Pleco flashcard export it ingests.

## Everything flows from a profile

Every card page reads through the selected profile's `scorefile` and `categoryIds`. Without a profile, show an empty-state explanation rather than whole-export numbers. `LoadFile.db.ts`'s file summary is the sole export-wide exception. See [the full profile model](docs/architecture.md#everything-flows-from-a-profile).

## Principles

- **Keep it simple.** This app is meant to be easy to maintain, not clever. Prefer the boring, standard solution.
- **No dead code or dead dependencies.** If something stops being used, remove it in the same change.
- **Mantine only, with its default theme.** We are building an app, not inventing a design system. Use the Mantine components and their style props (`<Group gap="md">`, `<Card padding="lg">`, …) rather than writing CSS. `<MantineProvider>` takes no theme override, and should keep taking none unless there is a real reason.
- **Almost no custom CSS.** There is currently zero hand-written CSS, and that is the goal. If you must add some, build it from Mantine's CSS variables (`var(--mantine-spacing-md)`, `var(--mantine-color-gray-2)`, …) so it follows the theme automatically. There is no Tailwind and no CSS framework.
- **No PostCSS.** Mantine's docs recommend `postcss-preset-mantine`, but it only exists to power its mixins and `rem()` helper inside hand-written CSS. Since we write none, it would be a build step that buys nothing. If custom CSS ever becomes substantial enough to want the mixins, adding it back is the moment to reconsider — not before.

## Documentation

Read the relevant documents before changing the area they describe. Their rules and behavioral constraints apply alongside this file. Paths mentioned in the documents are relative to the repository root unless linked otherwise.

- [Architecture](docs/architecture.md) — repository layout, providers, profile scoping, script and appearance preferences, routing, and static assets.
- [Data layer](docs/data-layer.md) — query ownership, shared helpers, profile resolution, and schema traps. Also read the [export-format reference](pleco-export-format.md) before writing a query.
- [Imports and storage](docs/imports-and-storage.md) — local and remote imports, IndexedDB, concurrency, forgetting, and incoming-link validation.
- [Pages](docs/pages.md) — page purposes, controls, searching, card lists, result limits, and URL state. For chart pages, also read [Charts](docs/charts.md).
- [Components](docs/components.md) — shared card displays, review history, dates, countdowns, Chinese text, and accessibility.
- [Charts](docs/charts.md) — calculations, buckets, navigation, colours, stacking order, and interpretation limits. Also read [Pages](docs/pages.md) when changing the lists opened by chart links.
- [Dictionary](docs/dictionary.md) — CC-CEDICT lookup, normalization, loading, and attribution.
- [Tooling and deployment](docs/tooling-and-deployment.md) — ESLint plugin responsibilities and Cloudflare deployment.

## Commands

There are deliberately no `dev`/`build` npm scripts, because `npx` already does the job:

- `npx vite` serves the site on the standard port (5173).
- `npx vite build` writes the production build to `dist/`.
- `npm run check` runs ESLint and TypeScript. Run this systematically. If it passes it does not mean your change is correct, but it is a good start. It uses `--max-warnings 0`, so an ESLint warning fails the check exactly like an error does — do not leave warnings behind.
- `npm run format` runs Prettier. Run this when your work is done, before committing or pushing.
- `git push origin origin/main:refs/heads/prod` deploys — see [Deployment](docs/tooling-and-deployment.md#deployment). Fast-forward only: `prod` never carries a commit that main does not.
- `npx wrangler deploy` publishes a local `dist/` to Cloudflare by hand. It uploads what is already there and never builds, so `npx vite build` has to have run first. It is the fallback, not the usual path.

Prettier uses its defaults except for `proseWrap: "never"` in `.prettierrc.json`.

## Important information for agents

- Do not manually add line breaks within Markdown paragraphs. The file viewer handles wrapping; keep each paragraph on one source line. Prettier enforces this with `proseWrap: "never"`.
- You are strictly not allowed to add dependencies, unless explicitly asked to do so by the humans controlling you. If you think a dependency is needed, explain why and ask for permission. This applies to `@mantine/*` packages too — only `@mantine/core`, `@mantine/hooks` and `@mantine/charts` are installed, on purpose. `recharts` is here only because `@mantine/charts` needs it.
- Mantine ships documentation written for LLMs at https://mantine.dev/llms.txt, which is an index of per-topic Markdown files under https://mantine.dev/llms/. Fetch the relevant one rather than answering from memory.
- TypeScript is pinned to 6.x rather than 7.x because typescript-eslint does not support the TypeScript 7 API yet (https://github.com/typescript-eslint/typescript-eslint/issues/10940). Bump it once that lands.
