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
- Browser zoomed out until the whole menu category shows, take a screenshot (include the size heading, e.g. "33 cm").
- Add tab -> pick the restaurant (or add a new one) -> pick the date -> choose screenshots -> Read.
- Check the rows (red cells must be filled) -> Save prices.
- Each restaurant gets its own tab. It opens on the newest date; the dropdown shows older dates.
  Arrows show price changes since the last earlier date that pizza and size was recorded.
- Download Excel gives a .xlsx with an "All data" sheet (full history, with filters) and one grid sheet per restaurant (newest date).
- Sending the same restaurant + date + size + pizza again replaces the earlier entry (so you can correct a day).
- "Delete this date" removes a restaurant's whole day if a batch was wrong.
- Rows you have read but not saved are kept on the server, so every device that logs in sees them.

## Where the data lives
Everything (history and pending rows) is stored in Netlify Blobs, inside your Netlify site.
Deleting the Netlify site deletes the data, so press "Download Excel" now and then as a backup.

Locally, use `netlify dev` (not a plain file server) so functions and Blobs work.
