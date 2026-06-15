# Slice-3 `_editor` LIST + DELETE Smoke — Findings

**Date:** 2026-06-15 (session 37)
**Branch:** main
**Related issue:** #92 / #91 (Slice-3 native keyless approve flow)
**Prior probe:** `docs/migration/findings/slice3-list-visibility-definitive-2026-06-15.md` (Q1 `_viewer` GREEN)

---

## Setup

- **PO key** (`69bcfd8e9c031ab8e6ce8079`, `mitselek@gmail.com`): db-root omniscient — setup/teardown only.
- **Admin identity** (`6a2fc05e4cd971291c5d5ddc`, uid `people/103228544448049423783`, `mihkel.putrinsh@gmail.com`): freshly re-provisioned second OAuth account via `add_user`. Confirmed non-omniscient (NOT on db-root `_viewer`/`_owner`/`_editor` lists). Real bound OAuth account (non-empty `accounts`).
- **EFK org** (`69c7f8718489bfcb0e81b065`): admin granted `_owner` for the duration of the probe, removed during teardown.
- **Probe singer** (`6a2fc0a44cd971291c5d5de8`, `_probe_singer_editor_smoke_s37`): private, `_inheritrights:false`. 404-confirmed deleted.
- **Probe application** (`6a2fc0a44cd971291c5d5def`, `_probe_app_editor_smoke_s37`): private, `_inheritrights:false`, `target_org=EFK`, `status=pending`. 404-confirmed deleted.

---

## Results

### Negative control (before any grant)

| Test | Result |
|---|---|
| Admin direct GET `/entity/<appId>` | 403 |
| Admin LIST `?_type.string=application&target_org.reference=<EFK>&status.string=pending` | 0 results |
| Admin LIST `?_type.string=application` (unfiltered) | 0 results |

Negative control clean — admin blind to private application with no explicit grant.

### Positive A: LIST discovery with `_editor` grant

Grant: `[{type:'_editor', reference: <adminPersonId>}]` posted by PO key to probe app.

| Test | Result |
|---|---|
| Admin direct GET `/entity/<appId>` | 200 — entity returned |
| Admin LIST `?_type.string=application&target_org.reference=<EFK>&status.string=pending` | 1 result (probe app) |
| Admin LIST `?_type.string=application` (unfiltered) | 1 result (probe app) |
| Admin LIST `?_type.string=application&_editor.reference=<adminId>` | 1 result (probe app) |

**`_editor` grant surfaces the application in all LIST variants — same as `_viewer`.** HIGH confidence.

### Positive B: DELETE with `_editor` grant

Admin attempts `DELETE /polyphony/entity/<appId>` while holding only `_editor` (no `_owner`):

```
HTTP 403 — "User not in _owner property"
```

**`_editor` does NOT permit DELETE.** DELETE requires `_owner`. HIGH confidence.

---

## Teardown

All 5 items deleted successfully by PO key:

| Item | Prop/Entity _id | Status |
|---|---|---|
| `_editor` grant on probe app | `6a2fc0b64cd971291c5d5df9` | deleted |
| Probe application entity | `6a2fc0a44cd971291c5d5def` | 404 confirmed |
| Probe singer person entity | `6a2fc0a44cd971291c5d5de8` | 404 confirmed |
| Admin `_owner` grant on EFK | `6a2fc09b4cd971291c5d5de7` | deleted |
| Admin `entu_api_key` prop | `6a2fc0934cd971291c5d5de6` | deleted |

Admin person (`6a2fc05e4cd971291c5d5ddc`) left intact. `entu_api_key` confirmed absent.

---

## Implications for Slice-3 Native Approve Flow

**`_editor` LIST: GREEN** — the approve-side discovery mechanic works identically whether the singer grants `_viewer` or `_editor` on their application. Both grant types surface the entity in the admin's `target_org`-filtered LIST.

**`_editor` DELETE: RED (403)** — the admin cannot delete the singer's application after approving it, even with `_editor`. Entu requires `_owner` for entity deletion ("User not in `_owner` property").

### Consequences for the approve flow

The approve flow must handle post-approval cleanup without relying on admin DELETE. Options:

