// Turn a Wolt or Glovo restaurant page into rows shaped like the screenshot reader's rows:
// { item, size (the section name, i.e. the headline), sale_price, regular_price, notes, popular, isNew, age18 }.
// Both sites put the whole menu inside the page as data, so no AI is needed. These readers depend on how those pages are built today;
// if a site changes its pages, they return an error instead of wrong prices.

const money = (n) => (Math.round(n * 100) / 100).toFixed(2);
const dec = (s, at) => { const text = s.slice(at); return JSON.parse(text.slice(0, endOfJson(text))); };

// Length of the JSON value that starts at the beginning of text (handles strings with brackets in them).
function endOfJson(text) {
  const open = text[0], close = open === "[" ? "]" : "}";
  let depth = 0, inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i + 1;
  }
  throw new Error("unfinished data");
}

export function parseWolt(html) {
  const i = html.indexOf('"items":[{"');
  const j = html.indexOf('"categories":[{"id"');
  if (i < 0 || j < 0) throw new Error("This Wolt page has no menu in it (the page layout may have changed).");
  const items = dec(html, i + 8), cats = dec(html, j + 13);
  const byId = new Map(items.map((x) => [x.id, x]));
  const rows = [];
  for (const cat of cats) {
    const seen = new Set();
    for (const id of cat.item_ids || []) {
      const x = byId.get(id);
      if (!x || seen.has(id) || typeof x.price !== "number") continue;
      seen.add(id);
      const sale = x.price / 100, regular = typeof x.original_price === "number" && x.original_price > x.price ? x.original_price / 100 : null;
      const tagIds = (x.tags || []).map((t) => String(t.id || "").toLowerCase());
      const hier = (x.product_hierarchy_tags || []).map((t) => String(t).toUpperCase());
      rows.push({
        item: String(x.name || "").trim(), size: String(cat.name || "").trim() || "Menu",
        sale_price: money(sale), regular_price: regular == null ? "" : money(regular), notes: "",
        popular: tagIds.includes("popular"), isNew: tagIds.includes("new"),
        age18: (x.alcohol_permille || 0) > 0 || hier.includes("ALCOHOL") || hier.includes("BEER")
      });
    }
  }
  if (!rows.length) throw new Error("No prices were found on this Wolt page.");
  return rows;
}

export function parseGlovo(html) {
  // The menu sits in the page's streamed data: blocks like {"type":"LIST","data":{"title":"...","elements":[{"type":"PRODUCT_ROW",...}]}}
  let flight = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)<\/script>/g)) {
    try { flight += JSON.parse(m[1]); } catch { /* skip a damaged chunk */ }
  }
  const lists = [];
  for (const m of flight.matchAll(/\{"type":"LIST","data":\{"title":/g)) {
    try { lists.push(dec(flight, m.index).data); } catch { /* skip */ }
  }
  if (!lists.length) throw new Error("This Glovo page has no menu in it (the page layout may have changed).");
  const real = lists.filter((l) => /-s\.\d+$/.test(l.slug || ""));
  const sections = real.length ? real : lists.filter((l) => !/^(promotions-pr|top-sellers-ts)$/.test(l.slug || ""));
  const top = lists.find((l) => l.slug === "top-sellers-ts");
  const topIds = new Set((top?.elements || []).map((e) => e.data?.id));
  const rows = [];
  for (const sec of sections) {
    for (const e of sec.elements || []) {
      const p = e.type === "PRODUCT_ROW" ? e.data : null;
      if (!p || typeof p.price !== "number") continue;
      const promo = (p.promotions || []).find((x) => typeof x.price === "number" && x.price < p.price);
      rows.push({
        item: String(p.name || "").trim(), size: String(sec.title || "").trim() || "Menu",
        sale_price: money(promo ? promo.price : p.price), regular_price: promo ? money(p.price) : "",
        notes: promo ? String(promo.title || "").trim() : "",
        popular: topIds.has(p.id), isNew: false, age18: false
      });
    }
  }
  if (!rows.length) throw new Error("No prices were found on this Glovo page.");
  return rows;
}

export const parseMenu = (app, html) => (app === "Wolt" ? parseWolt(html) : parseGlovo(html));
