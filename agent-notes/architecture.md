# Architecture

## Everything flows from a profile

This is how a Pleco user thinks, and the app has to keep matching it.

A **profile** is the top of Pleco's model. It is what the user picks before a review session, and from it flows: the **scorefile** the session reads and writes, the **cards** it reviews (through the categories the profile loads — often one, sometimes several), and the **settings** it runs under. Scores, difficulty and review history live per scorefile, so the same card can be saturated in one profile and unseen in another; a number read without knowing its profile means nothing.

Everything the app shows therefore hangs off one selected profile:

- The profile is **global state**, held by `DatabaseProvider` next to the imported file, and picked in the title bar so it is visible on every page.
- A page reads through `profile.scorefile` and `profile.categoryIds`, never across the whole export. Summing a card's reviews over every scorefile answers a question nobody asked.
- Pages with no profile in view say so; they do not fall back to whole-file numbers.

If a new feature seems to need export-wide numbers, that is a signal worth questioning before writing it.

## Which script cards are written in

A Pleco card carries both written forms — `hw` is simplified, `althw` traditional — and a learner reads one of them. Which one is app-wide state, held by `ScriptProvider` and picked on the `Load Pleco file` page.

It is global for the same reason the profile is: the same card appears in a table and again in a dialog, and the two have to agree. A page that had to ask for the script could forget to, and would then render a card in the form the rest of the app is not using.

Three things follow, and they are the ones to keep in mind when touching this:

- **It is not export state, so it does not live in `src/database/`.** It outlives every import, means the same thing before one has happened, and no query reads it. `src/script/` is its own small provider for that reason.
- **The `Script` values are the `Syllable` field names.** `"simplified"` and `"traditional"` are exactly the fields `splitHeadword()` returns, so anything rendering a character writes `syllable[script]` and cannot reach for the wrong one. `otherScript()` gives the form shown underneath it on a flashcard.
- **The choice persists, in `localStorage` under `rasbora-script`.** This preference survives a reload independently of the saved export and selected profile. `getInitialValueInEffect: false` is load-bearing — Mantine otherwise reads storage in an effect after the first render, which would show a frame of traditional to a reader who chose simplified.

The default is **traditional**. Cards with no traditional variant are unaffected either way: `splitHeadword()` already falls back to the simplified form, so both scripts render the same characters for them.

Note what this does _not_ touch. Category names, profile names and anything else the user typed into Pleco are stored strings, not headwords with two forms, so they render as written whatever the setting says. Converting them would take a conversion table the app does not have and will not be adding.

## Light or dark

The page itself, and the only one of the three globals the app does not hold. `<MantineProvider defaultColorScheme="auto">` and `useMantineColorScheme()` are the whole mechanism; the control sits at the bottom of `Load Pleco file`, under the script one, because it is the same kind of choice — made once, about the room you are in, not about the page you are on.

Three things to keep in mind:

- **`auto` is the default, and it is a real third value.** It means "follow the browser" and keeps following it when the OS flips at sunset; light and dark are overrides. That is why the control has three segments and not two — a two-way toggle can leave `auto` but never return to it. Mantine's own default is `light`, which would ignore a preference the browser already states, so `defaultColorScheme="auto"` on the provider is load-bearing.
- **Mantine owns the storage, so there is no provider beside `ScriptProvider`.** The value lives in `localStorage` under `mantine-color-scheme-value`, written by Mantine's own manager. Nothing in `src/` should re-roll it. There is no `ColorSchemeScript` either: it exists to stop a flash of the wrong scheme between server-rendered HTML and hydration, and this app has no server — Mantine sets the attribute in a layout effect, before the first paint.
- **A colour that is a _surface_ follows the scheme; a colour that is _data_ does not.** This is the line to hold when adding anything coloured. A shade like `red.8` is a fixed hex in Mantine whatever the scheme, and that is correct for the grade ramp: a ΔE between two of them is a property of the pair and does not move with the page behind it. What inverts is neutrals — a track, a rule, a line that is grey _because_ it is not a hue. Those are written as `light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))`, built from Mantine's variables as the CSS principle in [AGENTS.md](../AGENTS.md#principles) requires, and they follow the switch without any component reading state. Mantine's baseline already sets `color-scheme` from its own value, so `light-dark()` tracks `auto` too.

The flashcard timeline's arrow and the chart's total and "Other categories" series follow this rule. Review countdowns use plain Mantine red and green text, with the minus sign preserving the overdue distinction without colour.

The bundled dictionary is another app-wide provider; see [Dictionary](dictionary.md) for its lookup and loading rules.

## Repository layout

