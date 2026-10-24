---
name: stake-engine-ts-client
description: Use the `stake-engine` npm package (engineio/ts-client), a TypeScript RGS client for Stake Engine game frontends. Covers RGSClient setup from the launch URL (sessionID, rgs_url, lang, device), Authenticate/Play/EndRound/Event calls, bet-level and stepBet validation, API_MULTIPLIER amount scaling, DisplayAmount currency formatting, jurisdiction flags, and the window `balanceUpdate` / `roundActive` events. Use when wiring a slot or casino frontend (React, Svelte, vanilla) to the Stake Engine RGS, debugging RGS client errors, formatting balances, or handling active rounds and resume.
---

# Stake Engine TypeScript RGS Client (`stake-engine`)

Source: <https://github.com/engineio/ts-client>, npm package `stake-engine` (documented version **0.1.32**, BETA). RGS API docs: <https://stake-engine.com/docs/rgs>. Everything below was checked against the source. Where the upstream README disagrees with the code, the code is described here.

```bash
npm install stake-engine   # or: yarn add stake-engine
```

## Exports

```ts
import { RGSClient, DisplayAmount, ParseAmount, parseBalance } from 'stake-engine';
import type {
  AuthenticateConfig, AuthenticateResponse, Balance, BalanceResponse, Currency,
  EndRoundResponse, EventResponse, JurisdictionFlags, Language,
  PlayParameters, PlayResponse, Round,
} from 'stake-engine';
```

The README lists `API_MULTIPLIER` and `DisplayBalance`, but **neither is exported from the package entry**. Define `const API_MULTIPLIER = 1_000_000` yourself, and use `DisplayAmount` instead of `DisplayBalance`.

## Creating the client

```ts
const rgs = RGSClient({
  url: window.location.href,   // the launch URL the operator opened the game with
  enforceBetLevels: true,      // default true: Play amount must be in config.betLevels
  protocol: 'https',           // default 'https'; prefixed onto rgs_url
});
```

The client reads these query parameters from `url`:

| Param | Required | Notes |
|---|---|---|
| `sessionID` | yes | Throws `sessionID is not in set in url parameters` if missing |
| `rgs_url` | yes | Host only, without a scheme (e.g. `rgs.stake-engine.com`). Throws if missing |
| `lang` | no | Defaults to `en`. Uses the `Language` union (ar, de, en, es, fi, fr, hi, id, ja, ko, pl, pt, ru, tr, vi, zh) |
| `device` | no | `desktop` (default) or `mobile`. Any other value throws |

For local development, build a URL such as `http://localhost:5173/?sessionID=...&rgs_url=...&lang=en&device=desktop`.

## Call order and endpoints

| Method | Endpoint (POST) | Notes |
|---|---|---|
| `Authenticate()` | `/wallet/authenticate` | Call first. Stores `authenticateConfig` (minBet, maxBet, stepBet, defaultBetLevel, betLevels) and `jurisdictionFlags`. Returns `round`, which may be an **active round to resume** |
| `Play({ amount, mode })` | `/wallet/play` | Validates `amount % stepBet === 0`, `minBet <= amount <= maxBet`, and (when enforced) `betLevels.includes(amount)`. Throws if a round is already active |
| `EndRound()` | `/wallet/end-round` | Call only when `Play()` returned `round.active === true` (the payout needs settling) |
| `Event(value)` | `/bet/event` | Saves progress inside an active round (e.g. which free spin the player has reached) |

Every method except `Authenticate` throws `Client is not authenticated` if `Authenticate()` has not resolved. A periodic balance refresh (`/wallet/balance`, every 60 s) starts after the first `Play`/`EndRound`. It is not a public method.

```ts
const auth = await rgs.Authenticate();
if (auth.round?.active) { /* replay auth.round.state, then */ await rgs.EndRound(); }

const { round } = await rgs.Play({ amount: auth.config.defaultBetLevel, mode: 'base' });
// round.state holds the book events from the math (e.g. Slot Engine / Math SDK books)
if (round.active) await rgs.EndRound();
```

## Amounts and formatting

- RGS amounts are integers scaled by **1,000,000** (`1_000_000` = 1.00 unit). `ParseAmount(v)` returns `v / 1e6`.
- Bet levels from `Authenticate()` are already scaled, so pass them to `Play` unchanged.
- `DisplayAmount(balance: Balance, { removeSymbol?, decimals?, trimDecimalForIntegers? })` formats with the currency symbol and default decimals for each currency, using `navigator.language`. The README's `wholeNumberDecimals` option **does not exist**. Use `trimDecimalForIntegers`.
- Social casino currencies: `XGC` (Gold Coin, 0 decimals, shown as "GC") and `XSC` (Stake Cash, shown as "SC"). When `jurisdictionFlags.socialCasino` is true, follow Stake's social-language rules (see the `stake-web-sdk` skill's approval references).

## Window events

```ts
window.addEventListener('balanceUpdate', (e) => {
  const { amount, currency } = (e as CustomEvent<Balance>).detail;
});
window.addEventListener('roundActive', (e) => {
  const { active } = (e as CustomEvent<{ active: boolean }>).detail; // disable spin/bet UI while active
});
```

The event is named `balanceUpdate`. One line of the README says `balanceUpdated`, which is wrong. Remove listeners on unmount (React `useEffect` cleanup, Svelte `onMount` return).

## Jurisdiction flags (from Authenticate)

`socialCasino`, `disabledFullscreen`, `disabledTurbo`, `disabledSuperTurbo`, `disabledAutoplay`, `disabledSlamstop`, `disabledSpacebar`, `disabledBuyFeature`, `displayNetPosition`, `displayRTP`, `displaySessionTimer`, `minimumRoundDuration`. Gate the matching UI features on these. Stake's approval checks them.

## Known pitfalls in 0.1.32

- **Errors lose detail.** Non-2xx responses call `throw new Error(data)` with the parsed JSON object, so `err.message` becomes `"[object Object]"`. To read RGS error codes such as `ERR_IS` (invalid session) or `ERR_ATE` (auth token expired), call the endpoint yourself or wrap the call and inspect the network response.
- **Only HTTP 200 counts as success.** The check is `status / 100 !== 2`, so 201 or 204 would be treated as errors. This is harmless against the current RGS, which returns 200.
- A failed `Play` resets `roundActive` to false, but a failed `EndRound` leaves it true. Retry `EndRound` before allowing another `Play`.
- The client logs its version to the console on creation. This is expected.

## Related skills

- `stake-web-sdk`: the official Svelte/Pixi web SDK and the full RGS HTTP contract (`references/rgs-api.md`).
- `stake-math-sdk` / `slot-engine`: generating the books whose events arrive in `round.state`.
