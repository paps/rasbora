# Tooling and deployment

Development and validation commands are listed in [AGENTS.md](../AGENTS.md#commands).

## Deployment

The app is static, so Cloudflare serves `dist/` and no Worker code runs: `wrangler.jsonc` has no `main`, and is five settings long because that is all an assets-only Worker needs — four of them, plus `send_metrics: false` to keep Wrangler from reporting usage back to Cloudflare.

`not_found_handling: "single-page-application"` is the one line that is not boilerplate. Routing is client-side, so `/card-count` matches no file in `dist/`; this returns `index.html` for those requests and lets React Router read the URL. Without it every route but `/` 404s when reloaded or opened from a link, and `NotFound.tsx` would never render.

**Deploying is updating the `prod` branch.** Cloudflare watches it: a push to `prod` builds the site and publishes it to https://rasbora.martintapia.com, live a few minutes later. Work lands on main, and `prod` is fast-forwarded to main when the reader should see it — so main can hold changes that are not deployed yet, and `git log origin/prod..origin/main` is exactly what the next deploy ships.

That trigger is configured in the Cloudflare dashboard, not in this repository, which is why there is no CI file here. To confirm a deploy landed, check that the live JavaScript bundle contains a string from the change rather than trusting the push alone.

## Why there are three React ESLint plugins

They do not overlap by accident, so please do not try to consolidate them:

- **`eslint-plugin-react-hooks`** owns everything about hooks. It is maintained by the React team and is the only source of the React Compiler rules (`config`, `gating`, `incompatible-library`, `preserve-manual-memoization`, `void-use-memo`).
- **`@eslint-react/eslint-plugin`** owns component and JSX rules — most importantly `no-missing-key`, which nothing else here catches. It stands in for `eslint-plugin-react`, which crashes on ESLint 10 and has not shipped since 2025-04.
- **`eslint-plugin-react-refresh`** owns fast-refresh correctness. `@eslint-react` has no equivalent rule, so this cannot be folded in.

`@eslint-react`'s `recommended-typescript` preset also enables 9 hook rules that duplicate `eslint-plugin-react-hooks`. The block of `"off"` entries in `eslint.config.js` exists to silence those duplicates — removing it makes every hook problem get reported twice.

## Analytics

`index.html` uses the project-supplied PostHog HTML snippet with the EU ingestion host, public project token, and `defaults: "2026-05-30"`. Keep the integration minimal: use PostHog's defaults and project settings rather than adding client-side feature overrides or event filtering. No npm package or React provider is needed. The loader runs only on `https://rasbora.martintapia.com`, so local development and preview deployments do not load PostHog.

When changing analytics, validate the inline script as well as running the usual checks: ESLint and TypeScript do not check inline HTML scripts. Check that localhost/previews inject no script. A blocked analytics script must leave the app usable.
