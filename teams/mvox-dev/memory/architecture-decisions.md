# mvox-dev — Architecture Decisions

Settled patterns. **Bentham** stewards: prunes, resolves contradictions, appends new decisions as they land. Any teammate may propose additions via team-lead.

Format per entry: short title, decision, rationale, date. Most recent at the top within each section.

---

## URL parameters override persisted state — project-wide resolution rule for UI state (2026-05-24, session 22)

**Decision**: For any UI state that has BOTH a URL representation AND a persisted representation (localStorage, IndexedDB, Svelte stores), resolution follows a fixed order.

**On read** (initial mount, navigation, hydration):

1. URL parameter — when present and valid.
2. Persisted store — when present and valid.
3. Application default — last resort.

**On user-initiated change** (click handlers, programmatic updates, etc.):

1. Update URL via SvelteKit soft-nav (`goto(...)` with `replaceState`/`noScroll` as appropriate).
2. Update persisted store.
3. UI re-renders from the derived store.

**Rationale**: Deep-linking + shareability is the win. A user can copy `https://mvox.eu/library?org=foo&work=bar` and paste into another tab, device, or share with a teammate, and the recipient sees the same view. The persisted store carries the silent everyday default (no params in URL → "where I was last time"). The two-write on change keeps both representations in sync so subsequent navigation without params still reads the right value. The read order (URL → persisted → default) honors the explicit-over-implicit principle: a URL param IS an explicit user choice (typed, pasted, or linked); the persisted store is a silent inference from prior behavior; the default is what we fall back to when neither speaks.

### Applies to (current + foreseeable)

| Pattern | Example use site |
|---|---|
| `?org=<id>` | Organization selector (CHORE-66, immediate) |
| `?work=<id>` | Library drill-down (future CHORE) |
| `?status=<x>` / `?sort=<x>` | Filter + sort state on list pages |
| `?q=<text>` | Search query |
| `?lang=<locale>` | Explicit locale override (Paraglide normally infers; URL is the escape hatch) |
| `?page=<n>` / `?cursor=<x>` | Pagination |
| Future | Tab selectors, drawer state, modal state — any state users may want to deep-link to |

### Doesn't apply to

- **Secret/sensitive state** (auth tokens, session ids, OAuth nonces) — never in URL. URLs leak via referer headers, browser history, server logs, screenshots.
- **Ephemeral UI state** (focus, hover, transient validation, animation state) — neither URL nor persisted. Lives in component-local `$state` only.
- **Server-side state** — Path C means we don't have server state to coordinate with; the rule is browser-side only.

### Convention shape

