# Pérotin Scratchpad

(*MVOX:Perotin*)

## Session 7 — 2026-05-20

[DECISION] entu-client.ts exports: `getJwt`, `createEntity`, `listEntities`, `POLYPHONY_META_TYPE_ENTITY_ID` (69bcfd8e9c031ab8e6ce8034)
[DECISION] Voice type-id lookup: query `_type.reference=69bcfd8e9c031ab8e6ce8034&name.string=voice` to get the voice type entity _id
[DECISION] All 5 voice names are ASCII — no NFC normalization needed for lookup
[DECISION] seed-results/ dir does not exist yet — script must create it
[DECISION] POST multi-value gotcha (Q5): POST appends, doesn't replace. For fresh entity creation (no prior values), not an issue.
[DECISION] `_sharing: public` required at create time per entu-sharing-on-create memory
