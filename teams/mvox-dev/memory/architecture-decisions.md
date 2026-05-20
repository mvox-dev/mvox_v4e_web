# mvox-dev — Architecture Decisions

Settled patterns. **Bentham** stewards: prunes, resolves contradictions, appends new decisions as they land. Any teammate may propose additions via team-lead.

Format per entry: short title, decision, rationale, date. Most recent at the top within each section.

---

## Seed-data model — v4E-clean target shape (2026-05-20, session 8)

**Decision**: Seed scripts (`scripts/migrations/seed-*.ts`) write v4E-clean entities, NOT pre-v4E polyphony shape:

- **`person`**: plain `name: string` per v4E `schema.ts`. NO `forename` / `surname` (polyphony's legacy shape; Phase D retires those).
- **`member`**: required `person` reference + optional `current_section` reference + `status: "active"`. NO `name` on member (identity lives on linked person).
- **`organization`**: required `_parent.reference` to founder `person`. NO `org_type` / `contact_email` (deleted by Phase B + B.1). Umbrella↔collective distinction is structural (collective gets second `_parent` to umbrella org), not a property.
- **Multi-parent create**: founder + umbrella attached via two-POST sequence (POST create with founder; second POST appends umbrella to `_parent`). Per `project_entu_post_appends_multi_value` memory. Idempotency requires read-then-skip on the second POST.
- **Founder identity**: elected from the seed-created persons themselves (member-person founders). Reuses persons we're creating anyway; matches "founded by" semantic.

**Rationale**: Forward-looking work (seeds, new features, BFF contracts) targets the v4E schema as canonical truth. When `schema.ts` conflicts with polyphony's live state, **schema wins** — polyphony's divergence is the Phase B/C/D migration's job to close, not the seed's. Pérotin's session-8 dispatch surfaced three real schema conflicts (member.name doesn't exist; person required on member; org requires person parent), all settled by reading `$ENTU_RESEARCH/docs/schema/v4E/schema.ts` empirically.

**Source**: PO decisions session 8 (2026-05-20). Captured in `docs/migration/findings/seeding-source-plan-2026-05-20.md` + executed by `scripts/migrations/seed-collectives.ts` (merged at `a6ed6bb`).

---

## Entu mutation-op wire shapes (2026-05-20, session 8)

**Decision**: Empirical wire shapes for the three Entu mutation patterns, verified live by `scripts/migrations/probes/probe-mutation-ops-2026-05-20.ts` on polyphony:

| Op | Wire shape | Notes |
|---|---|---|
| **UPDATE** single property value | `DELETE /property/{old-value-id}` + `POST /entity/{id}` with new value | Entu POST APPENDS to multi-valued properties. Must DELETE old value before POST for replace semantics. |
| **REMOVE** single property value | `DELETE /property/{value-id}` | Clean, immediate. Verified via post-GET. |
| **DELETE_ENTITY** | `DELETE /entity/{id}` | Returns 404 on subsequent GET. Distinct from property-value delete. |

Companion call-out: **prop-def DELETE** also uses `DELETE /entity/{prop-def-id}` (prop-defs ARE entities). The v12 Bug-1 fix + #56 wire-shape split established the distinction between entity-`_id` and property-value-`_id`:

- Entity `_id` (entity OR prop-def): `DELETE /entity/{id}`
- Property-value `_id` (one of the multi-values on an entity's property): `DELETE /property/{id}`

**Rationale**: These are the canonical mutation primitives. Future scripts MUST distinguish entity-`_id` from property-value-`_id` and route to the correct endpoint. Conflating the two led to two prior bugs (v12 Bug-1; #56). Bentham REDs PRs that conflate them.

**Source**: Probe result artifact `scripts/migrations/seed-results/probe-mutation-ops-2026-05-20T15-24-35-641Z.json`; #56 commit `a7b4774`; v12 commit (Phase B GREEN v12).

---

## Stack (2026-05-18, session 2)

**Decision**: mvox is a SvelteKit 2 + Svelte 5 (Runes) + TypeScript-strict + Tailwind CSS v4 application, deployed to Cloudflare Pages + Workers via `@sveltejs/adapter-cloudflare`. Backend is the Entu API (no own DB; MongoDB + S3 under the hood). Auth is Entu OAuth with a BFF pattern: SvelteKit server holds the Entu JWT in an httpOnly cookie and proxies all Entu API calls. i18n via Paraglide, locales `en` / `et` / `lv` / `uk`. Tests via Vitest + Playwright. Package manager: pnpm (no workspaces).

**Rationale**: Inherited shape from the entu-research POC (also SvelteKit + Entu OAuth + BFF + Cloudflare). mvox is the production fork; it shares only the v4E schema as a contract with entu-research (option b — schema-as-contract, see below).

**Source**: PO briefing in session 2; cross-checked against `$ENTU_RESEARCH/CLAUDE.md`.

---

## Repo layout — flat single-app SvelteKit (2026-05-18, session 2)

**Decision**: Flat single-app layout. `src/lib/`, `src/routes/`, `src/lib/server/` (server-only boundary). NOT a monorepo — no `apps/` or `packages/` directories.

**Rationale**: mvox is one deployable. Entu handles auth, so there's no separate auth gateway (polyphony had `apps/vault` + `apps/registry`, which justified its monorepo — that justification doesn't exist for mvox). Migration to monorepo is mechanical (`mkdir apps/mvox && git mv src apps/mvox/`) and can happen later if a second deployable emerges (mobile companion, admin panel, federation cron). Don't pre-pay.

**Source**: PO decision, session 2.

---

## v4E schema ownership — schema-as-contract (2026-05-18, session 2)

**Decision**: mvox does not own v4E. The schema lives in `entu/research` at `docs/schema/v4E/` and is the single canonical source. mvox consumes v4E as a contract (option b of the four-option matrix surfaced in session 2). entu-research's editor.html + case study stay accurate as living docs.

**Rationale**: Preserves entu-research's investment (editor, narrative README, case study). Symmetric for any future v4E consumer. Cost: cross-repo coordination for schema changes — manageable at the current change cadence. Migration path to a third dedicated schema repo (option d) is open if a third consumer ever appears.

**Source**: PO decision, session 2. Trade-offs evaluated in session-2 conversation.

---

## v4E schema mutation gate — commit trailer convention (2026-05-18, session 2)

**Decision**: When a mvox feature requires a v4E schema change:

1. Open a PR against `entu/research` first; get PO approval there.
2. After it lands, open the mvox PR with these commit trailers:
   ```
   Schema-Change: entu/research@<sha> "<short title>"
   PO-Approved: <date> <PO handle or "verbal in session, logged by team-lead">
   ```
3. Bentham REDs any mvox PR whose diff references new/changed v4E entity types, properties, formulas, or rights defaults without both trailers.

PO approval can be in-session verbal (logged by team-lead in scratchpad with timestamp) or written (GitHub comment / email). Strictness can ratchet up later if needed.

**Rationale**: Closes Bentham's session-1 flag #4. Convention-only (zero tooling), works across the repo boundary (the schema isn't in this repo). The trailer makes the dependency visible at review time; the entu-research PR provides the queryable audit history. Adopted essentially as Bentham's Option A proposal from his session-2 intro.

