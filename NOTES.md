# Price Tracker: notes

A small private website (Netlify) that reads delivery-app menu screenshots with Claude, keeps a dated price history per
restaurant and app (Glovo / Wolt), compares restaurants, and exports to Excel. Built for Gennaro's own price tracking.

## Running it
- Hosted on Netlify, deployed from the `main` branch of the GitHub repo `nikogoko/CPR`. Functions are in `netlify/functions`.
- Settings (Netlify > Site configuration > Environment variables, Functions scope, "contains secret values" ticked):
  `SITE_PASSWORD` (required, the site refuses everything without it) and `ANTHROPIC_API_KEY`.
- Data lives in Netlify Blobs (strong consistency). Nothing is stored in Google Sheets any more.
- **Credits:** the free plan has 300 credits a month. Every production deploy (every push to `main` that builds) costs 15 credits,
  failed deploys cost nothing. Use "Stop builds" and trigger a deploy only when a batch of changes is ready. Reading a screenshot costs ~0.1 credit.
- The Claude API for reading screenshots is billed separately, on the account that owns `ANTHROPIC_API_KEY`
  (Claude Console: Cost and Usage pages).

## Files
- `index.html`: the whole page (pizzeria look, tabs: Add, one per restaurant, Compare). All logic is in its script.
- `netlify/functions/extract.js`: reads one screenshot with Claude (structured output). Old-style function.
- `netlify/functions/*.mjs`: `pending` (rows waiting to be saved, shared across devices), `save`, `history`, `export` (Excel),
  `links` (hand-made matches for Compare), `passkey` (Face ID).
- `lib/auth.js` (password + 12-hour session pass), `lib/http.mjs`, `lib/store.mjs` (Blobs, tries strong consistency), `lib/platforms.js`.

## Rules agreed with the owner
**Saving**
- The saved date is read when Save is pressed: the date box if filled in, otherwise today. Never the day the screenshots were read.
- Saving the same restaurant + app + date + headline + item again REPLACES the earlier entry (no history of replaced prices yet).
- Platform: "Auto" tells apps apart by screenshot background: dark = Wolt, light = Glovo. A platform picked by hand always wins and is remembered.
  Unclear screenshots follow the rest of the batch or the last app (yellow outline) or stay blank.
- The reader must copy item names, headlines and offers exactly (no synonyms, no translating). Names stay in Georgian.
- Tickboxes read from the app's badges: Popular, New, 18+. The badge text is kept out of the Offer field.
- Rows have a headline (the category title, e.g. "Neapolitan pizza 33 cm"); each headline is a column / a choice in the Headline dropdown.

**Restaurant tabs / Excel**
- Each restaurant tab has a Glovo | Wolt switch, a date dropdown (newest first) and a Headline dropdown. Arrows compare with the
  last earlier date of the same item and headline on the same app (down = red, up = green). Prices are shown with the lari sign after.
- Excel: "All data" sheet plus one sheet per restaurant (Glovo part on top, Wolt below, newest date of each). The download
  dropdown can limit it to one restaurant or one restaurant + app + day.

**Compare tab** ("your restaurant" defaults to Gennaro)
- Percent = (your price - theirs) / their price by default (like the owner's dashboard); option "the higher price". + red = you cost more, - green = less.
- "Original" prices (before discounts) by default; option "Sale prices (after discounts)".
- Items match by a spelling-tolerant name (Margherita / Margarita / Georgian მარგარიტა), on the same app, with the same size.
- Size of a headline: a number wins; "30 cm" and "35 cm" count as 33; a plain "Pizza" is 33; "Small pizza" is 20; Large/Medium are not guessed.
  Headlines that match nothing are listed (never dropped silently) and can be linked by hand or marked not comparable.
- Priority when two of their items match one of yours: hand link, then exact name, then similar spelling. A hand link that beats an
  exact name shows a warning with "Use the exact name instead".
- "Compare with" ticks are remembered per "your restaurant" on that device.

**Login**
- Password always works. Optional Face ID / fingerprint (passkeys), set up after a password login (buttons at the bottom of the page).
  A Face ID sign-in lasts 12 hours. It only works on the exact website address it was set up on.

## Agreed next, not built yet
- Safety net: warn before replacing a saved day, keep replaced prices with a Restore button, "change this day's date".
- Screenshot archive tab (screenshots filed by upload day, deleted after 30 days) kept inside the site. Google Drive was judged too complicated.

## Things to remember
- This file and the code were backed up outside GitHub on 7 November 2026 because the GitHub connection of the build session had changed.
- Tests were scratch scripts in the build session and are not in the repo.
