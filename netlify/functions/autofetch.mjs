// Automatic fetching. Netlify wakes this up every hour; it checks the schedule from Settings and, when a run is due,
// fetches the saved Wolt / Glovo pages a few at a time (a function may only run about 30 seconds, so a run can take several hours)
// and saves the prices straight into the history, dated with the day of the run (Tbilisi time).
import { openStore } from "../../lib/store.mjs";
import { loadSettings } from "../../lib/settings-rules.mjs";
import { fetchMenu } from "../../lib/menu-fetch.mjs";
import { saveRows } from "../../lib/save-rows.mjs";
import { summarise } from "../../lib/auto-state.mjs";

export const config = { schedule: "0 * * * *" };   // every hour, on the hour (UTC)

const PAGES_PER_WAKE = 4, PAUSE_MS = 3000, CATCH_UP_HOURS = 3, TZ = "Asia/Tbilisi";
const wait = (ms) => (globalThis.__priceTrackerNoPause ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

function tbilisiNow() {
  const d = globalThis.__priceTrackerNow ? new Date(globalThis.__priceTrackerNow) : new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], iso: d.toISOString(), ms: d.getTime() };
}

export default async () => {
  const store = await openStore();
  const out = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  const now = tbilisiNow();
  const { schedule } = await loadSettings(store);
  const sources = (await store.get("sources", { type: "json" })) || {};
  let st = await store.get("autofetch", { type: "json" });

  if (st && st.date === now.date && st.queue?.length) {                       // a run is under way today
    if (!schedule.enabled) { st = { ...st, queue: [], stopped: "Automatic fetching was turned off.", finishedAt: now.iso }; await store.setJSON("autofetch", st); return out({ status: "stopped" }); }
    if (st.lastStepAt && now.ms - st.lastStepAt < 20000) return out({ status: "too soon" });
  } else {                                                                     // maybe start a new run
    const due = schedule.enabled && schedule.days.includes(now.weekday) && now.hour >= schedule.hour && now.hour < schedule.hour + CATCH_UP_HOURS && st?.date !== now.date;
    if (!due) return out({ status: "nothing due" });
    const queue = Object.entries(sources).flatMap(([name, a]) => ["Wolt", "Glovo"].filter((app) => a[app]).map((app) => ({ name, app, url: a[app] })));
    if (!queue.length) return out({ status: "no addresses" });
    st = { date: now.date, queue, total: queue.length, pagesOk: 0, items: 0, errors: [], startedAt: now.iso, finishedAt: null };
  }

  st.lastStepAt = now.ms;
  const batch = st.queue.splice(0, PAGES_PER_WAKE);
  for (let i = 0; i < batch.length; i++) {
    const job = batch[i];
    try {
      const { rows } = await fetchMenu(job.url);
      const dated = rows.map((r) => ({ ...r, restaurant: job.name, platform: job.app, date: now.date }));
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
