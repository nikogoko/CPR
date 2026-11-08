// The rules you can change from the Settings page, their defaults and their checks.
export const DEFAULTS = {
  limit: 50,
  sameSizes: ["30", "35"],                       // sizes written in a headline that count as the normal size
  normalSize: "33",
  normalWords: ["pizza", "pizzas", "piza", "pitsa", "პიცა", "normal", "regular", "standard"],   // no number, these words = normal size
  smallSize: "20",
  smallWords: ["small", "mini", "little", "პატარა"],
  percentBase: "theirs"                          // "theirs" or "higher"
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
  return { settings: { limit, sameSizes, normalSize: String(s.normalSize).trim(), normalWords, smallSize: String(s.smallSize).trim(), smallWords, percentBase: s.percentBase } };
}

export async function loadSettings(store) {
  const saved = await store.get("settings", { type: "json" });
  const v = validate(saved || {});
  return v.settings || { ...DEFAULTS };   // a damaged record falls back to the defaults
}
