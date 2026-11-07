const crypto = require("crypto");

const fail = (statusCode, error) => ({ statusCode, body: JSON.stringify({ error }) });

// A "session pass" is given after a successful Face ID / fingerprint login, so the page does not need the password.
// It is signed with a key made from SITE_PASSWORD: changing the password cancels every pass.
function sessionKey() {
  return crypto.createHash("sha256").update("price-tracker-session|" + (process.env.SITE_PASSWORD || "").trim()).digest();
}
const sign = (exp) => crypto.createHmac("sha256", sessionKey()).update("session|" + exp).digest("base64url");

function issueSession(ttlMs) {
  const exp = Date.now() + ttlMs;
  return { token: `${exp}.${sign(exp)}`, expires: exp };
}

function validSession(token) {
  if (typeof token !== "string") return false;
  const [expText, mac] = token.split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || exp <= Date.now() || !mac) return false;
  const a = Buffer.from(mac), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Returns null when the request is allowed, otherwise the response to send back.
// Allowed with either the password (spaces around it are ignored) or a valid session pass.
function denied(event) {
  const expected = (process.env.SITE_PASSWORD || "").trim();
  if (!expected)
    return fail(500, "The server has no SITE_PASSWORD set. Add it in Netlify (Site configuration > Environment variables, with the Functions scope), then redeploy.");

  if (validSession(event.headers["x-session-token"])) return null;

  let given = event.headers["x-site-password"];
  if (typeof given !== "string") return fail(401, "Wrong password");
  try { given = decodeURIComponent(given); } catch { /* keep as sent */ }   // page sends it URL-encoded so any language works

  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? null : fail(401, "Wrong password");
}

module.exports = { denied, issueSession, validSession };
