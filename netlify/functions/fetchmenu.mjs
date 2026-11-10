// Fetches ONE Wolt or Glovo restaurant page and returns its menu rows. The page paces its calls (one page per call).
import { guard, json, readBody } from "../../lib/http.mjs";
import { fetchMenu, MenuError } from "../../lib/menu-fetch.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { url } = await readBody(req);
    return json(200, await fetchMenu(url));
  } catch (e) {
    return json(e instanceof MenuError ? e.status : 500, { error: e.message });
  }
};
