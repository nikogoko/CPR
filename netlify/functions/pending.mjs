// Stores the not-yet-saved rows so every device that logs in sees the same list.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const store = await openStore();
    const { action, rows } = await readBody(req);

    if (action === "save") {
      if (!Array.isArray(rows) || rows.length > 1000) return json(400, { error: "rows must be a list of up to 1000" });
      await store.setJSON("pending", rows);
      return json(200, { ok: true });
    }
    return json(200, { rows: (await store.get("pending", { type: "json" })) || [] });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
