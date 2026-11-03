// Saves confirmed rows into the price history (Netlify Blobs) and empties the pending list.
const { denied } = require("../../lib/auth");
const { openStore, historyKey } = require("../../lib/store");

function num(v) {
  let s = String(v ?? "").replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return parseFloat(s);
}
const clean = (v) => String(v ?? "").trim().slice(0, 200);
const bad = (msg) => ({ statusCode: 400, body: JSON.stringify({ error: msg }) });
const rowKey = (r) => `${r.date}|${r.size.toLowerCase()}|${r.item.toLowerCase()}`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const deny = denied(event);
  if (deny) return deny;

  try {
    const { rows } = JSON.parse(event.body || "{}");
    if (!Array.isArray(rows) || !rows.length || rows.length > 500) return bad("Send between 1 and 500 rows.");

    const byRestaurant = new Map();
    for (const r of rows) {
      const restaurant = clean(r.restaurant), item = clean(r.item), size = clean(r.size), notes = clean(r.notes), date = clean(r.date);
      const sale = num(r.sale_price);
      const regularText = String(r.regular_price ?? "").trim();
      const regular = regularText === "" ? "" : num(regularText);
      if (!restaurant || !item || !size) return bad(`Row "${item || "?"}" is missing a restaurant, pizza name or size.`);
      if (!Number.isFinite(sale)) return bad(`Row "${item}" has no valid sale price.`);
      if (regular !== "" && !Number.isFinite(regular)) return bad(`Row "${item}" has an invalid regular price.`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(`Row "${item}" has an invalid date.`);
      const k = historyKey(restaurant);
      if (!byRestaurant.has(k)) byRestaurant.set(k, []);
      byRestaurant.get(k).push({ restaurant, item, size, sale_price: sale, regular_price: regular, notes, date });
    }

    const store = openStore(event);
    let replaced = 0;
    for (const [k, incoming] of byRestaurant) {
      const existing = (await store.get(k, { type: "json" })) || { name: incoming[0].restaurant, rows: [] };
      // Same restaurant + date + size + pizza sent again replaces the earlier entry instead of duplicating it.
      const merged = new Map(existing.rows.map((r) => [rowKey(r), r]));
      for (const r of incoming) {
        const rk = rowKey(r);
        if (merged.has(rk)) replaced++;
        merged.set(rk, { ...r, restaurant: existing.name }); // keep the first spelling of the restaurant name
      }
      await store.setJSON(k, { name: existing.name, rows: [...merged.values()] });
    }

    await store.setJSON("pending", []); // saved, so empty the shared pending list
    return { statusCode: 200, body: JSON.stringify({ saved: rows.length, replaced }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
