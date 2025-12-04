# Mobile Handoff — Web Frontend Summary

Purpose
- Provide a compact, developer-friendly handoff so a new Copilot chat (focused on React Native mobile) can start quickly with full context from the web-side work.

One-line overview
- The web frontend migrated refresh tokens to an httpOnly cookie, moved to cookie-based refresh for browsers, made insight polling opt-in, added robust sparkline seeding (pad to SPARK_MAX = 24), and included single-shot fallback fetches to avoid race conditions.

Quick run & build commands
- TypeScript check:
```powershell
npx tsc -noEmit
```
- Start backend (dev):
```powershell
# from cryptics-backend
uvicorn app.main:app --reload --log-level debug
```
- Start web frontend (dev):
```powershell
# from cryptics-frontend\cryptics\apps\web
npm run dev
# or pnpm dev / yarn dev
```
- Clear Next dev cache (if needed):
```powershell
rd /s /q .next
```

- Start mobile app (Expo):
```powershell
# from cryptics-frontend\cryptics\apps\mobile
npm run start
# or to launch on device/emulator:
npm run android
npm run ios
```

Expo note:
- The mobile app is an Expo project located at `cryptics-frontend/cryptics/apps/mobile`.
- Ensure you have the Expo CLI installed (`npm install -g expo-cli` or use `npx expo`) and follow Expo's platform prerequisites (Node, watchman on macOS, Android/iOS tooling) for device/emulator testing.

Auth & token notes (important for mobile)
- Web uses server-set httpOnly `refresh_token` cookie and a readable `access_token` in client state.
  - Browser flow: `POST /auth/refresh` with credentials (cookie) to rotate tokens.
- Mobile cannot read httpOnly cookies. Decide mobile refresh approach with backend:
  - Option A: Backend accepts mobile refresh token stored securely (Keychain / EncryptedSharedPrefs) and a mobile refresh endpoint.
  - Option B: Backend provides an alternative mobile refresh flow (e.g., accepts refresh token in request body with secure handling).
- Mobile should store the `access_token` securely (Keychain / EncryptedSharedPrefs). Use `Authorization: Bearer <access_token>` for REST/WS.

Relevant endpoints (web + mobile will call same REST)
- Auth
  - `POST /auth/login` — returns access token (web also receives httpOnly refresh cookie).
  - `POST /auth/refresh` — rotates tokens (web uses cookie-based call).
  - `POST /auth/logout` — invalidates tokens, clears cookie.
- Market & insights
  - `GET /market/summaries?symbols=...&include_klines=true&kline_interval=1m&kline_limit=48`
  - `GET /market/klines?symbol={symbol}&interval=1m&limit=24`
  - `GET /insights/signal/{symbol}`
  - WebSocket: `/market/ws/summaries?symbols=...` (see `useVisibleSummaries`)

Key web-side files to inspect (paths)
- API helpers and auth
  - `packages/api/src/axios.ts` — axios wrapper and `doRefresh` logic.
  - `packages/api/src/auth.ts` — auth helpers and response shapes.
- Insights & sparkline logic
  - `apps/web/hooks/useInsights.ts` — insight fetch behavior (enabled flag, manual refresh).
  - `apps/web/components/InsightsCard.tsx` — sparkline seeding, delayed fallback, one-shot `getKlines` on insights arrival.
  - `apps/web/components/lwc/Sparkline.tsx` — chart rendering: Lightweight Charts + SVG fallback.
- Summaries streaming
  - `apps/web/hooks/useVisibleSummaries.ts` — WS management for visible symbols; exports `observe`, `unobserve`, `getLatest`, `tick`, `addExtraSymbol`, `removeExtraSymbol`.
- Backend router references
  - `app/routers/auth.py`, `app/routers/market.py`, `app/routers/insights.py` (for endpoint behavior and cookie handling).

