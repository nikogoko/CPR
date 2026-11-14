// The rules you can change from the Settings page, their defaults and their checks.
import platforms from "./platforms.js";
// Words that mean the same thing in different languages, so Compare can match "Salads" with სალათი with салаты.
// One group per line; the first word names the group. Georgian words are written in their basic form: plural and case endings are handled by the page.
export const DEFAULT_WORD_GROUPS = [
  ["drink", "drinks", "beverage", "beverages", "სასმელი", "напиток", "напитки"],
  ["alcohol", "alcoholic", "ალკოჰოლური", "ალკოჰოლი", "алкоголь", "алкогольные"],
  ["soft", "უალკოჰოლო", "безалкогольные"],
  ["hot", "ცხელი", "горячие"],
  ["cold", "ცივი", "холодные"],
  ["salad", "salads", "სალათი", "салат", "салаты"],
  ["dessert", "desserts", "sweet", "sweets", "დესერტი", "ტკბილეული", "десерт", "десерты"],
  ["soup", "soups", "წვნიანი", "სუპი", "суп", "супы"],
  ["pasta", "პასტა", "паста"],
  ["burger", "burgers", "ბურგერი", "бургер", "бургеры"],
  ["sandwich", "sandwiches", "სენდვიჩი", "сэндвич", "сэндвичи"],
  ["sauce", "sauces", "სოუსი", "соус", "соусы"],
  ["side", "sides", "garnish", "გარნირი", "гарнир", "гарниры"],
  ["starter", "starters", "appetizer", "appetizers", "snack", "snacks", "სნექი", "закуска", "закуски"],
  ["breakfast", "საუზმე", "завтрак", "завтраки"],
  ["combo", "combos", "set", "sets", "კომბო", "комбо", "сет", "сеты"],
  ["kids", "kid", "children", "საბავშვო", "ბავშვთა", "детское", "детские"],
  ["vegan", "ვეგანური", "веган"],
  ["vegetarian", "ვეგეტარიანული", "вегетарианская"],
  ["wine", "wines", "ღვინო", "вино"],
  ["beer", "beers", "ლუდი", "пиво"],
  ["water", "წყალი", "вода"],
  ["juice", "juices", "წვენი", "сок", "соки"],
  ["coffee", "ყავა", "кофе"],
  ["tea", "ჩაი", "чай"],
  ["lemonade", "ლიმონათი", "лимонад"],
  ["cheesecake", "ჩიზქეიქი", "чизкейк"],
  ["fries", "ფრი", "фри"],
  ["chicken", "ქათამი", "курица", "цыпленок"],
  ["beef", "საქონლის", "говядина"],
  ["pork", "ღორი", "свинина"],
  ["fish", "თევზი", "рыба"],
  ["shrimp", "shrimps", "კრევეტი", "креветки"],
  ["cheese", "formaggi", "formaggio", "ყველი", "сыр"],
  ["mushroom", "mushrooms", "funghi", "სოკო", "грибы"],
  ["prosciutto", "პროშუტო", "прошутто"],
  ["four", "quattro", "4", "ოთხი", "четыре"],
  ["three", "tre", "3", "სამი", "три"]
];

export const DEFAULTS = {
  limit: 50,
  sameSizes: ["30", "35"],                       // sizes written in a headline that count as the normal size
  normalSize: "33",
  normalWords: ["pizza", "pizzas", "piza", "pitsa", "პიცა", "normal", "regular", "standard"],   // no number, these words = normal size
  smallSize: "20",
  smallWords: ["small", "mini", "little", "პატარა"],
  percentBase: "theirs",                         // "theirs", "higher" or "mine" (your own restaurant's price, e.g. Gennaro's)
  wordGroups: DEFAULT_WORD_GROUPS,                // see above
  defaultApp: "auto",                            // which app a restaurant opens on: "auto" (the one with the newest prices), "Glovo" or "Wolt"
  schedule: { enabled: false, hours: [6], days: [1, 2, 3, 4, 5, 6, 7] }   // automatic fetching: one or two Tbilisi hours (0-23, at least 3 apart) and weekdays (1 = Monday ... 7 = Sunday)
};

