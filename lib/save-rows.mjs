// Checks rows and merges them into the price history (Netlify Blobs). Used by the Save button and by the automatic fetch.
import { historyKey } from "./store.mjs";
import platforms from "./platforms.js";
import { isValidSnapshot } from "./snapshot.mjs";

const { PLATFORMS } = platforms;

export class BadRows extends Error {}

// "28,00" = 28, "28.00" = 28, "1,234.50" and "1.234,50" = 1234.5, "1,234" = 1234. A minus sign is not a price.
function num(v) {
  const text = String(v ?? "").trim();
  if (/^-/.test(text)) return NaN;
  let s = text.replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");   // the last mark is the decimal point
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, "");   // 1,234 is a thousand, not 1.234
  else s = s.replace(",", ".");
  return parseFloat(s);
}
const clean = (v) => String(v ?? "").trim().slice(0, 200);
// Same restaurant + platform + date + size + pizza is the same entry.
const rowKey = (r) => `${r.date}|${(r.platform || "").toLowerCase()}|${r.size.toLowerCase()}|${r.item.toLowerCase()}`;

// Returns { saved, replaced }. Throws BadRows with a message a person can read.
export async function saveRows(store, rows, { clearPending = true, auto = false } = {}) {   // auto: rows made by the automatic fetch carry auto:true, so the 30-day cleanup can tell them from rows saved by hand
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
    if (!isValidSnapshot(date)) bad(`Row "${item}" has an invalid date.`);
    const k = historyKey(restaurant);
    if (!byRestaurant.has(k)) byRestaurant.set(k, []);
    byRestaurant.get(k).push({ restaurant, platform, item, size, sale_price: sale, regular_price: regular, notes, popular: r.popular === true, isNew: r.isNew === true, age18: r.age18 === true, date, ...(auto ? { auto: true } : {}) });
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
