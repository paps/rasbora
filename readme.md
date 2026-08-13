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

Rasbora therefore reads the export through exactly one profile at a time. You import a file and pick a profile at the top of the window, both stay visible everywhere, and every page answers for that profile alone: `Profile info` describes it, `Statistics` charts the cards it draws from, and `Most difficult cards` counts failures in its scorefile only.

## Traditional or simplified

Pleco stores both written forms of every card, so you choose which one you read. The 繁/简 switch sits at the top of the window next to the profile, and applies everywhere a character is drawn — the card lists and the card details alike. Traditional is the default, and your choice is remembered between visits.

Where a card has no traditional variant, both settings show the same characters. On a card's details, whichever form you did not choose is shown smaller underneath it.
