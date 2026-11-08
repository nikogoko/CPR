# Price Tracker: handover notes (updated 8 November 2026)

READ ALL OF THIS BEFORE CHANGING ANYTHING. It replaces the chat history of the session that built the site.

## 1. What this is
A small private website (Netlify) that reads delivery-app menu screenshots (Glovo and Wolt, menus in Georgian) with Claude, keeps a dated
price history per restaurant and app, compares restaurants, and exports to Excel. The owner built it for a small restaurant run by their
family (their aunt's, the owner said); "Gennaro" is that restaurant, the reference ("we") in the Compare tab. The Compare tab was modelled on
the owner's own price dashboard (a photo of it showed SKU rows, competitor columns with price and a "difference" column, a 30-day price
index line chart, and yellow cells meaning "price changed since yesterday").

## 2. How the owner likes to work
- Not a developer: short plain words, say what changed and why it matters. Show visual changes as screenshots (render with Playwright against a
  fake server and send the picture). Answer the question asked first.
- They asked to be challenged: when they describe how they want something, give an honest opinion, alternatives and a recommendation, then do
  what they decide. Say plainly what is untested or a guess.
- NEVER push to GitHub without their explicit yes ("push it"). Ask each time. A push to `main` that builds costs 15 Netlify credits (see 3), so
  group changes into one push. A separate branch can be pushed without touching the live site.
- Test before reporting done, and say what was NOT tested (see 9). Never touch repos that are not the owner's `nikogoko/CPR`.
- Menus are Georgian: keep names exactly as shown. Wording they chose: dates like "3rd November 2026", the lari sign after prices (30.00₾),
  "Item" (not "Pizza") for rows, "Save prices", "Sale prices", "Headline".

## 3. Where things stand
- Repo `nikogoko/CPR` (private), branch `main`, last commit "Keep the Download Excel block on the right edge" (a4f253f). That is what Netlify can deploy.
- NOT on GitHub yet (finished and tested, never deployed): Face ID (passkeys), the whole Compare tab, the date-read-at-Save fix, and this file.
  They exist in the backup zip and in a local-only `backup` branch of the build chat's clone. To publish: put them on a `backup` branch (GitHub web
  "Upload files" -> "Create a new branch" works without any Claude), then merge into `main` = ONE deploy.
- Why it could not be pushed: the build chat ran on another person's Claude account whose GitHub login (`swork-gif`) cannot see the private repo.
  Fix: install the Claude GitHub App on `nikogoko` for CPR and add `swork-gif` as a collaborator, or connect GitHub as `nikogoko` in the Claude account being used.
- Netlify free plan = 300 credits a month, hard limit (site pauses if exceeded). 15 production deploys used 225 in early November
  (about 226 total); resets about the end of November. Locking publishing does NOT stop builds; "Stop builds" does. Deploy by hand
  (Deploys > Trigger deploy) only when a batch is ready. Publishing an already-built deploy should be free. Reading a screenshot costs ~0.1 credit.
- The Claude API key (`ANTHROPIC_API_KEY`) is billed on the account that created it (Claude Console: Cost and Usage pages). Ask the owner whose.
- Settings in Netlify (Functions scope, secret ticked): `SITE_PASSWORD` (required: the site refuses everything without it) and `ANTHROPIC_API_KEY`.

## 4. Questions the owner has NOT answered yet (ask before assuming)
- Compare percent: default divides by THEIR price (like the dashboard; 100 vs 90 shows +11%). The owner's example said +10%, which matches the
  option "the higher price". They have not said which they prefer.
- Should every size from 30 to 35 count as 33 (one range rule)? Today only 30 and 35 are listed (SAME_SIZE); 31, 32, 34 are not.
  "Large"/"Medium" pizzas are deliberately not guessed.
- Safety net and screenshot archive (section 10): proposed, explained, NOT approved yet. Open points: 30-day retention, a "Read this again" button.
- Dashboard features not built: the 30-day price-index chart, yellow "changed since yesterday" cells, Compare inside the Excel file.
- Idea not done: move index.html into a `public/` folder (netlify.toml publishes the whole repo root, so function source is downloadable; no secrets in it).

## 5. Files
- `index.html`: the whole page and all its script. Pizzeria look: cream paper, tomato red, gingham band, "Pacifico" title from Google Fonts.
  Tabs: Add, one per restaurant, Compare. Footer: Face ID buttons and Log out.
- `netlify/functions/extract.js` (old style, CommonJS): reads one screenshot. Model `claude-sonnet-5-5`, `output_config` effort low + JSON-schema
  structured output, max_tokens 16000. This model REJECTS forced `tool_choice` (that bug broke every read once), so never use tool_choice tool/any.
- `netlify/functions/*.mjs` (new style, Request in / Response out, strong-consistency Blobs): `pending`, `save`, `history` (read, deleteDate), `export` (Excel
  via exceljs), `links`, `passkey`. Tests inject a fake store through `globalThis.__priceTrackerTestStore`.
- `lib/auth.js` (password or 12-hour session pass), `lib/http.mjs`, `lib/store.mjs` (falls back to normal consistency if strong reads are unavailable), `lib/platforms.js`.
- The platform list lives in TWO places that must match: `lib/platforms.js` and `PLATFORMS` in `index.html`.

## 6. Data format (do not break saved data)
- Netlify Blobs store `price-tracker`. Keys: `history/<sha1 of the trimmed lowercase restaurant name>` = `{ name, rows[] }`; `pending` = rows waiting to be saved
  (shared across devices); `passkeys` = Face ID public keys; `links` = hand links; `challenge/<id>` = one-time Face ID challenges.
