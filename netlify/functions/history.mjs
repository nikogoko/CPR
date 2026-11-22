// Reads saved prices for the restaurant tabs, or deletes one restaurant's platform-day.
import { guard, json, readBody } from "../../lib/http.mjs";
import { isValidSnapshot } from "../../lib/snapshot.mjs";
import { openStore, historyKey, readAllHistory } from "../../lib/store.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, restaurant, platform, date } = await readBody(req);
    const store = await openStore();

    if (action === "deleteDate") {
      if (typeof restaurant !== "string" || typeof platform !== "string" || !isValidSnapshot(date || ""))
        return json(400, { error: "Need a restaurant, a platform and a date." });
      const k = historyKey(restaurant);
      const rec = await store.get(k, { type: "json" });
      if (!rec) return json(404, { error: "Restaurant not found." });
      // Only that platform's prices for that day (an empty platform means older entries saved before platforms existed).
      const rows = rec.rows.filter((r) => !(r.date === date && (r.platform || "") === platform));
      if (rows.length) await store.setJSON(k, { name: rec.name, rows });
      else await store.delete(k);
      return json(200, { removed: rec.rows.length - rows.length });
    }

    const records = await readAllHistory(store);
    const rows = records.flatMap((rec) => rec.rows.map((r) => ({ ...r, platform: r.platform || "", restaurant: rec.name })));
    // A reply may not be bigger than about 6 MB. If it would be, the oldest automatic rows are left out of this view (nothing is deleted).
    const LIMIT = 4_800_000;
    let size = JSON.stringify(rows).length, hidden = 0, out = rows;
    if (size > LIMIT) {
      const order = rows.map((r, i) => i).filter((i) => rows[i].auto === true).sort((a, b) => String(rows[a].date).localeCompare(String(rows[b].date)));
      const drop = new Set();
      for (const i of order) { if (size <= LIMIT) break; size -= JSON.stringify(rows[i]).length + 1; drop.add(i); }
      out = rows.filter((_, i) => !drop.has(i)); hidden = drop.size;
    }
    return json(200, { rows: out, ...(hidden ? { hidden } : {}) });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
