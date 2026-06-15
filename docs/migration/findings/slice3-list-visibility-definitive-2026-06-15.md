# Slice-3 LIST-visibility — Definitive Probe Findings

**Date:** 2026-06-15 (session 37)
**Branch:** main
**Commit:** TBD (committed with this file)
**Related issue:** #92 (Slice-3 native keyless invite/join)
**Probe script:** `scripts/migrations/probes/probe-slice3-list-visibility-definitive-2026-06-14.ts`
**Prior art:** `docs/migration/findings/slice3-list-visibility-proxy-2026-06-14.md` (proxy probe, session 37 earlier)

---

## Setup

- **PO key identity** (`69bcfd8e9c031ab8e6ce8079`, `mitselek@gmail.com`): db-root omniscient — used for setup/teardown only. NOT used for LIST queries.
- **Admin identity** (`6a2f3f964cd971291c5d5ca2`, "Mihkel Putrinš by Gmail", `mihkel.putrinsh@gmail.com`, Google uid `people/103228544448049423783`): a genuine second OAuth account. Confirmed **non-omniscient** — not on db-root `_viewer`/`_owner`/`_editor` lists. Created via `add_user` auto-provision on second-account login.
- **EFK org** (`69c7f8718489bfcb0e81b065`, "Eesti Filharmoonia Kammerkoor"): admin granted `_owner` by PO before probe, removed during teardown.
- **Probe singer person** (`6a2f40674cd971291c5d5caf`, `_probe_singer_definitive_s37`): private, `_inheritrights:false`, created by PO key. 404-confirmed deleted after probe.
- **Probe application** (`6a2f40704cd971291c5d5cb6`, `_probe_app_definitive_s37`): private, `_inheritrights:false`, `target_org=EFK`, created by PO key. 404-confirmed deleted after probe.

---

## Results

### Q1: Does a `_viewer`-granted private application appear in the org admin's LIST query?

| Test | Before `_viewer` grant | After `_viewer` grant | Confidence |
|---|---|---|---|
| Admin direct GET `/entity/<appId>` | 403 | 200 (entity returned) | HIGH |
| Admin LIST `?_type.string=application&target_org.reference=<orgId>` | 0 results | 1 result (probe app) | HIGH |
| Admin LIST `?_type.string=application` (unfiltered) | 0 results | 1 result (probe app) | HIGH |
| Admin LIST `?_type.string=application&_viewer.reference=<adminId>` | 0 results | 1 result (probe app) | HIGH |

**VERDICT: GREEN — confirmed.** A `_viewer`-granted private application entity surfaces in ALL LIST query variants for the granted admin. The native keyless approach works without any schema change for the discovery step.

### Q2: Can a newly-provisioned (non-member) account read the org's `_owner` list?

| Test | Result | Confidence |
|---|---|---|
| Admin reads EFK `?props=_owner,_editor,name` BEFORE being granted `_owner` on EFK | Empty entity (`{}`) — org exists (domain sharing) but no properties visible | HIGH |
| Admin reads EFK `?props=_owner,_editor,name` AFTER being granted `_owner` on EFK | Full `_owner` list returned (3 entries: PO person, db entity, admin self) | HIGH |

**VERDICT: `_owner` list is NOT readable by non-members.** A singer account (with no org rights) cannot enumerate the org admins' person IDs by reading the org entity's `_owner` list. The admin discovery step requires a different mechanism (see Implications below).

---

## Teardown Confirmation

All probe artifacts deleted, all deletes returned success:

| Item | Prop/Entity _id | Status |
|---|---|---|
| `_viewer` grant on probe app | `6a2f40834cd971291c5d5cbf` | deleted |
| Probe application entity | `6a2f40704cd971291c5d5cb6` | 404 confirmed |
| Probe singer person entity | `6a2f40674cd971291c5d5caf` | 404 confirmed |
| Admin `_owner` grant on EFK | `6a2f40584cd971291c5d5cae` | deleted |
| Admin `entu_api_key` prop | `6a2f40394cd971291c5d5cad` | deleted (JWT TTL: issued tokens live ~48h, expected) |

Admin person entity (`6a2f3f964cd971291c5d5ca2`, "Mihkel Putrinš by Gmail") **left intact** — PO's real second OAuth account, not a probe artifact.

---

## Implications for Slice-3 Native Keyless Design

**Q1 GREEN means:** the approach-3 happy path works. Once the singer grants `_viewer` on their own `application` entity to the org admin's person ID, the admin's normal LIST query (`?_type.string=application&target_org.reference=<orgId>`) returns the application. No schema change, no service key, no aggregate formula required.

**Q2 finding means:** a singer who has never joined the org cannot enumerate admin person IDs by reading the org's `_owner` list directly. The singer needs the admin's person ID before they can grant `_viewer`. This is the one open gap.

**Resolution options for the discovery gap:**

1. **Federation-mediated invite flow:** The org admin initiates the flow (creates an `invitation` entity, grants singer `_viewer` on it); singer responds — singer never needs to enumerate admins. This matches the approach described in issue #91's native design notes.

2. **Public `_sharing:domain` on a dedicated "contact" entity:** A lightweight org-level contact entity with `_sharing:domain` that exposes one admin person reference — singers can read it without org membership.

3. **Org `_sharing:domain` + explicit `_viewer` on `_owner` prop:** Entu's `_sharing:domain` on the org entity only makes the entity discoverable, not its properties. Would require a deliberate design choice to expose the admin list publicly.

Option 1 (federation-mediated flow) is architecturally cleanest and matches the v4E spec intent. The singer's approach of granting `_viewer` on their own `application` to an admin they already know (e.g., via out-of-band communication or a public org directory page) remains viable for MVP.

---

## [GOTCHA] Notes

- **`add_user` reference picker (Entu UI bug):** The Entu web UI's reference picker for `add_user` only surfaces `menu` entities — cannot select the database entity itself via UI. PO granted `_editor` on the db entity to PO person, then Pérotin set `add_user` via API (bypassing the UI constraint). Entu team should be notified — likely a frontend filter bug.
- **DB entity is platform-owned:** `_owner`/`_editor` on the db entity (`69bcfd8e9c031ab8e6ce807a`) defaults to self-reference (`polyphony` database entity). PO person is only `_viewer`+`_expander` by default → API key gets 403 on any POST without an explicit `_editor` grant.
- **New person `_sharing:domain` + `_inheritrights:true`:** Auto-provisioned persons from `add_user` get `_sharing:domain` and inherit their parent's rights cascade. This makes them visible to other db users, which is correct for a "known member of this Entu instance" model.
- **`_viewer` does NOT confer DELETE:** Admin could READ the probe app (200 on GET, surfaces in LIST) but teardown was done by PO key (`_owner`). Unanswered: does `_viewer` allow DELETE? Likely not — standard rights hierarchy. To be probed separately if needed.

(*MVOX:Pérotin*)
