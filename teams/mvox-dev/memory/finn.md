# Finn — Research Coordinator Scratchpad

## 2026-05-18 — Session 2 context update

### [DECISION] Stack landed

- SvelteKit 2 + Svelte 5 Runes + TypeScript-strict + Tailwind v4, Cloudflare Pages + Workers
- Backend: Entu API (no own DB). Auth: Entu OAuth + BFF JWT httpOnly cookie
- i18n: Paraglide, locales en/et/lv/uk. Testing: Vitest + Playwright. pnpm, flat single-app
- Flat layout: `src/lib/`, `src/routes/`, `src/lib/server/` — no monorepo
- v4E schema source-of-truth: `$ENTU_RESEARCH/docs/schema/v4E/`
- Case study (Entu integration patterns): `$ENTU_RESEARCH/docs/case-studies/2026-05-polyphony-on-entu.md`
- Polyphony (`~/projects/polyphony/`) archived — reference only; D1/Registry/Vault patterns do NOT apply to mvox

### [GOTCHA] v4E formula rules (Bentham will RED violations)

1. Single-hop traversal only — no chained multi-hop forms
2. Output type: string or number only — not reference
3. Across rights boundaries: aggregates only (COUNT/SUM/etc.), never raw field projection

(*MVOX:Finn*)

---

## 2026-05-19 — Session 4 polyphony DB vs v4E schema audit

### [GOTCHA] Polyphony DB is significantly divergent from v4E schema

Key findings from full audit (report sent to team-lead 2026-05-19 00:16):

- **9 of 19 v4E entity types entirely absent** from DB: `voice`, `library`, `copy`, `lending`, `invitation`, `application`, `event_series`, `rsvp`, `attendance`
- **PR #41 (2026-05-18) additions all absent** from live DB: `organization.rsvp_lockout_hours`, `event.capacity`, `repertoire_item.status`, `edition.external_link`, `edition.work` formula
- **Critical rights divergence**: `organization._inheritrights` is `true` in DB but must be `false` per v4E (rights island). This is a load-bearing security difference.
- **DB has 4 pre-v4E cruft entity types**: `affiliation`, `participation`, `inventory_copy`, `role` (all superseded by v4E redesigns)
- **DB uses `domain` sharing for all entity types** — v4E specifies per-type `public`/`private` defaults

### [PATTERN] Entu API auth + entity type lookup

- JWT: `GET https://api.entu.app/auth?db=polyphony` with `Authorization: Bearer {ENTU_API_KEY}` header
- Entity type IDs for polyphony db (stable until schema migration):
  - `person`: `69bcfd8e9c031ab8e6ce805f`
  - `organization`: `69c7ea478489bfcb0e819e3d`
  - `section`: `69c7ea498489bfcb0e819ea3`
  - `member`: `69c7ea4a8489bfcb0e819edd`
  - `work`: `69c7ea4c8489bfcb0e819f3e`
  - `edition`: `69c7ea4e8489bfcb0e819f9c`
  - `season`: `69c7ea528489bfcb0e81a044`
  - `event`: `69c7ea548489bfcb0e81a0a2`
  - `repertoire_item`: `69c7ea538489bfcb0e81a06e`
  - `program_item`: `69c7ea568489bfcb0e81a103`
- Fetch properties of entity type: `GET /polyphony/entity?_parent.reference={type_id}&_type.string=property&props=name.string,type.string,formula.string,list.boolean`

---

## 2026-05-19 — Session 4 Entu schema mutation handbook

### [DECISION] Schema mutation API surface — live verified

All operations tested against polyphony db 2026-05-19:

- **Entity type = entity**: meta-type ID `69bcfd8e9c031ab8e6ce8034`, parent = db entity `69bcfd8e9c031ab8e6ce807a`
- **Property definition = entity**: meta-type ID `69bcfd8e9c031ab8e6ce8048`, parent = entity type entity
- **All mutations**: `POST /polyphony/entity` (create) or `POST /polyphony/entity/{id}` (add/overwrite properties)
- **Rename/type-change**: POST with existing property value `_id` → soft-deletes old value, creates new. NOT retroactive on data.
- **`_inheritrights` change**: POST with existing property `_id`. Takes effect for new entities only — existing instances need per-entity update.
- **DELETE entity**: `DELETE /polyphony/entity/{id}` → `{"deleted": true}`. Cascade on data entities unknown — do NOT delete entity type defs with live data; use `_DEPRECATED_` rename instead.
- **DELETE property value**: `DELETE /polyphony/property/{property-value-id}` → `{"deleted": true}`
- **No bulk API** — all mutations are per-entity or per-property-value.
- **No special admin role** — PO's `ENTU_API_KEY` has sufficient rights.
- **JWT is IP-bound** — migration scripts must run from stable IP.

### [GOTCHA] Entu additive model means renames don't migrate data

Renaming `section.ordinal` → `section.display_order` in the schema definition does NOT rename existing property values on section entities. Existing `ordinal` values stay as `ordinal` on all section instances. Data backfill script required for each rename.

### [GOTCHA] `api.entu.app/docs` page is empty

