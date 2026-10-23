// Everything hardcoded in one place. Shared by the server and the app bundle.

// Idura tenant + client. The client needs REDIRECT_URI registered as a callback URL.
// The client secret goes in .env (CLIENT_SECRET=...), read by the server only.
export const IDURA_DOMAIN = "janzeh.qa-idura.click";
export const CLIENT_ID = "urn:my:application:identifier:655246";

// redirect_uri host: stands in for app.giggera.se (no AASA), tunnelled to `npm run server`.
export const APP_ORIGIN = "https://dip-seen-acdbentity-tribune.trycloudflare.com";
export const REDIRECT_URI = `${APP_ORIGIN}/api/bankid/callback`;

// Resume URL: stands in for auth.giggera.se. The Idura domain serves the AASA
// (P56KU6NT8A.eu.idura.giggeratest, /ios/*), so this is a universal link into the app.
export const RESUME_URL = `https://${IDURA_DOMAIN}/ios/callback`;

export const CUSTOM_SCHEME = "giggera";
