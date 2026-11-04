// Small helpers for the newer-style Netlify functions (Request in, Response out).
import auth from "./auth.js";

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Returns null when the request may go ahead, otherwise the Response to send back.
export function guard(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const deny = auth.denied({ headers: Object.fromEntries(req.headers) });   // header names arrive lower-case
  return deny ? new Response(deny.body, { status: deny.statusCode, headers: { "content-type": "application/json" } }) : null;
}

export async function readBody(req) {
  try { return await req.json(); } catch { return {}; }
}
