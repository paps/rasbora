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
by `ScriptProvider` and picked on the `Load Pleco file` page.

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
- **The choice persists, in `localStorage` under `rasbora-script`.** This
  preference survives a reload independently of the saved export and selected
  profile. `getInitialValueInEffect: false` is load-bearing
  — Mantine otherwise reads storage in an effect after the first render, which
  would show a frame of traditional to a reader who chose simplified.

The default is **traditional**. Cards with no traditional variant are unaffected
either way: `splitHeadword()` already falls back to the simplified form, so both
scripts render the same characters for them.

Note what this does _not_ touch. Category names, profile names and anything else
the user typed into Pleco are stored strings, not headwords with two forms, so
they render as written whatever the setting says. Converting them would take a
conversion table the app does not have and will not be adding.

## The third global: light or dark

The page itself, and the only one of the three globals the app does not hold.
`<MantineProvider defaultColorScheme="auto">` and `useMantineColorScheme()` are
the whole mechanism; the control sits at the bottom of `Load Pleco file`, under
the script one, because it is the same kind of choice — made once, about the
room you are in, not about the page you are on.

Three things to keep in mind:

- **`auto` is the default, and it is a real third value.** It means "follow the
  browser" and keeps following it when the OS flips at sunset; light and dark
  are overrides. That is why the control has three segments and not two — a
  two-way toggle can leave `auto` but never return to it. Mantine's own default
  is `light`, which would ignore a preference the browser already states, so
  `defaultColorScheme="auto"` on the provider is load-bearing.
- **Mantine owns the storage, so there is no provider beside `ScriptProvider`.**
  The value lives in `localStorage` under `mantine-color-scheme-value`, written
  by Mantine's own manager. Nothing in `src/` should re-roll it. There is no
  `ColorSchemeScript` either: it exists to stop a flash of the wrong scheme
  between server-rendered HTML and hydration, and this app has no server —
  Mantine sets the attribute in a layout effect, before the first paint.
- **A colour that is a _surface_ follows the scheme; a colour that is _data_
  does not.** This is the line to hold when adding anything coloured. A shade
  like `red.8` is a fixed hex in Mantine whatever the scheme, and that is
  correct for the grade ramp: a ΔE between two of them is a
  property of the pair and does not move with the page behind it. What inverts
  is neutrals — a track, a rule, a line that is grey _because_ it is not a hue.
  Those are written as
  `light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))`, built
  from Mantine's variables as the CSS principle above requires, and they follow
  the switch without any component reading state. Mantine's baseline already
  sets `color-scheme` from its own value, so `light-dark()` tracks `auto` too.

The flashcard timeline's arrow and the chart's total and "Other categories"
series follow this rule. Review countdowns use plain Mantine red and green text,
with the minus sign preserving the overdue distinction without colour.

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
  cc-cedict/           Where card meanings come from; see "The bundled dictionary"
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

Routing lives entirely in `src/App.tsx`; adding a page means adding a file
under `src/pages/`, a `<Route>`, and an entry in `Layout.tsx`'s `PAGES` list.
Page titles are just a `<Title>` at the top of each page, so there is no title
plumbing to keep in sync.

`/` renders `About.tsx`, the first item in the sidebar and the one page that is
about the app rather than an export. `ProfileInfo.tsx` lives at `/profile`.
`Layout` still waits for restoration before mounting routes so `LinkedExport`
can validate incoming constraints against the saved export before any page
effects run.

`About.tsx` carries one highlighted panel, pointing at the repo's own agent
skill (`.agents/skills/pleco-flashcards/SKILL.md`). It is the page's only
`<Alert>`, and it is one because the skill is a second way to read an export
rather than another sentence about this one. Three things there are
deliberate. It sits **right after the _load a Pleco export_ line**, since it is
the next thing to do with an export and not a footnote. The `SKILL_URL` is
printed **in full rather than behind link text**, because its use is being
copied into an agent somewhere else — which is also why it is the raw
`raw.githubusercontent.com` URL: a person can read it and an agent can fetch
it unchanged. And it points at **`main`, never a pinned commit** — a reader who
followed one would get a skill older than the app it describes.

`LinkedExport.tsx` gates all routes inside Layout, after saved-file restoration.
It reads optional `profileId` and `lastSessionStart` parameters through the pure
resolver in `linkTarget.ts`. Profile metadata carries the raw `laststart` as
`lastSessionStart`, including zero and preserving NULL. Both constraints must
match the same profile; a timestamp alone searches all profiles and selects a
match, preferring the current profile on ties, then Pleco's order. Malformed,
empty and repeated values fail rather than silently dropping a constraint.

