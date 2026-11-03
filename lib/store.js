// Price history lives in Netlify Blobs: one record per restaurant, { name, rows: [...] }.
const crypto = require("crypto");
const { getStore, connectLambda } = require("@netlify/blobs");

function openStore(event) {
  connectLambda(event);
  return getStore("price-tracker");
}

// Hashed so any restaurant name (any script, any length) makes a valid key. Case-insensitive.
const historyKey = (restaurant) =>
  "history/" + crypto.createHash("sha1").update(String(restaurant).trim().toLowerCase()).digest("hex");

async function readAllHistory(store) {
  const { blobs } = await store.list({ prefix: "history/" });
  const records = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return records.filter(Boolean); // [{ name, rows }]
}

module.exports = { openStore, historyKey, readAllHistory };
