# Slice 3 — LIST-visibility proxy probe (approach 3 gating question)

**Probed by:** Pérotin  
**Date:** 2026-06-14 (session 37, task #7)  
**Target db:** polyphony (dev playground)  
**Authorization:** team-lead "I authorize this run" 2026-06-14 14:20  
**Probe script:** `scripts/migrations/probes/probe-slice3-list-visibility-proxy-2026-06-14.ts`  
**Result artifact:** `scripts/migrations/seed-results/probe-slice3-list-visibility-proxy-2026-06-14T14-49-56-021Z.json`  
**Cleanup:** all `_probe_*` entities + Test User API key confirmed deleted before this doc was written  

---

## The gating question

> Does a `_viewer`-granted private `application` appear in the org admin's **LIST query**
> (`GET /entity?_type.string=application&target_org.reference=<orgId>`)?
>
> If YES → approach 3 (native keyless + leak-free) needs zero schema change for admin discovery.  
> If NO → an additive discovery mechanism is needed (e.g., aggregate formula on org).

---

## Probe limitations — read before interpreting

**This probe is a proxy.** The definitive test requires two independent OAuth accounts (a non-omniscient admin JWT + a singer JWT). Only one API key was available:

- **PO's key** is the polyphony db-owner. The DB root entity (`69bcfd8e9c031ab8e6ce807a`) has `_inheritrights: true` and lists PO person (`69bcfd8e9c031ab8e6ce8079`) as `_viewer`. This cascades to every entity in the database. PO sees all private entities regardless of explicit grants. **Any PO LIST result is contaminated** — it cannot distinguish "visible via `_viewer` grant" from "visible via db-root cascade."

- **Floor JWT** (Test User `entu_api_key` → `accounts: []`) has no identity binding. It cannot hold meaningful `_viewer` grants because grants target a person entity by reference, and an anonymous-floor JWT has no person binding. It CAN test "no-rights = no visibility."

- **`_owner` strip** (to isolate the grant signal): Entu returned `403 "Can't delete last _owner"`. The strip is not possible when PO is the sole `_owner`. Confirmed empirically.

**What this probe CAN answer:** LIST indexing mechanics, grant POST mechanics, anonymous baseline visibility.  
**What this probe CANNOT answer:** Whether a real non-omniscient org admin's LIST returns a `_viewer`-granted private entity.

---

## Results

### Step 0 — PO identity verification

| Check | Result |
|---|---|
| PO JWT `accounts` bound | YES — `accounts:[{_id:"polyphony", user:{_id:"69bcfd8e9c031ab8e6ce8079"}}]` |
| PO on DB root `_viewer` | YES — cascade omniscience confirmed |

### Step 1 — Floor JWT (Test User `entu_api_key`)

| Check | Result |
|---|---|
| Floor JWT `accounts` | `[]` — no user binding (expected) |
| JWT obtained | YES |

**GOTCHA (new finding):** The correct way to add `entu_api_key` to an existing person entity is via `POST /{db}/entity/{personId}` with `[{type:'entu_api_key', string:'<key>'}]`. The `/properties` endpoint used in recon returned 404. This is consistent with the `postProperties` lib function — the correct endpoint is the entity POST endpoint, not a separate `/properties` suffix.

### Step 2 — Probe singer person

| Property | Value |
|---|---|
| `_sharing` | `private` |
| `_inheritrights` | `false` |

### Step 3 — Probe application (`_probe_app_viewer_test`)

| Property | Value |
|---|---|
| `_sharing` after create | **ABSENT** (private default — confirmed) |
| `_owner` | **PO only** — `[{ref:69bcfd8e9c031ab8e6ce8079, str:"Mihkel Putrinš"}]` |

**Key finding:** When the parent entity (`_probe_singer_person`) has `_sharing: private` + `_inheritrights: false`, the created child does NOT receive the automatic `polyphony` db-entity co-ownership. In all prior probes (entities created under domain-shared parents), newly created entities received `_owner = polyphony (807a)` AND `_owner = PO (8079)`. Here: only PO is `_owner`. This means **`_inheritrights: false` on the parent also blocks the db-entity cascade co-ownership grant at create time.** This is a meaningful finding for the rights model.

### Step 4A — LIST filter mechanics (PO omniscient view, before `_viewer` grant)

| Query | count | app found |
|---|---|---|
| `?_type.string=application&target_org.reference=EFK` | 1 | **YES** |
| `?_type.string=application` (unfiltered) | 1 | **YES** |

**Interpretation (contaminated):** PO can LIST the private application by `target_org.reference` filter. This confirms Entu indexes `target_org` on private entities for LIST responses. Whether a non-omniscient admin would also see it via this filter is the open question.

### Step 5B — Floor JWT (no-rights) baseline, before `_viewer` grant

| Query | Result |
|---|---|
| GET-by-id | **HTTP 403** — entity not accessible |
| LIST `?_type.string=application&target_org.reference=EFK` | count=0, app NOT found |
| LIST `?_type.string=application` (unfiltered) | count=0, app NOT found |

**CONFIRMED:** An identity with no rights cannot see the private application — either by direct fetch or by LIST query (with or without `target_org` filter). The private entity is completely invisible to the floor credential.

### Step 6C — `_owner` strip

| Check | Result |
|---|---|
| Strip PO `_owner` prop value | **FAILED — HTTP 403 "Can't delete last `_owner`"** |
| Entity survived | YES (PO can still GET it via cascade) |
| Remaining owners | PO only (`69bcfd8e9c031ab8e6ce8079`) |

**CONFIRMED:** Entu enforces "at least one `_owner`" — cannot strip the last owner. The `_owner`-strip proxy approach is not viable as a substitute for a second OAuth account.

### Step 7D — `_viewer` grant + post-grant observations

| Check | Result |
|---|---|
| POST `_viewer` grant to PO person | **SUCCESS** |
| PO GET-by-id after grant | **200** (contaminated — PO could already see it) |
| Floor JWT GET-by-id after grant | **HTTP 403** (expected — grant is to PO person, floor JWT has no identity) |
| Floor JWT LIST after grant | count=0, NOT found (expected — same reason) |
| PO LIST `?target_org.reference=EFK` after grant | count=1, **found** (contaminated) |
| PO LIST `?_viewer.reference=<PO>` after grant | count=1, **found** (contaminated) |
| PO LIST (unfiltered) after grant | count=1, **found** (contaminated) |

**Note on `?_viewer.reference=<PO>` filter:** Entu's LIST endpoint accepts `_viewer.reference` as a query parameter and returns matching entities. This is useful information: the API supports filtering by explicit viewer grant. Whether a non-omniscient admin can use this filter to discover their own viewer grants remains untested.

### Step 8 — Confidence verdict

| Sub-result | Trustworthy? | Finding |
|---|---|---|
| LIST `target_org` filter indexes private entities | **Contaminated** — PO is omniscient | Filter WORKS for PO; definitive test deferred |
| Anonymous floor = no visibility (before grant) | **HIGH confidence** | Confirmed 403 GET + empty LIST |
| `_viewer` grant POST mechanics | **HIGH confidence** | Grant succeeds; entity readable post-grant |
| Floor JWT still blind after grant (to non-grantee) | **HIGH confidence** | Expected; confirms grants are identity-specific |
| `_viewer.reference` LIST filter works (under PO) | **Contaminated** | Syntax valid; returns grantee's entities; definitive test deferred |
| Definitive LIST-visibility for non-omniscient admin | **INCONCLUSIVE** | Requires second OAuth account |

---

## What the proxy DOES establish (high-confidence facts)

1. **Private entity is invisible to floor credential** (no rights) — both GET-by-id and LIST return nothing. This is the correct baseline.

2. **`_viewer` grant POST mechanics work correctly.** Granting `_viewer` on a private entity to a specific person reference succeeds.

3. **Entu indexes `target_org` in LIST for private entities** (observed under PO's omniscient view). The filter `?target_org.reference=X` returns the private application. This means Entu does build a LIST index on non-system props for private entities — not just public/domain ones. This is a necessary condition for admin discovery; whether it's sufficient (whether the grant also makes the entity appear in the non-omniscient admin's LIST) is deferred.

4. **`_inheritrights: false` on parent blocks db-entity co-ownership at child create time.** New finding: creating a child under a private+no-inherit parent gives the child only the creator's `_owner`, not the db-entity's automatic co-ownership. This has implications for rights isolation in the singer's subtree.

5. **`_owner` strip is blocked by Entu** (`403 "Can't delete last _owner"`). The proxy workaround is not viable.

6. **`?_viewer.reference=<personId>` is a valid LIST filter** in Entu's query API. This opens an alternative discovery pattern: admin queries for entities where they hold `_viewer`, rather than filtering by `target_org`.

---

## What remains INCONCLUSIVE

**The core gating question.** Does a `_viewer`-granted private `application` appear in a non-omniscient org admin's LIST query? This requires:

1. A real Entu OAuth account (non-db-owner) with `_owner` on EFK as the admin identity.
2. A private entity created under a singer person that the admin has NO rights to by default.
3. A `_viewer` grant from the singer-side to the admin person.
4. A LIST query from the admin JWT to observe before/after.

**Deferred to:** GitHub issue (team-lead filing).

---

## Probe entity state

All probe entities confirmed deleted before this doc was written:

| Entity | ID | Status |
|---|---|---|
| `_probe_app_viewer_test` (application) | `6a2ebf914cd971291c5d5be5` | 404 confirmed |
| `_probe_singer_person` (person) | `6a2ebf914cd971291c5d5bde` | 404 confirmed |
| Test User `entu_api_key` prop | `6a2ebf914cd971291c5d5bdd` | deleted via `DELETE /property/{id}` |

Polyphony db state unchanged from pre-probe.

---

(*MVOX:Perotin*)