A successful link selects the matching profile and consumes only these two
parameters. A mismatch immediately unloads the export through
`forgetFile({ unloadImmediately: true })`, attempts the same guarded IndexedDB
removal as the normal Forget action, and replaces the URL with plain `/load`.
The navigation state carries only a `wrongExport` flag for the Load page's alert;
the original destination and query parameters are deliberately lost. The user
loads a file and follows the original link again. Routes do not mount while
validation is pending, so a rejected `/load?fromUrl=…` cannot start a download.
Storage deletion failure leaves the tab unloaded and reports a warning; the
ordinary Forget button keeps its existing retry behavior on failure.

`Layout.tsx` wraps every route. Its title bar holds the app's mark, its name and
one control — a `<Select>` of the export's profiles — and all of it is
left-aligned, as one group beside the mark.

**Only what changes while reading belongs up here.** The profile does: the same
page answers differently under another profile, so it has to be reachable from
every one of them. The file and the written form do not — you pick a file when
you arrive and a script because of where you are learning — so they live on
`Load Pleco file`, which is what the title bar being full at 360 px was telling
us. Ask that question before adding a second control, not how many will fit.

**Nothing is pushed to the right edge, either.** A right-aligned group is only
ever as far right as the layout viewport, and a card table wider than the screen
widens that on a phone — so the controls ended up off the right edge on exactly
the screens with the least room to spare. Left-aligned, they sit where the mark
puts them whatever the page below is doing. The `<Select>` takes the rest of the
row up to a `maw`, so a long profile name reads in full on a desktop and still
fits beside the mark on a phone.

`LoadFile.tsx` is where both of the controls that left went. It holds the
`FileButton` that opens the picker, **Forget file**, the import or removal error
if there is one, and the 繁/简 `<SegmentedControl>` under a heading that says
in English what it does —
which the two characters cannot, to someone still learning to read them.

The **Light or dark** control is last on the page, and is there for the reason
the script control is: both are read-once preferences about how the app is
drawn rather than about what it is showing. Its labels are words, so unlike
繁/简 it needs neither a `VisuallyHidden` name nor a tooltip to say what it
means. Anything else of this shape belongs here too, and not in the title bar.

It also describes the file: format version, who wrote it, when, and how many
cards, categories, profiles and reviewed cards are in it. That section used to
be the last thing on `Profile info`, and it was the one thing on that page that
did not move when the profile picker did — two sections about a profile, then a
table about the file, under a title saying "Profile info". Here it is about the
page's own subject, and the two pages point at each other in a sentence so the
split reads as a split rather than a loss.

Each of the two pages writes its own `<Table>`, and the two are **not** to be
merged into a shared component. A label-and-value table is Mantine markup, not
something this app owns; the moment it becomes a component it starts growing
props for whatever the next page wants of it. `src/components/` is for what has
to look the same everywhere — a flashcard does, because it is the same card in a
list and in a drawer. Two tables that happen to have two columns are not the
same thing twice.

The script control says what it is twice over, and both are needed:
`VisuallyHidden` gives each button its accessible name, which a screen reader
announces instead of a bare 繁, while the tooltip tells a sighted reader who
cannot read the characters. A tooltip is not an accessible name and a hidden
name never shows on screen, so neither one covers for the other.

Its `PAGES` list is the sidebar, and **no link is ever disabled** — a page with
nothing to read says so in a sentence instead. That is not a courtesy: routes
answer when typed in, so a page has to handle `database === null` and
`profile === null` anyway, and a disabled link would only hide the explanation.

`ProfileInfo.tsx` is what `/profile` renders, and describes the
selected profile and nothing else: what it reviews into, what it draws from, and
its session settings (the documented ones spelled out, all ~150 raw in an
`<Accordion>`). Everything on it moves when the profile picker moves, which is
the test for whether something belongs here — the file's own facts failed it and
now live on `Load Pleco file`. `CardCount.tsx` charts the profile's cards over
time, and `LearningDistribution.tsx` charts them by how far into learning they
are. `NotFound.tsx` is still just a heading.

`LearningDistribution.tsx` is the deck's shape in one bar chart: one bar per
run of correct answers the profile's cards are currently on, counted back from
the last review to the failure that ended the previous run. Read left to right
it is a pile of unlearned cards, then learning in progress, then a tail of
cards the profile has not caught out in a long time.

Four things there are load-bearing:

