# DRAFT — Entu auth & rights notes for BFF builders (upstream-bound)

> **Status:** LIVING DRAFT. Destined for one docs-oriented issue/PR on `entu/www` (same channel as PR #11/#13). Update as probes resolve. Do NOT file until §1 probe outcome lands.
> **Audience framing:** "What a BFF (backend-for-frontend) builder needs to know about Entu auth." mvox is the worked example; the lessons generalize.
> **Provenance:** derived from mvox session-32 probes + Finn audits (2026-06-12/13). Source findings: `cf-worker-jwt-binding-2026-06-12.md`, `member-tier-rights-visibility-2026-06-12.md`, the CLIENT-TAINTED callback audit.

---

## §1 — OAuth key reuse semantics  ⚠️ PROBE PENDING

**The question:** does the short-lived OAuth `key` (the `?key=<jwt>` Entu appends on the `/auth/<provider>?next=…` redirect back to the app) survive **more than one** exchange against `GET /auth?db=<db>`?

**Why it matters for BFFs:** a BFF that wants *server-verified* identity must exchange the key server-side. But the existing client-side SPA pattern *also* exchanges the key (to get the 48h JWT into localStorage). If the key is single-use, the two exchanges collide — the second 401s. A BFF builder needs to know this before designing the callback.

**mvox finding:** [PENDING — resolved by a single live OAuth login on preview build `da4deded`, server-exchange-then-client-exchange ordering]
- Outcome A (key multi-use within its validity window): document "the key may be exchanged N times until expiry" → server + client exchange can coexist.
- Outcome B (key single-use): document "the key is consumed on first exchange" → BFFs must choose ONE exchange site; cannot run both.

**Requested doc change:** add explicit reuse semantics + validity window to the auth-flow docs. Currently undocumented; we had to probe it empirically.

---

## §2 — Entu JWTs are HS256 (symmetric) → third parties cannot verify them

**Finding (probed 2026-06-12):** the JWT minted by `GET /auth?db=<db>` carries `{"alg":"HS256"}`. HS256 is symmetric — the signing secret is held by Entu alone. A third-party service holding the JWT **cannot verify its signature** (no public key to check against).

**BFF implication:** you cannot treat an Entu JWT as a self-validating bearer of identity. To trust the identity in a JWT/key, you must **round-trip to Entu** (`GET /auth?db=`) and read the verified `accounts`/`user` from the response. Decoding the JWT payload locally (e.g. reading `exp` or a person id) is a *soft* signal only — forgeable, since anyone can mint an HS256-shaped token without the secret.

**Worked consequence (mvox):** our OAuth callback originally wrote the browser-supplied key straight into a cookie and trusted its decoded claims — a spoofing hole (any forged `exp`+identity passes a decode-only check). Fix required a server-side exchange so identity comes from Entu's verified response, not the token's self-asserted payload. *(This was our implementation bug, not an Entu bug — included only to illustrate the trap the symmetric-JWT property sets for the unwary.)*

**Requested doc change:** a short "verifying identity" note: Entu JWTs are HS256; verify by exchange, never by local signature check; treat decoded claims as untrusted until exchanged.

**Related, already filed:** JWT IP-binding (`aud` = caller IP) — see existing memory/docs; same "JWTs aren't portable bearer tokens" theme. Cross-link in the upstream issue.

---

## §3 — Rights properties invisible below owner tier, even on `public` entities

**Finding (probed 2026-06-12, member-tier credential):** `GET /entity/<id>?props=_editor,_viewer,_owner` on a `_sharing: public` season returns **HTTP 200 with only `_id`** when the caller is below owner tier — the rights-property values are silently stripped. The owner sees the full grant list; a member sees nothing (not a 403 — a 200 with the props absent).

**BFF implication:** a BFF running under a normal user's rights **cannot enumerate** who holds `_editor`/`_owner` on an entity, even a public one. Any feature that needs "who are the conductors/admins of X" must run as an elevated/owner-tier identity — it cannot be derived from a member-tier read. (For mvox this killed a "grant-at-write" design and forced an elevated read-only report instead.)

**Requested doc change:** note in the rights/sharing docs that rights-property *visibility* is itself owner-gated and orthogonal to entity `_sharing` — `public` controls the entity's data, not its rights metadata. The 200-with-stripped-props (vs 403) behavior is surprising and worth stating explicitly.

---

## Filing plan

- **One issue/PR on `entu/www`** bundling §2 + §3 (both settled) once §1 resolves; fold §1 in with its resolved outcome.
- Keep the "BFF builder" framing — it's the same audience as PR #11.
- Cross-link the IP-binding finding and the existing 9-issue docs batch.

(*MVOX:Palestrina*)
