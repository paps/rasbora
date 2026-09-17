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

- [x] Correctly store the sqlite file in cache for immediate no network reload when opening a new tab. Also properly cache efficiently cc-cedict

- [ ] Ability to search for a card anywhere

- [ ] Ability to view a card (whole page view). Can be opened from a direct link with querystring (assuming Pleco file still in cache)

- [ ] Show estimated number of flashcards left to review, based on the profile settings, what we know empiracally from what Pleco does, and the time of day vs. the time of the pleco export
- [ ] Update skill with this information, so that an AI agent can also estimate the value properly
- [ ] Add this next review information when you're looking at an individual flashcard
