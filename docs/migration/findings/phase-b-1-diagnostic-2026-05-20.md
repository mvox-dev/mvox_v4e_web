# Phase B.1 Diagnostic — 2026-05-20

**Probed by:** Pérotin — read-only, live polyphony db
**Date:** 2026-05-20 (session 8)
**Purpose:** Diagnose the 4 blocked deletes from Phase B live execution (report: `scripts/migrations/reports/2026-05-20-phase-b-2026-05-20T08-57-30-837Z.{md,json}`)

---

## Background

Phase B live execution (session 7) completed with 14 of 18 §3 obsolete-delete operations succeeding. 4 were SAFE-halted by `verifyDeleteSafe`. This diagnostic determines whether each block is legitimate (data still present, real dependency) or a false positive (safety-check overfiring).

---

## Op #1 — organization.contact_email

**Report block reason:** `6 instance(s) of organization still have contact_email set`

**Probe result:** Confirmed. All 6 org instances hold exactly one `contact_email` property value each.

| Entity _id | Property value _id |
|---|---|
| `69c7f8718489bfcb0e81b05a` | `69c7f8718489bfcb0e81b05f` |
| `69c7f8718489bfcb0e81b065` | `69c7f8728489bfcb0e81b06a` |
| `69c7f8788489bfcb0e81b1a9` | `69c7f8788489bfcb0e81b1ae` |
| `69c7f87d8489bfcb0e81b2d9` | `69c7f87d8489bfcb0e81b2de` |
| `69c7f87d8489bfcb0e81b2e4` | `69c7f87d8489bfcb0e81b2e9` |
| `69c7f8868489bfcb0e81b4f0` | `69c7f8868489bfcb0e81b4f5` |

**Assessment:** Block is LEGITIMATE. Cleanup required: DELETE all 6 property value `_id`s (not the entity, not the prop-def — the individual property value entities). After deletion, re-run Phase B and `verifyDeleteSafe` Probe 2 will pass for this op.

---

## Op #2 — organization.org_type

**Report block reason:** `6 instance(s) of organization still have org_type set`

**Probe result:** Confirmed. All 6 org instances hold exactly one `org_type` property value each.

| Entity _id | org_type value | Property value _id |
|---|---|---|
| `69c7f8718489bfcb0e81b05a` | `umbrella` | `69c7f8718489bfcb0e81b05e` |
| `69c7f8718489bfcb0e81b065` | `collective` | `69c7f8728489bfcb0e81b069` |
| `69c7f8788489bfcb0e81b1a9` | `collective` | `69c7f8788489bfcb0e81b1ad` |
| `69c7f87d8489bfcb0e81b2d9` | `umbrella` | `69c7f87d8489bfcb0e81b2dd` |
| `69c7f87d8489bfcb0e81b2e4` | `collective` | `69c7f87d8489bfcb0e81b2e8` |
| `69c7f8868489bfcb0e81b4f0` | `collective` | `69c7f8868489bfcb0e81b4f4` |

**Assessment:** Block is LEGITIMATE. Same shape as Op #1: DELETE all 6 property value `_id`s, then re-run Phase B.

---

## Op #3 — member.joined_at

**Report block reason:** `10 instance(s) of member still have joined_at set`

**Probe result:** Phase B report said 10 instances; live probe found ALL 116 member instances hold `joined_at`. The discrepancy was a YELLOW-13 bug (Probe 2 `limit=10` undercount — fixed in task #54), but here we see the full picture: 116 property value `_id`s to delete.

**Assessment:** Block is LEGITIMATE. All 116 members have `joined_at` set. Cleanup required: DELETE all 116 property value `_id`s. The cleanup script must handle these serially (Entu has no bulk delete — see `project_entu_no_bulk_delete` memory: serial DELETE only).

---

## Op #4 — organization.member_count (prop-def `_id` `69c7ea498489bfcb0e819e96`)

**Report block reason:** `property is referenced by formula on 2 property-def(s)`

**Probe — Probe 1 re-run with word-boundary regex `\bmember_count\b`:**

The formula probe `q=member_count` returns 4 hits. After word-boundary filtering, 2 remain:

### Match 1: the prop-def itself

- `_id`: `69c7ea498489bfcb0e819e96` (the prop-def we want to delete)
- `name`: `member_count`
- `formula`: `"(_child.member.name COUNT) (_child.organization.member_count SUM) SUM"`

This is **self-referential**: the prop-def's own formula string contains `member_count` because it references sub-org `organization.member_count` recursively. The Probe 1 logic fires on the prop-def's own formula — but deleting the entity also deletes all its property values (including the formula). **This match is a false positive.**

### Match 2: member_count_per_section

- `_id`: `6a0d2e8790c8df7a1cc7dfd7` (Phase A-added prop-def on `organization`)
- `name`: `member_count_per_section`
- `formula`: `"SUM(_child section.member_count)"`

This formula references `section.member_count` — a property named `member_count` on `section` entities. The `organization.member_count` prop-def we are deleting lives under the `organization` type. The formula depends on `section.member_count` (a completely different prop-def, `_id` `69c7ea4a8489bfcb0e819ed1`). **This match is also a false positive**: Probe 1 performs a text search over formula strings; it cannot distinguish `organization.member_count` from `section.member_count`. The formula expression `SUM(_child section.member_count)` does NOT depend on the organization prop-def; it traverses `section` children.

### Conclusion: Op #4 is a FALSE POSITIVE

Neither match represents a genuine dependency on `organization.member_count`. The `verifyDeleteSafe` Probe 1 logic is operating correctly — it correctly applies word-boundary filtering — but the probe's design limitation is that it cannot scope formula references to a specific entity type. Both blocking matches are coincidental string overlaps, not semantic dependencies.

**The `organization.member_count` prop-def is safe to delete.** The Probe 1 block for this op requires a manual safety-check bypass with team-lead authorization.

### Probe 1 design gap (for future reference)

`verifyDeleteSafe` Probe 1 searches ALL property-defs (any type) for formulas containing the target property name. It cannot scope the search to: (a) prop-defs of the same parent type, or (b) prop-defs that syntactically reference `parentType.propertyName` vs just `propertyName`. This gap is acceptable for the current scale (small db, few formula-bearing prop-defs), but worth documenting as a known false-positive source for op types with common names (`name`, `type`, `count`, `member_count`).

---

## Summary

| Op | Status | Block type | Cleanup needed |
|---|---|---|---|
| `org.contact_email` | LEGITIMATE block | 6 instance values present | DELETE 6 property value `_id`s |
| `org.org_type` | LEGITIMATE block | 6 instance values present | DELETE 6 property value `_id`s |
| `member.joined_at` | LEGITIMATE block | 116 instance values present | DELETE 116 property value `_id`s |
| `org.member_count` | FALSE POSITIVE | Probe 1 self-ref + cross-type match | Team-lead auth required to bypass safety check |

Ops #1–#3 can be unblocked by the cleanup script (instance data deletion, idempotent, safe).
Op #4 requires team-lead authorization before the cleanup script attempts the prop-def DELETE.

---

(*MVOX:Perotin*)
