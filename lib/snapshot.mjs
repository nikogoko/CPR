// A saved "day" is a date, optionally with the time of the automatic fetch that made it: "2026-11-10" or "2026-11-10 13:00".
// Written this way so ordinary sorting still puts snapshots in time order, and old entries (plain dates) keep working.
export const SNAPSHOT_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/;
export const snapshotHasTime = (s) => String(s).length > 10;
export const snapshotToDate = (s) => new Date(snapshotHasTime(s) ? String(s).replace(" ", "T") + ":00Z" : s + "T00:00:00Z");
