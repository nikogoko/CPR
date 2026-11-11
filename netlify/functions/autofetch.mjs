// Automatic fetching. Netlify wakes this up every hour; it checks the schedule from Settings and, when a run is due,
// fetches the saved Wolt / Glovo pages a few at a time (a function may only run about 30 seconds, so a run can take several hours)
// and saves the prices straight into the history. Every run is saved under its own "slot": the day and the scheduled hour
// (e.g. "2026-11-10 13:00"), so a second run on the same day never overwrites the first, even if a run goes past midnight.
import { openStore } from "../../lib/store.mjs";
import { loadSettings } from "../../lib/settings-rules.mjs";
import { fetchMenu } from "../../lib/menu-fetch.mjs";
import { saveRows } from "../../lib/save-rows.mjs";
import { summarise } from "../../lib/auto-state.mjs";

export const config = { schedule: "0 * * * *" };   // every hour, on the hour (UTC)

const PAGES_PER_WAKE = 4, PAUSE_MS = 3000, CATCH_UP_HOURS = 3, GIVE_UP_AFTER_MS = 12 * 3600 * 1000, TZ = "Asia/Tbilisi";
const wait = (ms) => (globalThis.__priceTrackerNoPause ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

function tbilisiNow() {
  const d = globalThis.__priceTrackerNow ? new Date(globalThis.__priceTrackerNow) : new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], iso: d.toISOString(), ms: d.getTime() };
}
const slotName = (date, hour) => `${date} ${String(hour).padStart(2, "0")}:00`;

export default async () => {
  const store = await openStore();
  const out = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const now = tbilisiNow();
  const { schedule } = await loadSettings(store);
  const sources = (await store.get("sources", { type: "json" })) || {};
  let st = await store.get("autofetch", { type: "json" });
  const recent = (st?.recentSlots || []).slice(-6);

  if (st?.queue?.length) {                                                    // a run is under way
    if (now.ms - Date.parse(st.startedAt) > GIVE_UP_AFTER_MS) { st = { ...st, queue: [], stopped: "The run took too long and was given up.", finishedAt: now.iso }; await store.setJSON("autofetch", st); return out({ status: "stopped" }); }
    if (!schedule.enabled) { st = { ...st, queue: [], stopped: "Automatic fetching was turned off.", finishedAt: now.iso }; await store.setJSON("autofetch", st); return out({ status: "stopped" }); }
    if (st.lastStepAt && now.ms - st.lastStepAt < 20000) return out({ status: "too soon" });
  } else {                                                                     // maybe start a new run
    const slot = schedule.enabled && schedule.days.includes(now.weekday)
      ? schedule.hours.find((h) => now.hour >= h && now.hour < h + CATCH_UP_HOURS && !recent.includes(slotName(now.date, h)))
      : undefined;
    if (slot === undefined) return out({ status: "nothing due" });
    const queue = Object.entries(sources).flatMap(([name, a]) => ["Wolt", "Glovo"].filter((app) => a[app]).map((app) => ({ name, app, url: a[app] })));
    if (!queue.length) return out({ status: "no addresses" });
    const name = slotName(now.date, slot);
    st = { slot: name, date: name, recentSlots: [...recent, name], queue, total: queue.length, pagesOk: 0, items: 0, errors: [], startedAt: now.iso, finishedAt: null };
  }

  st.lastStepAt = now.ms;
  const batch = st.queue.splice(0, PAGES_PER_WAKE);
  for (let i = 0; i < batch.length; i++) {
    const job = batch[i];
    try {
      const { rows } = await fetchMenu(job.url);
      const dated = rows.map((r) => ({ ...r, restaurant: job.name, platform: job.app, date: st.slot }));
      for (let k = 0; k < dated.length; k += 500) await saveRows(store, dated.slice(k, k + 500), { clearPending: false });   // never touches rows waiting for your Save
      st.pagesOk++; st.items += rows.length;
    } catch (e) { if (st.errors.length < 20) st.errors.push(`${job.name} on ${job.app}: ${e.message}`); }
    await store.setJSON("autofetch", st);                                      // remember progress after every page
    if (i < batch.length - 1) await wait(PAUSE_MS);
  }
  if (!st.queue.length) st.finishedAt = new Date().toISOString();
  await store.setJSON("autofetch", st);
  return out({ status: st.queue.length ? "more to do" : "finished", ...summarise(st) });
};
