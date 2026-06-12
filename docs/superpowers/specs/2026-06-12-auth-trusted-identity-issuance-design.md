# Auth fix — Trusted identity at issuance (slice-2b prerequisite)

**Status:** APPROVED (PO, 2026-06-12 session 32 — AskUserQuestion: "Fix issuance + probe on preview").
**Problem:** `mvox_session` is CLIENT-TAINTED (Finn audit 2026-06-12): the OAuth callback echoes the browser-supplied `?key=` into the cookie unverified. No server-side identity trust exists, blocking all elevated endpoints (rsvp-summary, invite resolve).

## 1. Design

At the OAuth callback, the **server itself** exchanges the key with Entu and mints a **server-trusted identity cookie**:

```
+page.server.ts load:
  1. key = url.searchParams.get('key')            (as today; missing → redirect as today)
  2. SERVER → Entu: GET {ENTU_API_BASE}/auth?db={PUBLIC_ENTU_DB}
       Authorization: Bearer {key}
     (server-to-Entu within this invocation — same-invocation IP pattern, probe-proven)
  3. On HTTP !ok OR accounts missing the db → FAIL LOUDLY:
       NO cookies set; redirect 303 /auth/login?error=server_exchange_failed
       console.error with status (CF logs)
  4. personId = accounts[PUBLIC_ENTU_DB] from the response (Entu-verified)
  5. Set TWO cookies:
       mvox_session  = key                          (unchanged — existing soft gate)
       mvox_identity = sign({personId, iat, exp})   (NEW — server-trusted)
  6. Return { sessionToken: key, db } (unchanged — client exchange proceeds as today)
```

## 2. `mvox_identity` cookie

- Payload: `{ personId: string, iat: number, exp: number }` (exp = iat + 48h, aligned with Entu JWT lifetime).
- Format: `base64url(JSON payload) + '.' + base64url(HMAC-SHA256(payloadB64, secret))`.
- **Web Crypto API only** (`crypto.subtle.importKey`/`sign`/`verify`) — CF Workers has no Node `crypto` (per the CF `process.env`/runtime trap, same family).
- Secret: `MVOX_SESSION_SECRET` via `$env/static/private`. Local dev: `.env` (+ `.env.example` line, placeholder value). Production: CF Pages secret (`wrangler pages secret put`).
- Attributes: `httpOnly: true`, `secure: !dev`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 48h`.
- Cleared at logout alongside `mvox_session`.

**Trust argument:** the personId inside was obtained by OUR server directly from Entu over server-to-Entu HTTPS; the HMAC means no client can mint or alter it; httpOnly means no script can read it. Forged `?key=` values now fail step 3 — the taint path is closed at the source.

New module `src/lib/server/auth/identity-cookie.ts`: `signIdentity(payload, secret)`, `verifyIdentity(cookieValue, secret, nowMs)` → `{ personId } | null` (null = absent/bad signature/expired; callers treat null as 401 — no soft path).

## 3. The single-use unknown — resolved empirically (the "probe on preview")

Unknown: whether Entu's OAuth `key` survives two `/auth` exchanges (server's at step 2, then the client's existing `exchangeSession()`).

The deploy IS the probe. Server exchange runs first (SSR load precedes client JS). Outcomes on PO's one OAuth login on preview:

| Server exchange | Client exchange | Meaning | Action |
|---|---|---|---|
| OK | OK | key multi-use within window | DONE — proceed to slice 2b endpoints |
| OK | 401 | key single-use | **STOP** — revert callback commit on preview, redesign (challenge-ceremony option studied, not built) |
| fail | — | wire/shape wrong | **STOP** — login blocked loudly, fix before anything else |

Both failure paths are loud by construction: step-3 redirect for server-side, and the existing client `exchangeSession` error surface for client-side. No fallback paths.

## 4. Out of scope

The elevated endpoints themselves (rsvp-summary, invite resolve) — next chain, after the probe login confirms. The `mvox_session` soft gate and hooks guard — untouched. i18n — the new failure surfaces as `?error=server_exchange_failed` through the login page's existing error rendering; no new user-facing strings.

## 5. Testing

- `identity-cookie.spec.ts`: sign→verify round-trip; tampered payload → null; tampered signature → null; expired → null; malformed → null.
- Callback `page.server.spec.ts` (extends existing): mocked Entu exchange OK → both cookies set, identity payload carries personId from mock response; exchange !ok → NO cookies + redirect with `error=server_exchange_failed`; accounts missing db → same loud failure; `key` missing → existing behavior unchanged.
- Logout spec: `mvox_identity` cleared.

**Chain note (single-tree protocol):** spec+plan to main first → `feat/auth-trusted-identity` → Tallis RED → Josquin GREEN (server-only: callback, new module, logout) → Bentham (security-critical files — thorough) → merge → preview deploy → PO login probe. No Comenius (no new strings), no Byrd (no UI).

(*MVOX:Palestrina*)
