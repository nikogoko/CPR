// Saves confirmed rows into the price history (Netlify Blobs) and empties the pending list.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore, historyKey } from "../../lib/store.mjs";
import platforms from "../../lib/platforms.js";

const { PLATFORMS } = platforms;

function num(v) {
  let s = String(v ?? "").replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return parseFloat(s);
}
const clean = (v) => String(v ?? "").trim().slice(0, 200);
const bad = (msg) => json(400, { error: msg });
// Same restaurant + platform + date + size + pizza is the same entry.
const rowKey = (r) => `${r.date}|${(r.platform || "").toLowerCase()}|${r.size.toLowerCase()}|${r.item.toLowerCase()}`;

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;

  try {
    const { rows } = await readBody(req);
    if (!Array.isArray(rows) || !rows.length || rows.length > 500) return bad("Send between 1 and 500 rows.");

    const byRestaurant = new Map();
    for (const r of rows) {
      const restaurant = clean(r.restaurant), platform = clean(r.platform), item = clean(r.item), size = clean(r.size), notes = clean(r.notes), date = clean(r.date);
      const sale = num(r.sale_price);
      const regularText = String(r.regular_price ?? "").trim();
      const regular = regularText === "" ? "" : num(regularText);
      if (!restaurant || !item || !size) return bad(`Row "${item || "?"}" is missing a restaurant, item name or headline.`);
      if (!PLATFORMS.includes(platform)) return bad(`Row "${item}" needs a platform (${PLATFORMS.join(" or ")}).`);
      if (!Number.isFinite(sale)) return bad(`Row "${item}" has no valid sale price.`);
      if (regular !== "" && !Number.isFinite(regular)) return bad(`Row "${item}" has an invalid regular price.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(`Row "${item}" has an invalid date.`);
      const k = historyKey(restaurant);
      if (!byRestaurant.has(k)) byRestaurant.set(k, []);
      byRestaurant.get(k).push({ restaurant, platform, item, size, sale_price: sale, regular_price: regular, notes, popular: r.popular === true, isNew: r.isNew === true, date });
    }

    const store = await openStore();
    let replaced = 0;
    for (const [k, incoming] of byRestaurant) {
      const existing = (await store.get(k, { type: "json" })) || { name: incoming[0].restaurant, rows: [] };
      // Same restaurant + platform + date + size + pizza sent again replaces the earlier entry instead of duplicating it.
      const merged = new Map(existing.rows.map((r) => [rowKey(r), r]));
      for (const r of incoming) {
        const rk = rowKey(r);
        if (merged.has(rk)) replaced++;
        merged.set(rk, { ...r, restaurant: existing.name }); // keep the first spelling of the restaurant name
      }
      await store.setJSON(k, { name: existing.name, rows: [...merged.values()] });
    }

    await store.setJSON("pending", []); // saved, so empty the shared pending list
    return json(200, { saved: rows.length, replaced });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
