# Components

`src/components/` is for presentation that more than one page renders — and here being shared is the whole point, unlike the data layer, where sharing has to earn itself. A card looks the same wherever it is shown, so the display lives in one place and pages hand it data.

## Flashcard

`Flashcard.tsx` is that display and is meant to be _the_ way a single card is shown app-wide: give it a `FlashcardData` and it renders the headword, pinyin, any note, the review tally, the review log and the dates, holding no state. Its `FlashcardData` is the vocabulary item plus the review state read from the caller's profile scorefile. Its `nextReview` is an estimated due timestamp in Unix seconds, computed in each page's query through `nextReviewTime()`. Raw score and difficulty stay outside the display contract. A page that needs more can widen the contract; do not fork the component.

Five things about the review section are load-bearing:

- **The dates are grouped by what they are scoped to**, because mixing them would be a lie: the score and review times come from one profile's scorefile and the same card reads differently under another profile, while `created` and `modified` belong to the card and are the export's. Hence the two headings, "In this profile" and "This card".
- **The history is the last section, and runs down the page.** It is the one part of the card with no fixed height — a card with hundreds of reviews is hundreds of rows — so it goes at the bottom, where it can grow without pushing anything off the screen, and stacks downwards rather than wrapping into a block whose rows would mean nothing.
- **It reads newest first, and the timeline says so.** That is the order Pleco stores the log in, so nothing is reversed: the newest review is the top row. The first and last review dates cap the strip — they are not in the date table, where they would be two more rows rather than the ends of something — and an arrow runs up the left side between them with the span it covers written along it. There is still no date on any single review, only the sequence, and the caption says that.
- **Each review is drawn as a bar as long as its grade**, on Pleco's six-point scale, coloured on a red→green ramp and counted in the legend. Length, hue, the per-bar tooltip and the counts all say the same thing, so no one channel has to carry it. The two `0` counts a typical card shows are the point rather than noise: they say the user never reached for that grade — which is also why grades `2` and `6` are labelled "(default)": they are what a plain wrong and a plain right answer record.
- **The shades were checked, not chosen by eye.** Lightness runs outwards from the middle of the scale, so the order survives as order without hue, and the boundary that flips a card from wrong to right — "almost remembered" against "barely remembered" — holds ΔE 39 under simulated protanopia, the worst of the three simulations. Re-check it if you change a shade. The same six serve both colour schemes and in fact sit better on a dark page than a white one: the weakest is red.9 at 2.84:1 against `dark.7`, where in light it is green.4 at 1.75:1 against white. Only the timeline's arrow follows the scheme, being a rule rather than data — `gray.4` is a 1.49:1 whisper on white and a 10.4:1 stripe on dark, so `TIMELINE_LINE` drops it to `dark.4` and 1.54:1 there.

It reads two globals for itself. `useScript()`, which decides which form the big glyphs show and which is dimmed underneath; and `useDictionary()`, for the CC-CEDICT gloss shown below the user's own note. Both are deliberately hooks rather than props, for the same reason — a page could forget to pass them and show a card out of step with the rest of the app. It stays a rendering component either way: these are the only things it reaches for, and it still owns no state.

## CardList

`CardList.tsx` is the other half of that: the table every card page renders, holding the position, the headword in the chosen script, the pinyin, the time until review, then whatever columns the page hands it, plus the paging and the `<Modal>` that opens a `Flashcard`. Six pages ask "which cards?" and they differ in the question, not in the table — so the table is one component, and a seventh page gets the same page size, the same first columns and the same click behaviour for free. It is the caller's list that is rendered, in the caller's order: capping a long list and saying so is the page's job, since only the page knows what was left out.

The table sits inside `Table.ScrollContainer` with native horizontal scrolling, a zero minimum width and a maximum width of its parent. The table keeps its natural layout and scrolls when its content cannot fit; it must never widen the page or the viewport used by the card dialog. The scroll region is labelled and keyboard-focusable. Pagination and the dialog stay outside it.

The card dialog is centered and uses Mantine’s `lg` width, constrained to the viewport with `xs` (10 px) outer margins. On phones these small margins keep it visibly separate from the page. Mantine handles internal scrolling and the sticky header, so the enlarged, labelled X stays reachable throughout long review histories. Keep the margins rather than switching to full-screen mode. The `xOffset` and `yOffset` props take CSS lengths, not spacing keys: pass `var(--mantine-spacing-xs)`, never `"xs"`. A bare key makes the offset and maximum-height calculations invalid, so the dialog grows past the viewport instead of scrolling internally.

## ReviewDue and day formatting

`ReviewDue.tsx` is shared by every card list and the review count in the flashcard's "Review history in this profile" section, including when no log is available. `FlashcardData.nextReview` carries a timestamp, not a countdown: queries are memoized, so subtracting the clock there would freeze the answer at query time instead of when a card is opened.

The formula is `lastreviewedtime + score / pro_cardpointsday * 86400`, in Unix seconds. `ReviewDue` subtracts current Unix seconds and divides by 86,400 for the signed days remaining. A negative result is overdue, never clamped, even at the score ceiling. The clock is captured once on mount, matching the chosen behaviour of `RelativeTime`; there is no timer. Profile/scorefile data changes still change the due timestamp supplied to the display.

`days.ts` rounds to one decimal only between -10 and 10 days (exclusive), omitting trailing zeros, and to whole days otherwise. Below 0.1 days it shows `<0.1 days` or `-<0.1 days` to retain the sign. Negative is plain red, positive plain green, exactly zero neutral; no gradient or score bar remains. The exact estimated date is accessible through `Explained`. Missing scores, NULL/zero review dates or unusable points-per-day settings show `—` with an explanation, including never-reviewed cards found through a left join.

## Explained

`Explained.tsx` is the app's **only** "there is more here" affordance: dotted underlined text that a hover, a focus or a tap explains. It covers a label that would otherwise read as something it is not — the flashcard's "Score last fell", which is not always a failure, and the profile page's card count — and it is what shows a date's exact timestamp. One component, so a second shape of the same idea cannot appear; a mid-sentence tooltip and an underline saying different things is how that starts.

Mantine has no equivalent to import. It ships `Tooltip` and `ThemeIcon` but no icons at all, and its own docs draw this pattern with `@tabler/icons-react`, which is a dependency we do not have. What is worth keeping here is small and easy to forget by hand: `events` opens the tooltip to a keyboard and a touchscreen where Mantine defaults to hover alone, `tabIndex` is what lets a keyboard reach it, and `maw` with `multiline` lets a sentence wrap while a short date still shrinks to its own width.

## RelativeTime

`RelativeTime.tsx` is how **every** date in the app is written: "3 months ago", with the exact timestamp a hover away through `Explained`. "How long ago" is the question a reader has about a flashcard or a study session, and the exact moment is the rarer follow-up, so both are always there and neither reading is lost. It uses `Intl.RelativeTimeFormat`, which is in the browser and needs no dependency, with `numeric: "auto"` for the "yesterday" and "today" wordings. The clock is read once on mount rather than on every render — a re-render caused by something else must not silently reword a date, and the React Compiler's purity rule rejects the alternative anyway. Nothing ticks: a page left open overnight keeps yesterday's wording until it is mounted again, which is not worth a timer over a file the user imported by hand.

## Chinese text

`chinese.ts` is the pure text side of that: splitting a headword on `@` into aligned simplified/traditional/pinyin syllables, and turning numbered pinyin (`duan4`) into tone marks (`duàn`). The `Leeches` table and the flashcard both call it, so it is here and not in either. It runs no query — a page's `.db.ts` returns the raw columns and this shapes them for the eye.