- localStorage key naming: `mvox.<scope>Id` for entity ids (e.g., `mvox.selectedOrgId`); `mvox.<scope>.<facet>` for compound state (e.g., `mvox.library.sort`).
- URL param naming: lowercase, short, matches the dimension it represents (`org`, `work`, `status`, `sort`, `q`, `lang`, `page`).
- When the URL and persisted store disagree at read time, the URL wins AND a backfill write to the persisted store happens (so the next "everyday nav" without params keeps the URL's intent). This is the "two-write" symmetry: change writes URL+store; read writes store-from-URL if they diverge.

### Spec exemplar

`docs/superpowers/specs/2026-05-24-navbar-auth-wiring-design.md` Section "Selected-org resolution" is the first concrete implementation. The MvoxNav `?org=` ↔ `localStorage('mvox.selectedOrgId')` ↔ first-org pattern is the canonical shape — read order URL → localStorage → first-account; change order goto-with-`?org=` → setItem → derived re-render.

### Review enforcement (Bentham)

Any future spec or PR that introduces UI state needing persistence MUST follow this pattern. Verdicts:

- **RED**: New state is persisted in localStorage but NOT also expressible in URL, and no reasonable "doesn't apply to" exemption (secret / ephemeral / server-only) applies. The shareability/deep-link contract is structural; opting out of it leaks state that other devs reasonably expect to round-trip.
- **RED**: URL param exists but persisted store is missing. Deep-links work but everyday nav forgets — asymmetric, surprising, and a regression on the prior session's UX.
- **RED**: Write order is reversed (persisted-first, URL-as-decoration). That lets reload diverge from URL: the user navigates explicitly, then a refresh silently rewrites the URL back from the store, hiding the deep-link they just executed.
- **YELLOW**: Implementation diverges in non-blocking ways — e.g., URL param works AND localStorage works AND read order is correct, but the localStorage key name doesn't follow the `mvox.<scope>Id` / `mvox.<scope>.<facet>` convention; or the `goto` call uses `pushState` where `replaceState` would avoid history pollution.

### Cross-links

- First implementation: CHORE-66 navbar auth wiring (org selector). Spec: `docs/superpowers/specs/2026-05-24-navbar-auth-wiring-design.md`.
- Browser-direct data path (parent decision): "Data path — browser-direct to Entu" below. Path C means there's no server-side hop to fight over state ownership — the browser is authoritative for UI state, which is what makes the URL ↔ localStorage symmetry work cleanly.
- Storage naming precedent: see the `entu/webapp` parity rules in the same Path C section (`token` / `accounts` / `user` unprefixed for Entu compatibility; `mvox.*` prefix for mvox-owned keys).

**Source**: PO direction 2026-05-24, session 22. First exercised in CHORE-66; lifted to settled patterns at dispatch time so subsequent UI state work has a single rule to consult rather than re-deriving from the exemplar.

(*MVOX:Bentham*)

---

## Dispatch-message `Co-authored-by:` trailers short-circuit prepare-commit-msg hook (2026-05-24, session 22)

**Decision**: Team-lead dispatch messages MUST NOT include `Co-authored-by:` lines in commit-message templates. Use `Contributors:`, `Reviewed-by:`, `Helped-by:`, or body prose for team attribution instead. Implementers writing their own commits follow the same rule.

**Rationale**: `.githooks/prepare-commit-msg` uses `git interpret-trailers --if-exists doNothing` to append the PO co-author trailer (`Mihkel Putrinš <mihkel.putrinsh@gmail.com>`). `interpret-trailers` deduplicates on trailer KEY, not on full value. When the dispatch-message template already contains ANY `Co-authored-by:` trailer — including malformed group forms like `Co-authored-by: Comenius, Tallis, Byrd, Bentham (review)` — the hook short-circuits on the existing key and the PO co-author trailer is silently dropped. The commit lands without the standing co-authorship convention being honored, and nothing surfaces at commit time.

**Exemplar**: session-22 squash `9637eee` (closes #62 + #63). Squash landed cleanly but lacks the PO trailer because the dispatch template ended with `Co-authored-by: Comenius, Tallis, Byrd, Bentham (review)`. PO call 2026-05-24: leave the one-commit drift, codify the rule.

**Rule**:
- Dispatch templates: attribution lives in body prose or under `Contributors:` / `Reviewed-by:` / `Helped-by:` (any sentinel that isn't `Co-authored-by:`).
- Genuine multi-author co-authorship: list each contributor on its own line as `Co-authored-by: Name <email>` with a real git identity + email. The hook's dedupe checks full value, so distinct properly-formatted lines all survive AND the PO trailer still appends.
- Never write malformed group-form `Co-authored-by:` (multiple names on one line, parenthetical notes like `(review)`, names without emails).

**Review enforcement (Bentham)**: Any commit on main or a feature branch missing the PO co-author trailer when other `Co-authored-by:` lines are present → YELLOW for trailer-discipline drift. Spot-check the commit message body for the group-form pattern; if found, the dispatch template was the cause.

(*MVOX:Josquin*)

---

## Per-commit GREEN on feature branches — every commit independently passes the full GREEN gate (2026-05-23, session 19)

**Decision**: Every commit on a feature branch MUST independently pass the full GREEN gate — not just the branch tip. The gate is the same as the GREEN-phase quality gate below:

```
pnpm check     # 0 type errors
pnpm test:unit # all tests pass
pnpm lint:fix  # zero lint findings after autofix
pnpm build     # builds clean
```

Intermediate broken states ("I'll fix it in the next commit") are not permitted. When a planned commit ordering would leave a transient broken intermediate, the GREEN-phase implementer surfaces-and-stops, proposes a re-sequence, and re-splits the work into atomic GREEN commits. The branch tip passing alone is not sufficient.

**Rationale**: CHORE-B (the Path C rewrite, `feat/chore-53b-rewrite`) is the canonical exemplar. The plan's literal step ordering would have produced two broken intermediates:

- **B11 (`hooks.server.ts` + `app.d.ts` strip)** — stripping cookie-reading before landing's `+page.server.ts` was updated would break landing's `PageData` typing mid-branch. Josquin surface-and-stop #1.
- **B12 (landing `+page.server.ts` → `{}`)** — emptying the server load before the `+page.svelte` stopped reading `data.session` would strip data the component still consumed. Josquin surface-and-stop #2.

The team adopted "Path 2: every commit GREEN" via re-sequence — B13a (wrapper extend) → B13b (svelte rewrite consuming the extended wrapper) → B12 (server-load strip, now safe because the consumer no longer reads it). Three atomic GREEN commits instead of one commit + two broken intermediates. Net branch: 15 implementer commits, zero broken intermediates, bisect-clean across both re-sequences.

This is sibling to the lint:fix-in-GREEN rule below — both rules close gaps between "tests pass at the tip" and "the branch is actually a clean unit of history." Per-commit-GREEN closes the gap for bisect viability and prevents the "transient broken-state hand-off lands in main on squash" failure mode.

**Review enforcement (Bentham)**: For any feature-branch review, spot-check `pnpm check` + `pnpm test:unit` on at least two non-tip commits (e.g., the first GREEN commit and a mid-branch commit). If any commit fails the gate, the branch is YELLOW pending re-sequence — not auto-RED, because the tip is what merges, but the audit trail loses bisect value and the re-sequence cost is owed back. Implementers who surface-and-stop on a plan-ordering bug instead of merging through a broken intermediate are doing the right thing; team-lead's role is to accept the re-sequence proposal, not push through the original ordering.

**Source**: CHORE-B branch `feat/chore-53b-rewrite` (session 17, 2026-05-23). Bentham's session-17 review note: "bisect viability + prevents transient broken hand-off landing in main on squash." Lift proposed end of session 17, parked through session 18, ratified session 19.

(*MVOX:Bentham*)

---

## GREEN-phase quality gate — `pnpm lint:fix` is part of GREEN, not optional (2026-05-23, session 16)

**Decision**: GREEN-phase agents (Byrd + Josquin) MUST run `pnpm lint:fix` before handing off to the next phase. Test-passing alone is not GREEN. The full GREEN gate is:

```
pnpm check     # 0 type errors
pnpm test:unit # all tests pass
pnpm lint:fix  # zero lint findings after autofix
pnpm build     # builds clean
```

Then hand off. The lint:fix step catches the divergence between "tests pass" and "code matches house style after Biome's view of it." Skipping lint:fix manufactures a downstream autofix commit that pollutes the PR history with whitespace + import-order changes that should have been in the GREEN impl commit.

**Rationale**: CHORE-A (PR #56) was the first GREEN cycle to exercise the lint scaffolding from CHORE-48 (`b9b3499`). `pnpm test` passed; `pnpm lint` did not. The result was a separate `db59557` autofix commit at the tip of the branch — palatable as a one-time scope-override on the first lint-cycle, but a smell that becomes noise if it repeats. Lift to a settled norm BEFORE CHORE-B GREEN so it doesn't compound.

**Review enforcement (Bentham)**: From CHORE-B forward, any GREEN handoff whose subsequent autofix commit changes more than the implementer's claimed scope is YELLOW. An autofix commit that ONLY changes whitespace/import-order is a smell but not a blocker; an autofix that touches function bodies, conditionals, or semantic structure is RED — the GREEN commit was misattributed work.

**Source**: Josquin's session-16 [PATTERN] entry on `bentham.md` review thread; lift endorsed by Bentham, ratified by team-lead. First exercised: CHORE-B onward.

(*MVOX:Bentham*)

---

## Bundled-migration RED → split-by-blast-radius (2026-05-22, session 13)

**Decision**: When a bundled migration script has a clean Layer N and a problematic Layer N+1, the recommended fix path is **split the script into two** — one ships now (the clean layer), one defers behind its own task (the problematic layer). This wins over fix-in-place when:

1. The clean layer unblocks downstream consumers immediately (no pessimization waiting on the broken layer).
2. The deferred layer's open questions get their own probe/empirical-verification budget without timeline pressure.
3. The audit trail is cleaner — one PR = one clearly-bounded migration outcome, instead of a single PR carrying mixed "this worked, this didn't, here's why" semantics.

Bentham's standing recommendation on bundled-migration RED-1 verdicts: **lead with "split here" before "fix in place,"** unless the layers are genuinely coupled (the same op cannot be safely run without the other half).

**Rationale**: First exercised on the photo-rename pre-stage (task #12 → #15). Combined Layer 1 (prop-def rename) + Layer 2 (instance-value migration with DELETE-then-POST on file properties) script was RED on Layer 2's file-payload-round-trip bug. Option A split landed Layer 1 only as `cleanup-rename-photo-prop-def-only-2026-05-21.ts`; Layer 2 deferred to task #14 pending empirical probe of Entu's POST-with-file-fields semantics (does it re-link to a pre-existing S3 object, or always require a fresh upload?). Layer 1 live-executed cleanly 2026-05-22 (`82727ca`); Layer 2 remains deferred without blocking downstream work. Total split cost ~50 lines of Pérotin work vs. open-ended fix-in-place + Entu-probe budget on the combined script.

**Source**: Task #12 RED + task #15 GREEN (Option A split); live execution `82727ca` 2026-05-22; task #14 carries the deferred Layer 2 work.

(*MVOX:Bentham*)

---

## File-property mutations must round-trip full file payload (2026-05-22, session 13)

**Decision**: Any DELETE-then-POST migration on file-typed properties (`type: 'photo'`, `type: 'file'`, etc.) must round-trip the COMPLETE file payload — at minimum `filename`, `md5`, `filesize`, S3 key, content-type — from the DELETEd value to the POST body. Posting `[{type: 'photo'}]` (empty file property) silently destroys the S3 file binding.

**RED triggers**:
- Any DELETE-then-POST script touching file properties whose POST body lacks ANY of the file payload fields (`md5`, S3 key, content-type, filesize, filename).
- Any probe script enumerating file-typed property values that captures only a subset of file fields. The probe's captured-data shape is the upper bound on what a downstream live-run can reconstitute.
- `EntuProperty` (`src/lib/server/entu/client.ts:32-38` or equivalent) used as the POST body type for file mutations — it currently declares only `string`/`number`/`boolean`/`reference` and is incomplete for file values. Extend or split into `EntuFileProperty` before any file-property mutation lands.

**Open question (gates Layer 2 / task #14)**: Does Entu's POST-with-file-fields path re-link to a pre-existing S3 object, or does it always require a fresh upload? Until verified via `_probe_` against a throwaway entity with a real file value, NO DELETE-then-POST migration on file properties is GREEN-eligible. If Entu requires fresh upload, the rename CAN'T be done as DELETE-then-POST on file properties at all — would need an Entu-side property-rename API, or accept-data-loss.

**Empty-probe-today ≠ safe-to-defer**: Any script whose manifest is built at runtime from a live `listEntities` call must have its dead-code paths correct, because the gap between dry-run and live-run is exactly when uploads can land. Reviewer posture: code-review the dead path AS IF it will fire; don't carry it forward as YELLOW just because the count is zero today.

**Rationale**: Surfaced in the photo-rename pre-stage RED-1 (task #12). The combined script's `executeMigration` path posted `[{type: 'photo'}]` (empty body) — would have silently dropped the S3 file binding if any avatar/logo value existed at live-run time. Today's dead code, but the runtime manifest enumeration in `buildInstanceEntries` is the explicit safety net for "value uploaded between dry-run and live-run."

**Source**: Bentham RED on `chore/perotin-rename-photo-prestage-2026-05-21` `05eb5df` (task #12). Findings doc `docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md:85` prescribes the correct POST shape. Layer 2 deferred to task #14.

(*MVOX:Bentham*)

---

## Entu formula-to-plain conversion mechanic (2026-05-21, session 9)

**Decision**: To convert a formula property to a plain writable string on a type, DELETE the `formula` property VALUE from the prop-def entity (not the prop-def itself). Wire shape: `DELETE /property/{formulaValueId}` where `formulaValueId` is the `_id` of the formula value on the prop-def entity (not the prop-def entity `_id`).

After deletion:
- New instances: plain POSTs write and persist normally.
- Existing instances with stale formula-cached values: the cached value persists (consistent with Q4 — Entu retains materialized formula values after source deletion). A direct POST replaces the stale value with a single clean value — no pre-delete of the stale value needed. Formula-cached values have no `_id`, so Entu's POST path does not accumulate them alongside the new write — unlike the Q5 multi-value-append trap, where plain-string POSTs append rather than replace, requiring DELETE-then-POST for replace semantics.

**Corollary (formula-cache + `_id` interaction)**: Sanity-check or preserve-then-restore patterns that depend on a stable pre-image to restore to are BROKEN at the moment formula→plain conversion lands, because the pre-image (formula-cached value) has no `_id` to filter against. Any test-then-restore script that writes a probe value to a real entity whose original value came from a formula will lose the original on cleanup. **Use a throwaway entity for sanity checks, or use a real entity whose original value is itself an `_id`-bearing plain POST (e.g., seed-script-created instance).**

**Rationale**: Verified live against polyphony via `scripts/migrations/probes/probe-phase-d-formula-unwrap-2026-05-21.ts`. Unlocked Phase D sub-op 1 (converting `person.name` from formula `forename ' ' surname` → plain string to align live polyphony with v4E `schema.ts`). The "POST replaces stale formula cache without pre-delete" finding significantly reduces Phase D op count.

**Source**: Probe `probe-phase-d-formula-unwrap-2026-05-21.ts`, result artifact `probe-phase-d-formula-unwrap-2026-05-21T05-13-08-917Z.json`, findings doc `docs/migration/findings/entu-formula-unwrap-2026-05-21.md`. Session 9.

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
| **POST boolean property** | `POST /entity/{id}` with body `[{type: '<prop>', boolean: <true\|false>}]` | Replace semantics: DELETE existing value first then POST (same as UPDATE). Empirically confirmed by Phase D sub-op 5 (commit `88595c7`) — 6 successful `_inheritrights: false` flips on `organization` instances. |

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

### Schema-alignment carve-out (2026-05-21, session 9)

A PR that closes drift between live data and an *already-landed* v4E `EntityDef` does NOT require the `Schema-Change` trailer. Only PRs that diff `entu/research/docs/schema/v4E/schema.ts` (new/changed `EntityDef`s, properties, formulas, or rights defaults) require the trailer. Bentham distinguishes:

- "Does this PR change what's in `schema.ts`?" → trailer required
- "Does this PR change live data to match what's already in `schema.ts`?" → no trailer

First exercised by Phase D sub-ops 1+3+4 (forename/surname retirement; `person.name` formula→plain; commit `adc41e8`) and sub-op 5 (`_inheritrights: false` on 6 orgs; commit `88595c7`). All four had no Schema-Change trailer on the justification that v4E `schema.ts` already declared the target shape; live polyphony was the drift to close.

### Upstream-PR ownership shift (2026-05-22, session 13)

**Update to step 1:** team-lead authors and opens the `entu/research` PR directly. No more "PO submits via the upstream GitHub UI" relay.

Procedure: branch in `~/projects/entu-research/`, edit `docs/schema/v4E/schema.ts`, run `pnpm build-schema` to regenerate `schema.json`, sweep `docs/schema/v4E/README.md` for narrative refs, commit with PO email trailer, push, `gh pr create`. PO reviews on the GitHub side.

Rationale: the earlier finding-doc → paste-into-UI relay stranded schema work across session boundaries (session 12 wrote the draft for the `avatar/logo → photo` rename; session 13 still needed PO action before any consumer could move). PO directive 2026-05-22: "from here forward — this schema is ours to maintain at entu-research". First exercised on entu/research#49 (the rename), opened by team-lead end-to-end.

What this changes:
- The session-12 finding-doc pattern (`docs/migration/findings/v4e-rename-*.md`) remains useful as **design rationale capture**, but is no longer the gating artifact.
- Mechanical changes (renames, note clarifications, regenerated artifacts) are team-lead's to execute.
- **Structural changes** (new entity types, new rights model, new sharing semantics) still consult PO before the upstream PR opens. "Ours to maintain" ≠ "ours to design unilaterally."

What stays unchanged:
- The `Schema-Change: entu/research@<sha>` + `PO-Approved: <date> ...` trailer convention on the consuming mvox PR.
- Bentham REDs mvox PRs missing either trailer.
- The schema-alignment carve-out above.

**Source**: PO directive, session 13, immediately after entu/research#49 opened.

**Source for the umbrella decision**: Bentham proposal session 2 + PO confirmation.

---

## Data path — browser-direct to Entu (2026-05-23, session 17, CHORE-53/Path C)

**Decision**: mvox does NOT proxy Entu data calls. The frontend authenticates via Entu's OAuth flow client-side and then talks to `api.entu.app` browser-direct, exactly the way Entu's reference frontend (`entu/webapp`) does. The Entu JWT lives in `localStorage` and is sent as `Authorization: Bearer` on every API call. The BFF (CF Worker) is reserved for OAuth coordination + a currently-empty list of genuinely-elevated future operations (transactional email, cron cleanup, federation reports). All data flows browser ↔ `api.entu.app` directly, with no SvelteKit server-side hop.

### Forcing function

After CHORE-50 + CHORE-51 unblocked live OAuth sign-in in session 15, every subsequent BFF-proxied data call 500'd. Root cause: Entu JWTs encode the issuing browser's IP in the `aud` claim; the BFF on Cloudflare Workers proxies from CF Frankfurt egress IPs, so every BFF call returns `401 Invalid JWT audience`. This is not a code bug — it is a foundational incompatibility between mvox's prior "httpOnly cookie + BFF proxy" pattern and Entu's IP-bound JWT design. Three paths considered (Path A: service-entity API key with mvox owning rights enforcement — rejected by PO 2026-05-23 ("if we have to own rights management, why use Entu at all"); Path B: ask Argo to relax IP-binding — rejected as it would weaken Entu's threat model; Path C: mirror `entu/webapp`). Path C selected. Full design at `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`.

### Why this is structurally sound, not a downgrade

1. **It mirrors Entu's reference implementation.** `entu/webapp` (Entu's own open-source production frontend) uses localStorage + Bearer + browser-direct. If Entu ships future best-practice updates, mvox adopts them mechanically.
2. **It accepts Entu's threat model honestly.** IP-binding is the JWT-theft mitigation — a stolen token from a different IP is useless. The prior httpOnly-cookie wrapper *looked* more secure than localStorage, but the BFF proxy made the JWT unusable; the apparent security was theater because data flow could not happen at all.
3. **It realizes the open-platform stance.** Multiple Entu frontends (`entu/webapp`, mvox, future federation peers, third-party UIs) all run the same browser-direct pattern. "Open-platform stance for 3rd-party frontends" stops being aspirational doc text and becomes structurally enforced.
4. **Failure modes shrink.** Auth-cookie state machine vanishes (no "cookie expired but JWT valid" / "cookie present but JWT expired" / "cookie on wrong domain"). The CF-Workers-environment-differs-from-Node trap (CHORE-47 `process.env`) is structurally impossible because there is no CF Worker code in the data path.
5. **Test layer becomes honest.** Tests intercept `api.entu.app` at the network layer (MSW under CHORE-C); every layer runs the same code in tests as in production.

The honest non-win: XSS in mvox now grants the attacker the full Entu API surface as the user for the JWT's remaining lifetime, instead of only the routes the BFF explicitly exposed. The mitigation is IP-binding (stolen token used from a different IP = useless) — the same deal `entu/webapp` accepts. Defensive hygiene under Path C: strict CSP, no third-party scripts in the auth/data flow, careful review of any component that handles untrusted input. See spec §7.1.

### Architecture

```
Browser ──► api.entu.app          (data calls, Bearer from localStorage)
Browser ──► mvox BFF (CF Worker)   (OAuth coordination + future elevated ops only)
```

The BFF retains:

- `/auth/login` — server-renders the provider picker page (i18n stays).
- `/auth/[provider]/+page.svelte` — **client-side** OAuth init: constructs the init URL with state nonce + forward-compat `login_hint` from localStorage, then `window.location` redirects to `api.entu.app/auth/<provider>?next=...`. Mirrors `entu/webapp:app/pages/auth/[provider].vue`. No `+server.ts` here.
- `/auth/callback` — server-renders the spinner shell; client-side JS runs the JWT exchange (browser-direct to `api.entu.app/auth?db=...`) + writes `token` / `accounts` / `user` to localStorage.
- `/auth/logout` — `+page.svelte` that clears localStorage on mount; no server-side state to clear.

Deleted under CHORE-B: `/auth/+server.ts`, `/auth/cookie/+server.ts`, `/auth/logout/+server.ts`, `/api/organizations/+server.ts` + `[id]/sections/+server.ts` + all corresponding `.spec.ts` files. `hooks.server.ts` becomes a no-op (no cookie session under Path C).

### Storage and CSRF model

Browser storage layout:

| Key | Storage | Lifetime | Purpose | Cleared by |
|---|---|---|---|---|
| `token` | localStorage | until expiry / 401 / logout | Entu JWT (`Authorization: Bearer`) | logout, 401 |
| `accounts` | localStorage | until logout | Entu account list (multi-tenant) | logout, 401 |
| `user` | localStorage | until logout | Entu user metadata | logout, 401 |
| `mvox.last_provider` | localStorage | persistent | Last successful OAuth provider id | **logout only** (NOT 401) |
| `mvox.token_version` | localStorage | until version bump | Cache-bust sentinel on JWT shape changes | written by `setToken` only |
| OAuth `state` nonce | sessionStorage | single OAuth round-trip | CSRF protection for OAuth callback | callback verifies + deletes |

Naming rules:
- The first three keys (`token`, `accounts`, `user`) match `entu/webapp` exactly — same names, same shapes. Future devs reading `entu/webapp` source can apply that knowledge directly.
- mvox-specific keys are prefixed `mvox.` — clear namespace boundary, clear devtools signal.
- Return URL never lives in localStorage / sessionStorage independently; it rides inside the OAuth `state` payload (base64url JSON: `{ nonce, return_to, intent }`). Stale return URLs cannot outlive a single OAuth attempt — state is verified-then-consumed atomically on callback.

`/auth/logout` clears all five localStorage keys + sessionStorage; the next sign-in starts at the provider picker (no `login_hint`, no `prompt=none`, no carried account identifier) — load-bearing for users with multiple Google/Apple accounts mapped to different memberships. Involuntary re-auth on 401 (handled by `src/lib/api/wrapper.ts`) clears the same keys EXCEPT `mvox.last_provider`, then redirects to `/auth/<saved-provider>` with `intent=reauth`.

### Wire shapes (canonical)

The two browser-direct call shapes mvox uses today:

- **OAuth init redirect**: `window.location → ${ENTU_API_BASE}auth/${provider}?next=<callback-with-state>[&login_hint=<email>]`. Implementation: `src/routes/auth/[provider]/+page.svelte` → `src/routes/auth/[provider]/build-oauth-init-url.ts`.
- **Session-to-JWT exchange**: `GET ${ENTU_API_BASE}auth?db=${encodeURIComponent(db)}` with `Authorization: Bearer <session-token>`. Implementation: `src/lib/auth/exchange.ts`. Query-form (`?db=...`) is canonical — closes the path-form (`/{db}/auth`) drift that CHORE-50/51 surfaced.

`ENTU_API_BASE` is the single canonical Entu base URL constant from `src/lib/entu-config.ts` (today: `https://api.entu.app/`). The constant must be readable from client code — server-only access (`$env/dynamic/private`) is incompatible with the browser-direct call shape. The per-deployment tenant database is supplied at the call site via `PUBLIC_ENTU_DB` (`$env/static/public`); CF Pages sets it via `wrangler.json` `vars`.

### Carve-out vs default — terminology shift

Sessions 13 / 14 called the OAuth session-token-to-JWT exchange a "carve-out" — a narrow exception to a BFF-default rule. Under Path C the framing inverts: **browser-direct IS the default**, and the OAuth exchange is no longer special. The whole data path now runs the pattern that was previously labeled an exception. What stays narrow is the elevated-ops list (see "BFF elevated-ops list" decision below) — those genuinely cannot live client-side because their secrets / privilege cannot ship to the browser.

### Review enforcement (Bentham)

For any PR touching the auth or data path:

- **GREEN** when client-side calls go to `${ENTU_API_BASE}` directly via `src/lib/entu/client.ts` (or its consumers) and the resulting JWT is read from localStorage via `src/lib/auth/storage.ts`.
- **RED** for any NEW `+server.ts` under `src/routes/api/` that proxies Entu data calls. The data path is browser-direct by decision; new BFF data routes require team-lead approval + an entry on the elevated-ops list with rationale.
- **RED** for any client-side code that reads/writes the Entu JWT outside the `src/lib/auth/storage.ts` helpers (single source of truth for key names + version sentinel).
- **RED** for any code path that writes `user` / `accounts` AFTER `setToken` — see the token-version invariant in `storage.ts`. The contract is: callers MUST sequence `setUser` + `setAccounts` BEFORE `setToken`; `setToken` is the gate that publishes the new auth state with the current version. Reversing the order across a version bump leaves stale data without triggering the wipe.
- **RED** for any `apiRequest` consumer that handles 401 itself instead of letting the wrapper's interceptor fire. The 401 → clear-with-preserve-provider → redirect is centralized.

### What would trigger revision

The decision narrows or expands if any of the following lands:

1. **Entu retires `aud` IP-binding.** Then the data path could optionally move back through a BFF without breakage. The browser-direct default would still stand on the architectural-coherence grounds (Section "Why this is structurally sound" above), but the IP-binding necessity argument vanishes.
2. **Entu publishes a JWKS endpoint.** The BFF could cryptographically verify Entu-issued JWTs server-side, enabling stronger server-side guards on the elevated-ops list. Does not change the browser-direct data default.
3. **A second BFF-resident credential or capability emerges.** Treat as a request to expand the elevated-ops list (next section); requires team-lead approval + rationale.

### Cross-links

- GitHub issue: [mvox-dev/mvox_v4e_web#53](https://github.com/mvox-dev/mvox_v4e_web/issues/53).
- Full design spec: `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-05-23-chore-53-b-rewrite.md`.
- Entu base URL constant: `src/lib/entu-config.ts` (`ENTU_API_BASE`).
- Browser-side auth + API trio: `src/lib/auth/storage.ts` (localStorage helpers + version sentinel), `src/lib/auth/state.ts` (OAuth state payload + CSRF nonce), `src/lib/api/wrapper.ts` (Bearer injection + 401 interceptor).
- Reference frontend (mvox mirrors this): [entu/webapp](https://github.com/entu/webapp) — `app/utils/user.js`, `app/utils/api.js`, `app/pages/auth/[provider].vue`, `app/pages/auth/callback.vue`.
- Finn research: `docs/migration/findings/entu-api-key-expiry-2026-05-20.md` (JWT IP-binding mechanic, §3).
- CHORE-A merge: PR #56 — foundation libraries (`src/lib/auth/{storage,state}.ts`, `src/lib/api/wrapper.ts` skeleton, `EntuClient` move).
- CHORE-B branch: `feat/chore-53b-rewrite` — this decision's implementation.

**Source**: PO direction 2026-05-23, session 17. Brainstorm + spec authored same day. Supersedes the session-2 "BFF user-rights default" decision (the BFF-as-data-proxy default becomes moot — those routes do not exist under Path C) and the session-13 "Client-side Entu carve-out for IP-bound OAuth exchange" decision (today's default is no longer an exception). Closes YELLOW-50.1 + YELLOW-51.1 from session 15 (the wire-shape literal + parenthetical drift in the prior carve-out section is moot — the section is replaced; the canonical wire shapes are stated above).

(*MVOX:Bentham*)

---

## BFF elevated-ops list (2026-05-23, session 17, CHORE-53/Path C)

**Decision**: The BFF (SvelteKit server + CF Worker) hosts a single explicit enumerated list of operations that genuinely cannot run in the user's browser, because their secrets or privilege cannot ship to the client. Every other operation runs browser-direct against `api.entu.app` with the user's JWT (see "Data path — browser-direct to Entu" decision above).

**Current elevated-ops list** (seeded empty under Path C):

- *(none yet — list seeded empty; populate as real ops emerge)*

Anticipated future entries (no implementation today, no commitment to add):

- **Transactional email** (CHORE-6 Resend) — Resend API key cannot ship to the browser.
- **Cron cleanup** — orphan persons, expired invitations/applications, series past `end_date`. Service-account credentials; no human user context.
- **Federation reports** — curated cross-org aggregates. May require service-account read across rights islands.

Adding to the list requires:

1. A written rationale (in the PR description or scratchpad) for why the op cannot run browser-direct under the user's JWT.
2. Team-lead approval.
3. An update to this section listing the new op + the rationale summary.

**Rationale**: The rights model (Entu `_owner` / `_editor` / `_viewer` per entity) is the authoritative API contract. If the BFF has magic capabilities beyond user rights, alternative frontends (`entu/webapp`, mvox-mobile, federation peers, third-party UIs) become second-class. Heuristic: if a frequent user operation needs elevation, the role model is probably wrong. Per case study `$ENTU_RESEARCH/docs/case-studies/2026-05-polyphony-on-entu.md` §B4.

**Review enforcement (Bentham)**: New `+server.ts` under `src/routes/api/` that performs Entu writes/reads with anything other than the caller's JWT → RED unless the op is on this list. New BFF data routes that only proxy user-JWT calls (i.e., would have been browser-direct trivially) → RED for re-introducing the proxy pattern Path C deletes.

**Source**: PO direction 2026-05-23, session 17. Splits out from the prior "BFF user-rights default" decision (session 2) — that decision's BFF-data-proxy default is moot under Path C; what survives is this narrow elevated-ops list.

(*MVOX:Bentham*)

---

## Historical — Client-side Entu carve-out for IP-bound OAuth exchange (2026-05-22, session 13) (SUPERSEDED 2026-05-23 by "Data path — browser-direct to Entu")

**Decision**: A single, narrow carve-out to the BFF user-rights default above and to the canonical "no client→Entu" RED trigger. The OAuth session-token-to-JWT exchange step — and ONLY that step — runs in the user's browser, calling Entu directly. All other Entu API traffic continues through the BFF on the user's JWT.

### Where the carve-out lives

- **File**: `src/lib/auth/exchange.ts` (function `exchangeSession`).
- **Wire shape**: `GET ${ENTU_API_BASE}{db}/auth` with `Authorization: Bearer {sessionToken}` from the browser. `ENTU_API_BASE` is the single canonical Entu base URL constant from `src/lib/entu-config.ts`; whatever value it carries (currently `https://entu.app/api/`) IS the wire-shape literal — citing the constant rather than a hardcoded URL keeps this section drift-free across future base-URL unifications. Entu has historically served both subdomain (`https://api.entu.app/...`) and path (`https://entu.app/api/...`) forms; the canonical form is whatever `ENTU_API_BASE` resolves to today.
- **What flows back through the BFF**: the resulting 48h JWT is POSTed by the same client to `POST /auth/cookie`, where the server validates shape + `exp` and sets the `entu_jwt` httpOnly cookie. From that point onward, all Entu calls are BFF-proxied with the user's JWT, per the BFF user-rights default.

### Why this exchange must be client-side

Entu's session token is **IP-bound**: the resulting JWT's `aud` claim encodes the client IP at mint time, and Entu verifies `aud` on every subsequent API call (see `docs/migration/findings/entu-api-key-expiry-2026-05-20.md` §3). If the IP between session-token mint and JWT mint changes, the exchange silently produces an unusable JWT.

mvox deploys to Cloudflare Pages + Workers (see "Stack" decision above). CF Workers do not preserve the originating browser IP on outbound `fetch` — the call appears to Entu as coming from CF's edge network, not the user. Doing the exchange server-side would mint a JWT bound to a CF edge IP that the user's browser cannot use. Hence: the exchange must happen in the browser, where the IP matches what Entu expects.

This is a property of Entu's auth implementation, not a mvox design choice. Until Entu either drops `aud` IP-binding or publishes a JWKS endpoint that would let us verify Entu-issued JWTs server-side (and route the exchange through a trusted server context), the carve-out stays.

### Carve-out scope (what's allowed)

- Exactly one call path: the OAuth session-token-to-JWT exchange in `src/lib/auth/exchange.ts`.
- The Entu call uses ONLY the session token in `Authorization: Bearer` — no rights elevation, no service-account JWT, no API key.
- The resulting JWT MUST be handed off to `POST /auth/cookie` (server-controlled cookie set) before any further use. The browser does NOT cache or re-use the JWT directly.

### What stays disallowed (Bentham REDs)

- Any other client-side `fetch` to `entu.app` (any subdomain, any path) — outside `src/lib/auth/exchange.ts`. Reads, writes, file uploads, signed-URL retrieval, ALL Entu data traffic continues to flow through the BFF.
- Exposing the `entu_jwt` cookie value to JS (must stay `httpOnly`).
- Removing the `POST /auth/cookie` handoff step — the JWT must travel to the cookie via a server-controlled write, not via JS reading and setting `document.cookie`.

### What would trigger expansion or retirement

The carve-out narrows or disappears if any of the following lands:

1. **Entu publishes a JWKS endpoint.** Then the BFF can verify Entu-issued JWTs server-side, and we have an alternative path: keep the exchange client-side but additionally have the BFF cryptographically verify the JWT before setting the cookie. The carve-out itself doesn't change, but YELLOW-41.3 (JWT signature verification in `/auth/cookie`) closes.
2. **Entu retires `aud` IP-binding** (e.g., switches to a non-IP-bound mint that proves session-token validity by a different mechanism). Then the entire exchange can move server-side and the carve-out is removed — `src/lib/auth/exchange.ts` is deleted; `POST /auth/cookie` either disappears or becomes a strict redirect.
3. **A second IP-bound Entu operation appears.** Treat as a request to widen the carve-out: requires team-lead approval, scratchpad rationale, and an architecture-decisions update. Default posture is to refuse — find a non-IP-bound alternative first.

### Review enforcement (Bentham)

For any PR touching client-side Entu access:

- **GREEN** when the only client→Entu call is the exchange in `src/lib/auth/exchange.ts` and the JWT round-trips through `POST /auth/cookie`.
- **RED** for any other client-side `fetch` whose URL matches `entu.app` (any subdomain) — regardless of the verb, the data, or the operator's intent. Refactor to BFF-route first.
- **RED** for any change to `src/lib/auth/exchange.ts` that broadens the carve-out (additional Entu endpoints, additional verbs, additional credentials carried).

### Cross-links

- Entu base URL constant: `src/lib/entu-config.ts` (`ENTU_API_BASE`). Single source of truth for both server (`src/lib/server/entu/client.ts`) and client (`src/lib/auth/exchange.ts`).
- Finn research artifact: `docs/migration/findings/entu-api-key-expiry-2026-05-20.md` (JWT IP-binding mechanic, §3).
- Finn scratchpad: `teams/mvox-dev/memory/finn.md:70` (IP-binding summary line).
- Bentham #41 review: `teams/mvox-dev/memory/bentham.md` (session-13 #41 entry — pattern entries + 3 YELLOW carryforwards).
- CHORE-41 merge: commit `a506266` (`feat(#41): real OAuth wiring — client-side exchange flow`).
- CHORE-45 hardening (CSRF binding + Entu base URL unify): branch `feat/oauth-hardening`. Introduced `ENTU_API_BASE`; this section's wire-shape line was generalized to cite the constant at the same time (YELLOW-45.1).
- Related decision above: "BFF user-rights default (2026-05-18, session 2)" — this carve-out modifies the "all BFF route handlers default to user-rights" rule by adding a single client-side exchange step *upstream* of the BFF. The user-rights default itself is unchanged for the BFF surface.

**Source**: Bentham #41 review (session 13, 2026-05-22), lifted to settled patterns at team-lead direction the same session. Wire-shape generalization to constant: CHORE-45 / YELLOW-45.1, session 13.

(*MVOX:Bentham*)

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

## Test fixtures pin production defaults — don't DRY them into the value under test (2026-05-21, session 10)

**Decision**: When a production module exports a constant that has a fixed default (e.g., `DEFAULT_BASE_URL = 'https://entu.app/api/'`), the colocated spec should keep the literal `'https://entu.app/api/'` **hardcoded** as a fixture rather than importing the constant. The hardcoded literal acts as a drift-detection pin: if the production constant changes without the spec being updated, the test fails — surfacing the change for review. Importing the constant into the spec turns the assertion into a tautology (`stubEnv(X, X)` always passes regardless of what `X` is) and removes the drift signal.

**Corollary — DRY discipline applies to production-side code, not to test fixtures.** Two production sources of truth for the same value (e.g., `client.ts:1` AND `+server.ts:4` both declaring `const DEFAULT_BASE_URL = ...`) IS a drift bug — fix it by exporting from one and importing into the other. A test that pins the same literal as a fixture is NOT a drift bug — it's the gate that catches drift in the production side. The two surfaces serve opposite purposes; DRY-ing across them collapses the gate.

**Mechanism**:
- Production-to-production drift: real risk. Fix: one source of truth, others import.
- Production-to-test drift: a *feature*, not a bug. The test's hardcoded literal is the "what the value used to be" pin; the assertion against the production constant is what makes the test fail-on-change.
- A test that imports the constant from production loses both the "what it was" pin and the "did it change?" signal — the test still runs and still passes, silently.

**Caveats**:
- Applies to constants representing *stable defaults* (URLs, timeouts, schema versions, port numbers) — values where intentional change should be a reviewable event.
- Does NOT apply to test fixtures derived from production schemas/types (e.g., `import type { Foo }` for type-only consumption; importing the *type* is fine, importing a *value* with the intent of using it as a comparand against itself is the antipattern).
- Does NOT apply to integration tests that need the same actual URL the production code uses to talk to a real backend — those should share the constant to ensure they target the same endpoint.

**Rationale**: Discovered during #20 (YELLOW-2 follow-up, Bentham review of commit `7e36c07`). Josquin's first attempt exported `DEFAULT_BASE_URL` from `client.ts` and imported it into `client.spec.ts:7` to "DRY the literal." The change passed all 288 tests because every test continued to assert what it had always asserted — but the env-stub line `vi.stubEnv('ENTU_BASE_URL', DEFAULT_BASE_URL)` had become a tautology that could no longer fail when the constant changed. Reverted in v2; the spec's literal stays hardcoded as a fixture pin.

**Source**: Bentham review of `7e36c07`, RED verdict, v2 dispatched. Session 10.

**Forward pointer (2026-05-22, session 13)**: The constant has since been renamed to `ENTU_API_BASE` in `src/lib/entu-config.ts` (CHORE-45 / commit `2fa3b7b`). The lesson generalizes to any production-side constant — the example above stays anchored to the original `#20` incident for audit-trail fidelity.

(*MVOX:Bentham*)

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