- **"New" is its own bar, before the numbers, and must stay that way.** A card
  the profile has never reviewed and a card that just failed its last review
  are both on a run of zero, and one bar for both makes the left end mean
  nothing: in the sample export's big profile all 909 cards at zero have been
  reviewed, while in its small one 263 of the 283 there never have. So the
  query returns `streak: null` for them, the tick reads `New`, and the caption
  gives both counts in the same sentence.
- **Each bar is split by what the run is _made of_, and that is the page's
  point rather than decoration.** A run of correct answers is not a run of
  perfect ones. `4` ("barely remembered") and `5` ("remembered") are in Pleco's
  correct half, so they extend the run — but `pro_scoreintervalmult4` is 90
  against `pro_scoreintervalmult6` at 110, and a `4` also takes
  `pro_scorediffchange4` off the card's difficulty, which is the very
  multiplier the interval grows by (`difficulty / pro_scorediffdivisor`). A run
  of them decays its own multiplier towards the difficulty floor, so the card
  keeps coming back in weeks while the run grows without bound. Measured by
  diffing two dated snapshots of the sample export: a `6` multiplies the score
  by 3.11 and a failure resets it to 100, so the 512-day ceiling arrives in six
  perfect answers — and in that profile **no run of eleven or more is made of
  perfect answers alone**, against a longest run of 21. Without the split the
  right tail reads as mastery when it is closer to the opposite.
- **A run of zero is neither kind, and gets its own neutral series.** An empty
  run would answer "every answer was perfect" vacuously, which is why `runOf`
  returns `perfect: false` for it and `LAPSED_SERIES` exists. It is the one
  series drawn in a neutral rather than a hue, and so the only one that follows
  the colour scheme: a card that just failed is the _absence_ of a run, not a
  third quality of one.
- **Every run between 0 and the longest gets a bar, including the empty ones.**
  Same reason the Card count chart draws quiet months: a skipped bucket would
  compress the axis and misreport where the deck sits. There is no cap at the
  right end — the run cannot outgrow the review log, which is 83 reviews at its
  longest in any export seen so far and 21 in the profile this was built
  against.

**Selecting a bar opens the cards it counts**, which is wired twice because
neither half covers the other's case. `barProps` catches a hit on a bar and is
the only one that works under a finger — recharts fills the chart-level active
state from mouse movement, so a tap, which has none, arrives with nothing to
say; it stops propagation so the two never both fire. `barChartProps` catches
the rest of the column, which is what makes the tail reachable with a mouse,
those bars being a couple of pixels tall. Which segment was hit is ignored:
a bar opens every card it counts and `Streaks` carries the perfect/weaker split
as its `Quality` column instead. The `New` bar opens `New cards` rather than a
run of zero, for the reason it is its own bar at all. A chart is not something a
keyboard can select from, so both pages are in the sidebar and the caption says
so.

Note what the page does **not** do. There are no counts printed above the bars:
Mantine cannot label a stacked bar, and `minBarSize` is not a way round the
tail being only a few cards tall either — recharts hands that callback the
stack's cumulative top rather than the segment's own value, so a 2px floor
draws a sliver of "includes a weaker answer" under every bucket that has none.
The tooltip carries the exact numbers, and a tail that rounds to nothing on a
linear axis is telling the truth: it is 129 cards out of 15,004.

`SearchCard.tsx` is the one card page that is not a list, and it is in the
sidebar between the profile pages and the six that are — a lookup rather than
a question about a set. Everything else that shows cards answers "which
cards?" and renders `CardList` for it; this one asks "that one, what does it
say?", so it renders `Flashcard` directly, the same display the drawer opens.

Its title says **Search for a card** rather than naming the reading, because
searching is the part the reader does: the display below is the same
`Flashcard` three other pages already open in a drawer, and what this page
adds is the way in. Its route stays `/card`, which is about the destination
and not about how you got there, so links already shared keep working.

**It shows three cards at most, and says so when more match.** The display is
tall — a card with a few hundred reviews is a few hundred bars — so a fourth
result would push the first off the screen, and a reader scrolling past three
whole cards is reading a list, which the other six pages already are. Past
three, an `Alert` above the results gives the real count and asks for a
narrower search; the cap is the same "a truncated list must not read as a
complete one" rule the card lists follow, at a different scale.

**The search is in the address, as `search`.** `/card?search=xue2` opens the
page already showing those cards, which is what makes a single card linkable
at all: the skill in `.agents/skills/` exists so an agent can read an export
itself, and without a parameter here the best it could do was name a card and
leave the reader to retype it. It is written with `replace: true` for the
reason `Streaks` writes its range that way — a search is one view being
adjusted, not a page visited per word, so Back stays one press from wherever
the reader came from.