**Source**: Bentham proposal session 2 + PO confirmation.

---

## BFF user-rights default (2026-05-18, session 2)

**Decision**: All BFF route handlers default to running in the authenticated user's Entu rights — SvelteKit server forwards the user's JWT on every outbound Entu call. Elevated operations (where the BFF acts with more rights than the user has) live on a small explicit enumerated list. Adding to that list requires team-lead approval and a documented rationale.

**Current elevated-ops list** (seeded; grows by explicit decision only):

- *(none yet — list seeded empty; populate as real ops emerge)*

Polyphony's analogous list, for reference (NOT auto-inherited by mvox): cron cleanup (orphan persons, expired invitations/applications, series past `end_date`); BFF curated federation reports; self-link of additional verified emails. These may or may not apply to mvox — evaluate per op.

**Rationale**: Case study Section B4. The rights model is the authoritative API contract; if the BFF has magic capabilities beyond user rights, alternative clients become second-class. Heuristic: if a frequent user operation needs elevation, the role model is probably wrong.

**Source**: Case study `$ENTU_RESEARCH/docs/case-studies/2026-05-polyphony-on-entu.md` Section B4.

---

## Formula rule — single-hop, aggregates-only across rights boundaries (2026-05-18, session 2)

**Decision**:

1. **Single-hop only.** v4E formulas use only single-hop traversal (`propertyName.*.property` or `_parent`). Chained forms like `ref.*._parent.*.name` silently return absent. Denormalize via intermediate single-hop formulas (case study D1).
2. **String or number output only.** Declaring `type: reference` on a formula property silently coerces to string. Declare as `type: string` for honest schema (case study D3).
3. **Aggregates only across rights boundaries.** The formula evaluator bypasses rights checks (`entu/api/utils/formula.js`). Use formulas for aggregates (COUNT, SUM, AVERAGE, MIN, MAX) — safe. Never project raw values (names, descriptions) across rights boundaries via formulas — would leak (case study D6).

Bentham REDs PRs that violate any of these.

**Rationale**: All three are platform behaviours verified in the polyphony POC. Encoded here so the team doesn't re-derive them.

**Source**: Case study Sections D1, D3, D6.

---

## Test data strategy — empty-state UI first, dogfood second (2026-05-18, session 3)

**Decision**: Build empty-state designs for every singer/conductor view (agenda, repertoire, programme list, etc.) as part of the GREEN phase for each story. Do not seed the polyphony Entu db with synthetic test events/works. Once manager/admin stories ship, real test data is created through mvox itself (dogfood path).

**Rationale**: The polyphony db (6 real Estonian choirs, 116 real members, 0 events, 0 works) is production-shaped — real users may eventually see it; seeding synthetic test entities would muddy it. Empty-state UI is needed for any new org joining mvox anyway, so the work isn't wasted. Trade-off: slower visual feedback during early dev (devs see empty screens until admin flows exist). Mitigation: the first end-to-end TDD cycle prioritises an admin story (likely "create event") so test data appears quickly downstream.

**Source**: PO decision, session 3 (Gap 4 of the 5 session-2 carryforwards).

---

## Cloudflare Pages project name — `multivox` (2026-05-18, session 3)

**Decision**: The mvox Cloudflare Pages project is named `multivox`, served at `multivox.pages.dev` (and any future custom domain). Cloudflare account ID `1431b76f0b65e3d23833966744ff2bdf`. `mvox.pages.dev` is owned by a third party (live cert, dead origin); `multivox.pages.dev` and `mvox-app.pages.dev` were both free as of 2026-05-18.

**Rationale**: `multivox` matches the full product name from `$ENTU_RESEARCH/docs/user-stories.md` ("Multivox — User Stories"). Cleaner brand at the URL surface than `mvox-app`. Mild repo↔URL mismatch (`mvox_v4e_web` repo, `multivox` deploy) is acceptable since the repo is internal-facing and the URL is user-facing. entu-research's adjacent project (`entuphony.pages.dev`) follows the same "long name at the URL" pattern.

**Source**: PO decision, session 3 (Gap 5 of the 5 session-2 carryforwards). Availability check by Finn 2026-05-18, ownership confirmed via CF API token check (5 projects in account, no `mvox`).

---

(*MVOX:Palestrina*)
