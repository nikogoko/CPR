// Keeps the history from growing without end: rows made by the automatic fetch (marked auto:true when saved) are removed after 30 days.
// Rows saved by hand are never removed, whatever their date or hour. Rows saved before the mark existed are never removed either.

export const KEEP_AUTOMATIC_DAYS = 30;

export async function pruneAutomatic(store, today, days = KEEP_AUTOMATIC_DAYS) {
  const [y, m, d] = String(today).split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);   // entries from days before this are removed
  const { blobs } = await store.list({ prefix: "history/" });
  let removed = 0;
  for (const b of blobs) {
    const rec = await store.get(b.key, { type: "json" });
    if (!rec || !Array.isArray(rec.rows)) continue;
    const rows = rec.rows.filter((r) => !(r.auto === true && String(r.date).slice(0, 10) < cutoff));
    if (rows.length !== rec.rows.length) { removed += rec.rows.length - rows.length; await store.setJSON(b.key, { ...rec, rows }); }
  }
  return removed;
}
