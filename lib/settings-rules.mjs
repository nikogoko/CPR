// The rules you can change from the Settings page, their defaults and their checks.
import platforms from "./platforms.js";
export const DEFAULTS = {
  limit: 50,
  sameSizes: ["30", "35"],                       // sizes written in a headline that count as the normal size
  normalSize: "33",
  normalWords: ["pizza", "pizzas", "piza", "pitsa", "პიცა", "normal", "regular", "standard"],   // no number, these words = normal size
  smallSize: "20",
  smallWords: ["small", "mini", "little", "პატარა"],
  percentBase: "theirs",                         // "theirs" or "higher"
  defaultApp: "auto",                            // which app a restaurant opens on: "auto" (the one with the newest prices), "Glovo" or "Wolt"
  schedule: { enabled: false, hours: [6], days: [1, 2, 3, 4, 5, 6, 7] }   // automatic fetching: one or two Tbilisi hours (0-23, at least 3 apart) and weekdays (1 = Monday ... 7 = Sunday)
};

const num = (v) => typeof v === "string" && /^\d{1,3}(\.\d{1,2})?$/.test(v.trim());
const clean = (list, max) => [...new Set((Array.isArray(list) ? list : []).map((w) => String(w).normalize("NFKC").trim().toLowerCase()).filter(Boolean))].slice(0, max);

// Returns { settings } or { error }.
export function validate(input) {
  const s = { ...DEFAULTS, ...(input || {}) };
  const limit = Math.round(Number(s.limit));
  if (!(limit >= 1 && limit <= 100000)) return { error: "The reading limit must be a number from 1 to 100000." };
  const sameSizes = clean(s.sameSizes, 30);
  if (!sameSizes.every(num)) return { error: "Sizes must be plain numbers like 30 or 35, separated by commas." };
  if (!num(String(s.normalSize ?? "")) || !num(String(s.smallSize ?? ""))) return { error: "The normal and small sizes must be numbers like 33 and 20." };
  const normalWords = clean(s.normalWords, 60), smallWords = clean(s.smallWords, 60);
  if (normalWords.concat(smallWords).some((w) => w.length > 30 || /[\s,]/.test(w))) return { error: "Each word must be a single word (no spaces), up to 30 letters." };
  if (!["theirs", "higher"].includes(s.percentBase)) return { error: "Percent must be 'their price' or 'the higher price'." };
  if (s.defaultApp !== "auto" && !platforms.PLATFORMS.includes(s.defaultApp)) return { error: "The default app must be automatic or one of: " + platforms.PLATFORMS.join(", ") + "." };
  const sc = s.schedule && typeof s.schedule === "object" ? s.schedule : DEFAULTS.schedule;
  const rawHours = Array.isArray(sc.hours) ? sc.hours : sc.hour !== undefined ? [sc.hour] : DEFAULTS.schedule.hours;   // "hour" is the older single-hour form
  const hours = [...new Set(rawHours.map((h) => Math.round(Number(h))))].sort((a, b) => a - b), days = [...new Set((Array.isArray(sc.days) ? sc.days : []).map(Number))].sort();
  if (!hours.length || hours.length > 2 || hours.some((h) => !(h >= 0 && h <= 23))) return { error: "Choose one or two fetch hours, each from 0 to 23 (two runs a day at most)." };
  if (hours.length === 2 && hours[1] - hours[0] < 3) return { error: "The two fetch hours must be at least 3 hours apart, because a run takes a few hours." };
  if (!days.length || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { error: "Choose at least one day for the automatic fetch." };
  return { settings: { limit, sameSizes, normalSize: String(s.normalSize).trim(), normalWords, smallSize: String(s.smallSize).trim(), smallWords, percentBase: s.percentBase, defaultApp: s.defaultApp, schedule: { enabled: sc.enabled === true, hours, days } } };
}

export async function loadSettings(store) {
  const saved = await store.get("settings", { type: "json" });
  const v = validate(saved || {});
  return v.settings || { ...DEFAULTS };   // a damaged record falls back to the defaults
}
