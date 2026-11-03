// Stores the not-yet-sent rows so every device that logs in sees the same list.
const { getStore, connectLambda } = require("@netlify/blobs");
const { checkPassword } = require("../../lib/auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  if (!checkPassword(event)) return { statusCode: 401, body: JSON.stringify({ error: "Wrong password" }) };

  try {
    connectLambda(event);
    const store = getStore("price-tracker");
    const { action, rows } = JSON.parse(event.body || "{}");

    if (action === "save") {
      if (!Array.isArray(rows) || rows.length > 1000) return { statusCode: 400, body: JSON.stringify({ error: "rows must be a list of up to 1000" }) };
      await store.setJSON("pending", rows);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    const saved = await store.get("pending", { type: "json" });
    return { statusCode: 200, body: JSON.stringify({ rows: saved || [] }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
