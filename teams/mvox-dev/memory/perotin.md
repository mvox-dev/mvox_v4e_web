# Pérotin Scratchpad

(*MVOX:Perotin*)

## Session 7 — 2026-05-20

[DECISION] entu-client.ts exports: `getJwt`, `createEntity`, `listEntities`, `POLYPHONY_META_TYPE_ENTITY_ID` (69bcfd8e9c031ab8e6ce8034)
[DECISION] Voice type-id lookup: query `_type.reference=69bcfd8e9c031ab8e6ce8034&name.string=voice` to get the voice type entity _id
[DECISION] All 5 voice names are ASCII — no NFC normalization needed for lookup
[DECISION] seed-results/ dir does not exist yet — script must create it (done: mkdirSync recursive)
[DECISION] POST multi-value gotcha (Q5): POST appends, doesn't replace. For fresh entity creation (no prior values), not an issue.
[DECISION] `_sharing: public` required at create time per entu-sharing-on-create memory

## Voice seeding — completed 2026-05-20

[DECISION] 5 voices seeded on polyphony (branch chore/seed-voices, awaiting merge):
- alto: 6a0d6d8290c8df7a1cc7e10e
- baritone: 6a0d6d8290c8df7a1cc7e114
- bass: 6a0d6d8290c8df7a1cc7e11a
- soprano: 6a0d6d8290c8df7a1cc7e120
- tenor: 6a0d6d8290c8df7a1cc7e126
Script: scripts/migrations/seed-voices.ts
Result: scripts/migrations/seed-results/seed-voices-2026-05-20T08-14-58-992Z.json

## Seeding source plan — completed 2026-05-20