const num = (v) => typeof v === "string" && /^\d{1,3}(\.\d{1,2})?$/.test(v.trim());
const clean = (list, max) => [...new Set((Array.isArray(list) ? list : []).map((w) => String(w).normalize("NFKC").trim().toLowerCase()).filter(Boolean))].slice(0, max);

// Word groups: a list of lists of single words. A word may be in only one group. Returns { groups } or { error }.
function cleanGroups(input) {
  if (!Array.isArray(input) || input.length > 300) return { error: "The word groups must be a list of up to 300 groups." };
  const seen = new Map(), groups = [];
  for (const g of input) {
    const words = clean(Array.isArray(g) ? g : [], 30);
    if (!words.length) continue;                                           // an empty line is just ignored
    if (words.length < 2) return { error: `The group "${words[0]}" needs at least one more word that means the same.` };
    if (words.some((w) => w.length > 30 || /[\s,]/.test(w))) return { error: `Each word in a group must be a single word (no spaces). Check the line starting with "${words[0]}".` };
    for (const w of words) if (seen.has(w) && seen.get(w) !== words[0]) return { error: `"${w}" is in two groups ("${seen.get(w)}" and "${words[0]}"). A word can only be in one group.` };
    words.forEach((w) => seen.set(w, words[0]));
    groups.push(words);
  }
  return { groups };
}

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
  if (!["theirs", "higher", "mine"].includes(s.percentBase)) return { error: "Percent must be worked out from their price, the higher price, or your restaurant's price." };
  if (s.defaultApp !== "auto" && !platforms.PLATFORMS.includes(s.defaultApp)) return { error: "The default app must be automatic or one of: " + platforms.PLATFORMS.join(", ") + "." };
  const wg = cleanGroups(s.wordGroups);
  if (wg.error) return { error: wg.error };
  const sc = s.schedule && typeof s.schedule === "object" ? s.schedule : DEFAULTS.schedule;
  const rawHours = Array.isArray(sc.hours) ? sc.hours : sc.hour !== undefined ? [sc.hour] : DEFAULTS.schedule.hours;   // "hour" is the older single-hour form
  const toHour = (h) => (typeof h === "number" ? h : typeof h === "string" && /^\s*\d{1,2}\s*$/.test(h) ? Number(h) : NaN);   // "", null, false and 5.5 are not hours
  const hours = [...new Set(rawHours.map(toHour))].sort((a, b) => a - b), days = [...new Set((Array.isArray(sc.days) ? sc.days : []).map(Number))].sort();
  if (!hours.length || hours.length > 2 || hours.some((h) => !(Number.isInteger(h) && h >= 0 && h <= 23))) return { error: "Choose one or two fetch hours, each from 0 to 23 (two runs a day at most)." };
  if (hours.length === 2 && hours[1] - hours[0] < 3) return { error: "The two fetch hours must be at least 3 hours apart, because a run takes a few hours." };
  if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return { error: "Choose days from Monday to Sunday." };
  if (!days.length && sc.enabled === true) return { error: "Choose at least one day for the automatic fetch." };
  if (!days.length) days.push(...DEFAULTS.schedule.days);   // switched off: nothing to choose, keep every day ready for later
  return { settings: { limit, sameSizes, normalSize: String(s.normalSize).trim(), normalWords, smallSize: String(s.smallSize).trim(), smallWords, percentBase: s.percentBase, wordGroups: wg.groups, defaultApp: s.defaultApp, schedule: { enabled: sc.enabled === true, hours, days } } };
}

export async function loadSettings(store) {
  const saved = await store.get("settings", { type: "json" });
  const v = validate(saved || {});
  return v.settings || { ...DEFAULTS };   // a damaged record falls back to the defaults
}