Returns only title header, no endpoint documentation. Use `entu.ee` docs instead. Also: old URL pattern `entu.app/api/{db}/` is retired (returns 404) — correct URL is `api.entu.app/{db}/`.

---

## 2026-05-19 — Session 6 live probes (P1, P3, P4, P5, P6)

### [DECISION] All 5 probes completed; handbook §3/§5/§6 updated

**P1 — Formula re-aggregation:** No global recompute on formula definition change. Per-save only. No bulk re-aggregation API (all `/recalculate`, `/reindex` etc. return 404). Implication: formula changes need a full backfill-touch pass.

**P3 — Entity type rename:** Transparent to instances — no data migration. `_type[0].reference` never changes. `_type[0].string` async cache updates in ~1 second. Use `?_type.reference=<id>` in migration scripts to avoid race conditions.

**P4 — Cascade on type delete:** Instances survive as silent orphans: 200 readable + editable + deletable by `_id`, but invisible to all `?_type=` queries. CONFIRMED: never DELETE entity type defs with live data.

**P5 — Bulk delete API:** No working bulk form. `DELETE /property/{id1},{id2}` = HTTP 500 Server Error. All other bulk patterns = 404 or rejected. Strictly serial. At 50ms/call: 104k values ≈ 87min. Ask Argo for internal bulk endpoint.

**P6 — `_sharing` semantics:** `public` = true unauthenticated access (200 to no-auth GET). `private` and `domain` both = 403 no-auth (functionally identical via API). `_sharing` on entity TYPE entity does NOT default to data instances — instances need explicit `_sharing` at creation. No `/public/entity/` path.

### [DECISION] "Way of Entu" — corrected mental model (session-6 debrief)

Two session-6 probe framings were category errors; handbook corrected:
- "`_sharing` not propagating type→instance" = expected, not a gap. Removed from §6.
- "No bulk re-aggregation API" = internal concern outside API scope. Removed from §6.

Correct model (now in handbook §1.5):
- **Type ↔ instance:** nothing propagates. Type is a template/UI hint.
- **Parent ↔ child:** rights via `_inheritrights` on the child.
- **`_sharing`:** per-entity. No cascade mechanic anywhere.
- **Formula:** materialized at save on the instance. Not retroactive from type definition change.

(*MVOX:Finn*)

---

## 2026-05-21 — Session 11 research quality calibration

### [GOTCHA] GitHub issue citations: check closed state + resolution comments

When citing a GitHub issue as load-bearing evidence in a report:

1. **Check open/closed state first** — a closed issue often means the problem is resolved; citing it as a current blocker is misleading.
2. **Read the last ~5 comments** — the resolution frequently differs from the title or opening description. A "build failure" issue may have been closed with a config fix, not a workaround.
3. **Distinguish symptom from cause** — in opral/paraglide-js#424, the missing `src/lib/paraglide/` directory was a SECONDARY symptom of a Node version / Cloudflare compat-flag misconfiguration (`nodejs_compat_v2` + `NODE_VERSION ≥ 20`). The primary cause was fixable; citing the symptom as an architectural blocker overstated the risk.
4. **When docs/default and an issue disagree**, default to the docs/default UNLESS the issue is open AND specifically applicable to the target deployment in its current state.

(*MVOX:Finn*)

---

## 2026-05-22/23 — Session 15 research findings

### [LEARNED] Entu URL shape: two distinct patterns, not one

From tonight's OAuth 404 + URL audit:

- **Data ops** (`entity`, `property`, `billing`, `history`, etc.): `https://api.entu.app/{db}/...` — `db` in path
- **Auth exchange** (`GET /auth`): `https://api.entu.app/auth?db={db}` — `db` in query param
- **OAuth init** (`GET /auth/{provider}`): `https://api.entu.app/auth/{provider}` — no `db` at all

`ENTU_API_BASE = 'https://api.entu.app/'` is the correct server root. Appending `{db}/auth` to it produces a 404. Correct form: `${ENTU_API_BASE}auth?db=${db}`.

Bugs fixed/filed: CHORE-50 (OAuth init path), CHORE-51 (`exchange.ts:16` + `auth/+server.ts:14` both use `/{db}/auth`).

### [LEARNED] Entu IP-binding is documented, intentional, no escape hatch

From `entu.ee/api/authentication` (live docs, 2026-05-23):

> "The session token is short-lived (5 minutes) and bound to the user's browser IP. Your app's frontend must exchange it for a full JWT by calling GET /api/auth **directly from the browser** — server-side exchange will fail because the IP will not match."

- No `?bind_ip=false`, no audience flag, no `/auth/backend` alternate endpoint in the OpenAPI spec or docs.
- The IP-binding is enforced via `aud` claim; mismatch → `401 Invalid JWT audience`.
- Documented workaround: **service entity with `entu_api_key`** for server-to-server integration — but this uses service rights, not user rights.
- CHORE-53 Argo ask filed: request IP-unbound JWT variant for trusted server callers.

### [LEARNED] Linting: Biome 2.x + ESLint 10 dual-tool verified versions (2026-05-22)