Data shapes & important behaviors
- Summary object (example fields):
```ts
{ symbol: string, last_price: number | null, klines?: Array<Kline> }
```
- Kline: either object `{ open, high, low, close, volume, ts }` or array where `close` is at index 4.
- Insights `data` includes `signal` which may be a string ("BUY"/"SELL"/"HOLD") or an object `{ signal, confidence }` and optional `technical_analysis` and `sentiment`.

Web behaviors mobile should mirror
1. Insights fetch policy
  - Polling is opt-in; default is single fetch on mount + manual refresh to avoid exhausting third-party APIs.
2. Sparkline seeding & resilience
  - Prefer `summary.klines` when present; else use `summary.last_price` (fill buffer), else call `GET /market/klines`.
  - Always normalize/pad to `SPARK_MAX = 24` (pad with earliest value when needed) to avoid single-point renders.
  - Two recovery mechanisms are used:
    - A short delayed fallback (single-shot, ~150ms) that calls `getKlines` if buffer is too small (<3).
    - A one-shot `getKlines` when `insights` response arrives (ensures klines are fetched after signals).
3. WS summaries
  - The web manages a single batched WS to `/market/ws/summaries?symbols=...` and supplies `getLatest(symbol)` to cards.
  - Mobile can either subscribe to WS per active view or reuse a singleton manager similar to `useVisibleSummaries`.

Sparkline seeding pseudocode (recommended for mobile)
```ts
const SPARK_MAX = 24;
function seedSpark(symbol) {
  const summary = getLatestSummary(symbol);
  if (summary?.klines?.length) {
    const closes = extractClosePrices(summary.klines);
    const vals = closes.length > SPARK_MAX ? downsample(closes, SPARK_MAX) : closes.slice(-SPARK_MAX);
    return padTo(vals, SPARK_MAX);
  }
  if (summary?.last_price) return Array(SPARK_MAX).fill(summary.last_price);
  // else: one-shot fetch getKlines(symbol)
}
// fallback: if after seeding buffer < 3, setTimeout(() => getKlines(symbol), 150)
// also: when insights response arrives for symbol, call getKlines once
```

WebSocket protocol (summary)
- Connect to: `/market/ws/summaries?symbols=SYMBOL1%2CSYMBOL2...`
- Messages:
  - `{ type: 'summary', data: { symbol, last_price, ... } }`
  - `{ type: 'batch', data: [{...}, ...] }`
- Behavior: batch visible symbols and reconnect on visibility changes; flush updates to UI on an interval (`flushMs`).

Testing & verification checklist (for mobile)
- Auth
  - Access token usage for REST and WS.
  - Refresh token flow works end-to-end (discuss mobile refresh with backend).
- Insights & klines
  - On `GET /insights/signal/{symbol}`, mobile triggers a one-shot `GET /market/klines?symbol=...` (or otherwise ends up with seeded buffer).
  - Sparkline shows filled buffer on first render for BTC/ETH/XRP/ADA.
- WS
  - Real-time summaries arrive and `getLatest` reflects latest `last_price` values.
- Rate limits
  - Ensure no aggressive polling to `insights` endpoint; prefer single fetch + manual refresh.

Mobile-specific notes & recommended libraries
- Secure storage: `react-native-keychain` or `react-native-sensitive-info`.
- Storage for chat/history or cached market data: `@react-native-async-storage/async-storage` for small caches or `react-native-sqlite-storage` / `realm` for heavier usage.
- Charts: lightweight RN options — `react-native-svg` with `react-native-svg-charts`, `victory-native`, or implement a simple SVG fallback for small sparklines.
- WS client: use `WebSocket` (RN builtin) or a library if you need reconnection/backoff helpers.

Mobile dev quickstart
- Secure storage: store `access_token` (and mobile refresh token if used) in secure storage (Keychain on iOS / EncryptedSharedPrefs on Android). Use `react-native-keychain` or `react-native-sensitive-info`.
- Environment: set `NEXT_PUBLIC_API_URL` (or mobile equivalent) to point to your backend (e.g., `http://10.0.2.2:8000` for Android emulator, or `http://localhost:8000` for iOS simulator). Confirm network routing for emulators/devices.
- Starting the app:
  - `cd cryptics-frontend/cryptics/apps/mobile`
  - `npm run start` (opens Expo dev tools)
  - Use `npm run android` or `npm run ios` to launch on emulator/device
