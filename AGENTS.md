# Rasbora

A single page app built with React, TypeScript, Vite, Mantine, sql.js, ESLint and Prettier. Everything is bog standard and must stay that way. Follow best practices at all times.

See [README.md](README.md) for what the app is meant to do, and [pleco-export-format.md](agent-notes/pleco-export-format.md) for the shape of the Pleco flashcard export it ingests.

## Everything flows from a profile

Every card page reads through the selected profile's `scorefile` and `categoryIds`. Without a profile, show an empty-state explanation rather than whole-export numbers. `LoadFile.db.ts`'s file summary is the sole export-wide exception. See [the full profile model](agent-notes/architecture.md#everything-flows-from-a-profile).

## Principles

- **Keep it simple.** This app is meant to be easy to maintain, not clever. Prefer the boring, standard solution.
- **No dead code or dead dependencies.** If something stops being used, remove it in the same change.
- **Mantine only, with its default theme.** We are building an app, not inventing a design system. Use the Mantine components and their style props (`<Group gap="md">`, `<Card padding="lg">`, …) rather than writing CSS. `<MantineProvider>` takes no theme override, and should keep taking none unless there is a real reason.
- **Almost no custom CSS.** There is currently zero hand-written CSS, and that is the goal. If you must add some, build it from Mantine's CSS variables (`var(--mantine-spacing-md)`, `var(--mantine-color-gray-2)`, …) so it follows the theme automatically. There is no Tailwind and no CSS framework.
- **No PostCSS.** Mantine's docs recommend `postcss-preset-mantine`, but it only exists to power its mixins and `rem()` helper inside hand-written CSS. Since we write none, it would be a build step that buys nothing. If custom CSS ever becomes substantial enough to want the mixins, adding it back is the moment to reconsider — not before.

## Agent notes

Refrain from modifying `AGENTS.md` or `README.md` unless you are only adding links to other files or have been specifically asked to modify it.

The documents in `agent-notes/` are notes by and for agents. Read the relevant notes before changing the area they describe. Their rules and behavioral constraints apply alongside this file. Agents are welcome to add notes or modify existing ones when they think it will be useful for future work. Paths mentioned in the notes are relative to the repository root unless linked otherwise.

- [Architecture](agent-notes/architecture.md) — repository layout, providers, profile scoping, script and appearance preferences, routing, and static assets.
- [Data layer](agent-notes/data-layer.md) — query ownership, shared helpers, profile resolution, and schema traps. Also read the [export-format reference](agent-notes/pleco-export-format.md) before writing a query.
- [Imports and storage](agent-notes/imports-and-storage.md) — local and remote imports, IndexedDB, concurrency, forgetting, and incoming-link validation.
- [Pages](agent-notes/pages.md) — page purposes, controls, searching, card lists, result limits, and URL state. For chart pages, also read [Charts](agent-notes/charts.md).
- [Components](agent-notes/components.md) — shared card displays, review history, dates, countdowns, Chinese text, and accessibility.
- [Charts](agent-notes/charts.md) — calculations, buckets, navigation, colours, stacking order, and interpretation limits. Also read [Pages](agent-notes/pages.md) when changing the lists opened by chart links.
- [Dictionary](agent-notes/dictionary.md) — CC-CEDICT lookup, normalization, loading, and attribution.
- [Tooling and deployment](agent-notes/tooling-and-deployment.md) — ESLint plugin responsibilities and Cloudflare deployment.

## Project management

Project management is often done through GitHub issues using the `gh` CLI. Agents should refrain from adding or updating issue text, including titles, descriptions, and comments. Linking pull requests, assigning themselves to the issue, and moving it through the usual statuses — backlog → doing → in review → done — is generally enough.

## Git worktrees

Unless explicitly specified otherwise, place new Git worktrees in `worktrees/` at the root of the main repository checkout (for example, `worktrees/my-change/`). If you are already in a linked worktree, use the main checkout's directory rather than nesting worktrees. Only `worktrees/.gitignore` belongs in Git; the worktree contents stay local.

## Commands

There are deliberately no `dev`/`build` npm scripts, because `npx` already does the job:

- `npx vite` serves the site on the standard port (5173).
- `npx vite build` writes the production build to `dist/`.
- `npm run check` runs ESLint and TypeScript. Run this systematically. If it passes it does not mean your change is correct, but it is a good start. It uses `--max-warnings 0`, so an ESLint warning fails the check exactly like an error does — do not leave warnings behind.
- `npm run format` runs Prettier. Run this when your work is done, before committing or pushing.
- `git push origin origin/main:refs/heads/prod` deploys — see [Deployment](agent-notes/tooling-and-deployment.md#deployment). Fast-forward only: `prod` never carries a commit that main does not.
- `npx wrangler deploy` publishes a local `dist/` to Cloudflare by hand. It uploads what is already there and never builds, so `npx vite build` has to have run first. It is the fallback, not the usual path.

Prettier uses its defaults except for `proseWrap: "never"` in `.prettierrc.json`.

## Important information for agents

- Do not manually add line breaks within Markdown paragraphs. The file viewer handles wrapping; keep each paragraph on one source line. Prettier enforces this with `proseWrap: "never"`.
- You are strictly not allowed to add dependencies, unless explicitly asked to do so by the the user. If you think a dependency is needed, explain why and ask for permission. This applies to `@mantine/*` packages too — only `@mantine/core`, `@mantine/hooks` and `@mantine/charts` are installed, on purpose. `recharts` is here only because `@mantine/charts` needs it.
- Mantine ships documentation written for LLMs at https://mantine.dev/llms.txt, which is an index of per-topic Markdown files under https://mantine.dev/llms/. Fetch the relevant one rather than answering from memory.
- TypeScript is pinned to 6.x rather than 7.x because typescript-eslint does not support the TypeScript 7 API yet (https://github.com/typescript-eslint/typescript-eslint/issues/10940). Bump it once that lands.
