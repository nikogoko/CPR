// A saved "day" is a date, optionally with the time of the automatic fetch that made it: "2026-11-10" or "2026-11-10 13:00".
// Written this way so old entries (plain dates) keep working.
export const SNAPSHOT_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;
export const snapshotHasTime = (s) => String(s).length > 10;
export const snapshotToDate = (s) => new Date(snapshotHasTime(s) ? String(s).replace(" ", "T") + ":00Z" : s + "T00:00:00Z");

// True only for a date that exists ("2026-02-31", "2026-13-45" and "25:99" are not).
export function isValidSnapshot(s) {
  if (!SNAPSHOT_RE.test(String(s))) return false;
  const [d, t] = String(s).split(" ");
  const [y, m, day] = d.split("-").map(Number), check = new Date(Date.UTC(y, m - 1, day));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== day) return false;
  if (t) { const [hh, mm] = t.split(":").map(Number); if (hh > 23 || mm > 59) return false; }
  return true;
}

// Sorting: a plain date (typed by hand, no time) counts as the END of its day, after any automatic entry of the same day.
export const snapshotKey = (s) => (snapshotHasTime(s) ? String(s) : s + " 24:00");
export const compareSnapshots = (a, b) => snapshotKey(a).localeCompare(snapshotKey(b));