1. **Application self-expires (status field):** After admin creates the `member` entity (approve action), the application entity's `status` is updated to `approved` (admin has `_editor`, so property writes are fine). The application entity persists but is filtered out of pending-application LIST queries by `status.string=pending`. Clean-up of the entity itself can happen on a cron basis by PO key, or simply left as historical record.

2. **Singer deletes own application post-approval:** The singer holds `_owner` on their own application (they created it). After receiving confirmation that membership was granted (e.g., seeing themselves in the org member list), they can DELETE their own application. This is user-driven and requires no elevated rights.

3. **Grant admin `_owner` (not `_editor`) on the application at approve-time:** The singer initially grants `_viewer` or `_editor` for discovery; the approve flow (on the admin's side) could also grant themselves `_owner` on the application before deleting it. But this requires the admin to first have `_editor` to add their own `_owner` — and Entu may block self-`_owner` promotion. Not probed; may be a dead end.

**Recommended path for MVP:** Option 1 (status-field soft-close). Admin approves by creating `member` + setting `application.status='approved'`. Application entity persists as audit trail. Singer cleans up later (Option 2) or a cron sweeps old approved applications. No `_owner` escalation needed.

---

## Rights Hierarchy Confirmed

From these two probes (`_viewer` probe + this `_editor` probe), Entu's rights hierarchy for entity operations is:

| Right | LIST/GET | POST properties | DELETE entity |
|---|---|---|---|
| `_viewer` | YES | NO | NO |
| `_editor` | YES | YES | NO |
| `_owner` | YES | YES | YES |

---

## Addendum: `_editor` status-write (soft-close) smoke — 2026-06-15

**Authorization:** team-lead 09:30, session 37. Same second-account harness (`6a2fc05e4cd971291c5d5ddc`).

### Setup

Same pattern as above. Probe app (`6a2fc5fe4cd971291c5d5e05`) created with `status:'pending'`; admin granted `_editor`; confirmed in pending LIST (count=1) before status-write test.

### The multi-value trap: plain POST appends

`POST [{type:'status', string:'approved'}]` by the `_editor` admin **appended** a second value — both `pending` and `approved` coexisted on the entity:

```json
"status": [
  { "_id": "…e0c", "string": "pending" },
  { "_id": "…e10", "string": "approved" }
]
```

Result: entity appeared in BOTH `?status.string=pending` (count=1) AND `?status.string=approved` (count=1) LISTs simultaneously. Plain POST alone is insufficient for a clean soft-close.

### Clear-first works — `_editor` CAN delete property values

`DELETE /polyphony/property/<pending-prop-_id>` by the `_editor` admin:

```
HTTP 200 — { "deleted": true }
```

After the delete, only `approved` remained. The entity **dropped from the pending LIST** (count=0) and appeared only in the approved LIST (count=1).

**Key finding:** `_editor` permits `DELETE /property/{propValueId}` (deleting individual property values) even though `_editor` cannot `DELETE /entity/{id}`. These are different endpoints with different rights requirements — see `project_entu_wire_shape_entity_vs_property`.

### Exact wire sequence for Josquin

To soft-close an application (pending → approved) as an `_editor`-granted admin:

```
# Step 1: Read current status prop _id(s)
GET /{db}/entity/{applicationId}?props=status
→ capture each status value's "_id"

# Step 2: Delete the old value(s)
DELETE /{db}/property/{pendingPropValueId}
→ { "deleted": true }

# Step 3: POST the new value
POST /{db}/entity/{applicationId}
Body: [{"type": "status", "string": "approved"}]
→ { "_id": "...", "properties": [{ "_id": "...", "type": "status", "string": "approved" }] }
```

This is the standard Entu replace-semantics pattern per `project_entu_post_appends_multi_value` (clear existing prop _ids, then POST new value). **All three steps succeed with `_editor` rights** — no `_owner` required.

### Updated rights table

| Right | LIST/GET | POST (add/append prop) | DELETE prop value | DELETE entity |
|---|---|---|---|---|
| `_viewer` | YES | NO | NO | NO |
| `_editor` | YES | YES | YES | NO |
| `_owner` | YES | YES | YES | YES |

### Confidence

HIGH. Live probe on polyphony playground with non-omniscient second account. All steps confirmed on real Entu API.

### Teardown

5/5 clean, all probe entities 404-confirmed. Admin person `6a2fc05e4cd971291c5d5ddc` left intact.

(*MVOX:Pérotin*)