Two ways it is not the ranges on `Streaks` and `Due cards`:

- **There is nothing to validate, and so nothing is rejected.** `run` and
  `days` name a bucket that has to exist for the list under it to be honest,
  which is why an unusable value there falls back rather than listing nothing.
  A search is not a bucket: one that matches nothing is an answer, and the
  page already has the words for it. `searchCards` trims what it is handed and
  reads the empty string as no search at all, so no value needs stopping here
  first.
- **The value flows one way, and that is not a preference.** Those pages read
  their controls straight out of the address, which a stepper can afford: it
  emits one value per click and can wait for the router to hand it back. A
  keyboard cannot. A field whose value returns through the router loses the
  letters typed before the re-render — typing `pingchang` into one lands
  `phang` in the address, reproducibly, which is how this was caught. So the
  field owns its state, `useState(linked)` reads the address once for the
  search a link arrived with, and an effect mirrors the value back out through
  the same debounce the query uses. Both settle together: the reader who stops
  typing gets the cards and a URL worth copying at the same moment, and one
  mid-word costs neither a scan nor a history entry. An empty field writes no
  parameter rather than an empty one, so clearing it leaves `/card`.

One consequence of that one-way flow, and it is the right one: following the
sidebar link while a search is showing rewrites the address back to the search
rather than clearing the field. The page kept its state across that navigation
before it had a parameter too — what changed is that the address now says so.

Its search is the part with something to say, and it lives in
`SearchCard.db.ts`:

- **Both sides are reduced to a shape that can meet.** `pron` is `@`-separated
  numbered pinyin with Pleco's own notation hanging off it (`you1-`, `ru4, `,
  `bao4//@ming2`), and a reader types `ping chang`. So the column is reduced in
  SQL — a dozen nested `replace()` calls, since SQLite has no regex — and the
  query is reduced in TypeScript, to the same letters-only lowercase form with
  `ü` folded to `u`.
- **Tones narrow rather than merely being tolerated.** There are two reduced
  forms, toneless (`pingchang`) and numbered (`ping2chang2`). Every query
  matches the first; a query that carried tones must match the second as well,
  so `chang` finds 123 cards in the sample export and `chang2` finds 60. Tones
  are used only when **every** whitespace token carries one — `ping chang2`
  cannot be assembled into anything a card reads as, and `píngcháng` has two
  marks in one token with no saying where the syllable breaks, so both fall
  back to the toneless form and still find the card.
- **This is _not_ `canonicalPinyin()` and must not be merged with it.** That
  one is half of a contract with `cc-cedict/build.mjs` — change one, change
  both, or the dictionary join stops resolving — and it keeps syllable spacing,
  which a substring search has to drop. Two reducers, two jobs.
- **The card id is searchable because it is the only unique handle.** `hw` is
  not: the sample export holds 平常 twice. Searching a number is how you say
  "that one" about two cards that read alike.
- **Results are ranked, which is what makes a cap of three usable.** Exact
  match first, then a match at the start, then one anywhere, with `c.id` inside
  each band so the order does not shuffle while the reader types. Searching
  `shi` puts the cards that _are_ shi above the ones that merely contain it.

The scorefile is joined rather than required, as on `Customized cards`: a card
the profile has never put in front of anyone still has a headword to find it
by, and only its tallies come back empty. The query is debounced, unlike
`Lapses`' controls — that page re-filters rows it already holds, while
this one runs two full scans of the cards table, which no index survives
`lower()` and a dozen `replace()` calls to help with.

The other six pages all answer "which cards?", so they all render `CardList`
and differ only in the question — the SQL, the extra columns, and the sentence
above the table. In sidebar order, which runs from the cards that need work to
the cards that do not:

- **New cards** — held by the profile and never once reviewed. Oldest first,
  by when the card was added, since with no review state that is the only age
  it carries. This is the chart's `New` bar, and it is its own page rather than
  a run of zero for the reason that bar is its own bar.
- **Leeches** — failed most often in the profile's scorefile: the cards
  soaking up review time without ever being learned.
- **Lapses** — a run of correct answers, then a failure among the most
  recent reviews. Both lengths are the reader's to set: the export dates no
  individual review, so "recently" can only be counted in reviews, and how long
  a run has to be before losing it matters is a judgement about their own deck.
  The candidate rows are read once per profile and the controls re-filter them
  in memory, so a keystroke does not re-query.
