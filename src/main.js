// Mirrors the snippet Giggera sent support. Extra logging only.
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { APP_ORIGIN, RESUME_URL, CUSTOM_SCHEME } from "../config.js";

const logEl = document.getElementById("log");
const log = (...a) => {
  const line = `${new Date().toISOString().slice(11, 23)} ${a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`;
  console.log(line);
  logEl.textContent = line + "\n" + logEl.textContent;
};

let appVerifier;

async function startBankId({ purpose, appVerifier, appPlatform }) {
  const r = await fetch(`${APP_ORIGIN}/api/bankid/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose, appVerifier, appPlatform }),
  });
  return r.json();
}

const isAuthResume = (url) => url.startsWith(RESUME_URL);

document.getElementById("login").addEventListener("click", async () => {
  appVerifier = crypto.randomUUID();
  const purpose = "login";
  const { authorizeUrl } = await startBankId({ purpose, appVerifier, appPlatform: "ios" });
  log("authorizeUrl", authorizeUrl);
  await Browser.open({ url: authorizeUrl, presentationStyle: "fullscreen" });
});

App.addListener("appUrlOpen", async ({ url }) => {
  log("appUrlOpen", url);
  if (url.startsWith(`${CUSTOM_SCHEME}://idura`)) { // our redirect_uri's hand-off
    Browser.close();
    const h = new URL(url).searchParams.get("h");
    const r = await fetch(`${APP_ORIGIN}/api/bankid/session?h=${h}&appVerifier=${appVerifier}`);
    log("session", r.status, await r.json());
    return;
  }
  if (isAuthResume(url)) { log("resume url, ignoring"); return; } // ignore
  log("other deep link");
});

// Not in Giggera's code, but useful to see what the sheet is doing.
App.addListener("appStateChange", ({ isActive }) => log("appStateChange", { isActive }));
Browser.addListener("browserPageLoaded", () => log("browserPageLoaded"));
Browser.addListener("browserFinished", () => log("browserFinished (sheet closed)"));
