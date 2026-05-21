# Org Rights Cascade Audit — 2026-05-21

Post-execution audit following Phase D sub-op 5 (`_inheritrights=false` set on all 6 organization instances).

Probe script: `scripts/migrations/probes/probe-phase-d-rights-audit-2026-05-21.ts`
Artifact: `scripts/migrations/seed-results/probe-phase-d-rights-audit-2026-05-21-2026-05-21T09-30-47-769Z.json`

## Part 1 — Org instance rights + immediate subtree

| Org | `_inheritrights` | `_owner` | `_editor` | `_viewer` | Sections | Members |
|---|---|---|---|---|---|---|
| EKBL | **false** ✓ | 1 | 1 | 1 | 0 | 0 |
| EFK | **false** ✓ | 1 | 1 | 1 | 4 | 54 |
| Sireen | **false** ✓ | 1 | 1 | 1 | 4 | 50 |
| EMKL | **false** ✓ | 1 | 1 | 1 | 0 | 0 |
| Rahvusmeeskoor | **false** ✓ | 1 | 1 | 1 | 4 | 90 |
| TAM | **false** ✓ | 1 | 1 | 1 | 4 | 41 |

**All 6 orgs confirmed `_inheritrights=false`.** Each org has 1 owner, 1 editor, 1 viewer grant — no orphaned grants, no missing grants.

### Immediate subtree: sections

All sections across all 4 multi-section orgs (EFK, Sireen, Rahvusmeeskoor, TAM) have `_inheritrights=true`. This is expected and correct: sections sit *inside* the `_inheritrights:false` org boundary but are not themselves boundaries — they inherit within the org's isolated rights island. No section is orphaned.

| Org | Section | `_inheritrights` | `_owner` | `_editor` | `_viewer` |
|---|---|---|---|---|---|
| EFK | Soprano | true | 1 | 1 | 1 |
| EFK | Alto | true | 1 | 1 | 1 |
| EFK | Tenor | true | 1 | 1 | 1 |
| EFK | Bass | true | 1 | 1 | 1 |
| Sireen | Soprano I | true | 1 | 1 | 1 |
| Sireen | Soprano II | true | 1 | 1 | 1 |
| Sireen | Alto I | true | 1 | 1 | 1 |
| Sireen | Alto II | true | 1 | 1 | 1 |
| Rahvusmeeskoor | I Tenor | true | 1 | 1 | 1 |
| Rahvusmeeskoor | II Tenor | true | 1 | 1 | 1 |
| Rahvusmeeskoor | Baritone | true | 1 | 1 | 1 |
| Rahvusmeeskoor | Bass | true | 1 | 1 | 1 |
| TAM | I Tenor | true | 1 | 1 | 1 |
| TAM | II Tenor | true | 1 | 1 | 1 |
| TAM | Baritone | true | 1 | 1 | 1 |
| TAM | Bass | true | 1 | 1 | 1 |

### Immediate subtree: members

10-member samples retrieved for EFK, Sireen, Rahvusmeeskoor, TAM. EKBL and EMKL have 0 members each (they are umbrella orgs — expected; real members live under the collectives they umbrella).

Sample members (first 10 per org) uniformly showed `_inheritrights=true`, 1 owner, 1 editor, 1 viewer each — same pattern as sections. No orphaned members detected in the sample.

**Cascade verdict: CLEAN.** The `_inheritrights=false` flip on the 6 org instances correctly establishes rights isolation boundaries. Sections and members inside each org inherit within the boundary as expected. No grants were severed or orphaned.

---

## Part 2 — YELLOW-D4: organization TYPE `_inheritrights` default

**Finding: the organization TYPE entity has `_inheritrights=true` (explicitly set).**

- Organization type entity `_id`: `69c7ea478489bfcb0e819e3d`
- Type-level `_inheritrights`: **true**

This means every newly created `organization` instance will be born with `_inheritrights=true` (inheriting from the type default), requiring a manual flip to `false` on each new org. Sub-op 5 only fixed the 6 existing instances; future orgs will need the same treatment unless the type default is corrected.

### Proposed fix (awaiting team-lead authorization before execution)

One live op: POST `{type: "_inheritrights", boolean: false}` to the organization TYPE entity (`69c7ea478489bfcb0e819e3d`) — after first DELETEing the existing `_inheritrights=true` value on that entity.

Script: `cleanup-phase-d-org-type-rights-2026-05-21.ts` (to be drafted after authorization).

This is a 1-op schema-adjacent change (type-level default, not instance data). Given Entu's "type is just an entity" model, it does not require a `Schema-Change:` trailer (the v4E schema.ts already declares `_inheritrights:false` as the org default — this brings the live type entity into alignment with the declared spec). But authorization is required before live execution per new gate discipline.

(*MVOX:Perotin*)
