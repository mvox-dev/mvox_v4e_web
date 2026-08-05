# Entu Rights & Visibility Model — Verified Reference

**Status:** VERIFIED GROUND. Every claim below carries a `file:line` reference read directly from `entu-api` source (`~/projects/entu-api`) during the 2026-08-05 verification pass (Q1/Q1b) and the 2026-07-19 bucket review. Nothing here is inferred, and nothing is carried from a repo doc — repo docs are convenience summaries, not authority for Entu mechanics.

**Scope:** the rights, sharing, and cross-database visibility mechanics that the mvox single-collective design rests on. This is the reference; when it and any older doc disagree, this wins.

**Supersedes wholesale** (do not reconcile piecemeal — treat as replaced):
- `docs/migration/v4e-divergence-2026-05-19.md` §5.2 ("per-property sharing not a first-class Entu concept" — **wrong**, see §3)
- The INFERENCE section of `docs/migration/findings/entu-property-bucket-visibility-2026-07-19.md` (the "0 of 21 prop-defs have sharing" claim and the stale-bucket explanation built on it — **wrong**; the SOURCE-VERIFIED and LIVE-MEASURED sections of that doc stand)
- Any "no entity-to-entity grants" claim stated as a source-enforced rule (see §6 for the accurate version)

**Provenance key:** [P] = read directly by Palestrina this pass · [F] = read directly from source by Finn this pass (auth chain). No third category — if it isn't one of these, it isn't in this document.

---

## 1. Three property buckets, built at WRITE time  [P]

Every entity write runs `aggregateEntity` (`utils/aggregate.js`), which materializes three property objects on the stored document:

- `propertiesToEntity` seeds `private` / `domain` / `public` as empty objects plus an `access` array (`aggregate.js:312-320`).
- All actual property values always populate `private`. `domain` and `public` are selectively populated copies (§3).

The buckets are **snapshots taken at write time**, not computed at read time. This is the single most important structural fact: a read returns whatever was last written into these objects.

---

## 2. Read returns EXACTLY ONE bucket  [P]

`cleanupEntity` (`utils/entity.js:569-612`) selects one bucket by reader tier (`entity.js:573-586`):

```js
if (entu.userStr && entity.access?.map(x => x.toString())?.includes(entu.userStr)) {
  result = { ...result, ...entity.private }        // explicit grant → everything
} else if (entu.userStr && entity.access?.includes('domain')) {
  result = { ...result, ...entity.domain }          // authenticated in-db → domain bucket
} else if (entity.access?.includes('public')) {
  result = { ...result, ...entity.public }          // anyone → public bucket
} else {
  return                                            // → 403 "No accessible properties"
}
```

First match wins. The route handler turns the `undefined` return into `403 "No accessible properties"` (`routes/[db]/entity/[_id]/index.get.js:97-102`).

**Why `private` is robust:** `getAccessArray` (`utils/rights.js:76-97`) builds `access` by pushing the entity's own `_sharing` string in as a **literal** (`rights.js:80-82`) alongside each granted person reference (`rights.js:84-94`). A `private` entity gets the literal `'private'` in `access` — which matches neither the `'domain'` nor `'public'` branch, and is not a person id, so **only an explicit grant reaches it**. There is no string coincidence that could make `'private'` satisfy a `'domain'`/`'public'` check.

---

## 3. Per-property sharing IS first-class — it lives on the property DEFINITION  [P]

Bucket placement is decided per property, using **two** `_sharing` values:

1. The **property definition's** own `_sharing`, projected during aggregation: `sharing: { $arrayElemAt: ['$private._sharing.string', 0] }` (`aggregate.js:86`).
2. The **entity type's** own `_sharing`, fetched once as a cap: `definitionSharing = definitionEntity?.private?._sharing?.at(0)?.string` (`aggregate.js:94`).

Cap logic (`aggregate.js:113-121`):

```js
let sharing = definition[d].sharing
if (!definitionSharing) { sharing = undefined }                                       // type unshared → nothing exposed
else if (definitionSharing === 'domain' && definition[d].sharing === 'public') { sharing = 'domain' }  // type caps public→domain
```

Bucket write (`aggregate.js:148-154`):

```js
if (sharing === 'domain' && dValue) { newEntity.domain[name] = dValue }
if (sharing === 'public' && dValue) { newEntity.domain[name] = dValue; newEntity.public[name] = dValue }
```

A property whose definition is `private` (or unset) satisfies neither branch → its value is written **only** to `private`, never to `domain`/`public`.

**Second retention gate** (`aggregate.js:269-275`): even after the above, `newEntity.domain` / `newEntity.public` are deleted wholesale unless the **entity's own** `_sharing` equals `'domain'` / `'public'`. So a property is exposed at a tier only if BOTH the property-definition's `_sharing` AND the entity's own `_sharing` allow it.

**This is the contact-subset mechanism.** On one `person` type, set the prop-defs `name`/`email`/`phone` to `_sharing:domain` and `idcode`/`birthdate`/`notes` to `_sharing:private`; with the person entity itself `_sharing:domain`, an in-collective reader receives the first set and never the second. Source-deterministic. *(Operational note: changing `_sharing` on an already-populated prop-def requires re-aggregating existing instances, since buckets are write-time snapshots — moot for mvox because import is last, so prop-def sharing is set correctly at type-creation with no instances to re-aggregate.)*