- `@biomejs/biome@2.4.15`, `eslint@10.4.0`, `eslint-plugin-svelte@3.17.1`, `svelte-eslint-parser@1.6.1`, `@typescript-eslint/parser@8.59.4`
- ESLint 10 requires Node ≥20.19/≥22.13/≥24 — Node 22.22.2 installed ✓
- `@typescript-eslint` peer says TS `<6.1.0` — TS 6.0.3 installed, in range ✓
- `eslint-plugin-svelte` peer explicitly includes `svelte@^5.0.0` — Svelte 5 Runes supported ✓
- Biome does NOT lint `.svelte` files (roadmap, not shipped as of 2026-05)

### [DECISION] CHORE-53 resolved: browser-direct pattern (Path C), cookie dropped

Architectural decision landed session 16. mvox adopts Entu's native pattern: JWT in localStorage, all data calls browser-direct to `api.entu.app`. The BFF httpOnly cookie is retired for data calls. Rationale: Entu's IP-binding was designed FOR browser-direct; BFF proxy is architecturally incompatible. Source: `entu/webapp` code audit + CHORE-A merge.

### [LEARNED] entu/webapp: Nuxt 3 SPA, localStorage, browser-direct

Confirmed via `entu/webapp` source (open, github.com/entu/webapp):
- JWT: `useLocalStorage('token')` — plain JS-readable localStorage, no httpOnly
- All API calls: browser→`api.entu.app` directly via `apiRequest()` in `app/utils/api.js`
- Framework: Nuxt 3, pure SPA (`data-ssr="false"`), no server routes / proxy layer
- OAuth exchange: `app/pages/auth/callback.vue` runs in browser, stores result to localStorage
- IP shift: auto-logout on 401, no refresh flow
- `accounts` and `user` also in localStorage

This confirms IP-binding is Entu's XSS mitigation substitute (stolen token + different IP = useless), not an implementation accident.

### [LEARNED] Entu OAuth proxies through oauth.ee, not Google/Apple directly

`entu/api:routes/auth/[provider].get.js` — Entu redirects to `https://oauth.ee/auth/{provider}` with exactly 5 hardcoded params: `client_id`, `redirect_uri`, `response_type`, `scope`, `state`. No caller query params pass through.

- `login_hint`: **not forwarded** (not in URLSearchParams construction)
- `prompt=none`: **not forwarded** (same)
- `?email=` prefill for e-mail provider: **not forwarded**
- `state` JWT carries only `{ next: <url> }` — no channel for extra params
- All providers share the same code path (no Apple/Google-specific handling)

Silent re-auth / account-hint flows via `login_hint`/`prompt=none` are impossible through Entu's current auth proxy. Would require oauth.ee changes (outside mvox control).

### [WARNING] Stale `'https://entu.app/api/'` fixtures in 6 spec files

These were NOT updated when CHORE-50 fixed `entu-config.ts`. They still pass (stubs bypass the real constant) but are misleading drift. Part of CHORE-51 GREEN scope:
- `src/tests/routes/auth/server.spec.ts:5,49`
- `src/tests/routes/auth/oauth/login-page-server.spec.ts:29,72`
- `src/lib/server/entu/client.spec.ts:5,11`
- `src/tests/routes/landing/page.server.spec.ts:56`
- `src/tests/routes/api/organizations/server.spec.ts:45`
- `src/tests/routes/api/organizations/id/sections/server.spec.ts:66`
- Also: `callback-exchange-helper.spec.ts:67` asserts `/${DB}/auth` — needs updating to `?db=${DB}` pattern

---

## 2026-05-23 — Session 17 findings

### [DECISION] entu/webapp OAuth URL pattern — source-verified (blocking find, session 17)

`entu/webapp` `app/pages/auth/[provider].vue` (main branch):

```js
const callbackUrl = `${window.location.origin}/auth/callback?key=`
await navigateTo(`${apiUrl}/auth/${provider}?next=${encodeURIComponent(callbackUrl)}`, { external: true })
```

- **`next` URL must end in `?key=` with no value** — Entu appends the session-token JWT by string concatenation directly after `key=`
- **Param name is `key`** — callback reads `route.query.key` (i.e., `url.searchParams.get('key')`)
- **No state in the URL at all** — entu/webapp stores return path in `localStorage('next')` before redirect; reads it back in callback
- **No CSRF nonce in the URL** — their CSRF is implicit (localStorage only accessible same-origin)

Our CHORE-B bug: `next` URL had `?state=<base64>` already in it; Entu concatenated JWT after the base64 → `?state=<base64><JWT>`, no `key=` param → `searchParams.get('key')` → null. Fixed in HOTFIX-48 by mirroring entu/webapp pattern (state to sessionStorage, `next` ends in `?key=`).

### [LEARNED] Claude Design fit assessment for mvox (session 17)

