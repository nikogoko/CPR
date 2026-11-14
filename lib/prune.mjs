// Keeps the history from growing without end: entries made by the automatic fetch (their date has a time, "2026-11-10 06:00")
// are removed after 30 days. Entries saved by hand (a plain date) are never removed.
import { snapshotHasTime } from "./snapshot.mjs";

export const KEEP_AUTOMATIC_DAYS = 30;

export async function pruneAutomatic(store, today, days = KEEP_AUTOMATIC_DAYS) {
  const [y, m, d] = String(today).split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);   // entries from days before this are removed
  const { blobs } = await store.list({ prefix: "history/" });
  let removed = 0;
  for (const b of blobs) {
    const rec = await store.get(b.key, { type: "json" });
    if (!rec || !Array.isArray(rec.rows)) continue;
    const rows = rec.rows.filter((r) => !(snapshotHasTime(r.date) && String(r.date).slice(0, 10) < cutoff));
    if (rows.length !== rec.rows.length) { removed += rec.rows.length - rows.length; await store.setJSON(b.key, { ...rec, rows }); }
  }
  return removed;
}