- Debugging tips:
  - Use React Native Debugger or Expo dev tools for network/console inspection.
  - Check Network tab or device logs to ensure `GET /market/klines` and `/insights/signal` requests originate from the mobile client as expected.

Env examples & emulator notes
--------------------------------
Put development environment variables in `apps/mobile/.env` (copy from the provided `.env.example`). Key variables:

- `NEXT_PUBLIC_API_URL` / `API_URL` — base backend URL. Use emulator-friendly addresses while developing:
  - Default (recommended when developing on the same machine): `http://localhost:8000`
  - iOS simulator: `http://localhost:8000` (works when backend is on the same dev machine)
  - Android emulator (Android Studio) special case: `http://10.0.2.2:8000` if the emulator can't reach host `localhost`
  - Physical device: use your machine IP on the LAN (e.g., `http://192.168.1.100:8000`).

- `MOBILE_REFRESH_STRATEGY` — informational hint for which refresh approach to use for mobile. Example values:
  - `secure_storage` (recommended): mobile stores refresh token securely and calls mobile refresh endpoint.
  - `token_in_body`: send refresh token in request body to `/auth/refresh` (requires backend acceptance).

- `MOBILE_DEBUG_SPARKS` — optional; set to `true` to enable extra logging for sparkline seeding during development (gate logs behind this variable in code).

Notes on configuring env for Expo / React Native
- Expo doesn't automatically load `.env` files; use a library such as `expo-constants` with runtime config, or `react-native-dotenv` / `babel-plugin-inline-dotenv` to inject at build time. Alternatively, set env values in `app.config.js` or use `process.env` via a bundler plugin.
- Example (Android emulator):
  - If you run the backend locally and your Expo runs on the same machine (typical VS Code + Expo flow), set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `apps/mobile/.env` or your chosen loader, then start Expo (`npm run start`) and run on an emulator or simulator.
  - If testing on an Android emulator that cannot reach `localhost`, set `NEXT_PUBLIC_API_URL=http://10.0.2.2:8000` instead.

Security note
- Never commit a `.env` file with secrets to source control. Use `.env.example` for sample values and document how to populate the real `.env` in developer machines or CI.

Handoff artifacts to include in new Copilot chat
- This README (copy/paste) + these concrete artifacts from repo:
  - `packages/api` usage examples (`getKlines`, `getSummaries`)
  - `apps/web/components/InsightsCard.tsx` — seeding logic
  - `apps/web/hooks/useVisibleSummaries.ts` — WS batch manager pattern
- Optional: add a `packages/api/src/mobileApi.ts` stub that exposes mobile-friendly wrappers for `getKlines`, `getSummaries`, and a WS manager.

Suggested next activities for the new mobile Copilot chat
1. Decide mobile refresh strategy with backend (critical).  
2. Implement `packages/api/src/mobileApi.ts` (REST wrappers that use secure storage for token refresh).  
3. Implement a small `Sparkline` RN component that follows the seeding pseudocode.  
4. Implement a WS manager (or reuse `mobileApi`) for summaries and updates.  
5. Create tests verifying seeding behavior and that `insights` triggers `getKlines`.

Contact & context tips for the new chat
- Focus on auth refresh approach first — mobile cannot rely on httpOnly cookies.
- Mirror the web's conservative polling approach to avoid exhausting sentiment APIs.
- Use the seeding/pad/fallback approach exactly to avoid chart flicker.

If you want, I can also:
- Produce `packages/api/src/mobileApi.ts` stub and a `README_MOBILE_STUB.md` with sample calls.
- Or create a small gist-style copy of `InsightsCard` seeding logic optimized for React Native.

Mobile implementation approach (concrete)
--------------------------------------
This project already includes an Expo mobile app at `cryptics-frontend/cryptics/apps/mobile`.
Use the following approach to implement parity with the web features (insights, sparklines, summaries, auth):

