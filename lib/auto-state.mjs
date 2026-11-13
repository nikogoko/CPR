// What the page may see of the automatic fetch's progress (no addresses, just counts and problems).
// `st` is the state of the latest run, `wake` the note the hourly job leaves every time it wakes up.
export const summarise = (st, wake) => {
  if (!st && !wake) return null;
  const s = st || {};
  return {
    hasRun: !!st, date: s.date || null, total: s.total || 0, pagesOk: s.pagesOk || 0, items: s.items || 0, errors: s.errors || [],
    remaining: (s.queue || []).length, startedAt: s.startedAt || null, finishedAt: s.finishedAt || null, stopped: s.stopped || null, lastWake: wake || null
  };
};
