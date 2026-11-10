// Fetches one Wolt or Glovo restaurant page and returns { app, rows }. Used by the Fetch button and the automatic fetch.
import { checkMenuUrl } from "./menu-urls.mjs";
import { parseMenu } from "./menu-parsers.mjs";

const UA = "price-tracker/1.0 (small restaurant price comparison; one page per request)";

export class MenuError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }

async function getPage(url) {
  const doFetch = globalThis.__priceTrackerTestFetch || fetch;
  let current = url;
  for (let hop = 0; hop < 3; hop++) {                         // follow redirects ourselves, only to allowed addresses
    const res = await doFetch(current, { redirect: "manual", headers: { "user-agent": UA, "accept-language": "en" }, signal: AbortSignal.timeout(8000) });
    if (res.status >= 300 && res.status < 400) {
      const next = checkMenuUrl(new URL(res.headers.get("location") || "", current).href);
      if (next.error) throw new Error("The page moved somewhere that is not allowed.");
      current = next.url; continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
}

export async function fetchMenu(url) {
  const ok = checkMenuUrl(url);
  if (ok.error) throw new MenuError(ok.error, 400);
  let res;
  try { res = await getPage(ok.url); }
  catch (e) { throw new MenuError(e.name === "TimeoutError" ? `${ok.app} did not answer in time.` : `Could not reach ${ok.app}: ${e.message}`); }
  if (res.status === 404) throw new MenuError(`${ok.app} says this page does not exist. Check the address.`);
  if (res.status === 403 || res.status === 429) throw new MenuError(`${ok.app} refused the request (${res.status}). It may be limiting automatic visits; try again later.`);
  if (!res.ok) throw new MenuError(`${ok.app} answered with error ${res.status}.`);
  const html = await res.text();
  try { return { app: ok.app, rows: parseMenu(ok.app, html) }; } catch (e) { throw new MenuError(e.message); }
}
