// Reads saved prices for the restaurant tabs, or deletes one restaurant's day.
const { checkPassword } = require("../../lib/auth");
const { openStore, historyKey, readAllHistory } = require("../../lib/store");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!checkPassword(event)) return { statusCode: 401, body: JSON.stringify({ error: "Wrong password" }) };

  try {
    const { action, restaurant, date } = JSON.parse(event.body || "{}");
    const store = openStore(event);

    if (action === "deleteDate") {
      if (typeof restaurant !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
        return { statusCode: 400, body: JSON.stringify({ error: "Need a restaurant and a date." }) };
      const k = historyKey(restaurant);
      const rec = await store.get(k, { type: "json" });
      if (!rec) return { statusCode: 404, body: JSON.stringify({ error: "Restaurant not found." }) };
      const rows = rec.rows.filter((r) => r.date !== date);
      if (rows.length) await store.setJSON(k, { name: rec.name, rows });
      else await store.delete(k);
      return { statusCode: 200, body: JSON.stringify({ removed: rec.rows.length - rows.length }) };
    }

    const records = await readAllHistory(store);
    const rows = records.flatMap((rec) => rec.rows.map((r) => ({ ...r, restaurant: rec.name })));
    return { statusCode: 200, body: JSON.stringify({ rows }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
