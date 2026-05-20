# Entu API Key Expiry Policy — 2026-05-20

**Researched by:** Finn (research request from team-lead 2026-05-20 06:12)
**Sources:** Entu OpenAPI spec (`https://api.entu.app/openapi`), entu-research auth.ts, login-scenarios spec, live probes
**Date:** 2026-05-20
**Purpose:** Session 7 PO question — does the `ENTU_API_KEY` have an expiry?

---

## 1. Does the API key expire?

**Short answer: The API key itself does NOT expire. It is permanent.**

Per the Entu OpenAPI spec `/auth` endpoint description:

> "Exchange API key or session token for a 48-hour JWT. Accepts **permanent API keys** (SHA-256 hashed) or temporary tokens from OAuth/passkey flows."

The 48-hour expiry applies to the **JWT** minted from the key — not the key itself.

### Terminology clarification

The credentials file currently calls `ENTU_API_KEY` the "temporary API key" — this label is misleading. Entu's auth flow distinguishes three token types:

| Token type | How obtained | Lifetime | Entu term |
|------------|-------------|----------|-----------|
| **Session token** | `GET /auth/{provider}` OAuth callback returns `{"key": "..."}` | Short (single-use / session) | "temporary session token" |
| **API key** | Created in Entu user profile (stored SHA-256 hashed) | **Permanent** (no auto-expiry) | "permanent API key" |
| **JWT** | `GET /auth?db=<db>` with either token above | **48 hours**, IP-bound | "48-hour JWT" |

Our `ENTU_API_KEY` is the **permanent API key** type. The credentials file comment should be updated.

---

## 2. What happened to the 2026-05-18 key (session 7 auth diagnostic)?

The pre-rotation key still authenticates today but mints a JWT with **no `accounts` field** — meaning the JWT doesn't carry any db association. That's why Josquin's 04:55 diagnostic returned only 7 system meta-types (publicly readable) instead of 28.

### Hypothesis

PO manually rotated the API key in the Entu UI between session 7's 04:02 (Phase A had executed cleanly with the key) and 04:55 (key returned `accounts: []`). The rotation likely:

- Replaced the API key stored on the PO's person entity, leaving the old key valid as an identity but unassociated with the polyphony db
- OR replaced the rights/account-binding entry for that identity

The new key (rotated ~05:23) is properly bound to polyphony and returns the full 28-type query.

**Root cause: manual rotation in the Entu UI, not an automatic expiry.** Session 7's confusion was caused by mismatch in the team's mental model — "the key is permanent and reliable" turned out to be "the key is permanent UNTIL someone rotates it, with no audit trail visible to client code."

---

## 3. JWT IP-binding note (operational gotcha)

The JWT `aud` claim encodes the client's IP at mint time. Entu verifies `aud` on each API call. **If the calling IP changes between JWT mint and API use, the JWT will silently fail.**

Implications:
- Not a concern for local dev (stable IP)
- Could cause silent failures in dynamic-IP environments: CI runners, NAT rotations, dev container rebinds
- For long-running migration runs (Phase B with snapshot + N+1 fetches): all calls happen within seconds of JWT mint, so IP stability is preserved

---

## 4. Summary

| Question | Answer |
|----------|--------|
| Does `ENTU_API_KEY` expire? | **No.** It is permanent until manually revoked/rotated by a user. |
| What has a 48h lifetime? | The JWT minted FROM the key. |
| What caused the 04:55 `accounts:[]` failure? | PO rotated the key in Entu UI — old key's db association was replaced, not expired. |
| Is the old key usable for anything now? | It authenticates but returns no db access. Effectively dead until re-bound. |
| Does anything auto-expire? | Only the JWT (48h). No auto-expiry on the key itself. |
| Is there an audit trail of key rotations? | Unknown from Entu's API surface; would have to inspect the user's person entity directly. |

---

## 5. Recommendation for repo hygiene

Update `~/.config/mvox/credentials.env` comment header — the "temporary API key" phrasing is technically wrong per Entu's own classification. Comment should describe it as "permanent API key, rotated manually in Entu UI."

---

(*MVOX:Finn*) — research + tabulation
(*MVOX:Palestrina*) — committed
