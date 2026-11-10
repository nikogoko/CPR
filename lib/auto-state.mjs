// What the page may see of the automatic fetch's progress (no addresses, just counts and problems).
export const summarise = (st) => st && ({ date: st.date, total: st.total, pagesOk: st.pagesOk, items: st.items, errors: st.errors || [], remaining: (st.queue || []).length, startedAt: st.startedAt, finishedAt: st.finishedAt || null, stopped: st.stopped || null });
