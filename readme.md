# Rasbora

Rasbora is a companion app for the [Pleco](https://www.pleco.com/), the most famous Chinese dictionnary app for Chinese learners.

Rasbora works by ingesting a Pleco flashcard database export. It then provides the following features:

- Flashcard dashboard with statistics
- Flashcard organization recommendations
- Flashcard AI analysis

## Everything flows from a profile

This is how a Pleco user thinks about their flashcards, and Rasbora is built the same way.

A **profile** is what you select before starting a review session, and everything flows from it:

- **the scorefile** it reads and writes. Scores, difficulty and review history live per scorefile, so the same card can be well known in one profile and freshly learned in another.
- **the cards it reviews**, through the categories the profile loads — often just one, sometimes several.
- **the settings** the session runs under: cards per session, word length, score bounds, how difficulty moves, and so on.

So a profile is the top of the tree, and settings, scores and card selection all hang below it. Nothing in the export is meaningful on its own — a score without the profile that produced it says nothing.

Rasbora therefore reads the export through exactly one profile at a time. You load a file on the `Load Pleco file` page, which is where the app opens when there is no saved file, and then pick a profile at the top of the window — it stays visible everywhere, and every page answers for that profile alone: `Profile info` describes it, `Statistics` charts the cards it draws from, and the card lists all read its scorefile only.

## Remembering your file

After an import, Rasbora saves the original Pleco file and your selected profile
in your browser. Reloading or opening another tab on the same site restores
both automatically, without uploading or downloading the export. Importing a
new file replaces the saved copy and selects its first profile. Existing tabs
keep their current file and profile until reloaded; their profile changes cannot
overwrite the selection for a newer import.

Use **Forget file** on the Load Pleco file page to remove that export from
browser storage and close it in the current tab. Other open tabs
keep their in-memory copy, but cannot save it again just by changing profiles.
The original file on your device is untouched.

Storage belongs to this site in this browser profile. Clearing site data,
private browsing ending, or browser storage eviction can remove the saved copy;
keep your original Pleco export. If saving fails, the imported file still works
in the current tab and Rasbora explains that it could not be remembered.

The bundled CC-CEDICT dictionary and SQLite engine use the browser's HTTP cache
with Cloudflare's default revalidation policy. On repeat visits, the browser
checks whether a cached asset has changed and reuses its local copy when the
server confirms it has not. Changed assets get new content-hashed URLs.

## The card lists

Five pages answer "which cards?", and each one opens a card's details when you select it. Every row carries a bar for how well known the card is — filling and turning from red towards green as the score climbs, with the exact score on hover. It reads in doublings rather than in plain numbers, because that is how Pleco spaces reviews: a card at the top of the scale fills the bar and is one you are done with.

- **Most difficult cards** — the ones this profile has failed most often.
- **Risky cards** — the ones you had learned and are now getting wrong: a run of correct answers, then a failure among the most recent reviews. You set how long the run has to have been and how far back "recently" reaches. Pleco records no date for an individual review, only the order, so recency here is counted in reviews rather than in weeks.
- **Almost learned cards** — in the profile's top score band, but not yet at its maximum. These still come back, at the longest interval the profile has.
- **Learned cards** — at the profile's maximum score, where Pleco has nowhere further to space them. Least recently seen first.
- **Customized cards** — the ones you have written your own definition on, which is the only meaning a Pleco export itself carries. Open one and the bundled dictionary's definition sits below your own.

Both score bounds are read from the profile you picked rather than assumed, so a profile that scores differently is read differently.

## Traditional or simplified

Pleco stores both written forms of every card, so you choose which one you read. The 繁/简 switch sits on the `Load Pleco file` page, beside the file it applies to, and it applies everywhere a character is drawn — the card lists and the card details alike. It is a choice you make once, because of where you are learning rather than what you are reading. Traditional is the default, and your choice is remembered between visits.

Where a card has no traditional variant, both settings show the same characters. On a card's details, whichever form you did not choose is shown smaller underneath it.

## Definitions

A Pleco export barely contains meanings: it stores your own notes, which most cards don't have, and references into Pleco's own dictionaries whose text is not exported. So Rasbora fills the gap with [CC-CEDICT], a free community dictionary bundled with the app. Open a card and, below your own note if you wrote one, you'll see its dictionary definition — matched to the card's reading, so the right sense shows for a character that has more than one (行 as _xíng_ or _háng_).

Multi-word phrases and cards you made yourself are often not in CC-CEDICT, and simply show no definition. CC-CEDICT is provided under [CC BY-SA 4.0] and is credited on every card that uses it.

[CC-CEDICT]: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
[CC BY-SA 4.0]: https://creativecommons.org/licenses/by-sa/4.0/
