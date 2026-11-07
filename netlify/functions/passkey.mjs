// Optional Face ID / fingerprint / Windows Hello sign-in ("passkeys", the standard called WebAuthn).
// The device keeps a private key behind its biometric check; this site only stores the matching public key.
//   status, loginOptions, loginVerify  -> open to anyone (they are how you sign in)
//   registerOptions, registerVerify, removeAll -> need the password or a session pass (you are already signed in)
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import auth from "../../lib/auth.js";
import { guard, json, readBody } from "../../lib/http.mjs";
import { openStore } from "../../lib/store.mjs";

const SESSION_MS = 12 * 60 * 60 * 1000;   // a Face ID sign-in lasts 12 hours
const CHALLENGE_MS = 5 * 60 * 1000;       // the device must answer within 5 minutes
const USER_ID = new TextEncoder().encode("price-tracker-owner");   // one owner, many devices
const PROTECTED = new Set(["registerOptions", "registerVerify", "removeAll"]);

// Where the browser says the page lives. Passkeys only work for exactly this website address.
function where(req) {
  const u = new URL(req.url), local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  return { rpID: u.hostname, origin: `${local ? u.protocol : "https:"}//${u.host}` };
}

const toB64 = (bytes) => Buffer.from(bytes).toString("base64url");
const fromB64 = (text) => new Uint8Array(Buffer.from(text, "base64url"));

async function loadKeys(store) { return (await store.get("passkeys", { type: "json" })) || []; }

// Each challenge is single-use: stored when handed out, deleted when answered, expired after 5 minutes.
async function saveChallenge(store, challenge, kind) {
  const { blobs } = await store.list({ prefix: "challenge/" });
  const live = [];
  for (const b of blobs) {   // tidy up old ones, and refuse to pile up
    const c = await store.get(b.key, { type: "json" });
    if (!c || c.exp < Date.now()) await store.delete(b.key); else live.push(b.key);
  }
  if (live.length > 50) throw new Error("Too many sign-in attempts at once. Try again in a few minutes.");
  await store.setJSON("challenge/" + challenge, { kind, exp: Date.now() + CHALLENGE_MS });
}
const useChallenge = (store, kind) => async (challenge) => {
  const key = "challenge/" + challenge, c = await store.get(key, { type: "json" });
  if (!c) return false;
  await store.delete(key);   // single use: a copied answer cannot be replayed
  return c.kind === kind && c.exp >= Date.now();
};

// The library's own wording is technical; say what happened in plain words.
const plain = (e) => /challenge/i.test(e.message) ? "This sign-in request expired or was already used. Please try again." : e.message;

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await readBody(req), { action } = body;

  if (PROTECTED.has(action)) {
    const blocked = guard(req);
    if (blocked) return blocked;
  }
  if (!(process.env.SITE_PASSWORD || "").trim())
    return json(500, { error: "The server has no SITE_PASSWORD set, so Face ID cannot be used either." });

  try {
    const store = await openStore(), { rpID, origin } = where(req), keys = await loadKeys(store);

    if (action === "status") return json(200, { enabled: keys.length > 0 });

    if (action === "loginOptions") {
      if (!keys.length) return json(400, { error: "Face ID has not been turned on yet." });
      const options = await generateAuthenticationOptions({
        rpID, userVerification: "required",
        allowCredentials: keys.map((k) => ({ id: k.id, transports: k.transports }))
      });
      await saveChallenge(store, options.challenge, "login");
      return json(200, options);
    }

    if (action === "loginVerify") {
      const key = keys.find((k) => k.id === body.response?.id);
      if (!key) return json(401, { error: "This device is not set up for Face ID." });
      let result;
      try {
        result = await verifyAuthenticationResponse({
          response: body.response, expectedChallenge: useChallenge(store, "login"), expectedOrigin: origin, expectedRPID: rpID,
          credential: { id: key.id, publicKey: fromB64(key.publicKey), counter: key.counter, transports: key.transports },
          requireUserVerification: true
        });
      } catch (e) { return json(401, { error: "Face ID check failed: " + plain(e) }); }
      if (!result.verified) return json(401, { error: "Face ID check failed." });
      key.counter = result.authenticationInfo.newCounter;
      await store.setJSON("passkeys", keys);
      return json(200, auth.issueSession(SESSION_MS));
    }

    if (action === "registerOptions") {
      const options = await generateRegistrationOptions({
        rpName: "Price Tracker", rpID, userName: "owner", userDisplayName: "Price Tracker", userID: USER_ID, attestationType: "none",
        excludeCredentials: keys.map((k) => ({ id: k.id, transports: k.transports })),   // do not add the same device twice
        authenticatorSelection: { residentKey: "preferred", userVerification: "required", authenticatorAttachment: "platform" }
      });
      await saveChallenge(store, options.challenge, "register");
      return json(200, options);
    }

    if (action === "registerVerify") {
      let result;
      try {
        result = await verifyRegistrationResponse({
          response: body.response, expectedChallenge: useChallenge(store, "register"), expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true
        });
      } catch (e) { return json(400, { error: "Could not turn on Face ID: " + plain(e) }); }
      if (!result.verified) return json(400, { error: "Could not turn on Face ID." });
      const c = result.registrationInfo.credential;
      keys.push({ id: c.id, publicKey: toB64(c.publicKey), counter: c.counter, transports: c.transports || [], createdAt: new Date().toISOString() });
      await store.setJSON("passkeys", keys);
      return json(200, { ok: true, devices: keys.length });
    }

    if (action === "removeAll") {
      await store.setJSON("passkeys", []);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unknown action." });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
