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

### Configuring Google Drive downloads

1. In a Google Cloud project, enable the **Google Drive API** and create a
   dedicated API key for Rasbora. Public files can be accessed with an API key;
   OAuth credentials and a service account are not needed.
2. Restrict the key to the **Google Drive API** and to Rasbora's website using
   **Websites (HTTP referrers)** restrictions. Include the deployed origin and
   its `/*` path pattern. Add `http://localhost:5173` and
   `http://localhost:5173/*` if testing locally.
3. Set `GOOGLE_DRIVE_API_KEY` at the top of
   `src/pages/LoadFile.remote.ts` to that key and commit it. Run
   `npx vite build` and deploy the rebuilt `dist/`. No environment variables
   or separate configuration files are needed.

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
