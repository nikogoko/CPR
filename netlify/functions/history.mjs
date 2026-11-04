// Reads saved prices for the restaurant tabs, or deletes one restaurant's platform-day.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore, historyKey, readAllHistory } from "../../lib/store.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, restaurant, platform, date } = await readBody(req);
    const store = await openStore();

    if (action === "deleteDate") {
      if (typeof restaurant !== "string" || typeof platform !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
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
    return json(200, { rows });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
