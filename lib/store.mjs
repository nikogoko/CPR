// Price history lives in Netlify Blobs: one record per restaurant, { name, rows: [...] }.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

let strongWorks = null;   // remembered after the first try

// Strong consistency: a read right after a save always sees that save. That keeps the page up to date
// straight after saving and stops two quick saves from overwriting each other. If this environment
// cannot do strong reads, fall back to the default instead of breaking the site.
export async function openStore() {
  if (globalThis.__priceTrackerTestStore) return globalThis.__priceTrackerTestStore;   // used by the automated tests only
  if (strongWorks === false) return getStore("price-tracker");
  const store = getStore({ name: "price-tracker", consistency: "strong" });
  if (strongWorks === null) {
    try { await store.get("pending"); strongWorks = true; }
    catch (e) {
      if (e?.name !== "BlobsConsistencyError") throw e;
      strongWorks = false;
      console.warn("Netlify Blobs strong consistency is not available here; using the default (eventual) mode.");
      return getStore("price-tracker");
    }
  }
  return store;
}

// Hashed so any restaurant name (any script, any length) makes a valid key. Case-insensitive.
export const historyKey = (restaurant) =>
  "history/" + crypto.createHash("sha1").update(String(restaurant).trim().toLowerCase()).digest("hex");

export async function readAllHistory(store) {
  const { blobs } = await store.list({ prefix: "history/" });
  const records = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return records.filter(Boolean); // [{ name, rows }]
}