- **Streaks** — on a run of correct answers, the runs being the reader's to
  pick: one exact run, or a range of them. It is the list behind a bar of the
  `Learning distribution` chart, so **a range of one stays exact**: a bar of
  530 has to open a list of 530, which is why both count through `runOf` in
  `src/database/reviewLog.ts` rather than each walking the log itself. Soonest
  due first whatever the range — widening it does not change which card the
  reader should look at next, and the run each card is on is a column rather
  than the ordering. Its controls' values live in the querystring rather than
  in state, so the chart can link to it and a view survives a reload.
- **Due cards** — estimated due within a band of days, the band being the
  reader's to pick and either end of it able to be negative. It is the list
  behind a bar of the `Incoming reviews` chart, so **a range of one day stays
  exact** for the reason a range of one run does on `Streaks`, and both sides
  floor through `wholeDaysUntil` in `src/database/reviewSchedule.ts` rather
  than each dividing by 86,400 themselves. Its controls live in the
  querystring for the same reason `Streaks`' do. Sitting beside `Streaks`
  rather than in the "most work needed first" run, since a band of days is no
  one point along it.
- **Customized cards** — carrying a definition the user wrote. This one is
  about the card rather than the review state, so its scorefile join is a
  `left join` and a card the profile has never shown still appears.

Two things about the range on `Streaks` are worth keeping straight, because
the page has two readers with different questions:

- **`run` alone still means one run, and `runTo` is optional.** `runTo` is a
  second parameter rather than a range syntax inside `run`, so every address
  written before it existed opens what it always did, and `bucketLink` on the
  chart keeps emitting `?run=N`. That is not backwards compatibility for its
  own sake: the chart's promise is that a bar of 530 opens 530 cards, and a
  link that could widen on its own would break it.
- **An impossible range collapses rather than listing nothing.** A `runTo`
  below `run`, or either value unusable, falls back to the single run — an
  empty table would otherwise be indistinguishable from a profile that
  genuinely has no card there, and the page's empty state exists to tell those
  four cases apart. The controls hold the same invariant from the other side:
  raising `from` carries `to` up with it, and `to` has `from` as its floor, so
  neither the steppers nor a typed value can name a band no card can sit in.

`Due cards` holds both of those invariants — `days` alone is one exact day,
and an impossible range collapses rather than listing nothing — and differs in
two ways that follow from days not being runs:

- **Its default is a range rather than a single value, and it is everything
  overdue**: the profile's earliest estimated day through -1, which is exactly
  the set behind the chart's red bars and its "cards due for review" heading.
  So that heading links here with no parameters at all. It stops at -1 because
  day zero means "due within the next 24 hours" and is not yet due, the same
  line the heading's own count draws.
- **Both ends are signed and the day is not a property of the card.** A run is
  a fact about a review log; a day until review is a distance from a clock, so
  `readDueCandidates` takes the mount-time `now` the chart also takes, and a
  card sitting on a day boundary can move a bucket between the two pages. That
  is the same "the clock is read on mount" rule every countdown in the app
  follows, and both pages say they recalculate when reopened.

Two things about that group are load-bearing. **"Oldest" means least recently
reviewed**, because `lastreviewedtime`
is the only age a card carries once its score has stopped moving; cards the
scorefile never dated sort last, where a zero would otherwise read as 1970 at
the top of a list about age. And **every list is capped at 1,000 rows**, with
the caption saying so whenever the total is larger — a silently truncated list
reads as a complete one.

## The data layer

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

`pleco-export-format.md` stays the authority on the schema, and its gotchas
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

The original export and selected profile are saved in **IndexedDB**, through
`src/database/savedImport.ts`. `DatabaseProvider` restores them on mount, opens
an independent in-memory sql.js database for each tab, and owns its cleanup.
Pages still receive the same database and profile; they never access storage.
The layout shows a restoring message before rendering pages, so the import
prompt does not flash during startup.

A successful new import atomically replaces the saved file and selects its
first profile. Validation and profile resolution happen before that write, so
an invalid import leaves both the current database and saved file intact.
Profile selection is a separate small record: changing profiles never rewrites
the file. Every import has a unique ID, checked in the same transaction when
saving a profile or forgetting a file, so an older tab cannot change the saved
selection for a newer export. Existing tabs keep their current views until
reloaded; new tabs restore the last saved file and profile.