---

## 4. The database boundary IS a read boundary  [F]

"One Entu install per collective → `domain` = in-collective visibility" holds, enforced by code, not by data state.

The domain read-gate needs `entu.userStr` truthy (§2). Its value:

- The **target db comes from the URL path**, not the token: `entu.account = ...event.path.split('/').at(1)` (`middleware/auth.js:21`).
- **Anonymous excluded:** no Bearer token → the auth block is skipped → `userStr` stays `undefined` (`middleware/auth.js:31-33`).
- **The gate** (`middleware/auth.js:46-48`):
  ```js
  if (entu.account && entu.token.accounts?.[entu.account]) {
    entu.userStr = entu.token.accounts[entu.account]
  }
  ```
  `userStr` is set only if the JWT's `accounts` map has an entry for the db being read.
- **`accounts` is populated per-db by real person existence:** the `/auth` exchange enumerates every db on the platform (`routes/auth/index.get.js:132`) and, for each, adds an entry only if a `person` entity **inside that db's own collection** matches the login's OAuth identity or API-key hash (`index.get.js:141-190`, map built at `:254`).
- Same gate independently confirmed for the GraphQL path (`utils/graphql/schema.js:87-124`, `:109-111`).

**Consequence:** a user authenticated against install X cannot read `domain` entities in install Y unless they genuinely have a `person` entity in Y. The JWT secret is shared platform-wide (`auth.js:35-36`), so signature validity alone proves nothing about db scope — the `accounts[db]` lookup is what scopes access.

**Not "one JWT = one collective":** if the same OAuth identity has a real person in two dbs, one JWT carries `accounts` for both and reads `domain` in both. This is not a boundary bypass (each requires a genuine person in that db). Ruled out of scope for mvox 2026-08-05 (person-per-collective stands; cross-install identity is Entu's concern) — recorded here as a mechanism fact, not an open question.

---

## 5. Changing `_sharing` requires `_owner`  [P]

`_sharing` is a rights-type property. Writing or deleting any rights-type property requires the caller be in the entity's `_owner` list.

- `rightTypes` = `['_noaccess','_viewer','_expander','_editor','_owner','_sharing','_inheritrights']` (`utils/entity.js:21-29`).
- POST gate: a write touching any rights-type property 403s "User not in _owner property" unless the caller's `userStr` is in `_owner` — **or** the caller is a `systemUser` (service key), which bypasses the check (`entity.js:115-121`).
- DELETE has the same gate (`routes/[db]/property/[_id]/index.delete.js:140`).

**Consequence:** an auto-provisioned person gets `_editor: self`, not `_owner`, so a user **cannot change their own person's `_sharing`** on their own JWT. Any runtime `_sharing` change needs the service key. *(Largely moot under single-collective: person sharing posture is set on the type's prop-defs at creation, §3, not per-instance at runtime.)*

---

## 6. Rights references are NOT type-constrained — but entity-to-entity grants confer nothing  [P]

**Correcting a claim we previously overstated.** The write path does **not** require a rights reference to point at a person. `refCheckedTypes` (`entity.js:138`) validates only that the referenced entity **exists** — any type, projection `_id` only (`entity.js:141-153`). The API would accept `_viewer: <org-entity-id>`.

But such a grant is inert. The read gate matches a reader's own person id (`userStr`) against `access` (§2), and `getAccessArray` pushes each grant's `reference` verbatim (`rights.js:84-94`). An org-entity id placed in `access` matches no reader's `userStr`, so it grants **no** transitive "anyone in org O can see this" access — it is a dead reference.

**So:** there is no group/membership-expansion primitive. The only transitive-visibility mechanism is the `_inheritrights` parent→child cascade (a structural relationship, not a rights reference). A design needing "collective members can resolve person X" must use either `domain` sharing (§3, the single-collective answer) or per-person grants — not an org-as-viewer shortcut.

---

## What this changes for the single-collective design

- In-collective visibility = `domain` sharing, gated by the db boundary (§4). One install = one collective = one visibility domain. No org entity, no grants, no cascade needed for basic member visibility.
- Contact-info subset = per-prop-def `_sharing` (§3): contact fields `domain`, sensitive fields `private`, on one person type.
- Set prop-def sharing at type-creation (§3 operational note); no runtime `_sharing` changes, so §5's `_owner`/service-key constraint doesn't bind the happy path.

---

## Discipline note (why this doc exists)

Between 2026-07-17 and 2026-07-19 the same rights/sharing questions produced three confident, published, and wrong conclusions in a row. Every failure began with a repo doc that read as authoritative and was not; every claim read directly from `entu-api` source held up. The structural fix is this document plus one rule:

> **Claims about Entu mechanics cite `entu-api` source `file:line`, or are marked unverified. Repo docs — including findings docs — are summaries, not authority.**

(*MVOX:Palestrina*) — auth-chain verification (§4) by Finn, same pass.
