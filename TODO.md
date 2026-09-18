- [ ] Add an analysis of the Profile's goal (reading comprehension, hearing comprehension, recall at least) depending on understanding the profile's settings. Used as a double check so that the user realizes the profile learning effect in case they didn't know

- [x] 'Learned' page — shipped as `Learned cards`, with `Almost learned cards`
      beside it for the top score band below the ceiling

- [x] 'Forgotten' page: a list of cards that had 666+ and then got lost, number
      of 6s adjustable — shipped as `Lapses`, with both the run length and
      how far back "recently" reaches adjustable on the page

- [ ] IMPORTANT: the 'points per day' config in the profile is what divides the card score to get the number of days Pleco will wait until showing the card again. This should be shown in the app and documented. It will help compute the estimate of review dates etc

- [ ] Have a querystring that is there just to check that the deeplink from AI (or anywhere) correctly matches the currently loaded database, by looking at the exact date of the last review start time. If it doesn't match, unload the database and complain to the user

- [ ] Check what happens for flashcards that refer to a user dict entry only (because the dict entry is not available for now in the app)

- [ ] Make it work for fuller exports of Pleco (that include Pleco settings and, in particular, Pleco user dictionaries, which appear to come as a separate sqlite file?)

- [ ] Ability to identify dangling user dict entries (ones that have no flashcard associated)

- [ ] Detect flashcards that I consider 'bugged', i.e. they lost their definitions (it doesn't display when reviewing in Pleco)

- [ ] Make the whole thing fully mobile friendly

- [x] Correctly store the sqlite file in cache for immediate no network reload when opening a new tab. Also properly cache efficiently cc-cedict

- [ ] Ability to search for a card anywhere — there is a `View a card` page
      that searches now, but "anywhere" would mean reaching it from every page,
      which is a title bar question and the title bar is full

- [x] Ability to view a card (whole page view) — shipped as `View a card`,
      searching by headword in either script, by reading with or without
      tones, and by card number

- [ ] Show estimated number of flashcards left to review, based on the profile settings, what we know empiracally from what Pleco does, and the time of day vs. the time of the pleco export
- [ ] Update skill with this information, so that an AI agent can also estimate the value properly
- [ ] Add this next review information when you're looking at an individual flashcard
- [ ] Open `View a card` from a direct link with a querystring (assuming Pleco
      file still in cache) — the page holds its search in component state for
      now, so a search is not linkable and does not survive a reload
- [ ] Rename `Learned cards` to `Cards to revive` (or find the right SRS name
      for it) and sort it oldest first. Update the page accordingly: the goal is
      to bring back into review the cards that weren't actually learned, or were
      forgotten, after years+ of non use
- [ ] Instead of displaying the score prominently, display the number of days
      before the next review (which can go negative depending on the current
      time) — score is not useful on its own, the number of days is always the
      better metric. Days = `score` / `pro_cardpointsday` (100 here) counted
      from `lastreviewedtime`, so next review =
      `lastreviewedtime + score/pro_cardpointsday days - now`
