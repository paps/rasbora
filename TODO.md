- [ ] Add an analysis of the Profile's goal (reading comprehension, hearing comprehension, recall at least) depending on understanding the profile's settings. Used as a double check so that the user realizes the profile learning effect in case they didn't know

- [x] 'Learned' page — shipped as `Learned cards`, with `Almost learned cards`
      beside it for the top score band below the ceiling

- [x] 'Forgotten' page: a list of cards that had 666+ and then got lost, number
      of 6s adjustable — shipped as `Risky cards`, with both the run length and
      how far back "recently" reaches adjustable on the page

- [ ] Check what happens for flashcards that refer to a user dict entry only (because the dict entry is not available for now in the app)

- [ ] Make it work for fuller exports of Pleco (that include Pleco settings and, in particular, Pleco user dictionaries, which appear to come as a separate sqlite file?)

- [ ] Ability to identify dangling user dict entries (ones that have no flashcard associated)

- [ ] Detect flashcards that I consider 'bugged', i.e. they lost their definitions (it doesn't display when reviewing in Pleco)

- [ ] Make the whole thing fully mobile friendly

- [ ] Correctly store the sqlite file in cache for immediate no network reload when opening a new tab. Also properly cache efficiently cc-cedict

- [ ] Ability to search for a card anywhere — there is a `View a card` page
      that searches now, but "anywhere" would mean reaching it from every page,
      which is a title bar question and the title bar is full

- [x] Ability to view a card (whole page view) — shipped as `View a card`,
      searching by headword in either script, by reading with or without
      tones, and by card number

- [ ] Open `View a card` from a direct link with a querystring (assuming Pleco
      file still in cache) — the page holds its search in component state for
      now, so a search is not linkable and does not survive a reload
