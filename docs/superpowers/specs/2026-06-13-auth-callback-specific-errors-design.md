# Specific auth-callback error codes (diagnostic + permanent fail-loudly improvement)

**Status:** APPROVED (team-lead, 2026-06-13). Triggered by a live probe: server-side OAuth exchange (the trusted-identity fix, `c10f392`) failed with the generic `server_exchange_failed`, which cannot distinguish an architecturally-fatal cause from a trivially-fixable one.

## Why

`src/routes/auth/callback/+page.server.ts` currently emits ONE error code (`server_exchange_failed`) for THREE distinct failures:
1. Entu exchange returned non-ok (`!res.ok`) — could be a **browser-IP-bound OAuth key** that the server (different egress IP) cannot exchange → would be **fatal to the server-exchange approach**.
2. Exchange ok but `accounts` lacks the db entry.
3. Anything in the `try` throws — including `signIdentity` (Web Crypto / `Buffer` in the CF runtime) → **fixable bug**.

Conflating (1) and (3) blocks the decision between *pivot the architecture* and *fix a bug*. CF Pages function logs aren't retained, so the redirect URL must carry the diagnosis itself. This also permanently upgrades the auth error surface — specific, actionable codes over one catch-all (the PO's fail-loudly directive: loud *and specific*).

## Change

In `+page.server.ts`, replace the single `server_exchange_failed` with distinct codes:

| Failure | Current | New |
|---|---|---|
| Exchange `!res.ok` | `server_exchange_failed` | `exchange_http_<status>` (e.g. `exchange_http_401`) |
| Exchange ok, no account for db | `server_exchange_failed` | `exchange_no_account` |
| Unexpected throw in try (signing, etc.) | `server_exchange_failed` | `identity_sign_failed` |

- The catch-all keeps re-throwing SvelteKit redirects (must not swallow them); only genuine errors map to `identity_sign_failed`. Include the error's name/message in the `console.error` (already present) — not in the URL (avoid leaking internals to the client).
- `<status>` is the numeric HTTP status from the Entu exchange response — safe to surface (it's our own upstream call's status, no secret).
- Login page (`/auth/login`): the `error` query is already rendered; these new codes flow through the existing surface. Optionally map them to friendlier strings, but the raw code in the URL is the diagnostic signal — keep it visible.

## Diagnostic outcome (the probe this unblocks)

On the next PO OAuth login, the redirect URL tells us precisely:
- `?error=exchange_http_401` → **Hypothesis A confirmed**: OAuth key is IP-bound to the browser; server cannot exchange it. The trusted-identity-at-issuance design is dead — pivot (challenge-ceremony or alternative trust model for slice-2b). NO further build on server-exchange.
- `?error=exchange_http_<other>` → exchange failing for a different reason (e.g. 400 malformed call) — fix the call.
- `?error=exchange_no_account` → exchange works, account-shape issue — fix parsing.
- `?error=identity_sign_failed` → **Hypothesis B confirmed**: exchange works; signing throws in CF runtime. Fix `identity-cookie.ts` (likely replace `Buffer` with pure Web-API base64url so it's runtime-agnostic), re-deploy, re-probe.

## Testing

Extend `callback-page-server.spec.ts`: the existing exchange-401 test asserts `error=exchange_http_401`; add a no-account test → `exchange_no_account`; a signing-throw test (mock `signIdentity` to throw) → `identity_sign_failed`; keep the missing-key (`missing_session_token`) and happy-path pins. Full-shape on the redirect location.

## Out of scope

The actual A-vs-B fix (depends on the probe outcome). Any login-page copy beyond surfacing the codes.

**Chain (single-tree):** spec+plan → main → `fix/auth-callback-error-codes` → Tallis RED → Josquin GREEN → Bentham → merge → preview deploy → PO one login to read the code.

(*MVOX:Palestrina*)
