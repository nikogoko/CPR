# Setup checklist

You only need two secrets. There is no Google account, sheet or service account any more.

## 1. Anthropic key
console.anthropic.com -> API keys -> Create key (shown once, copy it).
API use is billed separately from a Claude subscription: add a little credit under Billing.
If asked about "identity federation", choose "Continue with an API key".

## 2. GitHub
Push this project to your repository (node_modules is ignored automatically).

## 3. Netlify
1. Sign in at netlify.com with GitHub -> Add new site -> Import an existing project -> pick the repo.
   The build settings are already in netlify.toml; leave them alone.
2. Before the first deploy, Site configuration -> Environment variables:
   - SITE_PASSWORD      (required; pick anything, you type it on the site; the site refuses everything without it)
   - ANTHROPIC_API_KEY
3. Deploy, open the URL, enter your password.

## Using it
- Browser zoomed out until the whole menu category shows, take a screenshot (include the headline above the pizzas, e.g. "Neapolitan pizza 33 cm"; a screenshot can show several headlines).
- Add tab -> pick the restaurant (or add a new one) -> pick the Platform (Glovo or Wolt; it remembers your last choice). "Auto" tells them apart by the screenshot's background: dark = Wolt, light = Glovo (set in index.html, THEME) -> pick the date -> choose screenshots -> Read.
  Glovo and Wolt prices are kept apart, even for the same pizza on the same day.
- Check the rows (red cells must be filled; tick "Popular" / "New" for items the app marks with those badges) -> Save prices.
- Each restaurant gets its own tab with a Glovo | Wolt switch inside it, and a Headline dropdown to show one headline at a time (for example "Neapolitan pizza 33 cm", Salads or Beverages) or all of them side by side. It opens on the platform with the freshest prices and its newest date; the dropdown shows older dates.
  Arrows show price changes since the last earlier date that pizza was recorded under the same headline on the same platform.
- Download Excel gives a .xlsx with an "All data" sheet (full history, with filters and a Platform column) and one sheet per restaurant with two parts: Glovo on top, Wolt below (newest date of each).
- Sending the same restaurant + platform + date + headline + pizza again replaces the earlier entry (so you can correct a day).
- "Delete this date" removes one restaurant + platform + day if a batch was wrong.
- To add another delivery app later, add its name to lib/platforms.js and to PLATFORMS in index.html.
- Rows you have read but not saved are kept on the server, so every device that logs in sees them.

## Where the data lives
Everything (history and pending rows) is stored in Netlify Blobs, inside your Netlify site.
Deleting the Netlify site deletes the data, so press "Download Excel" now and then as a backup.

Locally, use `netlify dev` (not a plain file server) so functions and Blobs work.

## If the login says "Wrong password"
- A new or changed SITE_PASSWORD only applies after the next deploy (Deploys -> Trigger deploy).
- The variable must be named exactly SITE_PASSWORD, with the Functions scope and a value for the Production context.
- If the page says "The server has no SITE_PASSWORD set", the site can't see the variable: fix the name/scope/context and redeploy.
- Spaces around the password are ignored. Passwords in any language work. Capital letters count.
