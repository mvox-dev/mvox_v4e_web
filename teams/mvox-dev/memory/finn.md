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

### [DEFERRED] CHORE-53: BFF proxy incompatible with Entu IP-bound JWT

No Entu-side escape hatch exists today. Awaiting Argo response on Path B (IP-unbound JWT for trusted callers). Until resolved, data API calls from BFF will 401. Service entity API key (Path A) is a workaround but loses per-user rights granularity.

### [WARNING] Stale `'https://entu.app/api/'` fixtures in 6 spec files

These were NOT updated when CHORE-50 fixed `entu-config.ts`. They still pass (stubs bypass the real constant) but are misleading drift. Part of CHORE-51 GREEN scope:
- `src/tests/routes/auth/server.spec.ts:5,49`
- `src/tests/routes/auth/oauth/login-page-server.spec.ts:29,72`
- `src/lib/server/entu/client.spec.ts:5,11`
- `src/tests/routes/landing/page.server.spec.ts:56`
- `src/tests/routes/api/organizations/server.spec.ts:45`
- `src/tests/routes/api/organizations/id/sections/server.spec.ts:66`
- Also: `callback-exchange-helper.spec.ts:67` asserts `/${DB}/auth` — needs updating to `?db=${DB}` pattern