```
index.html
vite.config.js          Vite config (JS on purpose, so it needs no @types/node)
eslint.config.js        Flat config: typescript-eslint + @eslint-react +
                        react-hooks + react-refresh
tsconfig.json           Strict, with the "@/*" -> "./src/*" path alias
cc-cedict/              Build tooling for the bundled dictionary (see its readme)
  build.mjs             CC-CEDICT text dump → src/cc-cedict/cedict.sqlite
public/
  favicon.svg           Served as-is at /favicon.svg; see "Static assets" below
src/
  main.tsx              Mounts <App /> and imports the Mantine stylesheets
  App.tsx               <MantineProvider> + <ScriptProvider> +
                        <DictionaryProvider> + <DatabaseProvider> + router
  Layout.tsx            <AppShell>: the title bar and the sidebar
  LinkedExport.tsx      Checks incoming link constraints before routes mount
  linkTarget.ts         Parses constraints and matches profile metadata
  database/             What every page shares, and nothing more
    plecoFile.ts        Opening an export, the shared sql.js opener, reading
                        sql.js values, score tables, profiles
    reviewSchedule.ts   Score-to-days conversion, estimated due timestamps
                        and the whole day until one
    reviewLog.ts        Grade meanings and the run at the head of a review log
    context.ts          DatabaseContext + the useDatabase() hook
    DatabaseProvider.tsx  Restores and holds the export and selected profile
    savedImport.ts      IndexedDB storage of the original file and profile choice
  script/               The written form cards are shown in
    context.ts          Script, otherScript() + the useScript() hook
    ScriptProvider.tsx  Holds the choice app-wide, in localStorage
  cc-cedict/           Where card meanings come from; see dictionary.md
    cedict.sqlite       CC-CEDICT, committed and served as a static asset
    context.ts          lookupCard(), the useDictionary() hook
    DictionaryProvider.tsx  Loads the dictionary once, app-wide
  components/           Reusable presentational pieces, shared across pages
    Flashcard.tsx       The card display, opened from any list of cards
    CardList.tsx        The table of cards that opens one, with its paging
    Explained.tsx       Dotted-underlined text a hover/focus/tap explains
    RelativeTime.tsx    "3 months ago", with the exact date on hover
    ReviewDue.tsx       Signed days until review, shared by lists and cards
    days.ts             Fractional-day formatting, including near-zero signs
    chinese.ts          Headword splitting and numbered-pinyin → tone marks
  pages/                One file per route, plus its queries
    About.tsx
    ProfileInfo.tsx     + ProfileInfo.db.ts
    CardCount.tsx       + CardCount.db.ts
    LearningDistribution.tsx + LearningDistribution.db.ts
    IncomingReviews.tsx      + IncomingReviews.db.ts
    NewCards.tsx             + NewCards.db.ts
    Leeches.tsx              + Leeches.db.ts
    Lapses.tsx               + Lapses.db.ts
    Streaks.tsx              + Streaks.db.ts
    DueCards.tsx             + DueCards.db.ts
    CustomizedCards.tsx      + CustomizedCards.db.ts
    SearchCard.tsx           + SearchCard.db.ts
    LoadFile.tsx             + LoadFile.db.ts + LoadFile.remote.ts
    NotFound.tsx
```

## Routing

Routing lives entirely in `src/App.tsx`; adding a page means adding a file under `src/pages/`, a `<Route>`, and an entry in `Layout.tsx`'s `PAGES` list. Page titles are just a `<Title>` at the top of each page, so there is no title plumbing to keep in sync.

`/` renders `About.tsx`, the first item in the sidebar and the one page that is about the app rather than an export. `ProfileInfo.tsx` lives at `/profile`. `Layout` still waits for restoration before mounting routes so `LinkedExport` can validate incoming constraints against the saved export before any page effects run.

See [incoming-link validation](imports-and-storage.md#incoming-link-validation) for the constraints checked before routes mount, and [Pages](pages.md) for individual page behavior.

## Title bar and sidebar

`Layout.tsx` wraps every route. Its title bar holds the app's mark, its name and one control — a `<Select>` of the export's profiles — and all of it is left-aligned, as one group beside the mark.

**Only what changes while reading belongs up here.** The profile does: the same page answers differently under another profile, so it has to be reachable from every one of them. The file and the written form do not — you pick a file when you arrive and a script because of where you are learning — so they live on `Load Pleco file`, which is what the title bar being full at 360 px was telling us. Ask that question before adding a second control, not how many will fit.

**Nothing is pushed to the right edge, either.** A right-aligned group is only ever as far right as the layout viewport, and a card table wider than the screen widens that on a phone — so the controls ended up off the right edge on exactly the screens with the least room to spare. Left-aligned, they sit where the mark puts them whatever the page below is doing. The `<Select>` takes the rest of the row up to a `maw`, so a long profile name reads in full on a desktop and still fits beside the mark on a phone.

`Layout.tsx`'s `PAGES` list is the sidebar, and **no link is ever disabled** — a page with nothing to read says so in a sentence instead. That is not a courtesy: routes answer when typed in, so a page has to handle `database === null` and `profile === null` anyway, and a disabled link would only hide the explanation.

## Static assets

sql.js needs its WebAssembly module at runtime. It is wired up with Vite's `?url` import in `plecoFile.ts`, which emits a hashed asset at build time — so no asset the code refers to has to be copied by hand. The bundled dictionary, `src/cc-cedict/cedict.sqlite`, is the second such asset: a committed binary imported `?url` and fetched at runtime, hashed and cached like the wasm.

`public/` holds only what has to keep a fixed URL and so cannot be hashed: today that is `favicon.svg` alone. Anything the code imports belongs in `src/` with a `?url` import instead, which is why the directory stayed empty until a favicon needed it. `Layout.tsx` showing the same file beside the title is not an exception to that: it writes the fixed `/favicon.svg` URL rather than importing it, so the tab icon and the one in the title bar stay the same picture and the file is served once.
