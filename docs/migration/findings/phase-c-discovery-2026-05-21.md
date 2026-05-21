# Phase C Discovery — Live Polyphony State

**Date:** 2026-05-21  
**Probe:** `scripts/migrations/probes/probe-phase-c-discovery-2026-05-21.ts`  
**Artifact:** `scripts/migrations/seed-results/probe-phase-c-discovery-2026-05-21T14-33-33-624.json`  
**Authorization:** Read-only. No mutations.

---

## Summary

| Entity type | Live count | Notes |
|---|---|---|
| `inventory_copy` | **0** | No instances exist |
| `participation` | **0** | No instances exist |
| `affiliation` | **4** | One per collective; collective↔umbrella links only |
| `member` with `role` set | **4** (of 235) | PO's member in each of the 4 collectives; "Owner" + "Admin" on each |

---

## 1. inventory_copy — 0 instances

No `inventory_copy` entities exist on polyphony. The Phase C redesign (inventory_copy → `copy` + `lending`) is a pure schema/type-definition change — no instance data to migrate or delete.

**Phase C implication:** Sub-phase for inventory_copy is type-def cleanup only. No instance-level migration ops.

---

## 2. participation — 0 instances

No `participation` entities exist. The Phase C split (participation → `rsvp` + `attendance`) is likewise a pure schema/type-definition change.

**Phase C implication:** Sub-phase for participation is type-def cleanup only. No instance-level migration ops.

---

## 3. affiliation — 4 instances

All 4 affiliation instances have the same shape:

```
_parent:    → organization (the collective: EFK / Sireen / Rahvusmeeskoor / TAM)
collective: → organization (same collective as _parent — redundant reference)
umbrella:   → organization (the umbrella org: EKBL or EMKL)
joined_at:  date (2026-03-28 for all 4)
name:       formula string "Collective @ Umbrella" (no _id — formula-computed)
```

**Key observations:**
- These entities model **collective↔umbrella federation links**, not person affiliations. There is no `person` property on any of them.
- The `collective` property duplicates `_parent.reference` — appears to be a denormalization for formula use (the `name` formula reads `collective.*.name @ umbrella.*.name`).
- `_sharing: domain` (3 values each — appears to be a polyphony-era multi-value artifact, same pattern as Phase B org cleanup).
- `_inheritrights: true` on all 4 (not yet flipped to false — these are not `organization` instances so Phase D sub-op 5 didn't touch them).

**Phase C implication:** The `affiliation` entity type in polyphony is **not a person-affiliation join** — it is a collective-to-umbrella structural link. v4E schema has no `affiliation` type; these 4 instances either map to the structural `_parent` multi-parent relationship that already exists on orgs (umbrella is already a `_parent` of the collective) or they are fully redundant. Team-lead/PO decision required: **delete the 4 affiliation instances + retire the type-def**, or verify whether `affiliation` carries rights or formula semantics not replicated by the existing `_parent` link.

The `name` formula string ("Collective @ Umbrella") is the only unique value. The umbrella reference in `affiliation.umbrella` is also present as a `_parent` on the org itself (e.g. EFK has both `_parent: EFK-founder-person` and `_parent: EKBL`). The `affiliation` entity appears structurally redundant.

---

## 4. member.role — 4 of 235 members

**4 members** have the `role` property set, all belonging to the PO (Mihkel Putrinš):

| member _id | org | role values |
|---|---|---|
| 69c7f8728489bfcb0e81b085 | EFK | Owner, Admin |
| 69c7f8788489bfcb0e81b1c9 | Sireen | Owner, Admin |
| 69c7f87e8489bfcb0e81b2f9 | Rahvusmeeskoor | Owner, Admin |
| 69c7f8878489bfcb0e81b50f | TAM | Owner, Admin |

(The 231 seeded members have no `role` set — v4E-clean seeds never wrote `role`.)

`role` is a **reference** property (points to `role`-type entities: `69c7f8708489bfcb0e81b020` = "Owner", `69c7f8708489bfcb0e81b02e` = "Admin"). The string label is computed.

**Phase C implication:** Per `project_polyphony_roles_as_rights` memory, the `role` property on `member` is being retired in favour of rights grants:
- "Owner/Admin" → `_owner` on the org (cascade covers full subtree)
- "Librarian" → `_editor` on library
- etc.

The PO's 4 members currently carry `role: [Owner, Admin]`. The rights implication (PO already has `_owner` on the org entities from the seed setup) means these `role` values are already backed by the correct rights grants. Migration ops: delete the 8 role-reference property values from the 4 members, then retire the `role` prop-def and the `role` entity type instances.

**Count of ops:** 8 property-value DELETEs (2 per member × 4 members) + prop-def + role entity-type cleanup. Very small.

---

## Scope Collapse Summary

Phase C was expected to be the most complex migration. The live data tells a different story:

| Sub-phase | Expected scope | Actual scope |
|---|---|---|
| inventory_copy → copy+lending | Instance migration | **Type-def only** (0 instances) |
| participation → rsvp+attendance | Instance migration | **Type-def only** (0 instances) |
| affiliation retire | Instance cleanup | **4 instances** (collective↔umbrella links, not person affiliations) — confirm redundancy with PO before delete |
| member.role → rights grants | Rights migration across all members | **8 property-value DELETEs** (4 members × 2 role values, PO only) |

This is ~Phase D level effort (handful of targeted ops), not the large structural migration Phase C was scoped as.

(*MVOX:Pérotin*)
