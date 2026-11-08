// Counts how many screenshots were read each day, so the page can warn when it is a lot.
// Stored as { days: { "2026-11-08": 12 }, limit: 50 }. It only counts; it never blocks reading.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";

const DEFAULT_LIMIT = 50;
const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, day, limit } = await readBody(req);
    const store = await openStore();
    const u = (await store.get("usage", { type: "json" })) || {};
    u.days = u.days || {};
    if (!Number.isFinite(u.limit)) u.limit = DEFAULT_LIMIT;

    if (action === "add") {
      if (!isDay(day)) return json(400, { error: "Need a day like 2026-11-08." });
      u.days[day] = (u.days[day] || 0) + 1;
      for (const d of Object.keys(u.days).sort().slice(0, -62)) delete u.days[d];   // keep about two months
      await store.setJSON("usage", u);
    } else if (action === "setLimit") {
      const n = Math.round(Number(limit));
      if (!(n >= 1 && n <= 100000)) return json(400, { error: "The limit must be a number from 1 to 100000." });
      u.limit = n;
      await store.setJSON("usage", u);
    }
    const month = isDay(day) ? day.slice(0, 7) : "";
    const monthTotal = Object.entries(u.days).filter(([d]) => d.startsWith(month)).reduce((s, [, n]) => s + n, 0);
    return json(200, { today: isDay(day) ? u.days[day] || 0 : 0, month: month ? monthTotal : 0, limit: u.limit });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
