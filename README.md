# Idura Verify + Capacitor (iOS) BankID app switch demo

Barebones replica of a Capacitor app doing Swedish BankID app switch through Idura Verify in `@capacitor/browser` (SFSafariViewController), without any Idura SDK.

- `src/main.js` - the app: opens the authorize URL with `Browser.open`, handles `appUrlOpen`.
- `server/server.mjs` - the backend: builds the authorize URL, exchanges the code on the `redirect_uri`, then hands off to the app via `giggera://idura?h=...`.
- `config.js` - all hardcoded values (Idura domain, client ID, redirect URI, resume URL).

The flow:

1. The app asks the backend for an authorize URL with `acr_values=urn:grn:authn:se:bankid` and `login_hint=appswitch:resumeUrl:https://<idura domain>/ios/callback`.
2. After BankID, the resume URL (a universal link, AASA served by the Idura domain) brings the app back to the front. The app ignores the URL itself.
3. Idura redirects the browser to the `redirect_uri` (no AASA, not a universal link). The backend exchanges the code and redirects to `giggera://idura?h=...`, which closes the browser and fetches the session.

## Running it

1. Expose the backend: `cloudflared tunnel --url http://localhost:3000`, and put the URL in `APP_ORIGIN` in `config.js`. Register `<APP_ORIGIN>/api/bankid/callback` as a callback URL on the Idura application.
2. Put the client secret in `.env`: `CLIENT_SECRET=...`, then `npm install && npm run server`.
3. In the Idura dashboard, configure the iOS app (Team ID + bundle ID) for the domain's AASA. Set the same domain in `ios/App/App/App.entitlements` and the team in Xcode.
4. `npm run ios`, then run on a device with Developer Mode on (the entitlement uses `?mode=developer`).
