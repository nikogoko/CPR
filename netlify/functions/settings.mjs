// Rules you can change from the page: the reading warning limit, what counts as a 33 or a small pizza, the percent choice.
// Stored once on the server so every device uses the same rules.
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";
import { DEFAULTS, validate, loadSettings, WORD_GROUPS_VERSION, withNewBuiltInGroups } from "../../lib/settings-rules.mjs";

export default async (req) => {
  const blocked = guard(req);
  if (blocked) return blocked;
  try {
    const { action, settings } = await readBody(req);
    const store = await openStore();
    if (action === "save") {
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) return json(400, { error: "Nothing to save: the settings did not arrive. Reload the page and try again." });
      if ((settings.wordGroupsVersion || 0) < WORD_GROUPS_VERSION && Array.isArray(settings.wordGroups)) settings.wordGroups = withNewBuiltInGroups(settings.wordGroups);   // an older open page still holds the shorter list
      const v = validate({ ...(await loadSettings(store)), ...settings });   // anything an older page does not send keeps its saved value
      if (v.error) return json(400, { error: v.error });
      await store.setJSON("settings", v.settings);
    } else if (action === "reset") {
      await store.setJSON("settings", { ...DEFAULTS });
    }
    return json(200, { settings: await loadSettings(store), defaults: DEFAULTS });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
