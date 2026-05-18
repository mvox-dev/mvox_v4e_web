# mvox-dev — Architecture Decisions

Settled patterns. **Bentham** stewards: prunes, resolves contradictions, appends new decisions as they land. Any teammate may propose additions via team-lead.

Format per entry: short title, decision, rationale, date. Most recent at the top within each section.

---

## Stack (2026-05-18, session 2)

**Decision**: mvox is a SvelteKit 2 + Svelte 5 (Runes) + TypeScript-strict + Tailwind CSS v4 application, deployed to Cloudflare Pages + Workers via `@sveltejs/adapter-cloudflare`. Backend is the Entu API (no own DB; MongoDB + S3 under the hood). Auth is Entu OAuth with a BFF pattern: SvelteKit server holds the Entu JWT in an httpOnly cookie and proxies all Entu API calls. i18n via Paraglide, locales `en` / `et` / `lv` / `uk`. Tests via Vitest + Playwright. Package manager: pnpm (no workspaces).

**Rationale**: Inherited shape from the entu-research POC (also SvelteKit + Entu OAuth + BFF + Cloudflare). mvox is the production fork; it shares only the v4E schema as a contract with entu-research (option b — schema-as-contract, see below).

**Source**: PO briefing in session 2; cross-checked against `~/projects/entu-research/CLAUDE.md`.

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

**Source**: Case study `~/projects/entu-research/docs/case-studies/2026-05-polyphony-on-entu.md` Section B4.

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
