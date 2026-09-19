# Rasbora

Rasbora is a companion app for the [Pleco](https://www.pleco.com/), the most famous Chinese dictionnary app for Chinese learners.

Rasbora works by ingesting a Pleco flashcard database export. It then provides the following features:

- Flashcard dashboard with statistics
- Flashcard AI analysis

## Everything flows from a profile

This is how a Pleco user thinks about their flashcards, and Rasbora is built the same way.

A **profile** is what you select before starting a review session, and everything flows from it:

- **the scorefile** it reads and writes. Scores, difficulty and review history live per scorefile, so the same card can be well known in one profile and freshly learned in another.
- **the cards it reviews**, through the categories the profile loads — often just one, sometimes several.
- **the settings** the session runs under: cards per session, word length, score bounds, how difficulty moves, and so on.

So a profile is the top of the tree, and settings, scores and card selection all hang below it. Nothing in the export is meaningful on its own — a score without the profile that produced it says nothing.

Rasbora therefore reads the export through exactly one profile at a time. You load a file on the `Load Pleco file` page, which is where the app opens when there is no saved file, and then pick a profile at the top of the window — it stays visible everywhere, and every page answers for that profile alone: `Profile info` describes it, `Card count` charts the cards it draws from, and the card lists all read its scorefile only.

## Links to a specific export

Every page accepts optional `profileId` and `lastSessionStart` query parameters:

```text
/streaks?run=4&profileId=2&lastSessionStart=1789722000
/card?profileId=2
/incoming-reviews?lastSessionStart=1789722000
```

`profileId` must exist in the loaded export and selects that profile.
`lastSessionStart` is the exact Unix-seconds value of a profile's `laststart`
column in the export, not a formatted date or milliseconds. With both parameters,
both must match the same profile. With only `lastSessionStart`, any profile can
match, and Rasbora selects it. If several match, the selected profile wins when
it is one of them; otherwise the first in Pleco's order wins. Values must be
nonnegative decimal integers; empty, repeated, or malformed parameters are
rejected. Missing timestamps do not match zero.

Pages can carry parameters of their own beside these, and **Streaks** is the
one that does: `run` is the run of correct answers to list, and the optional
`runTo` raises it into a range, so `/streaks?run=4&runTo=10` lists every card
on a run of 4 through 10. `run` on its own lists that one exact run, which is
what the Learning distribution chart links to. A `runTo` below `run`, or a
value that is not a whole number from 0 to 100, is ignored and leaves the
single run showing.

Validation waits for saved-file restoration and any import already in progress.
The destination page stays hidden until the link is checked. Successful links
consume these two parameters while preserving the path and other parameters,
so subsequent profile choices work normally.

If either constraint fails, or no export is loaded, Rasbora unloads the current
export and forgets its saved browser copy, using the same protection against
removing a newer export saved by another tab as **Forget file**. It opens
`/load` with a prominent error and drops the original destination and all query
parameters, including `fromUrl`. Load the intended export there, then click the
original link again. Loading a replacement does not automatically return to the
old destination or validate it against the discarded link. If browser storage
prevents deletion, the current tab still unloads the export and explains that
its saved copy may return on reload.

## Loading from a URL

On **Load Pleco file**, paste a direct HTTP(S) download URL or a public Google
Drive file sharing link into **File URL**, then choose **Load from URL**.
Downloads go directly from the host to your browser; Rasbora has no backend
or download proxy. Other hosts must allow cross-origin browser requests (CORS).
On an HTTPS deployment, browsers also block insecure HTTP downloads. Links
requiring sign-in are not supported. If a host blocks browser access, download
the file yourself and use the local file picker.

For Google Drive, set the file's general access to **Anyone with the link** and
allow viewers to download it. Paste the complete sharing link, including its
`resourcekey` parameter if present. Rasbora reads the original file name and
bytes through the Drive API, without asking the reader to sign in. This needs
the app-level API key described below.

The downloaded file uses the same validation and IndexedDB storage as a local
import. A failed download or invalid export leaves the current and saved file
intact. Reloads and new tabs restore the saved bytes and profile without
contacting the URL again. There is no automatic sync: load the URL again to
import a newer export. Explicit URL loads request a fresh download.

A **Loaded from a URL** panel shows the original source as a clickable link.
The URL is saved alongside the file in IndexedDB and remains visible after
reloads and in new tabs. For Drive imports, this is the original sharing link,
not the API request containing Rasbora's key. A failed import preserves the
previous source along with its file. Loading a local file or choosing
**Forget file** clears the source. Older saved files without source information
still restore normally, with no panel.

You can also open `/load?fromUrl=…` to start a download automatically, with the
URL already filled into the form. Encode the complete source URL as the query
parameter value, especially if it contains `&`, `+`, or `#`. For example:

```text
/load?fromUrl=https%3A%2F%2Ffiles.example%2Fflashcards.pqb
```

For a Drive link, build the query with
`new URLSearchParams({ fromUrl: driveSharingLink }).toString()` to preserve all
of its parameters, including `resourcekey`.

The opening link starts one import after saved-file restoration finishes, using
the same validation, errors, and IndexedDB save as **Load from URL**. An empty
`fromUrl` does nothing. Reloading or reopening a link containing `fromUrl`
requests a fresh download; open `/load` without it to use the saved copy. An
unsuccessful automatic import leaves the previous export intact, and the form
lets you correct the URL or retry manually.

### Configuring Google Drive downloads

1. In a Google Cloud project, enable the **Google Drive API** and create a
   dedicated API key for Rasbora. Public files can be accessed with an API key;
   OAuth credentials and a service account are not needed.
2. Restrict the key to the **Google Drive API** and to Rasbora's website using
   **Websites (HTTP referrers)** restrictions. Include the deployed origin and
   its `/*` path pattern. Add `http://localhost:5173` and
   `http://localhost:5173/*` if testing locally.
3. Set `GOOGLE_DRIVE_API_KEY` at the top of
   `src/pages/LoadFile.remote.ts` to that key and commit it, then deploy by
   updating the `prod` branch from main. No environment variables or separate
   configuration files are needed.

This public browser key lives in the repository and is visible in the built
JavaScript and network requests. Keep the API and website restrictions above.
The app sends it only to the Drive API. Without it, direct URLs and
local imports still work, while Drive links explain that Drive loading is not
configured. Google permissions and download/API quotas still apply.

See Google's [API key setup](https://developers.google.com/workspace/guides/create-credentials),
[key restrictions](https://docs.cloud.google.com/docs/authentication/api-keys),
[file downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads),
and [resource keys](https://developers.google.com/workspace/drive/api/guides/resource-keys).

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

Five pages answer "which cards?", and each opens a card's details when you select it. Every row shows the estimated time until its next review in fractional days. Positive values are green; negative values are red with a minus sign. The same display appears beside the review count on card details and **View a card**.

- **New cards** — the ones this profile holds but has never reviewed, the ones added longest ago first. This is the left-hand bar of the Learning distribution chart.
- **Leeches** — the ones this profile has failed most often: cards soaking up review time without ever being learned.
- **Lapses** — the ones you had learned and are now getting wrong: a run of correct answers, then a failure among the most recent reviews. You set how long the run has to have been and how far back "recently" reaches. Pleco records no date for an individual review, only the order, so recency here is counted in reviews rather than in weeks.
- **Streaks** — the ones on the run of correct answers you pick, soonest due first. You can ask for one exact run, or for a range of them — runs 4 to 10 in one list, say, with each card's own run in a column. Selecting a bar of the Learning distribution chart opens this page at that single run, and both ends of the range are in the address, so a view can be reloaded or shared.
- **Customized cards** — the ones you have written your own definition on, which is the only meaning a Pleco export itself carries. Open one and the bundled dictionary's definition sits below your own.

## Time until review

The selected profile's **Card points per day** (`pro_cardpointsday`) converts
scores into review intervals. It is configuration, not a constant: 100 in the
sample export does not mean every profile uses 100.

```text
intervalDays = score / pro_cardpointsday
nextReviewUnixSeconds = lastreviewedtime + intervalDays × 86400
daysRemaining = (nextReviewUnixSeconds − currentUnixSeconds) / 86400
```

Use the card's score and last review date from the profile's scorefile, and the
points-per-day setting from the profile itself. Two profiles can share a
scorefile but use different rates. The interval starts at the **last review**,
not when the score last changed or the file was exported. One day is 86,400
seconds, not a calendar-day boundary.

A score of 250 at 100 points per day gives a 2.5-day interval. Three days after
its last review, the card shows **-0.5 days**: half a day overdue. Even cards at
the score ceiling can become overdue; the ceiling caps the interval and does
not retire the card. These are estimates from saved state, not a prediction of
session selection. Reviews after export are unknown until a new file is loaded.

Values strictly between -10 and 10 days round to one decimal with trailing
zeros omitted; all other values round to whole days. A nonzero magnitude
under 0.1 days reads **<0.1 days** or **-<0.1 days**, so rounding never hides the
overdue sign. Negative is red, positive green, and exactly zero neutral. Hover,
focus or tap reveals the estimated due date. The clock is read when the display
mounts; a page left open does not tick. Reopening it recalculates against
current time, not export time.

Missing scores, NULL/zero last-review timestamps, and missing, invalid or
nonpositive points-per-day settings show **—**, never an invented date.

**Incoming reviews** charts all cards in the selected profile with an estimated
review date, one bar per day from the earliest estimate to the latest. Days are
rounded down: 2.7 days goes in **2**, and -0.2 days goes in **-1**. Negative
days are overdue; **0** means due within the next 24 hours. Empty days stay on
the axis, with no weekly grouping or limit on the range. Negative-day bars are
red, and their sum is shown above the chart as the number of cards due for
review. Cards without enough data for an estimate are counted below the chart.
Like the individual card countdowns, the chart uses the time when the page
opens and does not tick.

**Profile info** summarizes cards per session, the new-card limit, and the
review interval range in days. The interval range divides score bounds by the
profile's points per day; it is not a countdown because settings have no
card's last-review date to subtract. Technical settings remain available in
the raw settings accordion. **Start date** on Profile info and Load Pleco file
labels their existing profile creation and `FileCreated` timestamps respectively; it is not
the export's download date.

## Traditional or simplified

Pleco stores both written forms of every card, so you choose which one you read. The 繁/简 switch sits on the `Load Pleco file` page, beside the file it applies to, and it applies everywhere a character is drawn — the card lists and the card details alike. It is a choice you make once, because of where you are learning rather than what you are reading. Traditional is the default, and your choice is remembered between visits.

Where a card has no traditional variant, both settings show the same characters. On a card's details, whichever form you did not choose is shown smaller underneath it.

## Definitions

A Pleco export barely contains meanings: it stores your own notes, which most cards don't have, and references into Pleco's own dictionaries whose text is not exported. So Rasbora fills the gap with [CC-CEDICT], a free community dictionary bundled with the app. Open a card and, below your own note if you wrote one, you'll see its dictionary definition — matched to the card's reading, so the right sense shows for a character that has more than one (行 as _xíng_ or _háng_).

Multi-word phrases and cards you made yourself are often not in CC-CEDICT, and simply show no definition. CC-CEDICT is provided under [CC BY-SA 4.0] and is credited on every card that uses it.

[CC-CEDICT]: https://www.mdbg.net/chinese/dictionary?page=cc-cedict
[CC BY-SA 4.0]: https://creativecommons.org/licenses/by-sa/4.0/

## Checking changes

Run `npm run check`, `npm run format`, and `npx vite build`.
