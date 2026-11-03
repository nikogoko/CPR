const crypto = require("crypto");

const fail = (statusCode, error) => ({ statusCode, body: JSON.stringify({ error }) });

// Returns null when the request is allowed, otherwise the response to send back.
// Spaces around the password (typed or stored) are ignored.
function denied(event) {
  const expected = (process.env.SITE_PASSWORD || "").trim();
  if (!expected)
    return fail(500, "The server has no SITE_PASSWORD set. Add it in Netlify (Site configuration > Environment variables, with the Functions scope), then redeploy.");

  let given = event.headers["x-site-password"];
  if (typeof given !== "string") return fail(401, "Wrong password");
  try { given = decodeURIComponent(given); } catch { /* keep as sent */ }   // page sends it URL-encoded so any language works

  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? null : fail(401, "Wrong password");
}

module.exports = { denied };