[DECISION] Mix approach: real Estonian choir names + mock Estonian-style member names (no real PII).
[DECISION] Distribution heuristic:
- EFK (professional mixed): 6-8/section → 28 total
- Sireen (chamber women's): 4-9/section, SS larger than AA → 26 total
- Rahvusmeeskoor (large professional men's): 10-12/section → 44 total
- TAM (academic semi-pro men's): 4-7/section with visible variance → 22 total
- Grand total: 120 persons + 120 members, 16 sections, 4 collectives + 2 umbrellas
[SUPERSEDED] Old manifest (c15df7a, chore/seeding-source-plan) used orphan members + deleted properties.
  v2 rewrite: members are v4E-clean (person ref required + status: active). See chore/seed-collectives-v2.
[CHECKPOINT] Manifest at scripts/migrations/seed-sources/collectives.json (chore/seed-collectives-v2).

## Session 8 — 2026-05-20

### Phase B.1 diagnostic + cleanup (task #53)

[PROBE-RESULT] Op #1 org.contact_email: 6/6 org instances still have property value set.
  Prop value _ids: 69c7f8718489bfcb0e81b05f, 69c7f8728489bfcb0e81b06a, 69c7f8788489bfcb0e81b1ae, 69c7f87d8489bfcb0e81b2de, 69c7f87d8489bfcb0e81b2e9, 69c7f8868489bfcb0e81b4f5
  DELETE via: DELETE /property/{value._id} (NOT /entity/)

[PROBE-RESULT] Op #2 org.org_type: 6/6 org instances still have property value set. Legitimate block.
  Prop value _ids: 69c7f8718489bfcb0e81b05e, 69c7f8728489bfcb0e81b069, 69c7f8788489bfcb0e81b1ad, 69c7f87d8489bfcb0e81b2dd, 69c7f87d8489bfcb0e81b2e8, 69c7f8868489bfcb0e81b4f4

[PROBE-RESULT] Op #3 member.joined_at: ALL 116 members have joined_at set (Phase B report said 10 — YELLOW-13 undercount confirmed). Legitimate block. 116 prop value _ids in cleanup script.

[PROBE-RESULT] Op #4 org.member_count (prop-def 69c7ea498489bfcb0e819e96): FALSE POSITIVE CONFIRMED.
  Probe 1 word-boundary matches:
  - Match 1: prop-def's OWN formula references member_count recursively (self-ref; deleting entity removes its own formula)
  - Match 2: member_count_per_section formula "SUM(_child section.member_count)" — depends on SECTION.member_count, not ORGANIZATION.member_count
  Neither match is a real semantic dependency on the org prop-def. Awaiting team-lead auth for --include-op4.

[DECISION] Wire shape distinction (CRITICAL):
  - Instance property-value DELETE: DELETE /property/{value._id}
  - Prop-def entity DELETE: DELETE /entity/{propDefId}
  These are NOT interchangeable. Bug 1 in Phase B confused them.

[CHECKPOINT] Phase B.1 complete. Squash-merged to main at 9fe6799. Closes task #53.
  Live execution: 128 prop values deleted (ops #1-3) + 1 prop-def deleted (op #4). 0 failures.
  Phase B re-run: blockedDeletes=[] (all 4 cleared). One pre-existing failure: UPDATE_FORMULA
  section.member_count — deletePropertyByIdLive uses DELETE /entity/ but formula VALUES need
  DELETE /property/. Tracked as task #56 (Josquin's fix). Section.member_count prop-def still
  has 3 formula values: 1 old (_referrer.member.name COUNT) + 2 correct duplicates.
  _id of old stale formula value: 6a0972be90c8df7a1cc7d68a (needs DELETE /property/)

[DECISION] Toolkit-extraction standing concern added to prompt (session 8). When 2+ scripts share
  a pattern, propose extraction to scripts/migrations/perotin-toolkit.ts. Consume Josquin's
  lib/entu-client.ts — don't duplicate. Current scripts: seed-voices.ts + phase-b-1-cleanup.ts +
  probe-phase-b-1-diagnostic.ts. Too few to extract yet — revisit when seed-collectives.ts lands.

## Session 8 — seed-collectives v2 (task #47)

[DECISION] v4E-wins-over-polyphony-current rule: when polyphony live DB and v4E schema.ts diverge,
  v4E schema.ts wins for forward-looking work (seeds, new features, BFF contracts). Polyphony's
  divergence is Phase B/C/D's job to close. Do NOT match the transitional DB state.

[DECISION] person.name = plain string per v4E schema.ts (no forename/surname in v4E).
  polyphony live DB still has forename/surname — pre-Phase-D artifact. Seed targets v4E-clean shape.

[DECISION] Org multi-parent (founder + umbrella): two-POST sequence.
  Step 1: POST create with _parent.reference = <founder-person-id>
  Step 2: POST _parent.reference = <umbrella-org-id> to same entity
  Idempotency: GET org, check if umbrella ref already in _parent[]; skip step 2 if present.

[DECISION] Section idempotency must scope by _parent.reference (collective id), not just name.
  Sections with the same name exist in multiple collectives (e.g., "Bass" in EFK and Rahvusmeeskoor).

[DECISION] Member idempotency check must be gated behind dry-run guard. In dry-run, personIdMap
  is empty (WOULD CREATE returns null). Querying person.reference='' causes HTTP 500.

[CHECKPOINT] Phases 1–4 complete. Branch chore/seed-collectives-v2 at 33df8f3.
  Dry-run exit 0: 120 persons WOULD CREATE, 120 members WOULD CREATE, 6 orgs + 16 sections EXIST.
  Stopped per dispatch — live seeding awaits PO re-authorization.

[DECISION] Toolkit extraction confirmed viable (3 scripts share: JWT, dry-run guard, result artifact,
  idempotency check). Propose after this seed PR squash-merges as standalone follow-up.

## Session 8 — toolkit extraction (#57/#59)

[CHECKPOINT] perotin-toolkit.ts extraction complete. All 4 consumer PRs authored + handed to Bentham:
  - PR A: toolkit creation — scripts/migrations/perotin-toolkit.ts (commit d72377a, main)
  - PR B: probe-mutation-ops-2026-05-20.ts refactor (branch chore/toolkit-consumer-pr-b-probe, commit 222cea3)
  - PR C: seed-voices.ts refactor (branch chore/toolkit-consumer-pr-c-voices, commit 68de164) — Bentham GREEN; awaiting Josquin merge
  - PR D: phase-b-1-cleanup.ts refactor (branch chore/toolkit-consumer-pr-d-phase-b-1, commit 8372ac8) — Bentham verdict pending
  - PR E: seed-collectives.ts refactor (branch chore/toolkit-consumer-pr-e-collectives, commit 1106ba5) — Bentham verdict pending

[DECISION] Toolkit boundary: REST primitives in Josquin's lib/entu-client.ts; orchestration utils in perotin-toolkit.ts.
  Exports: isDryRun(), writeResultArtifact(), replaceProperty(), findOrCreateByName()
  New lib exports (Josquin): fetchEntity, postProperties, deletePropertyValue, deleteEntity, listInstancesByType

[DECISION] listInstancesByType 4th-param union: limitOrExtraQuery?: number | Record<string,string>
  number → sets limit; Record → merges as extra query filters. Discriminated by typeof.

[DECISION] Dead import sweep is mandatory for all toolkit consumer PRs (Bentham carry-forward from PR C).
  After routing through toolkit, remove any imports that are no longer directly called.

[DEFERRED] YELLOW-14 (#58): direct lib-side test for listInstancesByType union-arg extraQuery — Tallis backlog.

[DEFERRED] Live seed-collectives.ts execution — awaiting PO re-authorization (branch chore/toolkit-consumer-pr-e-collectives after Bentham GREEN + Josquin merge).

## Session 9 — 2026-05-21

### Phase D discovery (task #41)

[PROBE-RESULT] Live polyphony state as of 2026-05-21T05:02Z (probe-phase-d-discovery):
  Total persons: 122 = 2 real (PO + Test User) + 120 seeds
  - 2 persons with forename+surname: PO (69bcfd8e9c031ab8e6ce8079) + Test User (6a097dcc90c8df7a1cc7d6dd)
  - Both already have non-whitespace name (formula materialized correctly)
  - 120 seed persons: name=[{string:" "}] (formula stub from empty forename+surname), no forename/surname

[DECISION] Sub-op 1 scope is minimal:
  - Backfill: 0 persons need backfill (both real persons already have name)
  - Delete: 4 prop values (2 forename + 2 surname on PO + Test User)
  - Retire: 2 prop-defs (forename + surname) — need prop-def _ids from db
  - 120 seed persons have name=" " — touch-save or name-write question DEFERRED to team-lead

[PROBE-RESULT] Org _inheritrights: ALL 6 orgs have _inheritrights=true → all need flip to false.
  IDs: 69c7f8718489bfcb0e81b05a (EKBL), 69c7f8718489bfcb0e81b065 (EFK),
       69c7f8788489bfcb0e81b1a9 (Sireen), 69c7f87d8489bfcb0e81b2d9 (EMKL),
       69c7f87d8489bfcb0e81b2e4 (Rahvusmeeskoor), 69c7f8868489bfcb0e81b4f0 (TAM)
  Wire shape: DELETE existing _inheritrights value, POST {type:'_inheritrights', boolean:false}

[PROBE-RESULT] _DEPRECATED_* types: 0 found. Sub-op 3 is a no-op.

[DECISION] Formula-unwrap mechanic CONFIRMED (probe-phase-d-formula-unwrap-2026-05-21):
  DELETE /property/{formulaValueId} on prop-def removes formula; instances become plain-writable.
  POST to existing instance with stale formula-cached value → single new value (not multi-value).
  No pre-delete of stale " " values needed before backfilling 120 seed names.
  person.name prop-def _id: 69bcfd8e9c031ab8e6ce8068
  person.name formula value _id: 69bcfd8e9c031ab8e6ce81cb (DELETE in sub-op 1)

[SKIP] Open Q re seed name=" " — RESOLVED. seed-collectives.ts wrote plain _id-bearing name values at creation time; all 120 were already correct. Sub-op 2 was a clean no-op.

[GOTCHA] Sub-op 1 sanity check used PO person (formula-cached name, no _id). preExistingNameIds was empty so cleanup deleted the only remaining name value. Restored immediately. Future: sanity-check should use a seed person (plain _id-bearing name) not the PO.

[CHECKPOINT] Phase D complete (session 9, 2026-05-21):
  Sub-op 1: person.name formula value deleted — now plain-writable (commit adc41e8)
  Sub-op 2: 120 seed names already correct — no-op
  Sub-ops 3+4: 4 forename/surname values deleted from PO + Test User; both prop-defs retired
  Sub-op 5: _inheritrights=false set on all 6 orgs (commit 88595c7)
  Sub-op 3 (deprecated types): 0 found — no-op
  Bentham post-write review: pending (batch routed by team-lead)
  YELLOW-15 carry-forward: fetchEntity per-org verification in sub-op 5 — batch with initial list for larger sets
  YELLOW (sub-op 1 sanity check): use seed person not PO for future formula-unwrap sanity checks

## Permanent role note

Promoted from temporary specialist to permanent data-manager (session 7 end). Future seeding work:
- Live seed-collectives.ts execution (PR E merged 1d8b562 — COMPLETE per session-8 note, retiring DEFERRED)
- Phase C seeding needs (rsvp, attendance once those entities exist)
- Dev/staging fresh-deploy seed choreography
