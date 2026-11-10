// Remembers each restaurant's Wolt and Glovo page address, so the page can fetch prices without pasting links.
// Stored as { "<restaurant name>": { Wolt: "https://…", Glovo: "https://…" } }.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";
import { checkMenuUrl } from "../../lib/menu-urls.mjs";
import { summarise } from "../../lib/auto-state.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, sources } = await readBody(req);
    const store = await openStore();
    if (action === "save") {
      if (!sources || typeof sources !== "object" || Array.isArray(sources)) return json(400, { error: "Nothing to save." });
      const names = Object.keys(sources);
      if (names.length > 100) return json(400, { error: "Too many restaurants (100 at most)." });
      const clean = {};
      for (const raw of names) {
        const name = String(raw).trim();
        if (!name || name.length > 120) return json(400, { error: "Every restaurant needs a name (up to 120 letters)." });
        if (clean[name]) return json(400, { error: `"${name}" is listed twice.` });
        clean[name] = {};
        for (const app of ["Wolt", "Glovo"]) {
          const v = String(sources[raw]?.[app] || "").trim();
          if (!v) continue;
          const ok = checkMenuUrl(v);
          if (ok.error) return json(400, { error: `${name} / ${app}: ${ok.error}` });
          if (ok.app !== app) return json(400, { error: `${name}: the ${app} box has a ${ok.app} address.` });
          clean[name][app] = ok.url;
        }
      }
      await store.setJSON("sources", clean);
    }
    return json(200, { sources: (await store.get("sources", { type: "json" })) || {}, auto: summarise(await store.get("autofetch", { type: "json" })) || null });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
