# CF Worker IP-bound JWT: same-invocation mint+use probe

**Date:** 2026-06-12  
**Probe branch:** `chore/probe-cf-jwt-binding`  
**Probe file:** `scripts/migrations/probes/probe-cf-jwt-binding/worker-src.js`  
**Platform:** CF Pages Functions (Workers runtime, identical egress behaviour to CF Workers)  
**Authorised by:** team-lead 2026-06-12 (PO approved, session 32)

---

## Background

Entu JWTs carry an `aud` claim equal to the caller's IP address at mint time. A JWT minted from one IP fails with HTTP 401 when used from a different IP (memory `project_entu_jwt_ip_bound`).

mvox's MVP elevated BFF ops (rsvp-summary report, invite-token resolve — spec §6) require the CF Worker to:

1. Exchange the org service API key for an Entu JWT
2. Immediately use that JWT for the privileged Entu query

**Hypothesis:** if both calls happen within the same CF Worker invocation, they share the same egress IP, so the JWT is valid for call 2.

---

## Probe design

The scratch Pages project (`probe-jwt-binding`, deleted post-probe) exposed a single endpoint in two modes:

- **Same-invocation mode** (`GET /`): Worker mints a fresh JWT from `ENTU_API_KEY` secret, then immediately issues `GET /polyphony/entity?_type.string=season&props=_id&limit=1` with that JWT — all within one `fetch()` handler.
- **Stale-JWT mode** (`GET /?stale=1`): Worker receives a JWT minted externally (from this machine) via `X-Stale-Token` header and uses it — demonstrating the cross-IP failure case.

---

## Results

### Same-invocation mode — 7 invocations

| Call | mintOk | useOk | useStatus | mintLatencyMs | useLatencyMs | timestamp (UTC) |
|------|--------|-------|-----------|---------------|--------------|-----------------|
| 1 | true | true | 200 | 66 | 149 | 05:51:32 |
| 2 | true | true | 200 | 319 | 83 | 05:51:37 |
| 3 | true | true | 200 | 90 | 78 | 05:51:41 |
| 4 | true | true | 200 | 70 | 80 | 05:51:46 |
| 5 | true | true | 200 | 32 | 79 | 05:51:50 |
| 6 | true | true | 200 | 36 | 92 | 05:51:54 |
| 7 | true | true | 200 | 88 | 83 | 05:51:58 |

**7/7 invocations: mintOk=true, useOk=true, useStatus=200.**

### Stale-JWT contrast — 1 invocation

JWT minted from the dev machine (different IP from CF egress), passed to the Worker via `X-Stale-Token`:

| useOk | useStatus | useLatencyMs |
|-------|-----------|--------------|
| false | 401 | 183 |

**Cross-IP 401 confirmed** — the same JWT that would work on the minting machine fails immediately when used from CF egress.

---

## Verdict

**Hypothesis CONFIRMED. Same-invocation mint+use works reliably (7/7 invocations).**

The cross-IP failure is real (1/1 stale-JWT contrast → 401), which validates the IP-binding constraint. The mitigation — exchanging the API key and using the JWT within the same Worker invocation — is sufficient and reliable.

---

## Latency observations

| Stat | mintLatencyMs | useLatencyMs |
|------|---------------|--------------|
| min | 32 | 78 |
| max | 319 | 149 |
| median | 88 | 83 |

Call 2's mint was 319 ms (cold-start / new colo). Calls 3–7 ranged 32–90 ms (warm). The use-call latency was stable at 78–149 ms across all invocations.

**Per-elevated-request overhead:** roughly 70–90 ms for the `/auth` exchange on a warm invocation. For the two elevated ops in MVP (rsvp-summary + invite-token resolve), this is a one-time cost at the start of the BFF handler — not per-entity, so the overhead is acceptable.

**Caching note:** the JWT could be cached within a single Worker invocation (already the case — one mint per request). Cross-invocation JWT caching (e.g., via KV or Durable Object) is NOT safe given the IP-binding, and is outside the MVP scope. Each invocation that needs elevated access mints a fresh JWT.

---

## Implications for elevated-op design

1. **Design is sound.** The elevated BFF ops described in spec §6 can be implemented as: `const jwt = await mintJwt(env.ENTU_API_KEY); const result = await elevatedQuery(jwt, ...);` — both calls in the same `fetch()` handler body.
2. **No cross-invocation JWT sharing.** Do not store the minted JWT in KV, cache, or any cross-invocation store. Its `aud` is bound to the colo's egress IP at mint time; CF may route a later request through a different colo.
3. **Token in Worker secret only.** `ENTU_API_KEY` must live as a CF Pages/Worker secret, never in `vars` or source. This probe used `wrangler pages secret put`; production uses the same mechanism.
4. **Cold-start budget.** The first invocation after a cold start may spend ~300 ms on the mint. For a user-facing request chain that goes `CF Worker → /auth → Entu query`, budget ~400 ms on cold start, ~170 ms warm. Both are acceptable for the MVP RSVP-summary and invite-token-resolve endpoints.
5. **Slices 2–3 are unblocked.** This was the gating probe for the elevated ops prerequisite (spec §6). Proceed to slice 1 spec → slice 2 TDD chain.

---

(*MVOX:Perotin*)