- A row: `restaurant, platform ("Glovo"|"Wolt"|"" for entries saved before platforms existed, shown as "No platform"), item, size (the headline text; very old rows
  hold "33 cm"), sale_price (number), regular_price (number or ""), notes, popular, isNew, age18 (booleans, absent in old rows), date (YYYY-MM-DD)`.
- Saving replaces an existing entry with the same restaurant + platform + date + headline + item (case-insensitive). The first spelling of a restaurant name is kept.
- Hand links: `<normalised their restaurant>|<normalised their item>` -> `{ ref: <normalised your restaurant>, item: <your item's name key> }`, or item "!" = never the same;
  headline links use `...|~<normalised headline>` -> `{ ref, item: <size key> }` or "!" = not comparable.
- Passwords are sent URL-encoded in the `x-site-password` header; a Face ID sign-in returns a session pass sent as `x-session-token`, signed from SITE_PASSWORD
  (changing the password cancels every pass). Never put secrets in the repo.

## 7. Rules agreed with the owner
**Saving**
- The saved date is read when Save is pressed: the date box if it is filled in, otherwise today (the device's date). Never the day the screenshots were read.
- Rows waiting to be saved are stored on the server (every device sees them) and flushed when the page closes. After Save the page re-asks the server until the
  new rows appear, so no reload is needed.
- Platform "Auto" tells apps apart by screenshot background brightness: dark = Wolt, light = Glovo (THEME in index.html; median < 100 dark, > 155 light, in between = unclear).
  The AI used to guess the app and was wrong. A platform the owner picks always wins and is remembered. Unclear screenshots follow the rest of the batch or the last app
  (yellow outline) or stay blank.
- The reader copies item names, headlines and offers exactly: no synonyms, no translating, no spelling fixes (it once swapped "სამარხვო" for "ვეგანური"). It ignores
  order-wide banners, uses the highlighted side-menu entry as the headline only when no title is shown, and reports cards it cannot read.
- Tickboxes read from the app's badges, separate from the Offer text: Popular, New (ახალი), 18+.

**Restaurant tabs and Excel**
- A Glovo | Wolt switch, a date dropdown (newest first) and a Headline dropdown (one headline's items, or all side by side). Arrows compare with the last earlier date of
  the same item and headline on the same app: price down = red ▼, up = green ▲. Tags: yellow "★ Popular", green "New", dark red "18+".
- "Delete this date" removes one restaurant + app + day. Deleting an app's only day jumps to the app that still has prices.
- Excel: sheet "All data" (every row, with filters, Platform / Headline / Popular / New / 18+ columns) plus one sheet per restaurant with a Glovo part on top and a Wolt part
  below (each app's newest date). A dropdown next to Download Excel limits it to everything, one restaurant, or one restaurant + app + day (sits on the right edge).

**Compare tab** (your restaurant defaults to Gennaro)
- Percent = (your price - theirs) / their price by default, or "the higher price". + red = you cost more, - green = you cost less. "Original" prices (before discounts) by
  default, or "Sale prices (after discounts)". Only items both restaurants have; the app and the headline are chosen above the table. "Compare with" ticks (All / None) choose the
  restaurants, remembered per "your restaurant" on that device. A note says when a restaurant's prices are from an older day.
- Matching is by a spelling-tolerant name key (Margherita / Margarita / Georgian მარგარიტა; Georgian letters transliterated, vowels and doubles dropped, "pizza" ignored)
  plus the same size. Automatic similar matches are marked ≈ and listed with a "Not the same" button.
- Size of a headline: a number wins, except 30 and 35 count as 33; no number: a plain "Pizza" is 33, "Small pizza" is 20 (Georgian პატარა too); Large/Medium/others are not
  guessed. Headlines that match nothing are LISTED (never dropped silently) and can be linked to one of yours or marked not comparable.
- Priority when several of their items match one of yours: hand link, then exact name, then similar spelling. A hand link that beats an exact name shows a warning with
  "Use the exact name instead". Items that lose go to "Not matched yet".

**Login**: the password always works. Optional Face ID / fingerprint (passkeys) set up after a password login; lasts 12 hours; works only on the exact website address it was set up on.

## 8. Known risks (never verified live)
- Nothing was ever run against the real Claude API, real Netlify Blobs, a real Glovo/Wolt screenshot, or a real phone with Face ID. The owner's first real use is the real test.
- Not measured: how long reading ~20 Georgian items takes versus Netlify's function time limit; if it times out, split big screenshots into pieces.
- Assumed, not checked: new-style `.mjs` functions answer at `/.netlify/functions/<name>`; strong consistency works in the live environment (there is a fallback); Face ID
  derives its website address from the request URL (an origin mismatch shows in the error text).
- Netlify does not publish a credit rate for Blobs storage; check the Usage page after adding anything big (the archive would).
- The Georgian-to-Latin name matching and size words were built from a handful of examples; expect to extend them from real menus.

## 9. Proposed next steps (not approved, see 4)
1. Safety net: a warning before today's prices replace a saved day (this happened once: prices saved under the wrong date overwrote the real ones), a copy of replaced prices
   with a Restore button, and "change this day's date".
2. Screenshot archive tab inside the site (filed by the day they were uploaded, shrunk, deleted after 30 days). Google Drive was ruled out: it needs a complicated sign-in.

## 10. Tests
Scratch scripts from the build session, in the backup zip under `session-tests/` (not in the repo): a Node script running the real functions against an in-memory store, and Playwright
browser tests against a fake server (login, saving, tabs, compare, Face ID with Chromium's virtual authenticator, dates, name and size matching). They contain hard-coded paths and need
small edits to run elsewhere. When you change behaviour, rerun the same kinds of checks.