1) Where to put shared code
- Reuse `packages/api` where possible for REST helpers (e.g. `getKlines`, `getSummaries`). If browser-only helpers assume cookies, add a thin mobile wrapper under the mobile app:
  - `cryptics-frontend/cryptics/apps/mobile/src/api/mobileApi.ts` — mobile-friendly wrappers that call the same backend endpoints and handle access token storage/refresh.
  - Keep WS/streaming logic in a mobile manager: `cryptics-frontend/cryptics/apps/mobile/src/ws/summaries.ts`.

2) Auth and token refresh (must-do)
- Mobile cannot rely on httpOnly cookies. Decide one of these:
  - Store a mobile refresh token securely (Keychain / EncryptedSharedPrefs) and call a mobile refresh endpoint (recommended). Implement wrappers in `mobileApi.ts` to read refresh token from secure store and call `/auth/refresh` when access token expires.
  - Alternatively, have backend accept refresh tokens in the request body for mobile (discuss server-side change with backend team).
- Store `access_token` securely using `react-native-keychain` or `react-native-sensitive-info`.

3) WS & summaries manager
- Implement a singleton WS manager that mirrors `useVisibleSummaries` responsibilities:
  - Batch subscribed symbols and open a single WS to `/market/ws/summaries?symbols=...`.
  - Expose `subscribe(symbol)`, `unsubscribe(symbol)`, and `getLatest(symbol)`.
  - Place under `apps/mobile/src/ws/summaries.ts` and import into components/screens.

4) Sparkline & seeding
- Implement a lightweight RN Sparkline component using `react-native-svg` (or `victory-native`) in `apps/mobile/src/components/Sparkline.tsx`.
- Port the seeding logic from `InsightsCard.tsx`:
  - Prefer `summary.klines` if present → extract closes → downsample/pad to `SPARK_MAX = 24`.
  - Else use `summary.last_price` → fill buffer.
  - Else issue a one-shot `GET /market/klines` when insights data arrives (single-shot per symbol) and keep a delayed 150ms fallback attempt if buffer < 3.

5) Placement for screens/components
- Use Expo/Router `app/` directory already present. Add screens/components under:
  - `apps/mobile/app/(dashboard)/InsightsScreen.tsx` (or integrate into existing tabs)
  - `apps/mobile/src/components/InsightsCard.tsx` (mobile-optimized card using Sparkline component and mobile `mobileApi`)

6) Networking & environment
- Ensure `NEXT_PUBLIC_API_URL` is set for mobile dev. For Android emulator use `http://10.0.2.2:8000` (or your dev IP) to reach backend; for iOS simulator `http://localhost:8000` typically works. Document in `.env` or README.

7) Debugging & testing
- Use Expo dev tools and device emulators. For network inspection, use React Native Debugger or proxy the device traffic (e.g., via `adb` reverse or ngrok) to confirm `GET /market/klines` calls.

8) Minimal file scaffold suggestion (I can create these)
- `apps/mobile/src/api/mobileApi.ts` — wrappers: `getKlines`, `getSummaries`, `getInsights`, token refresh helpers.
- `apps/mobile/src/ws/summaries.ts` — singleton WS manager with `subscribe` / `unsubscribe` / `getLatest`.
- `apps/mobile/src/components/Sparkline.tsx` — RN sparkline component with seed/pad/fallback logic.
- `apps/mobile/src/components/InsightsCard.tsx` — uses `mobileApi`, `ws/summaries`, and `Sparkline` for mobile UI.

If you'd like, I can scaffold the `mobileApi.ts`, `ws/summaries.ts`, and `Sparkline.tsx` stubs and add small examples illustrating how to seed sparkline buffers exactly like the web.

---

File created: `cryptics-frontend/cryptics/README_MOBILE_HANDOFF.md`

Tell me which artifact to produce next: `mobileApi` stub, RN `Sparkline` example, or a compact README to paste into a new Copilot chat.