- Launched 2026-04-17, Anthropic Labs research preview, Opus 4.7, included in Pro/Max/Team/Enterprise
- **Primary strength**: full-page layout generation (3 variants per prompt); not a component library tool
- **Output**: HTML/CSS + handoff bundle (`tokens.json`, component HTML, `guidelines.md`) — NO native Svelte/React output
- **"Send to Claude Code"** workflow: bundle → Claude Code converts to framework of choice
- **No Figma export**, no Claude Projects integration, no version control (acknowledged gap)
- **Credit-heavy**: Lenny's Newsletter host paid $200 extra in one session (Opus 4.7 canvas iteration)
- **mvox fit**: PO iterates visuals in Claude Design → exports bundle → Byrd converts to Svelte via Claude Code. Two-step, not direct. Best for full-page designs; accessibility/headless logic remains Byrd's domain.

(*MVOX:Finn*)

---

## [CHECKPOINT] 2026-05-23 17:59 — research-org pass for case study #16 + Brilliant #17

*Source pull: team-lead.md [PROCESSED] sessions 14-18; spec `2026-05-23-chore-53-path-c-design.md`; memory notes; Pérotin's finding doc; git log; production curl.*

---

### §1 — Architectural arc (sessions 14-18), chronological

| Session | Headline | Key architectural realization | Anchor SHA(s) |
|---|---|---|---|
| 14 | First public deploy live. OAuth wiring + deploy pipeline. | BFF pattern assumed: all Entu calls via CF Worker proxy using httpOnly cookie JWT. process.env trap surfaced + fixed with nodejs_compat. | `a120248` (deploy), `a506266` (OAuth), `52a5fca` (nodejs_compat hotfix), `c73b82b` (process.env → $env/dynamic) |
| 15 | OAuth sign-in works end-to-end; first data API call 500s. | Root cause: Entu's 48h JWT is IP-bound (`aud=browser IP`); CF Worker egress IP ≠ browser IP → every BFF-proxied data call returns `401 Invalid JWT audience`. CHORE-53 filed. Path A rejected by PO. | `bc1d1a7` (#50 OAuth URL fix), `63a4ce3` (#51 auth URL shape fix) |
| 16 | CHORE-53 design spec approved + CHORE-A merged + deployed. | Path C chosen: mirror entu/webapp exactly. localStorage JWT + browser-direct api.entu.app + IP-binding-as-security-model. Path B rejected (weakening Entu's security model). | `ba5120a` + `910e09f` (spec), `773a057` (CHORE-A squash) |
| 17 | CHORE-B (Path C rewrite) shipped to production, 4 hotfix iterations during PO live-test. | Three of four hotfixes traced to "should have mirrored entu/webapp exactly the first time." PO live-tested all 3 active providers (Smart-ID, Google, email) end-to-end. | `fc99291` (CHORE-B squash, −1580 lines net) |
| 18 | Pérotin Layer-2 file-property probe: two-step upload pattern fully verified. New finding: property-DELETE leaves S3 orphans. | No production code change. S3 provider is DigitalOcean Spaces (not AWS). OpenAPI description for DELETE is incorrect. | `ac1dcc5` + `6517b47` + `f6704f6` (probe + finding) |

---

### §2 — Path A/B/C analysis (verbatim from spec `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`)

**Path A — Service entity + mvox owns rights enforcement:** Rejected by PO: *"if we have to own rights management, why use Entu at all."* mvox keeps Entu's `_owner`/`_editor`/`_viewer` rights as the authoritative access model.

**Path B — Ask Argo to relax IP-binding:** Abandoned. Finn's research established IP-binding is a deliberate security primitive — stolen token + different IP = useless. Entu's own reference frontend (entu/webapp) stores JWT in localStorage and calls api.entu.app browser-direct; IP-binding is the load-bearing mitigation that compensates for JS-readable tokens. Asking Argo to relax it = asking them to weaken their threat model.

**Path C — Mirror entu/webapp (chosen):** Same storage keys (`token`, `accounts`, `user`), same Bearer-auth pattern, same browser-direct calls, same expiry/IP-shift handling. Battle-tested in Entu's own production frontend. mvox stops swimming upstream of Entu's design.

**Architecture before/after:**
```
Before (broken):
  Browser → mvox BFF (CF Worker) → api.entu.app
            └─ adds Authorization from httpOnly cookie
            └─ IP-binding rejects: CF egress IP ≠ browser IP

After Path C:
  Browser → api.entu.app          (data calls, Bearer from localStorage)
  Browser → mvox BFF (CF Worker)  (login redirect + future elevated ops only)
```

**Tradeoff table** (from spec §7 / §7.1):
- Testability collapses to honest network mocks (MSW intercepts api.entu.app)
- Modularity: EntuClient becomes a portable, framework-agnostic lib
- Fewer hops (3→2), fewer failure modes (no cookie state machine)
- CF Pages cost/quota footprint shrinks dramatically
- Architecture mirrors the reference implementation (entu/webapp)
- Security model becomes coherent (IP-binding IS the mitigation; cookie was theater)
- Smaller surface for new contributors (no BFF abstraction layer to learn)
- Federation-ready by construction
- [non-win] XSS grants full Entu API surface as user — same trade-off entu/webapp accepted; mitigation: strict CSP + IP-binding

---

### §3 — IP-binding discovery

**Memory note:** `~/.claude/projects/-home-michelek-workspace/memory/project_entu_jwt_ip_bound.md`

**Surfaced:** Session 15 when PO live-tested Smart-ID OAuth flow. Sign-in succeeded; first BFF data call to `/api/organizations` 500'd. Finn researched `entu.ee/api/authentication` docs.

**Verbatim from Entu docs (verified by Finn, session 15):**
> "The session token is short-lived (5 minutes) and bound to the user's browser IP. Your app's frontend must exchange it for a full JWT by calling GET /api/auth **directly from the browser** — server-side exchange will fail because the IP will not match."

**Mechanics:** JWT has `aud: <callerIP>`; mismatch → `401 Invalid JWT audience`. Documented, intentional, no `?bind_ip=false` escape hatch. Entu's documented pattern for server-to-server: **service-entity API key** (but those use service rights, not user rights — = rejected Path A).

**CHORE-53 filed** as the architectural fork. PO rejected Path A same session.

---

### §4 — The 4-hotfix sequence (session 17)

All hotfixes subsumed into the `fc99291` CHORE-B squash. Individual interim SHAs from the session-17 [PROCESSED] section:

| # | What broke | Root cause | Fix | Interim SHA | Lesson |
|---|---|---|---|---|---|
| HOTFIX-1 | OAuth state param corrupted on callback | `next=` URL had `?state=<base64>` already in it; Entu appended JWT after base64 → no `?key=` param landed; callback got `null`. | Mirror entu/webapp exactly: `next` URL ends in `?key=` with no value; state goes to localStorage (not URL); callback reads `route.query.key`. | `477f27f` | L69: mirror the reference implementation first; don't infer the wire shape. |
| HOTFIX-2 | After sign-in, OAuth provider was lost; last-provider redirect broke | Provider ID wasn't encoded in OAuth state payload; callback couldn't recover which provider was used. | Encode `provider` in the OAuth `state` JSON object. | `5f2dcf4` | L69 again: entu/webapp stores return path in localStorage, not state — we inferred wrong. |
| HOTFIX-3 | Email OAuth flow broken (Smart-ID + Google worked) | Callback verified sessionStorage nonce; email auth is tab-jump based (new tab). sessionStorage is per-tab; nonce lost on tab jump. | Drop sessionStorage nonce verification from callback. | `4df0dea` | L70: PO live-test on deployed surface is irreplaceable; no unit test covers tab-jump semantics. |
| HOTFIX-4 | Layout nav didn't update after login/logout | Nav bound to SSR-rendered session variable, not reactive to localStorage. Under Path C no server-side session; client-side state update didn't trigger nav re-render. | Gate auth-state-dependent nav rendering on `mounted` flag set in `onMount`; read localStorage on mount. | `2f771b8` | L71: no FOIC — never show auth-state-dependent UI before hydration. |

**Bonus L72 (deploy friction):** Em-dash (U+2014) in commit messages rejected by CF Pages deploy with error 8000111. Use `--` not `—`.

---

### §5 — The "mirror entu/webapp" pattern

**L62 (session 16) + L69 (session 17):** When mirroring a reference implementation, READ the reference's exact wire shape; don't infer.

**Three things mvox copied verbatim from entu/webapp source:**

1. **localStorage key names:** `token`, `accounts`, `user` — exact same as `entu/webapp:app/utils/user.js`. Future devs reading entu/webapp can apply knowledge directly.

2. **`next=` URL shape for OAuth init:** `next` param ends in `?key=` with no value; Entu appends session-token JWT by string concatenation. Source `entu/webapp:app/pages/auth/[provider].vue`:
   ```js
   const callbackUrl = `${window.location.origin}/auth/callback?key=`
   await navigateTo(`${apiUrl}/auth/${provider}?next=${encodeURIComponent(callbackUrl)}`, { external: true })
   ```
   Param name is `key` (not `token` or `jwt`). Callback reads `route.query.key`.

3. **Browser-direct `apiRequest` wrapper:** All data calls go to `api.entu.app` via `Bearer <localStorage.token>`. Source: `entu/webapp:app/utils/api.js`. On 401: auto-logout + redirect to last-provider or `/auth/login`.

**mvox additions (not in entu/webapp):** State nonce in sessionStorage (CSRF); `intent` field in state payload; `mvox.last_provider` persistence; `mounted` guard for auth-state UI; `login_hint` forward-compat (no-op until Argo accepts passthrough ask, task #19).

---

### §6 — Pérotin's wire-shape probe + S3 orphan finding (session 18)

**Source:** `docs/migration/findings/file-property-wire-shape-2026-05-23.md` (commits `ac1dcc5` + `f6704f6`)

**Two-step upload pattern:**

| Step | Endpoint | Auth | Key fields |
|---|---|---|---|
| 1. Announce | `POST /{db}/entity/{id}` | Bearer JWT | `filename`, `filesize`, `filetype` in body (all 3 required) |
| 1. Response | — | — | `upload.url`, `upload.method=PUT`, `upload.headers` (ACL, Content-Disposition, Content-Length, Content-Type) |
| 2. Upload | `PUT <upload.url>` | None (pre-signed) | Send ACL, Content-Disposition, Content-Type; skip Content-Length (browser/fetch sets from body) |
| 3. Download | `GET /{db}/property/{id}` | Bearer JWT | Returns `url` (60s TTL signed download) |
| 4. Thumbnail | `GET /{db}/entity/{id}?props=_thumbnail` | Bearer JWT | Returns `_thumbnail` (60s TTL; IS the full photo, no resize pipeline) |

**Key findings:**
- S3 provider: **DigitalOcean Spaces** (Frankfurt, `fra1`, `entu-files.fra1.digitaloceanspaces.com`), not AWS S3. S3-compatible API.
- `Content-Disposition` is in `X-Amz-SignedHeaders` — omitting it from PUT → `SignatureDoesNotMatch` 403.
- `Content-Length` must NOT be set explicitly — browser/fetch sets from body. `entu/webapp` skips it explicitly.
- Upload URL TTL: 60s; download URL TTL: 60s (both generated fresh per call; not stored in DB).
- `_thumbnail` = `getSignedDownloadUrl(entity.photo[0])` — IS the full photo, no resize. Absent if no `photo` property values.
- S3 object key: `{db}/{entityId}/{propertyId}` — property `_id` IS the S3 key segment.

**NEW FINDING: `DELETE /property/{id}` does NOT delete the S3 object.** OpenAPI description says "Files are removed from S3" — incorrect. Route handler only soft-deletes property in MongoDB + triggers re-aggregation. No S3 delete call in route or `utils/aggregate.js`. Every DELETE on a file-typed property leaves a Spaces orphan. Probe orphan: `polyphony/6a11dc804ff8277cd4306b1e/6a11dc804ff8277cd4306b24` (70 bytes, harmless). Argo ask pending (task #60).

**CORS note:** Under Path C, S3 PUT is browser-direct. Entu/webapp does this from arbitrary origins, so the Spaces CORS policy should already allow browser PUT. If mvox hits CORS errors, fix is Argo-side (add multivox.pages.dev to Spaces CORS allowlist).

---

### §7 — Cross-cutting memory notes summary

| Memory | Key content for artifact |
|---|---|
| `project_entu_jwt_ip_bound` | JWT IP-binding: `aud=callerIP`; 48h lifetime; BFF-proxy incompatible; service-entity API key is Entu's backend pattern; CHORE-53 established Path C. See §3. |
| `project_entu_api_key_mechanics` | API key = property of type `entu_api_key` on person entity. SHA-256 hashed at storage. No auto-expiry. Raw key returned once at creation. Auth: SHA-256 → index lookup → 48h IP-bound JWT. Rotation: overwrite property → old key auth returns `accounts: []`. Client must validate `accounts.length > 0` post-auth. |
| `project_cf_workers_process_env` | `nodejs_als` does NOT expose `process` global. `process.env.X` 500s in CF Workers runtime; Vitest passes on Node → "passes tests, fails production." Use `nodejs_compat` (superset) OR `$env/static/private` / `$env/dynamic/private`. mvox CHORE-47 migrated to `$env/dynamic/private`; `nodejs_compat` retained as safety net. |
| `project_cf_pages_wrangler_vars` | When `wrangler.json` has a `vars` block, CF dashboard Variables UI is LOCKED. Only secrets (encrypted) can be managed via dashboard. Wrangler is source of truth for plaintext vars. |
| `project_wrangler_deploy_auth` | `pnpm wrangler login` fails without `xdg-utils`. Use `set -a; . ~/.config/mvox/credentials.env; set +a && pnpm run deploy` — picks up `CLOUDFLARE_API_TOKEN`. Credentials at `~/.config/mvox/credentials.env`. |
| `project_entu_post_appends_multi_value` | POST to an existing non-formula string property APPENDS a new value (multi-valued at wire level). To replace: DELETE existing property value(s) by `_id` first, then POST. Affects any "update a field" UX. `list: true` is a UI hint only. |
| `project_entu_wire_shape_entity_vs_property` | Two distinct `_id` kinds: entity `_id` → `DELETE /entity/{id}`; property-value `_id` → `DELETE /property/{id}`. Cannot be interchanged (404 if conflated). UPDATE pattern: DELETE value via `/property/{id}`, POST new via `/entity/{id}`. |
| `project_entu_formula_mechanics` | Formula values MATERIALIZED on instances (not virtual reads). Survive source-property deletion. Direct POST to formula property silently dropped (re-evaluates). Pre-delete verify: check `/\S/`, not just non-empty — formula can materialize as single space. |

---

### §8 — Production state + verification

**curl -sIL https://multivox.pages.dev/ (2026-05-23 17:59):** HTTP/2 200. CF-Ray: a005f3f6d9cf243e-FRA. Production is healthy.

**Latest deploy SHA:** `a9c9ad88.multivox.pages.dev` (alias `multivox.pages.dev`) — CHORE-B build from `fc99291`. Unchanged since session 17.

**4-hotfix-cycle commit chain** (all subsumed into `fc99291` CHORE-B squash on main):
- `477f27f` — bare next= + state-to-localStorage (HOTFIX-1)
- `5f2dcf4` — provider-in-state closes #57 (HOTFIX-2)
- `4df0dea` — drop sessionStorage nonce verify (HOTFIX-3)
- `2f771b8` — layout nav reactive (HOTFIX-4)
- `f4f7a0a` — pre-merge cleanup: gate auth UI on hydration + drop dev scaffold

**Tests at session-18 close:** Vitest 361/361 unit, pnpm check 0, pnpm lint 0, pnpm build clean. Playwright: 11 pre-existing failures (CHORE-C scope).

**S3 orphan:** `polyphony/6a11dc804ff8277cd4306b1e/6a11dc804ff8277cd4306b24` (70 bytes, harmless, pending Argo ask task #60).

(*MVOX:Finn*)

---

## 2026-05-31 — Session 26 findings

### [LEARNED] MvoxNav layout — pre-CHORE-76 and post-CHORE-76

**Pre-CHORE-76 (session 25 audit):** `<header>` was `flex items-center justify-between py-2 px-6 border-b-[1.5px] border-ink-2 bg-paper` — no position, no z-index, no responsive handling. Avatar/hamburger entirely off-screen on mobile because the whole right group (5 tabs + avatar) pushed past viewport edge.

**Post-CHORE-76 (CHORE-77 bug):** `overflow-x-hidden` was added to `<header>`. Per CSS overflow spec §3.2, this forces `overflow-y: auto` — clips `absolute top-full` dropdown panels below the header box. Both AvatarMenu and nav-tab-menu panels disappeared. Fix: remove `overflow-x-hidden` from `<header>`, add `position: relative; z-index: <N>` instead (creates stacking context so z-50 panels paint above page siblings).

**DeskSurface:** `animation` on `.wood-bg` may create GPU compositor layer on some browsers — `position: relative; z-index` on header guards against this regardless.

### [LEARNED] /library — layout structure + responsive state (post-CHORE-78)

- **Three-card task grid:** `style="grid-template-columns: 1fr 1fr 1.15fr"` — inline style. CHORE-78 added `class="hidden sm:grid"` to hide on mobile.
- **LibraryMasterDetail:** scoped CSS `.md-wrap { grid-template-columns: 240px 1fr; }` — no `@media`. Hard 240px master column.
- **LibraryMaster:** `.master-col { position: sticky; top: 24px }`, `.master-paper { max-height: calc(100vh - 80px); overflow-y: auto }`. Right-fade gradient — designed for side-by-side.
- **IntersectionObserver scroll-spy** keeps `selectedWorkId` + URL in sync as detail scrolls. Works in single-column reflow. `handleSelect` → `scrollIntoView({ behavior: 'smooth', block: 'start' })`.
- **DeskSurface:** `w-full`, fluid, no min-width — not the constraint.

### [LEARNED] /library filter dimension readiness

Key facts (from hydrateLibrary.ts + schema.ts + library-entu.ts):
- **Ready now:** title search, composer, edition.year, edition.publisher
- **Fetched but name-mismatch risk:** voicing (`work.voicing` fetched, schema field is `original_voicing`), language (`work.language` fetched, schema field is `original_language`) — may silently return empty from v4E db; probe needed
- **Schema yes, not fetched (trivial to add):** genre (list), edition_type (required!), arranger, license
- **Availability:** needs copy count + open lending count per edition — two extra query tiers, not currently fetched
- **Work year is dead code:** v4E `work` has no `year` property (only `original_duration` in minutes); `w.year?.[0]?.number` returns nothing from v4E-compliant db

### [LEARNED] /library auth behavior (pre-CHORE-79)

- **Unauthenticated:** page fully renders, catalog stays `{ status: 'loading' }` forever — no redirect, no error.
- **Non-librarian:** `goto('/')` fires after Entu returns `no-rights`.
- **No server-side guard:** `src/routes/library/` has no `+page.server.ts`, no `+layout.server.ts`. `hooks.server.ts` is bare passthrough.

### [LEARNED] Session JWT is localStorage-only — server is completely blind

Auth storage keys (all `localStorage`): `token`, `accounts`, `user`, `mvox.token_version`, `mvox.last_provider`. Zero cookies in codebase — confirmed grep. `hooks.server.ts` never populates `event.locals`.

**CHORE-79 design gate:** true no-flash server-side guard requires a new session cookie. Minimal path: after OAuth exchange, call a server endpoint that sets an httpOnly cookie; `hooks.server.ts` reads it to gate protected routes. Full JWT stays in localStorage for Entu API calls.

(*MVOX:Finn*)

---

## 2026-05-31 — Session 27 notes

### [LEARNED] Session 27 shipped: CHORE-79 (server-side auth guard) + CHORE-72 (/about page)

No research requests came to Finn this session — team executed independently.

**Next session prep (schema audit):** team-lead flagged a design/mapping session for rehearsal/concert/season/rsvp entities. Relevant prior context:
- v4E `season` entity: `start_date`, `end_date` — straightforward temporal container.
- v4E `event` entity: multi-parent (org + season(s) + section(s) + series), `event_series` for recurring patterns with `interval_days` + `start_time` + `duration`.
- v4E `rsvp`: child of `person`, member-created. `attendance`: child of `event`, conductor-created. Split design (session-8 memory: `project_polyphony_participation.md`).
- `event_series` and `rsvp` and `attendance` are among the 9 entity types **entirely absent** from live polyphony DB (session-4 audit).
- Probe needed: what IS in live polyphony DB for events/seasons? (Only `season` + `event` + `repertoire_item` + `program_item` type IDs known — see scratchpad §2026-05-19.)

**Standing open item:** `/library` filter `voicing`/`language` field name mismatch risk — probe against live DB still needed before filter UI lands.

(*MVOX:Finn*)

---

## 2026-06-01 — Session 28 notes

### [LEARNED] v4E temporal/participation schema — confirmed exact shapes

Key values not previously recorded in any memory file, confirmed from schema.ts v4E.0.1:

- **`rsvp.status` values:** `going | not_going | maybe`
- **`attendance.status` values:** `present | absent | late`
- **`event_type` enum (on both `event_series` and `event`):** `rehearsal | concert | festival | retreat | workshop | meeting | social | other` — rehearsal vs concert is a property value on a single `event` type, NOT separate entity types
- **`duration_minutes`** is the correct field name (not `duration` as scratchpad §2026-05-31 session-27 shorthand implied)
- **`rsvp_lockout_hours`** lives on `organization`, not on `rsvp` or `event`

### [LEARNED] event series-to-event inheritance is BFF-mediated, not Entu-native

`event` properties with note "inherited from series.X if not set" are NOT auto-populated by Entu. The BFF must read both the event and its parent `event_series` and merge at read time. No Entu mechanic handles this.

### [LEARNED] mvox wiring state at session 28: zero for temporal/participation domain

No routes, no types, no Entu client calls, no Svelte components for season/event/rsvp/attendance exist in `src/`. Only marketing copy (landing pillars, `library_rehearsal_in` mock string) touches the vocabulary. Clean slate confirmed.

### [DEFERRED] /library filter voicing/language field name mismatch

`work.voicing` is fetched but v4E schema field is `original_voicing`; `work.language` fetched but schema field is `original_language`. Live DB probe needed before filter UI lands. Still open from session 26.

(*MVOX:Finn*)

---

## 2026-06-01 — Session 29 notes

### [LEARNED] seasons data layer: fully wired, three live bugs found this session

`src/lib/seasons/entuSeasons.ts` is GREEN across all 10 tasks (Tasks 1–10). `src/routes/seasons/+page.svelte` exists but manage-ops stubs are unwired (handleRehearsalCancel/Edit/ConductorAssign/Remove are `// GREEN:` comments). #86 is the wiring issue.

**Three bugs surfaced via research:**

1. **Season-create silent failure + no feedback** (season-create bug, post-#86):
   - `handleSeasonCreate` has no try/catch — a failing POST is an unhandled rejection, zero UI feedback.
   - No auto-select, no notice, no form reset after success.
   - `_type: { string: 'season' }` in `entuSeasons.ts:79` vs `_type: { reference: TYPE_IDS.season }` in seed script — seed comment says reference form required for API-key auth. Whether string form works for user JWT is unconfirmed; needs live network tab check or P0.1 probe artifact.

2. **`assignConductor` duplicate-grant** (`entuSeasons.ts:416`):
   - Bare `POST { type: '_editor', reference: personId }` with no prior-grant check.
   - Double-assign → two property-value `_id`s; `listConductors` lists person twice; single `revokeConductor` leaves residual grant.
   - Fix: check `listConductors` before POST, skip if already direct editor.

3. **`EntuClient.setProperty` dead code risk** (`src/lib/entu/client.ts:72`):
   - Posts to `/property` endpoint (different shape from rest of codebase). No prior-value DELETE. Zero callsites currently, but unsafe if called for "set" semantics.

### [LEARNED] org-member list: no helper exists

`listOrgMembers(cfg, orgId)` does not exist anywhere in `src/`. Must be added to `entuSeasons.ts`. Query: `?_type.string=member&_parent.reference={orgId}&status.string=active&props=person&limit=500`, then parallel name resolution (same pattern as `listConductors`). `OrgMember` interface already declared in `ConductorPanel.svelte:7`.

### [LEARNED] `member` schema confirmed

From `$ENTU_RESEARCH/docs/schema/v4E/schema.ts:277`: required `person` (ref) + required `status` (`active | archived`). Filter `status.string=active` to exclude archived members.

### [LEARNED] edit-form pattern: no modal anywhere

Zero `<dialog>`, modal, overlay, or popover components in codebase. House style: inline conditional `{#if}` renders a form block. `RehearsalEditForm` should mirror `SeasonForm.svelte` shape — `$state` fields pre-populated from props, `onedit(patch)` callback. `RehearsalPatch` type already defined at `entuSeasons.ts:229`.

### [DEFERRED] _type string vs reference for user JWT

`entuSeasons.ts` uses `{ type: '_type', string: 'season' }` for entity creates. Seed script uses `{ type: '_type', reference: TYPE_IDS.season }` with comment that reference form required for API-key auth context. Not confirmed whether string form works for browser user JWT. If it fails, the create silently 4xx (no try/catch in handleSeasonCreate). Need: P0.1 probe artifact or browser network tab check.

(*MVOX:Finn*)
