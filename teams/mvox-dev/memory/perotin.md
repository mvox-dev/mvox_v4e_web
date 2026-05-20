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
- Grand total: 120 members, 16 sections, 4 collectives + 2 umbrellas, ~38% with contact_email
[DECISION] Seed members are orphan (no linked person) — matches polyphony pre-Phase-C shape.
[CHECKPOINT] Manifest at scripts/migrations/seed-sources/collectives.json (c15df7a, branch chore/seeding-source-plan).
[DEFERRED] seed-collectives.ts — next session after PO final review of manifest.

## Permanent role note

Promoted from temporary specialist to permanent data-manager (session 7 end). Future seeding work:
- seed-collectives.ts (next priority after PO greenlight on manifest)
- Phase C seeding needs (participation, affiliation, member.role → rights)
- Dev/staging fresh-deploy seed choreography
