// Stand-in for Giggera's backend. Plain node:http, in-memory state.
//
//   POST /api/bankid/start          -> { authorizeUrl }            (startBankId)
//   GET  /api/bankid/callback       -> code exchange, then page that
//                                      redirects to giggera://idura?h=...
//   GET  /api/bankid/session?h=&appVerifier= -> claims             (swap ?h= for the session)
//
// No AASA here, like app.giggera.se. The resume URL's AASA is served by Idura.
//
// Every request is logged, so we can see what the SFSafariViewController
// actually loads (and when, e.g. the late redirect_uri reloads).

import http from "node:http";
import crypto from "node:crypto";
import {
  IDURA_DOMAIN, CLIENT_ID, REDIRECT_URI, RESUME_URL, CUSTOM_SCHEME,
} from "../config.js";

const PORT = 3000;
const { CLIENT_SECRET } = process.env; // from .env, see README
const discovery = await (await fetch(`https://${IDURA_DOMAIN}/.well-known/openid-configuration`)).json();

const flows = new Map(); // state -> { appVerifier, purpose }
const handoffs = new Map(); // h -> { appVerifier, result }

const html = (body) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:1em">${body}`;
// CORS because the app's webview origin is capacitor://localhost.
const send = (res, status, type, body) => {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" });
  res.end(body);
};
const json = (res, status, obj) => send(res, status, "application/json", JSON.stringify(obj, null, 2));
const readBody = async (req) => { let s = ""; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };

function authorizeUrl(state) {
  const u = new URL(discovery.authorization_endpoint);
  u.search = new URLSearchParams({
    response_type: "code",
    response_mode: "query",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid",
    state,
    acr_values: "urn:grn:authn:se:bankid",
    login_hint: `appswitch:resumeUrl:${RESUME_URL}`,
  }).toString();
  return u.toString();
}

async function exchange(code) {
  const r = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Basic " + Buffer.from(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`).toString("base64"),
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
  });
  const body = await r.json();
  if (!r.ok) return { error: body };
  const claims = JSON.parse(Buffer.from(body.id_token.split(".")[1], "base64url"));
  return { claims };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const origin = `https://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
  console.log(new Date().toISOString(), req.method, origin + url.pathname + url.search, "|", req.headers["user-agent"]);

  try {
    if (req.method === "OPTIONS") return send(res, 204, "text/plain", "");

    if (req.method === "POST" && url.pathname === "/api/bankid/start") {
      const { purpose, appVerifier, appPlatform } = await readBody(req);
      const state = crypto.randomUUID();
      flows.set(state, { appVerifier, purpose, appPlatform });
      return json(res, 200, { authorizeUrl: authorizeUrl(state) });
    }

    if (url.pathname === "/api/bankid/callback") {
      const state = url.searchParams.get("state");
      const flow = flows.get(state);
      flows.delete(state);
      if (!flow) return send(res, 400, "text/html", html(`<h3>Unknown or reused state</h3><pre>${url.search}</pre>`));

      const result = url.searchParams.has("code")
        ? await exchange(url.searchParams.get("code"))
        : { error: Object.fromEntries(url.searchParams) };
      const h = crypto.randomBytes(16).toString("hex");
      handoffs.set(h, { appVerifier: flow.appVerifier, result });

      const target = `${CUSTOM_SCHEME}://idura?h=${h}`;
      return send(res, 200, "text/html", html(`
        <p>Returning to the app...</p>
        <p><a href="${target}">Tap here if nothing happens</a></p>
        <script>location.href = ${JSON.stringify(target)};</script>`));
    }

    if (url.pathname === "/api/bankid/session") {
      const h = url.searchParams.get("h");
      const handoff = handoffs.get(h);
      handoffs.delete(h);
      if (!handoff || handoff.appVerifier !== url.searchParams.get("appVerifier")) return json(res, 404, { error: "unknown h" });
      return json(res, 200, handoff.result);
    }

    send(res, 404, "text/plain", "not found");
  } catch (err) {
    console.error(err);
    send(res, 500, "text/plain", String(err));
  }
});

server.listen(PORT, () => {
  console.log(`listening on :${PORT}`);
  console.log(`  redirect_uri ${REDIRECT_URI}`);
  console.log(`  resumeUrl    ${RESUME_URL}`);
});
