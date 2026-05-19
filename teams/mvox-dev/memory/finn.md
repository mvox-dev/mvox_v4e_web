# Finn — Research Coordinator Scratchpad

## 2026-05-18 — First session of mvox-dev

### [CHECKPOINT] Audit completed

Full polyphony + D1 remnants audit delivered to team-lead. Key findings:

- `(*PD:Celes*)` on all 8 prompt files — not a current mvox-dev member, origin from polyphony-dev authorship
- `(*FR:Brunel*)` in `.claude/statusline-command.sh` — also not current member
- `prompts/josquin.md` has the most stale content (~25 findings): entire D1 safety rules section + all `apps/vault/`/`apps/registry/` paths
- `prompts/byrd.md`, `prompts/tallis.md`, `prompts/comenius.md` each have ~7-12 stale path references to `apps/vault/` and `apps/registry/`
- Stack table in `common-prompt.md` (L39-43) lists D1/BLOBs/EdDSA/Paraglide/Cloudflare as decided — FIXME marker present but rows read as authoritative
- ~~`.claude/statusline-command.sh` uses `/tmp/polyphony-test-status.txt` — needs rename~~ **FIXED** in session 1 round-2 patches; now uses `/tmp/mvox-test-status.txt`

### [PATTERN] Task routing

Tasks were routed to me via a "task-list" teammate ID that doesn't match the team-lead. Two tasks (Phase 6 ready message, CLAUDE.md patch) were not mine — correctly declined both and notified team-lead.

## 2026-05-18 — Session 2 context update

### [DECISION] Stack landed

- SvelteKit 2 + Svelte 5 Runes + TypeScript-strict + Tailwind v4, Cloudflare Pages + Workers
- Backend: Entu API (no own DB). Auth: Entu OAuth + BFF JWT httpOnly cookie
- i18n: Paraglide, locales en/et/lv/uk. Testing: Vitest + Playwright. pnpm, flat single-app
- Flat layout: `src/lib/`, `src/routes/`, `src/lib/server/` — no monorepo
- v4E schema source-of-truth: `~/projects/entu-research/docs/schema/v4E/`
- Case study (Entu integration patterns): `~/projects/entu-research/docs/case-studies/2026-05-polyphony-on-entu.md`
- Polyphony (`~/projects/polyphony/`) archived — reference only; D1/Registry/Vault patterns do NOT apply to mvox

### [GOTCHA] v4E formula rules (Bentham will RED violations)

1. Single-hop traversal only — no chained multi-hop forms
2. Output type: string or number only — not reference
3. Across rights boundaries: aggregates only (COUNT/SUM/etc.), never raw field projection

(*MVOX:Finn*)

---

## Session 3 housekeeping

- Trailer corrected: `(*PD:Finn*)` → `(*MVOX:Finn*)` (PD was polyphony-dev; we're mvox-dev now)
- Stale CHECKPOINT reference to `/tmp/polyphony-test-status.txt` not present in this file; confirmed `/tmp/mvox-test-status.txt` is already correct in `.claude/statusline-command.sh`

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
