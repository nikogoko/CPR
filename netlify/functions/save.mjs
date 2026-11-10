// Saves confirmed rows into the price history (Netlify Blobs) and empties the pending list.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";
import { saveRows, BadRows } from "../../lib/save-rows.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { rows } = await readBody(req);
    return json(200, await saveRows(await openStore(), rows));
  } catch (e) {
    return json(e instanceof BadRows ? 400 : 500, { error: e.message });
  }
};