Remote imports enter the same lifecycle: `importFile()` accepts either a local
`File` or a function that downloads one. The provider invokes that function
inside its busy guard, before validation and the existing atomic save, so local
imports, remote imports, forgetting, and profile changes cannot race in a tab.
`LoadFile.remote.ts` owns URL handling beside the page. It uses direct browser
fetches and the Google Drive API for public sharing links. The public browser
key is committed as `GOOGLE_DRIVE_API_KEY` in `LoadFile.remote.ts`, restricted
to the Drive API and this site. There is no backend or proxy.
The source URL is saved alongside the file in the same IndexedDB transaction
and exposed as `sourceUrl` by the provider for the Load page's info panel. It
is the original input link, never the Drive API URL containing the app key.
The separate `source` record carries the import ID: profile changes leave it
alone, and an older app tab that replaces the file cannot leave a stale URL
attached to the new import. Local imports store a null source; forgetting clears
it with the file. Missing source metadata on older imports means no panel.
The saved record still holds the file bytes, never a URL to refetch; restoration
never contacts the remote host. Opening `/load?fromUrl=…` is a separate explicit
import request: the page reads it on mount, prefills the URL field, and starts
one import after restoration. It waits for any current import and guards
against effect replay and completion causing repeat downloads. The parameter
stays in the address so reopening or reloading that link requests a fresh copy.
Google Cloud setup is documented in `readme.md`.

Storage failures are reported separately from import errors: the file can stay
usable in this tab even when saving fails. **Forget file**, on the Load Pleco
file page, removes that export from storage and closes the current tab's copy.
Browser storage can be cleared or evicted, and private browsing is usually
temporary. The script preference remains independent in localStorage:
see "The other global" above.

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
any note, the review tally, the review log and the dates, holding no state. Its
`FlashcardData` is the vocabulary item plus the review state read from the
caller's profile scorefile. Its `nextReview` is an estimated due timestamp in
Unix seconds, computed in each page's query through `nextReviewTime()`. Raw
score and difficulty stay outside the display contract. A page that needs more
can widen the contract; do not fork the component.

Five things about the review section are load-bearing:

- **The dates are grouped by what they are scoped to**, because mixing them
  would be a lie: the score and review times come from one profile's scorefile
  and the same card reads differently under another profile, while `created`
  and `modified` belong to the card and are the export's. Hence the two
  headings, "In this profile" and "This card".
- **The history is the last section, and runs down the page.** It is the one
  part of the card with no fixed height — a card with hundreds of reviews is
  hundreds of rows — so it goes at the bottom, where it can grow without
  pushing anything off the screen, and stacks downwards rather than wrapping
  into a block whose rows would mean nothing.
- **It reads newest first, and the timeline says so.** That is the order Pleco
  stores the log in, so nothing is reversed: the newest review is the top row.
  The first and last review dates cap the strip — they are not in the date
  table, where they would be two more rows rather than the ends of something —
  and an arrow runs up the left side between them with the span it covers
  written along it. There is still no date on any single review, only the
  sequence, and the caption says that.
- **Each review is drawn as a bar as long as its grade**, on Pleco's six-point
  scale, coloured on a red→green ramp and counted in the legend. Length, hue,
  the per-bar tooltip and the counts all say the same thing, so no one channel
  has to carry it. The two `0` counts a typical card shows are the point rather
  than noise: they say the user never reached for that grade — which is also
  why grades `2` and `6` are labelled "(default)": they are what a plain wrong
  and a plain right answer record.
- **The shades were checked, not chosen by eye.** Lightness runs outwards from
  the middle of the scale, so the order survives as order without hue, and the
  boundary that flips a card from wrong to right — "almost remembered" against
  "barely remembered" — holds ΔE 39 under simulated protanopia, the worst of
  the three simulations. Re-check it if you change a shade. The same six serve
  both colour schemes and in fact sit better on a dark page than a white one:
  the weakest is red.9 at 2.84:1 against `dark.7`, where in light it is green.4
  at 1.75:1 against white. Only the timeline's arrow follows the scheme, being
  a rule rather than data — `gray.4` is a 1.49:1 whisper on white and a 10.4:1
  stripe on dark, so `TIMELINE_LINE` drops it to `dark.4` and 1.54:1 there.

It reads two globals for itself. `useScript()`, which decides which form the big
glyphs show and which is dimmed underneath; and `useDictionary()`, for the
CC-CEDICT gloss shown below the user's own note. Both are deliberately hooks
rather than props, for the same reason — a page could forget to pass them and
show a card out of step with the rest of the app. It stays a rendering component
either way: these are the only things it reaches for, and it still owns no
state.

`CardList.tsx` is the other half of that: the table every card page renders,
holding the position, the headword in the chosen script, the pinyin, the time
until review, then whatever columns the page hands it, plus the paging and the
`<Drawer>` that opens a `Flashcard`. Six pages ask "which cards?" and they
differ in the question, not in the table — so the table is one component, and a
seventh page gets the same page size, the same first columns and the same click
behaviour for free. It is the caller's list that is rendered, in the caller's
order: capping a long list and saying so is the page's job, since only the page
knows what was left out.

