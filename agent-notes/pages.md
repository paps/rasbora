# Pages

See [Architecture](architecture.md#routing) for routing and sidebar rules, [the data layer](data-layer.md) for page queries, and [Components](components.md) for the shared displays.

## About

`About.tsx` carries two highlighted panels. The first points at the repo's own agent skill (`.agents/skills/pleco-flashcards/SKILL.md`); it uses an `<Alert>` because the skill is a second way to read an export rather than another sentence about this one. The second is a disclaimer at the end of the page, stating that Rasbora has only been tested with exports from Pleco for Android version 3.2. Three things about the skill panel are deliberate. It sits **right after the _load a Pleco export_ line**, since it is the next thing to do with an export and not a footnote. The `SKILL_URL` is printed **in full rather than behind link text**, because its use is being copied into an agent somewhere else — which is also why it is the raw `raw.githubusercontent.com` URL: a person can read it and an agent can fetch it unchanged. And it points at **`main`, never a pinned commit** — a reader who followed one would get a skill older than the app it describes.

## Load Pleco file

`LoadFile.tsx` holds the file and script controls described in [the title-bar layout](architecture.md#title-bar-and-sidebar). It holds the `FileButton` that opens the picker, **Forget file**, the import or removal error if there is one, and the 繁/简 `<SegmentedControl>` under a heading that says in English what it does — which the two characters cannot, to someone still learning to read them.

The **Light or dark** control is last on the page, and is there for the reason the script control is: both are read-once preferences about how the app is drawn rather than about what it is showing. Its labels are words, so unlike 繁/简 it needs neither a `VisuallyHidden` name nor a tooltip to say what it means. Anything else of this shape belongs here too, and not in the title bar.

It also describes the file: format version, who wrote it, when, and how many cards, categories, profiles and reviewed cards are in it. That section used to be the last thing on `Profile info`, and it was the one thing on that page that did not move when the profile picker did — two sections about a profile, then a table about the file, under a title saying "Profile info". Here it is about the page's own subject, and the two pages point at each other in a sentence so the split reads as a split rather than a loss.

Load Pleco file and Profile info each write their own `<Table>`, and the two are **not** to be merged into a shared component. A label-and-value table is Mantine markup, not something this app owns; the moment it becomes a component it starts growing props for whatever the next page wants of it. `src/components/` is for what has to look the same everywhere — a flashcard does, because it is the same card in a list and in a dialog. Two tables that happen to have two columns are not the same thing twice.

The script control says what it is twice over, and both are needed: `VisuallyHidden` gives each button its accessible name, which a screen reader announces instead of a bare 繁, while the tooltip tells a sighted reader who cannot read the characters. A tooltip is not an accessible name and a hidden name never shows on screen, so neither one covers for the other.

See [Imports and storage](imports-and-storage.md) for import, restoration, and incoming-link behavior.

## Profile info

`ProfileInfo.tsx` is what `/profile` renders, and describes the selected profile and nothing else: what it reviews into, what it draws from, and its session settings (the documented ones spelled out, all ~150 raw in an `<Accordion>`). Everything on it moves when the profile picker moves, which is the test for whether something belongs here — the file's own facts failed it and now live on `Load Pleco file`. `CardCount.tsx` charts the profile's cards over time, and `LearningDistribution.tsx` charts them by how far into learning they are. `NotFound.tsx` is still just a heading.

Profile info summarizes **Cards per session**, **New cards per session, at most**, and **Review interval range**. The range divides score bounds by the profile's points per day without subtracting elapsed time, because settings have no last review. Points per day, difficulty, review buckets, language and word length stay in the raw accordion rather than the readable summary. The session settings need no explanation paragraph. Both Profile info and Load Pleco file label their existing creation timestamp **Start date**; this relabel does not change the source of either date.

## Chart pages

Card count, Learning distribution, and Incoming reviews are documented in [Charts](charts.md), including their calculations and links to card lists.

## Search for a card

`SearchCard.tsx` is the one card page that is not a list, and it is in the sidebar between the profile pages and the six that are — a lookup rather than a question about a set. Everything else that shows cards answers "which cards?" and renders `CardList` for it; this one asks "that one, what does it say?", so it renders `Flashcard` directly, the same display the dialog opens.

Its title says **Search for a card** rather than naming the reading, because searching is the part the reader does: the display below is the same `Flashcard` three other pages already open in a dialog, and what this page adds is the way in. Its route stays `/card`, which is about the destination and not about how you got there, so links already shared keep working.

**It shows three cards at most, and says so when more match.** The display is tall — a card with a few hundred reviews is a few hundred bars — so a fourth result would push the first off the screen, and a reader scrolling past three whole cards is reading a list, which the other six pages already are. Past three, an `Alert` above the results gives the real count and asks for a narrower search; the cap is the same "a truncated list must not read as a complete one" rule the card lists follow, at a different scale.

**The search is in the address, as `search`.** `/card?search=xue2` opens the page already showing those cards, which is what makes a single card linkable at all: the skill in `.agents/skills/` exists so an agent can read an export itself, and without a parameter here the best it could do was name a card and leave the reader to retype it. It is written with `replace: true` for the reason `Streaks` writes its range that way — a search is one view being adjusted, not a page visited per word, so Back stays one press from wherever the reader came from.

Two ways it is not the ranges on `Streaks` and `Due cards`:

- **There is nothing to validate, and so nothing is rejected.** `run` and `days` name a bucket that has to exist for the list under it to be honest, which is why an unusable value there falls back rather than listing nothing. A search is not a bucket: one that matches nothing is an answer, and the page already has the words for it. `searchCards` trims what it is handed and reads the empty string as no search at all, so no value needs stopping here first.
- **The value flows one way, and that is not a preference.** Those pages read their controls straight out of the address, which a stepper can afford: it emits one value per click and can wait for the router to hand it back. A keyboard cannot. A field whose value returns through the router loses the letters typed before the re-render — typing `pingchang` into one lands `phang` in the address, reproducibly, which is how this was caught. So the field owns its state, `useState(linked)` reads the address once for the search a link arrived with, and an effect mirrors the value back out through the same debounce the query uses. Both settle together: the reader who stops typing gets the cards and a URL worth copying at the same moment, and one mid-word costs neither a scan nor a history entry. An empty field writes no parameter rather than an empty one, so clearing it leaves `/card`.

One consequence of that one-way flow, and it is the right one: following the sidebar link while a search is showing rewrites the address back to the search rather than clearing the field. The page kept its state across that navigation before it had a parameter too — what changed is that the address now says so.

Its search is the part with something to say, and it lives in `SearchCard.db.ts`:

- **Both sides are reduced to a shape that can meet.** `pron` is `@`-separated numbered pinyin with Pleco's own notation hanging off it (`you1-`, `ru4, `, `bao4//@ming2`), and a reader types `ping chang`. So the column is reduced in SQL — a dozen nested `replace()` calls, since SQLite has no regex — and the query is reduced in TypeScript, to the same letters-only lowercase form with `ü` folded to `u`.
- **Tones narrow rather than merely being tolerated.** There are two reduced forms, toneless (`pingchang`) and numbered (`ping2chang2`). Every query matches the first; a query that carried tones must match the second as well, so `chang` finds 123 cards in the sample export and `chang2` finds 60. Tones are used only when **every** whitespace token carries one — `ping chang2` cannot be assembled into anything a card reads as, and `píngcháng` has two marks in one token with no saying where the syllable breaks, so both fall back to the toneless form and still find the card.
- **This is _not_ `canonicalPinyin()` and must not be merged with it.** That one is half of a contract with `cc-cedict/build.mjs` — change one, change both, or the dictionary join stops resolving — and it keeps syllable spacing, which a substring search has to drop. Two reducers, two jobs.
- **The card id is searchable because it is the only unique handle.** `hw` is not: the sample export holds 平常 twice. Searching a number is how you say "that one" about two cards that read alike.
- **Results are ranked, which is what makes a cap of three usable.** Exact match first, then a match at the start, then one anywhere, with `c.id` inside each band so the order does not shuffle while the reader types. Searching `shi` puts the cards that _are_ shi above the ones that merely contain it.

The scorefile is joined rather than required, as on `Customized cards`: a card the profile has never put in front of anyone still has a headword to find it by, and only its tallies come back empty. The query is debounced, unlike `Lapses`' controls — that page re-filters rows it already holds, while this one runs two full scans of the cards table, which no index survives `lower()` and a dozen `replace()` calls to help with.

## Card lists

The other six pages all answer "which cards?", so they all render `CardList` and differ only in the question — the SQL, the extra columns, and the sentence above the table. In sidebar order, which runs from the cards that need work to the cards that do not:

- **New cards** — held by the profile and never once reviewed. Oldest first, by when the card was added, since with no review state that is the only age it carries. This is the chart's `New` bar, and it is its own page rather than a run of zero for the reason that bar is its own bar.
- **Leeches** — failed most often in the profile's scorefile: the cards soaking up review time without ever being learned.
- **Lapses** — a run of correct answers, then a failure among the most recent reviews. Both lengths are the reader's to set: the export dates no individual review, so "recently" can only be counted in reviews, and how long a run has to be before losing it matters is a judgement about their own deck. The candidate rows are read once per profile and the controls re-filter them in memory, so a keystroke does not re-query.
- **Streaks** — on a run of correct answers, the runs being the reader's to pick: one exact run, or a range of them. It is the list behind a bar of the `Learning distribution` chart, so **a range of one stays exact**: a bar of 530 has to open a list of 530, which is why both count through `runOf` in `src/database/reviewLog.ts` rather than each walking the log itself. Soonest due first whatever the range — widening it does not change which card the reader should look at next, and the run each card is on is a column rather than the ordering. Its controls' values live in the querystring rather than in state, so the chart can link to it and a view survives a reload.
- **Due cards** — estimated due within a band of days, the band being the reader's to pick and either end of it able to be negative. It is the list behind a bar of the `Incoming reviews` chart, so **a range of one day stays exact** for the reason a range of one run does on `Streaks`, and both sides floor through `wholeDaysUntil` in `src/database/reviewSchedule.ts` rather than each dividing by 86,400 themselves. Its controls live in the querystring for the same reason `Streaks`' do. Sitting beside `Streaks` rather than in the "most work needed first" run, since a band of days is no one point along it.
- **Customized cards** — carrying a definition the user wrote. This one is about the card rather than the review state, so its scorefile join is a `left join` and a card the profile has never shown still appears.

Range links use `/streaks?run=4&runTo=10` for runs 4–10 and `/due?days=-3&daysTo=7` for three days overdue through seven days ahead. Runs accept whole numbers from 0 to 100; days accept whole numbers from -36,500 to 36,500.

Two things about the range on `Streaks` are worth keeping straight, because the page has two readers with different questions:

- **`run` alone still means one run, and `runTo` is optional.** `runTo` is a second parameter rather than a range syntax inside `run`, so every address written before it existed opens what it always did, and `bucketLink` on the chart keeps emitting `?run=N`. That is not backwards compatibility for its own sake: the chart's promise is that a bar of 530 opens 530 cards, and a link that could widen on its own would break it.
- **An impossible range collapses rather than listing nothing.** A `runTo` below `run`, or either value unusable, falls back to the single run — an empty table would otherwise be indistinguishable from a profile that genuinely has no card there, and the page's empty state exists to tell those four cases apart. The controls hold the same invariant from the other side: raising `from` carries `to` up with it, and `to` has `from` as its floor, so neither the steppers nor a typed value can name a band no card can sit in.

`Due cards` holds both of those invariants — `days` alone is one exact day, and an impossible range collapses rather than listing nothing — and differs in two ways that follow from days not being runs:

- **Its default is a range rather than a single value, and it is everything overdue**: the profile's earliest estimated day through -1, which is exactly the set behind the chart's red bars and its "cards due for review" heading. So that heading links here with no parameters at all. It stops at -1 because day zero means "due within the next 24 hours" and is not yet due, the same line the heading's own count draws.
- **Both ends are signed and the day is not a property of the card.** A run is a fact about a review log; a day until review is a distance from a clock, so `readDueCandidates` takes the mount-time `now` the chart also takes, and a card sitting on a day boundary can move a bucket between the two pages. That is the same "the clock is read on mount" rule every countdown in the app follows, and both pages say they recalculate when reopened.

Two things about that group are load-bearing. **"Oldest" means least recently reviewed**, because `lastreviewedtime` is the only age a card carries once its score has stopped moving; cards the scorefile never dated sort last, where a zero would otherwise read as 1970 at the top of a list about age. And **every list is capped at 1,000 rows**, with the caption saying so whenever the total is larger — a silently truncated list reads as a complete one.
