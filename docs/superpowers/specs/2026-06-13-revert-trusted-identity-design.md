# Revert the trusted-identity stack — restore client-side login

**Status:** APPROVED (team-lead, 2026-06-13). The trusted-identity-at-issuance approach (server-side OAuth-key exchange) is **impossible by documented Entu design** — tokens are `aud=IP`-bound, so the server (CF egress IP) can't exchange a browser-issued key (`memory project_entu_jwt_ip_bound`, re-confirmed via 4 deploy cycles → anonymous-token `exchange_no_claim`). The formula-based conductor tally (Pérotin probe `ed7f8c1`, VIABLE) needs **no server identity at all**, so the entire stack is not just dead but unnecessary.

## What broke

The server-exchange callback (`c10f392` + follow-ups `99e4c9a`/`597b0b2`/`c0c0721`) **breaks preview login** — every OAuth sign-in fails at the server exchange. Prod (`mvox.eu`) was never deployed with it. This revert restores the proven client-side flow.

## Revert to known-good (`c10f392~1` = `7bf74aa`)

1. **`src/routes/auth/callback/+page.server.ts`** → restore verbatim to the `c10f392~1` version: read `key`, `missing_session_token` guard, `cookies.set(SESSION_COOKIE, key, ...)`, `return { sessionToken: key, db: PUBLIC_ENTU_DB }`. No server exchange, no identity cookie. (This is the CHORE-79 soft-gate behavior that worked.)
2. **`src/routes/auth/logout/+page.server.ts`** → remove the `cookies.delete('mvox_identity', …)` line (keep the `SESSION_COOKIE` delete).
3. **Delete** `src/lib/server/auth/identity-cookie.ts` + `src/lib/server/auth/identity-cookie.spec.ts`.
4. **`.env.example`** → remove the `MVOX_SESSION_SECRET` line.
5. **`src/tests/routes/auth/oauth/callback-page-server.spec.ts`** → restore to the `c10f392~1` version (client-flow assertions: key present → session cookie set + `{sessionToken, db}` returned; missing key → `missing_session_token`). Removes all exchange/error-code/token-claims tests.

## Not reverted (genuinely good, keep)

- **#89 stale-JWT cleanup** (`0d67bb7`) — independent, correct, stays.
- The CF `MVOX_SESSION_SECRET` Pages secret can be deleted later (low priority; harmless dormant).
- Superseded specs/plans (trusted-identity, error-codes, accounts-shape, token-claims) stay as historical record; mark this design as their closer.

## Verification

- Full suite + `pnpm check` + `pnpm build` green (identity-cookie tests gone; callback tests back to client-flow).
- `grep -rn "identity-cookie\|mvox_identity\|MVOX_SESSION_SECRET\|signIdentity" src/` → zero hits (no orphan references).
- PO re-login on preview after deploy → clean sign-in (client-side exchange, as before all this).

**Chain (single-tree):** spec+plan → main → `fix/revert-trusted-identity` → Tallis RED (restore known-good specs, delete identity spec) → Josquin GREEN (restore code, delete module, remove wiring) → Bentham (verify clean revert, no orphans) → merge → deploy → PO re-login.

(*MVOX:Palestrina*)
