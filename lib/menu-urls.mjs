// Only Wolt and Glovo restaurant pages may be fetched. This keeps the "fetch" function from being used on any other website.
const HOSTS = { Wolt: ["wolt.com", "www.wolt.com"], Glovo: ["glovoapp.com", "www.glovoapp.com"] };

// Returns { app, url } (cleaned: https, no query or #) or { error }.
export function checkMenuUrl(input) {
  let u;
  try { u = new URL(String(input || "").trim()); } catch { return { error: "That is not a web address." }; }
  if (String(input).length > 300) return { error: "That address is too long." };
  if (u.protocol !== "https:" || u.username || u.password || u.port) return { error: "Use a normal https:// address." };
  const host = u.hostname.toLowerCase();
  const app = Object.keys(HOSTS).find((a) => HOSTS[a].includes(host));
  if (!app) return { error: "Only wolt.com and glovoapp.com restaurant pages can be used." };
  if (app === "Wolt" && !/^\/[a-z]{2,3}\/[a-z]{3}\/[^/]+\/(restaurant|venue)\/[^/]+/i.test(u.pathname))
    return { error: "That does not look like a Wolt restaurant page (it should look like wolt.com/en/geo/tbilisi/restaurant/name)." };
  if (app === "Glovo" && !/\/stores\/[^/]+/i.test(u.pathname))
    return { error: "That does not look like a Glovo restaurant page (it should look like glovoapp.com/en/ge/tbilisi/stores/name)." };
  const parts = u.pathname.split("/");
  if (app === "Wolt") parts.length = Math.min(parts.length, 6);          // /en/geo/tbilisi/restaurant/<name>: drop anything after the name
  return { app, url: `https://${host}${parts.join("/").replace(/\/+$/, "")}` };
}
