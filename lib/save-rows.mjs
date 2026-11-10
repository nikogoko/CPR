// Checks rows and merges them into the price history (Netlify Blobs). Used by the Save button and by the automatic fetch.
import { historyKey } from "./store.mjs";
import platforms from "./platforms.js";

const { PLATFORMS } = platforms;

export class BadRows extends Error {}

function num(v) {
  let s = String(v ?? "").replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return parseFloat(s);
}
const clean = (v) => String(v ?? "").trim().slice(0, 200);
// Same restaurant + platform + date + size + pizza is the same entry.
const rowKey = (r) => `${r.date}|${(r.platform || "").toLowerCase()}|${r.size.toLowerCase()}|${r.item.toLowerCase()}`;

// Returns { saved, replaced }. Throws BadRows with a message a person can read.
export async function saveRows(store, rows, { clearPending = true } = {}) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) throw new BadRows("Send between 1 and 500 rows.");
  const bad = (m) => { throw new BadRows(m); };
  const byRestaurant = new Map();
  for (const r of rows) {
    const restaurant = clean(r.restaurant), platform = clean(r.platform), item = clean(r.item), size = clean(r.size), notes = clean(r.notes), date = clean(r.date);
    const sale = num(r.sale_price);
    const regularText = String(r.regular_price ?? "").trim();
    const regular = regularText === "" ? "" : num(regularText);
    if (!restaurant || !item || !size) bad(`Row "${item || "?"}" is missing a restaurant, item name or headline.`);
    if (!PLATFORMS.includes(platform)) bad(`Row "${item}" needs a platform (${PLATFORMS.join(" or ")}).`);
    if (!Number.isFinite(sale)) bad(`Row "${item}" has no valid sale price.`);
    if (regular !== "" && !Number.isFinite(regular)) bad(`Row "${item}" has an invalid regular price.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bad(`Row "${item}" has an invalid date.`);
    const k = historyKey(restaurant);
    if (!byRestaurant.has(k)) byRestaurant.set(k, []);
    byRestaurant.get(k).push({ restaurant, platform, item, size, sale_price: sale, regular_price: regular, notes, popular: r.popular === true, isNew: r.isNew === true, age18: r.age18 === true, date });
  }

  let replaced = 0;
  for (const [k, incoming] of byRestaurant) {
    const existing = (await store.get(k, { type: "json" })) || { name: incoming[0].restaurant, rows: [] };
    const merged = new Map(existing.rows.map((r) => [rowKey(r), r]));
    for (const r of incoming) {
      const rk = rowKey(r);
      if (merged.has(rk)) replaced++;
      merged.set(rk, { ...r, restaurant: existing.name });   // keep the first spelling of the restaurant name
    }
    await store.setJSON(k, { name: existing.name, rows: [...merged.values()] });
  }
  if (clearPending) await store.setJSON("pending", []);   // saved by hand, so empty the shared pending list
  return { saved: rows.length, replaced };
}