`ReviewDue.tsx` is shared by every card list and the review count in the
flashcard's "Review history in this profile" section, including when no log is
available. `FlashcardData.nextReview` carries a timestamp, not a countdown:
queries are memoized, so subtracting the clock there would freeze the answer
at query time instead of when a card is opened.

The formula is `lastreviewedtime + score / pro_cardpointsday * 86400`, in Unix
seconds. `ReviewDue` subtracts current Unix seconds and divides by 86,400 for
the signed days remaining. A negative result is overdue, never clamped, even
at the score ceiling. The clock is captured once on mount, matching the chosen
behaviour of `RelativeTime`; there is no timer. Profile/scorefile data changes
still change the due timestamp supplied to the display.

`days.ts` rounds to one decimal only between -10 and 10 days (exclusive),
omitting trailing zeros, and to whole days otherwise. Below 0.1 days it shows `<0.1 days` or `-<0.1 days` to retain the sign. Negative is plain red,
positive plain green, exactly zero neutral; no gradient or score bar remains.
The exact estimated date is accessible through `Explained`. Missing scores,
NULL/zero review dates or unusable points-per-day settings show `—` with an
explanation, including never-reviewed cards found through a left join.

Profile info summarizes **Cards per session**, **New cards per session, at
most**, and **Review interval range**. The range divides score bounds by the
profile's points per day without subtracting elapsed time, because settings
have no last review. Points per day, difficulty, review buckets, language and
word length stay in the raw accordion rather than the readable summary. The
session settings need no explanation paragraph.
Both Profile info and Load Pleco file label their existing creation timestamp
**Start date**; this relabel does not change the source of either date.

`Explained.tsx` is the app's **only** "there is more here" affordance: dotted
underlined text that a hover, a focus or a tap explains. It covers a label that
would otherwise read as something it is not — the flashcard's "Score last
fell", which is not always a failure, and the profile page's card count — and
it is what shows a date's exact timestamp. One component, so a second shape of
the same idea cannot appear; a mid-sentence tooltip and an underline saying
different things is how that starts.

Mantine has no equivalent to import. It ships `Tooltip` and `ThemeIcon` but no
icons at all, and its own docs draw this pattern with `@tabler/icons-react`,
which is a dependency we do not have. What is worth keeping here is small and
easy to forget by hand: `events` opens the tooltip to a keyboard and a
touchscreen where Mantine defaults to hover alone, `tabIndex` is what lets a
keyboard reach it, and `maw` with `multiline` lets a sentence wrap while a
short date still shrinks to its own width.

`RelativeTime.tsx` is how **every** date in the app is written: "3 months ago",
with the exact timestamp a hover away through `Explained`. "How long ago" is
the question a reader has about a flashcard or a study session, and the exact
moment is the rarer follow-up, so both are always there and neither reading is
lost. It uses `Intl.RelativeTimeFormat`, which is in the browser and needs no
dependency, with `numeric: "auto"` for the "yesterday" and "today" wordings.
The clock is read once on mount rather than on every render — a re-render
caused by something else must not silently reword a date, and the React
Compiler's purity rule rejects the alternative anyway. Nothing ticks: a page
left open overnight keeps yesterday's wording until it is mounted again, which
is not worth a timer over a file the user imported by hand.

`chinese.ts` is the pure text side of that: splitting a headword on `@` into
aligned simplified/traditional/pinyin syllables, and turning numbered pinyin
(`duan4`) into tone marks (`duàn`). The `Leeches` table and the flashcard
both call it, so it is here and not in either. It runs no query — a page's
`.db.ts` returns the raw columns and this shapes them for the eye.

## Charts

`@mantine/charts` (and its `recharts` peer) is installed for the Card count,
Learning distribution and Incoming reviews pages. These are the only reason
either package is here, so keep chart work on `<LineChart>`, `<BarChart>` and
friends rather than dropping to raw recharts.

The split is the same on all three: the `.db.ts` shapes the data and names the
buckets, the `.tsx` picks the colours. A chart colour is a rendering decision,
so a query never returns one.

`CardCount.db.ts` shapes the data and names the series; `CardCount.tsx` picks
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
  invalidates that, so re-check it if you do. The six need no per-scheme
  treatment — the weakest on a dark page is blue.7 at 3.70:1, better than
  yellow.8's 2.48:1 on a white one.
