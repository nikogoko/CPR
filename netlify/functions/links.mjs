// "Same item" links between restaurants, set by hand when two restaurants name the same dish differently.
// Stored as { "<their restaurant>|<their item>": { ref: "<your restaurant>", item: "<your item>" } }, all in normalised form.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";

const ok = (v) => typeof v === "string" && v.length > 0 && v.length <= 300;

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, comp, item, ref, target } = await readBody(req);
    const store = await openStore();
    const links = (await store.get("links", { type: "json" })) || {};

    if (action === "set") {
      if (!ok(comp) || !ok(item) || !ok(ref) || (target !== "" && !ok(target))) return json(400, { error: "Need the restaurant, the item and what it matches." });
      const k = `${comp}|${item}`;
      if (target === "") delete links[k];
      else {
        if (Object.keys(links).length >= 3000 && !(k in links)) return json(400, { error: "Too many links saved." });
        links[k] = { ref, item: target };
      }
      await store.setJSON("links", links);
    }
    return json(200, { links });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
