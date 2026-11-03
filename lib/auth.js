const crypto = require("crypto");

// Rejects everything if SITE_PASSWORD is not set, so a missing setting can never leave the site open.
function checkPassword(event) {
  const expected = process.env.SITE_PASSWORD;
  const given = event.headers["x-site-password"];
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { checkPassword };