- **`FIXED_COLORS` does follow the scheme, because both of its entries are
  neutrals.** The total is deliberately not a hue, so it cannot be read as a
  category — and that is exactly what makes it invert: `gray.7` goes from
  8.18:1 on white to 1.90:1 on dark, which is the chart's most important line
  all but gone. It reads as `dark.1` there instead, at 7.83:1, with "Other
  categories" moving violet.7 → violet.3 for the same reason.

The chart can only say when a card was _created_: the export keeps no history
of category membership, so a card counts towards the categories it is in today.
That caveat is in the caption and should stay there.

`IncomingReviews.tsx` draws one bar per whole day until the estimated next
review, from the earliest to the latest in the selected profile. Its query uses
`nextReviewTime()` and the profile's own points per day, and receives the clock
captured on page mount in Unix seconds. It rounds down, so -0.2 days is -1 and
0 means the next 24 hours. Every intervening day stays on the axis, including
empty days; there is no weekly grouping or range cap. A left join retains
never-reviewed cards in the total, and cards without usable scheduling data are
counted below the chart rather than assigned an invented day. Category
membership must not count a card twice. Negative-day buckets are the `due`
series in fixed `red.8`; zero and positive days are `upcoming` in fixed
`blue.7`. The due-card figure above the chart is accumulated from exactly the
same negative buckets, so it must equal the sum of every red bar. Day zero is
not part of it: it means due within the next 24 hours, not already due.

**Selecting a bar opens the cards it counts**, on `Due cards`, at that one day
— `/due?days=-3` — and it is wired twice for the reasons the same click is on
`Learning distribution`: `barProps` is the half that survives a tap, and
`barChartProps` catches the rest of the column, which is what makes a day
holding three cards reachable with a mouse. Which series was hit is ignored,
as there too: a day opens every card it counts, and only the day the range
turns on could hold both series anyway. The due-card heading is a link as
well, to `/due` with no parameters, which is that page's own default — and it
keeps `red.8` through `c="inherit"` rather than taking the link colour, since
that red is the same data the bars carry. A chart is not something a keyboard
can select from, so `Due cards` is in the sidebar and the caption says so.

`LearningDistribution.tsx` draws the stacked bar chart, and its colours were
checked the same way. Three of its four are hues — `orange.8`, `blue.7` and
`teal.8`, all drawn from the six above but re-measured as their own set rather
than assumed safe for their provenance: worst all-pairs ΔE 9.5 under
protanopia and 19.6 in normal vision, each clearing 3:1 on both pages.
`perfect` and `weaker` are the pair that actually sit against each other inside
a bar, at ΔE 18.7 protan / 19.6 normal.

Their weak spot is tritanopia, where blue and teal fall to ΔE 3.8, and that is
covered by **stacking order** rather than by hue: `perfect` is always the
segment on the baseline and `weaker` always the one above it, so the split
survives with no colour vision at all. Keep that order if you touch the series
list. The fourth, `lapsed`, is a neutral and therefore the only one that
follows the colour scheme, for the same reason `FIXED_COLORS` does above.

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
- `git push origin origin/main:refs/heads/prod` deploys — see "Deployment".
  Fast-forward only: `prod` never carries a commit that main does not.
- `npx wrangler deploy` publishes a local `dist/` to Cloudflare by hand. It
  uploads what is already there and never builds, so `npx vite build` has to
  have run first. It is the fallback, not the usual path.

Prettier has no config file on purpose — the defaults are fine.

## Deployment

The app is static, so Cloudflare serves `dist/` and no Worker code runs:
`wrangler.jsonc` has no `main`, and is five settings long because that is all
an assets-only Worker needs — four of them, plus `send_metrics: false` to keep
Wrangler from reporting usage back to Cloudflare.

`not_found_handling: "single-page-application"` is the one line that is not
boilerplate. Routing is client-side, so `/card-count` matches no file in
`dist/`; this returns `index.html` for those requests and lets React Router
read the URL. Without it every route but `/` 404s when reloaded or opened from
a link, and `NotFound.tsx` would never render.

**Deploying is updating the `prod` branch.** Cloudflare watches it: a push to
`prod` builds the site and publishes it to https://rasbora.martintapia.com,
live a few minutes later. Work lands on main, and `prod` is fast-forwarded to
main when the reader should see it — so main can hold changes that are not
deployed yet, and `git log origin/prod..origin/main` is exactly what the next
deploy ships.

That trigger is configured in the Cloudflare dashboard, not in this repository,
which is why there is no CI file here. To confirm a deploy landed, check that
the live JavaScript bundle contains a string from the change rather than
trusting the push alone.

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
