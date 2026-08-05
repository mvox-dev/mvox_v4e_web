# Entu Property Bucket Visibility — Source-Verified Correction

**Date:** 2026-07-19
**Branch:** main
**Related issue:** #93 (person privacy model)
**Probe scripts:**
- `scripts/migrations/probes/probe-person-domain-sharing-2026-07-19.ts` (bucket-selection reads, one mutation + teardown)
- `scripts/migrations/probes/probe-person-sharing-census-2026-07-19.ts` (population census, read-only, added by Palestrina after the first draft of this doc to give the numbers below provenance)

**Result artifacts:**
- `scripts/migrations/seed-results/probe-person-domain-sharing-2026-07-19T18-29-22-931Z.json`
- `scripts/migrations/seed-results/probe-person-sharing-census-2026-07-19T18-38-36-647Z.json`

**Update, 2026-08-05:** the model's central claim — a property reaches the domain tier only if its *definition* carries `_sharing:domain`, independent of the entity's own `_sharing` — was live-confirmed end-to-end via a real (non-synthesized) member browser token, using a dedicated PO-directed experiment. See "LIVE-CONFIRMED, 2026-08-05" below. Scripts: `scripts/migrations/probes/probe-mvox-collective-unshared-prop-2026-08-05.ts`, `scripts/migrations/cleanup-mvox-collective-test-hidden-2026-08-05.ts`. Artifacts: `scripts/migrations/seed-results/probe-mvox-collective-unshared-prop-2026-08-05T19-16-50-962Z.json`, `scripts/migrations/seed-results/cleanup-mvox-collective-test-hidden-2026-08-05T19-25-03-533Z.json`.

**Supersedes:** `docs/migration/v4e-divergence-2026-05-19.md` §5.2 — see "Supersession" below. Note the path correction: that file lives at `docs/migration/v4e-divergence-2026-05-19.md`, **not** under `docs/migration/findings/`.

---

## TL;DR

Two things we told the PO on issue #93 were both wrong:

1. **"`_sharing` is discoverability-only"** — wrong. `_sharing` (combined with a property definition's own `sharing` field) determines which of three property *buckets* get populated at write time, and a reader who matches a bucket gets the whole bucket's contents, not just an existence signal.
2. **"Per-property sharing is not a first-class Entu concept"** — wrong. It is: it lives on the `sharing` field of the property-**definition** entity (the `property`-typed entity parented under an entity-type), not on the instance.

---

## SOURCE-VERIFIED: the three-bucket model

All line numbers below verified by reading `~/projects/entu-api` directly (not taken on trust from the dispatch brief).

### Write time: `aggregateEntity` builds three buckets

`utils/aggregate.js`. `aggregateEntity` materializes a `private` / `domain` / `public` object on every entity write (`propertiesToEntity`, called at `utils/aggregate.js:49`, seeds all three as empty objects — see `utils/aggregate.js:312-320`).

For each property definition of the entity's type (`utils/aggregate.js:112-156`):

```js
// utils/aggregate.js:112-121
let sharing = definition[d].sharing

if (!definitionSharing) {
  sharing = undefined
}
else if (definitionSharing === 'domain' && definition[d].sharing === 'public') {
  sharing = 'domain'
}
```

`definitionSharing` (`utils/aggregate.js:94`) is the entity-**type**'s own `_sharing`, fetched once per aggregation. This is the cap: a property definition marked `sharing: public` is downgraded to `domain` if the owning type is only `domain`-shared. If the type carries no `_sharing` at all, every property's `sharing` is forced to `undefined` regardless of what the definition says — no property is ever exposed at domain/public tier under an unshared type.

The write itself (`utils/aggregate.js:148-155`):

```js
if (sharing === 'domain' && dValue) {
  newEntity.domain[definition[d].name] = dValue
}

if (sharing === 'public' && dValue) {
  newEntity.domain[definition[d].name] = dValue
  newEntity.public[definition[d].name] = dValue
}
```

A `public`-shared property lands in **both** `domain` and `public`; a `domain`-shared property lands only in `domain`. There is no per-property mechanism to expose to `public` without also exposing to `domain` — that's structurally impossible given this code.

**Bucket retention is gated by the entity's own `_sharing`, independent of what got written into it** (`utils/aggregate.js:269-275`):

```js
if (newEntity.private?._sharing?.at(0)?.string !== 'domain' || Object.keys(newEntity.domain).length === 0) {
  delete newEntity.domain
}

if (newEntity.private?._sharing?.at(0)?.string !== 'public' || Object.keys(newEntity.public).length === 0) {
  delete newEntity.public
}
```

So even though a `public`-shared *property* populates both `domain` and `public` objects, a `domain`-shared *entity* still has its `public` bucket deleted wholesale at the end of aggregation (its own `_sharing` isn't `'public'`). The entity-level `_sharing` is the final gate on which buckets survive at all.

### Read time: `cleanupEntity` returns exactly one bucket

`utils/entity.js:569-612` (`cleanupEntity`, full function body — this line range matches the dispatch brief exactly). Selection logic, `utils/entity.js:573-586`:

```js
if (entu.userStr && entity.access?.map((x) => x.toString())?.includes(entu.userStr)) {
  result = { ...result, ...entity.private }
}
else if (entu.userStr && entity.access?.includes('domain')) {
  result = { ...result, ...entity.domain }
}
else if (entity.access?.includes('public')) {
  result = { ...result, ...entity.public }
}
else {
  return
}
```

Three-way branch, first match wins: explicit grant → whole `private` bucket; else authenticated + domain access → `domain` bucket; else public access → `public` bucket; else `return` (`undefined`).

The route handler turns that `undefined` into the 403 the brief cited: `routes/[db]/entity/[_id]/index.get.js:97-102`:

```js
if (!cleanedEntity) {
  throw createError({
    statusCode: 403,
    statusMessage: 'No accessible properties'
  })
}
```

### `access` construction: why `_sharing` is a literal, not a rights check

`utils/rights.js:76-97` (`getAccessArray`). The relevant lines, `utils/rights.js:80-82`:

```js
if (entity._sharing?.at(0)?.string) {
  access.push(entity._sharing?.at(0)?.string.toLowerCase())
}
```

The entity's own `_sharing` string (`'public'`, `'domain'`, or `'private'`) is pushed into `access` as a **literal string**, alongside every explicitly-granted user reference (`_viewer`/`_expander`/`_editor`/`_owner`, lines 84-94). A `private` entity gets the literal `'private'` in `access` — which matches neither the `'domain'` nor `'public'` branch in `cleanupEntity`, and isn't a user id either, so only an explicit grant reaches it. This is the mechanical reason `private` is robust: there's no string coincidence that could make `'private'` match a check for `'domain'` or `'public'`.

---

## LIVE-MEASURED: probe results, 2026-07-19

Reader identity: person `6a2fc05e4cd971291c5d5ddc` (see "Flagged discrepancy" below re: this identity's binding history). Method: inject `entu_api_key`, exchange for JWT, read four targets with `?props=name,email,phone,forename,surname,address,birthdate,idcode`. Full detail in the result artifact; summarized here directly from it (no numbers added beyond what the artifact contains):

| Target | Entity `_sharing` | HTTP | Properties returned |
|---|---|---|---|
| `6a097dcc90c8df7a1cc7d6dd` "Test User" | domain | 200 | `["name"]` |
| `6a0dd2384ff8277cd4305e9e` "Aino Kask" | public | 200 | `[]` |
| `69bcfd8e9c031ab8e6ce8079` PO person | private | 403 "No accessible properties" | — |
| `6a2fc05e4cd971291c5d5ddc` self | domain | 200 | `["email","name"]` (control) |

Artifact verdict field: `"REFUTED — domain DOES expose person properties: name"`. Self-read control: `"VALID — reader sees own properties (email, name), so the empty reads above are a rights result, not a broken credential"`.

This is consistent with the source model above: the reader is authenticated (has `userStr`) and non-granted on all three non-self targets, so `cleanupEntity` routes them through the `domain` or `public` branch, never `private`. The private target 403s exactly as the source predicts (its `access` contains the literal `'private'`, matching nothing). The domain target returns a non-empty `domain` bucket (`name`); the public target's `domain`-tier read returns an empty `domain` bucket — both are live bucket **contents**, not existence flags, which is the whole correction.

### Population census, 2026-07-19 (`probe-person-sharing-census-2026-07-19.ts`, read-only, no mutation)

Read directly from `probe-person-sharing-census-2026-07-19T18-38-36-647Z.json`. `personTotal` (131) equals `apiReportedCount` (131) — the census is not truncated by the `limit=1000` query cap.

**`_sharing` census across all 131 live `person` entities:**

| Tier | Count |
|---|---|
| public | 128 |
| domain | 2 |
| private | 1 |

The population is overwhelmingly `public`-shared seed/fixture data, not `domain`-shared as issue #93 assumed.

**PII-field census by tier** (which fields actually have a value, per tier — read via the PO's private-bucket view, i.e. every property regardless of sharing):

| Tier | Fields present |
|---|---|
| public (128 persons) | `name` only (128) |
| domain (2 persons) | `name` (2), `email` (1) |
| private (1 person) | `name` (1), `email` (1) |

`birthdate`, `idcode`, `phone`, `address` (and `forename`/`surname`, dropped per the v4E migration) exist on **zero** live persons across all 131 — the sensitive fields issue #93 worries about aren't populated in the current dataset at all, independent of the sharing question.

**Person property definitions — sharing values:** 21 definitions total (`address`, `bio`, `birthdate`, `county`, `email`, `entu_api_key`, `entu_passkey`, `entu_user`, `idcode`, `language`, `locale`, `name`, `notes`, `phone`, `photo`, `postalcode`, `preferences`, `preferred_contact_email`, `timezone`, `town`, `voice`), queried directly (`_type.string=property&_parent.reference=<person-type-id>`) — **0 of 21 carry a `sharing` value** (`propertyDefsWithSharing: []` in the artifact). Per the source model above (`utils/aggregate.js:115-117`), this means a freshly-aggregated person exposes **nothing** at domain or public tier to a non-granted reader, regardless of the entity's own `_sharing`.

**OAuth-bound persons:** exactly 2 in the whole population — `69bcfd8e9c031ab8e6ce8079` (PO, private) and `6a2fc05e4cd971291c5d5ddc` (reader used in the domain-sharing probe above, domain).

**Anonymous (no `Authorization` header) reads**, same three tier-exemplar targets as the authenticated probe:

| Tier | HTTP | Properties returned |
|---|---|---|
| public | 200 | `[]` |
| domain | 403 | — |
| private | 403 | — |

Matches the source model exactly: `cleanupEntity` (`utils/entity.js:573-586`) requires `entu.userStr` truthy to reach the `domain` branch at all; an anonymous caller has none, so a `domain`-shared entity 403s outright while a `public`-shared one still resolves (to whatever's in its `public` bucket — empty here, consistent with no property definition carrying `sharing`).

---

## LIVE-CONFIRMED, 2026-08-05: the `mvox_collective` prop-def-sharing experiment

The 2026-07-19 probe above established the model using a synthesized reader credential (`entu_api_key` injected on an OAuth-bound person). This is a second, independent confirmation using a real member browser token (Mihkel's actual second-account login, not a synthesized JWT), run against a purpose-built control/test pair rather than pre-existing person data — closes the loop for issue #93/slice-1 T4.

**Setup:** a new app-extension type `mvox_collective` (PO-approved, not canonical v4E), `_sharing:domain`, with two sibling properties on one singleton instance ("Eesti Filharmoonia Kammerkoor", `_sharing:domain`):
- `name` — prop-def `_sharing:domain` (the control; matches the domain-shared population already tested on 2026-07-19)
- `test_hidden` — prop-def with **no `_sharing` value at all** (the test; value `"MEMBER_SHOULD_NOT_SEE"`), isolating the one variable the model claims should matter

**Result (Mihkel's own report, member-tier browser-token read of the instance):** `name="Eesti Filharmoonia Kammerkoor"` (visible), `test_hidden=null` (absent). Exactly the prediction from the source model: `sharing` in `utils/aggregate.js:112-121` is forced to `undefined` for a property whose own definition carries no `_sharing`, so it's never written into `newEntity.domain` (`utils/aggregate.js:148-155`), and `cleanupEntity`'s domain branch (`utils/entity.js:578-579`) can only ever return what's actually in that bucket.

**Cleanup:** `test_hidden`'s prop-def and its instance value were both deleted after the read (`scripts/migrations/cleanup-mvox-collective-test-hidden-2026-08-05.ts`, idempotent, artifact-confirmed); the real marker (type, `name` prop-def, instance) is untouched and still reads `count=1, name="Eesti Filharmoonia Kammerkoor"` via `?_type.string=mvox_collective&props=name`.

### [GOTCHA] `_sharing` inherits from `_parent` at create time — "just omit it" doesn't mean "unshared"

Discovered while building the experiment above, and load-bearing for the experiment's validity: entu-api's `inheritParentProperties` (called unconditionally by `setEntity` for every new-entity create) auto-injects `_sharing` onto a new entity from its `_parent`'s `_sharing` whenever the create payload doesn't include one. Confirmed by direct reproduction, not read-only inference: creating `test_hidden`'s prop-def under the domain-shared `mvox_collective` type **without** `_sharing` in the payload produced a prop-def with `_sharing:domain` auto-set anyway (removed by an explicit follow-up `DELETE` on that specific property value, then re-verified absent).

**Consequence:** a naive "just don't set `_sharing`" approach to creating an unshared property definition under any domain- or public-shared type silently produces a *shared* property definition instead — the opposite of what's usually intended. Anyone doing schema work under a shared type needs to either explicitly set `_sharing:private`, or create-then-verify-then-delete-if-inherited as this experiment did.

**Connects to a prior finding in this document:** `lib/v4e-translator.ts`'s `translatePropertyDef` (Josquin's territory, not modified) never includes `_sharing` in its payload for any property definition it creates — checked directly, no such field. Combined with this inheritance behavior, that means the *actual* sharing outcome for any prop-def created through the standard schema pipeline depends entirely on whether its **parent type** happens to carry `_sharing` at creation time, not on anything in the v4E schema source (which does have a per-property `sharing` field that's simply never read by the translator). For `person` — whose type-def apparently carries no `_sharing` — this is currently harmless by coincidence (nothing to inherit, matches the "0/21 have sharing" census). It would **not** be harmless under any type that does carry `_sharing`, where every prop-def created through the untouched translator would silently inherit that same sharing level regardless of what the v4E schema intended per-property. Worth a ticket for Josquin: `translatePropertyDef` should either read and set `sharing` from the v4E def, or the caller needs to explicitly pin `_sharing:private` for properties the schema doesn't intend to share, to avoid relying on accidental non-inheritance.

---

## INFERENCE

**Why "Test User" (domain) returns `name` while a freshly-aggregated domain-shared person should return nothing:** buckets are write-time snapshots produced by `aggregateEntity`, not read-time computations — `cleanupEntity` only ever reads whatever was last written to `newEntity.domain`/`newEntity.public` (`utils/entity.js:576-582` reads `entity.domain`/`entity.public` directly off the stored document; nothing in `cleanupEntity` re-derives values from current property-definition state). The census above (LIVE-MEASURED) now confirms the premise directly: `name`'s property definition currently carries **no** `sharing` value, so a person aggregated today would get nothing in `domain`. Test User returning `name` therefore requires that `name`'s definition carried a `sharing` value (`public`, which per the cap logic lands in `domain` for a `domain`-shared type) at some point in the past, with Test User aggregated while that was true. That history — when `name`'s `sharing` was unset, and when Test User was last aggregated — is **inference**: I did not query either timestamp or any audit trail, and found no artifact establishing them. The mechanism (bucket = snapshot at last aggregation) is source-verified; the specific historical sequence that produced Test User's stale bucket is not.

**Why re-aggregation doesn't self-heal this staleness (source-verified mechanism, not in the original brief):** `startRelativeAggregation` (`utils/aggregate.js:477-553`) is the only code path that queues *other* entities for re-aggregation when one entity changes, and it triggers on exactly three things: a name change (queues referrers, `utils/aggregate.js:491-499`), a rights change (queues `_inheritrights:true` children, `utils/aggregate.js:502-519`), or formula-relevant parent/referrer/reference relationships (`utils/aggregate.js:521-543`). Editing a property **definition**'s `sharing` field is none of these — it's not a name change or rights change on the definition entity itself, and instances of the type are connected to the type via `_type`, not `_parent`, so they're never in the "children" set that a rights-change would queue, and they're not "referrers" of the definition entity either. Grepping the full `entu-api` route tree for `aggregateEntity`/`addAggregateQueue` call sites confirms every call is either self-triggered by a write to that same entity, or driven by the name/rights-change propagation above — there is no route or job that sweeps all instances of a type when a property definition changes. **Consequence:** once a property definition's `sharing` changes, every already-aggregated instance of that type keeps its old bucket contents indefinitely, until something else happens to write to that specific instance (any property POST/DELETE on the instance re-runs `aggregateEntity` for it, since `setEntity` calls `aggregateEntity` unconditionally after every write — `utils/entity.js:55`).

---

## Flagged discrepancies with the dispatch brief

Per instruction, reporting these rather than silently reproducing the brief:

1. **Path correction:** the section being superseded is `docs/migration/v4e-divergence-2026-05-19.md` §5.2, not `docs/migration/findings/v4e-divergence-2026-05-19.md` — no file of that second name exists in this repo.

2. **Anonymous-read table and the 131-person `_sharing` census — originally unbacked, now resolved.** Neither had a corresponding artifact when this document was first drafted; recording them as LIVE-MEASURED was declined at that point for lack of provenance. Palestrina confirmed the numbers had come from throwaway scratchpad scripts with no saved output, and wrote a proper companion probe (`probe-person-sharing-census-2026-07-19.ts`, read-only, no mutation) to reproduce them with an artifact. All figures matched what was originally reported. Both now appear in the "Population census" subsection above as LIVE-MEASURED, cited to that script and artifact.

3. **The "21 property definitions, none with `sharing` set" claim — same resolution.** The census probe queried this directly (`_type.string=property&_parent.reference=<person-type-id>`) and confirmed 21 definitions, 0 with a `sharing` value. Now cited as LIVE-MEASURED above rather than left as unverified inference.

4. **Reader-identity binding history contradicts the brief's framing, and this is still unresolved.** The brief states person `6a2fc05e4cd971291c5d5ddc` "has an `entu_user` binding, so an injected `entu_api_key` yields a properly account-bound in-domain JWT. Confirmed bound at runtime" — and today's artifact does show `"readerAccountsBound": true` for exactly this person. But my own scratchpad (`teams/mvox-dev/memory/perotin.md`, Session 39, 2026-06-15, entry "CORRECTED 2026-06-16") records the **opposite finding for this exact same person entity**, confirmed twice: *"entu_api_key on any person returns accounts:[] regardless of whether that person has OAuth… Re-confirmed in session 39 recheck: auth response has `accounts:[]`, `user:{}`… Cannot synthesize a real member JWT for access testing this way."* That was a deliberate correction of an earlier wrong probe, so it wasn't a casual note — it was arrived at after retracting a prior error.
   Today's artifact shows the reverse: `accounts` keyed by db name, pointing at the reader's own person id, and a self-read control that returns real properties (`email`, `name`) — which is independent evidence the binding worked this time (an unbound/anonymous JWT reading its own `domain`-shared self would need `userStr` truthy to hit the domain branch at all per `utils/entity.js:578`; an anonymous credential without `userStr` would only reach the `public` branch or 403).
   **Hypothesis, not resolution** (raised by Palestrina; recorded as a lead, not a settled answer): `member-tier-rights-visibility-2026-06-12.md` frames its finding specifically around **seeded** persons — "Seeded polyphony person entities have no Entu OAuth accounts… that JWT carries `accounts: {}`." If the session-39 "regardless of whether that person has OAuth" phrasing generalized from that seeded-person case rather than from a test genuinely run against an OAuth-bound person, session 39 and today would both be correct and non-contradictory: seeded person → anonymous JWT; OAuth-bound person → bound JWT. This can't be checked from here — it needs the session-39 probe's own script/artifact to confirm whether its target actually had `entu_user` set, and that script hasn't been identified. Treat as a lead for a follow-up probe, not a reconciliation.
   Either way, the LIVE-MEASURED table above is good evidence for the *bucket-selection* behavior regardless of how this resolves — the self-read control independently establishes today's credential was live and readable, so the contradiction doesn't propagate into the #93 bucket-visibility conclusions. Only the specific mechanism-of-binding claim ("how" `entu_api_key` becomes account-bound, and under what precondition) is unresolved, and shouldn't be relied on as a repeatable technique without a follow-up probe that controls for the seeded-vs-OAuth variable directly.

---

## Supersession

`docs/migration/v4e-divergence-2026-05-19.md` §5.2 states, for the `sharing` field:

> `sharing` | not a property on property definitions | Per-property sharing not a first-class Entu concept; `_sharing` lives on the entity, not individual properties

This is **superseded by this document**. Per-property sharing is a first-class Entu concept — it's the `sharing` field on the property-definition entity, read at `utils/aggregate.js:87` (via the `$project` stage's `sharing` field) and applied at `utils/aggregate.js:112-155`. This document does not edit `v4e-divergence-2026-05-19.md` itself; that's left for whoever owns that file to reconcile.

---

## [GOTCHA]

- **Buckets are write-time snapshots, not read-time computations, and nothing automatically re-syncs them when a property definition's `sharing` changes.** See the source-verified mechanism under INFERENCE above (`startRelativeAggregation` only propagates on name/rights/formula-relationship changes to the *changed* entity, never on a property-definition edit reaching the type's instances). Any team relying on "we changed the schema, so behavior changed" needs to also force re-aggregation of existing instances (e.g., a touch-write, or the `aggregate.get.js` route at `routes/[db]/entity/[_id]/aggregate.get.js:58`) — the schema change alone is not enough.
- **The previously-documented admin/reader person `6a2f3f964cd971291c5d5ca2` is gone.** It 404s as of 2026-07-19; the PO's second Google OAuth account re-provisioned under a new id, `6a2fc05e4cd971291c5d5ddc`. Any prior findings doc citing the old id (e.g. `slice3-list-visibility-definitive-2026-06-15.md`) is referencing a now-deleted entity — treat that id as stale when reading older docs.
- **The `entu_api_key`-binding contradiction above (discrepancy #4) is itself a gotcha**, independent of whichever side turns out to be right: this specific probe technique (POST `entu_api_key` to an OAuth-linked person, exchange for JWT) has now produced two different, both internally-consistent-looking results on the same entity a month apart. Don't treat a single successful "accounts bound" result as durable proof the technique is reliable going forward without re-checking.

---

## Live mutation record (for audit)

One `entu_api_key` property posted to the reader person (`6a5d1782b11ea7f3c7c09d89`), deleted in teardown per the artifact's `teardown` field (`{"keyPropId": "6a5d1782b11ea7f3c7c09d89", "status": 200, "ok": true}`). No other entities created, modified, or deleted by this probe.

(*MVOX:Pérotin*)
