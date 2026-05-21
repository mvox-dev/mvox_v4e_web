# v4E schema-change PR draft — rename `person.avatar` + `organization.logo` to `photo`

**Target repo:** `entu/research`
**Target file:** `docs/schema/v4E/schema.ts`
**Author of draft:** Josquin (MVOX), 2026-05-21 session 12
**Submitter:** PO (paste the body below into the entu/research GitHub UI to open the PR)

This finding is structured so the PR body, motivation, and diff can be lifted verbatim into the upstream PR description and patch.

---

## Summary

Rename `person.avatar` → `person.photo` and `organization.logo` → `organization.photo` in v4E so both entity types can use Entu's native `_thumbnail` mechanism, which is hardcoded to look for a property named exactly `photo`. Cuts the file-URL hop count from two (entity GET → property GET) to one (entity GET with `?props=_thumbnail`) and unlocks anonymous thumbnail access for public-shared entities.

---

## Motivation

mvox's session-12 BFF design (`docs/architecture/bff-rights-aware-contracts.md` in `mvox-dev/mvox_v4e_web`, branch `docs/bff-rights-design`) chose Entu's native `_thumbnail` field as the file-URL strategy for the `GET /api/organizations` endpoint. Finn's session-12 research into the entu/api source surfaced the hardcoded property-name constraint that motivates this rename:

### Finn's findings (cited verbatim from session 12)

- **Direct property GET:** `GET /api/{db}/property/{propertyValueId}` returns a signed S3 download URL (60s TTL). Adding `?download=true` makes it a 302 to the signed URL directly. Public-shared properties (e.g., `organization.logo` with `sharing: 'public'`) work anonymously.
  - Source: `entu/api/routes/[db]/property/[_id]/index.get.js`
  - Source: `entu/api/utils/file.js`
- **`_thumbnail` system (the headline finding):** Entu hardcodes the `_thumbnail` derived field to look for a property named exactly `photo` on the entity. When a client requests `?props=_thumbnail`, Entu auto-resolves the entity's `photo` property and returns a pre-signed URL in the `_thumbnail` field of the entity response — **one hop, no second property fetch needed**.
  - Source: `entu/api/utils/entity.js` (`cleanupEntity`)
  - Source: `entu/api/routes/[db]/entity/[_id]/index.get.js`
- **`picture` is NOT special.** Zero references to `picture` in `entu/api` or `entu/app`. Earlier informal references to a `picture` property were a misremembering of `photo`.
- **Current v4E file properties:** `person.avatar`, `organization.logo`, `edition.file`. **None named `photo`. None get the `_thumbnail` benefit as-is.** The rename closes that gap for the two single-value file properties; `edition.file` is `list: true` and represents PDF/audio/video collections, which `_thumbnail` does not address (it resolves a single property only) — `edition.file` is intentionally left untouched.

The semantic shift from "avatar"/"logo" to "photo" is mild — both are still user-supplied images representing identity. The wider word ("photo") is also closer to what mvox's UI will surface across both entity types uniformly. PO confirmed the framing in session 12.

---

## Proposed schema change

Unified diff against `entu/research/docs/schema/v4E/schema.ts`.

### Hunk 1 — `person.avatar` → `person.photo` (around line 114)

```diff
--- a/docs/schema/v4E/schema.ts
+++ b/docs/schema/v4E/schema.ts
@@ -111,7 +111,7 @@
 			note: 'self-declared vocal capabilities'
 		},
 		{ name: 'bio', type: 'text', sharing: 'public', note: 'self-editable' },
-		{ name: 'avatar', type: 'file', sharing: 'public', note: 'self-editable' },
+		{ name: 'photo', type: 'file', sharing: 'public', note: 'self-editable; resolved via Entu `_thumbnail` for one-hop signed S3 URL' },
 		{
 			name: 'notes',
 			type: 'text',
```

### Hunk 2 — `organization.logo` → `organization.photo` (around line 178)

```diff
--- a/docs/schema/v4E/schema.ts
+++ b/docs/schema/v4E/schema.ts
@@ -175,7 +175,7 @@
 		{ name: 'founded', type: 'date', sharing: 'public' },
 		{ name: 'location', type: 'string', sharing: 'public', note: 'e.g., "Tallinn, Estonia"' },
 		{ name: 'website', type: 'string', sharing: 'public' },
-		{ name: 'logo', type: 'file', sharing: 'public' },
+		{ name: 'photo', type: 'file', sharing: 'public', note: 'resolved via Entu `_thumbnail` for one-hop signed S3 URL' },
 		{
 			name: 'social_links',
 			type: 'string',
```

### Notes on the diff

- Both renames also annotate the `note:` field to record *why* the property is named `photo` — anyone reading `schema.ts` cold should see the `_thumbnail` rationale without having to consult this PR thread.
- `edition.file` (around line 455) is intentionally **not** changed. It's `list: true` (multi-file collection of PDFs/audio/video) and `_thumbnail` is single-property-only. The rename has no impact on it.
- **This PR also includes the regenerated `schema.json`** (run `pnpm build-schema` after the `schema.ts` edit, per the comment at the top of `schema.ts`). Keeping both in the same commit avoids a transient state where `schema.json` lags behind `schema.ts` and keeps upstream CI green on a single commit.

---

## Impact on dependent code/data

### Live polyphony Entu database

- **`person.avatar`:** ~2 real persons may have `avatar` property values currently set. Rename = `DELETE /property/{old-value-id}` + `POST /entity/{personId}` with `[{type: 'photo', filename: ..., md5: ..., ...}]` per value, per the established mutation wire shape (architecture-decisions.md "Entu mutation-op wire shapes", session 8). On the type-def entity, the property-def name needs updating from `avatar` to `photo` separately.
- **`organization.logo`:** ~6 real org instances may have `logo` property values currently set. Same migration shape as above.
- **Migration owner:** Pérotin. The session-11 manifest-first migration patterns (committed as `fd132ca` on main) cover this class — small, scoped, two-property-type rename with a known instance count.
- **Type-def vs. instance distinction:** the type-def entity (where the property definition lives, with `_type.string='property'` and the property name string) needs the rename applied on the type-def's `name` value. Instance-level property values inherit the rename by virtue of the new property-def name; old `avatar` / `logo` values become orphaned and need DELETE-then-POST to attach to the new property name. Pérotin's manifest captures both layers.

### mvox BFF (this repo)

- Design doc (this PR's sibling, `docs/architecture/bff-rights-aware-contracts.md`) already consumes the post-rename shape (`organization.photo`, the `_thumbnail` strategy in §5.1). The design is **APPROVED-but-blocked** on the upstream rename.
- No `src/` code currently references `avatar` or `logo` (BFF skeleton only). The first implementation PR will write the consumer code directly against `photo` + `_thumbnail`.
- The mvox implementation PR will carry the trailer convention (see "Required commit trailers" below).

### Other v4E consumers (known)

- **entu-research POC** (`~/projects/entu-research`): the schema file *is* the source of truth here, so the change lands in this PR by definition. The editor.html + README cite the property names; PR-author should sweep those for `avatar`/`logo` mentions and update narratively if needed (likely minimal — the names are listed but not heavily discussed).
- **polyphony prototype** (`~/projects/polyphony`, archived): doesn't consume v4E directly. No action.
- No other downstream consumers known. If `entu/app` (the official Entu UI) renders these properties by name, the rename is transparent (it reads property-def from the type entity, not by hardcoded string).

---

## Required commit trailers on mvox PR

When the consuming mvox PR is opened (first impl PR that uses `organization.photo` + `_thumbnail` against a real Entu call), it **MUST** include both trailers per the convention in `mvox-dev/mvox_v4e_web/teams/mvox-dev/common-prompt.md` and `architecture-decisions.md` ("v4E schema mutation gate", session 2):

```
Schema-Change: entu/research@<sha> "rename avatar+logo to photo for _thumbnail support"
PO-Approved: <date> verbal in session, logged by team-lead
```

Where `<sha>` is the merge commit SHA on `entu/research/main` after this PR lands, and `<date>` is the session-12 PO-approval date (2026-05-21).

Bentham REDs the mvox PR without both trailers.

---

## Migration plan (ordered)

1. **`entu/research` PR (this draft) merges.** PO submits via the upstream GitHub UI using the body above. After merge, capture the `<sha>` for the mvox commit trailer.
2. **Pérotin migrates polyphony db** (separate dispatch). Two-step:
   - Update the type-def entity's property name from `avatar` to `photo` (on the `person` type-def's child prop-def entity) and from `logo` to `photo` (on the `organization` type-def's child prop-def entity). Standard mutation wire shapes apply.
   - For each affected instance (~2 persons + ~6 orgs), DELETE-then-POST the file value under the new property name. Use the manifest-first pattern: build the manifest from `_probe_` scans, dry-run, PO-authorize the live run, execute.
   - Verify post-migration via `?props=_thumbnail` smoke probe on a public-shared org.
3. **mvox BFF implementation PR** (Josquin + Byrd, this design realized). Consumes `organization.photo` + `_thumbnail` in `GET /api/organizations`. Carries both trailers from §"Required commit trailers". Bentham reviews; team-lead approves; Josquin squash-merges per the local merge ritual.

Steps 1 and 2 are independent of each other in principle (the schema doc and the live data are separate), but the mvox impl PR (step 3) depends on **both** being done — schema for trailer evidence, data for runtime correctness.

---

## References

### Source citations for the `_thumbnail` mechanism
- `entu/api/routes/[db]/property/[_id]/index.get.js` — direct property GET, signed-URL response, 60s TTL
- `entu/api/utils/file.js` — S3 pre-signed URL generation
- `entu/api/utils/entity.js` — `cleanupEntity` function, contains the hardcoded `photo` property name lookup that powers `_thumbnail`
- `entu/api/routes/[db]/entity/[_id]/index.get.js` — entity GET path that surfaces `_thumbnail` when `?props=_thumbnail` is requested

### Schema lines being changed
- `entu/research/docs/schema/v4E/schema.ts` line 114 (`person.avatar`)
- `entu/research/docs/schema/v4E/schema.ts` line 178 (`organization.logo`)
- `entu/research/docs/schema/v4E/schema.ts` line 455 (`edition.file`) — explicitly NOT changed; documented for completeness

### Companion mvox documents
- `docs/architecture/bff-rights-aware-contracts.md` — the BFF design that motivates this rename (§0 PO decisions Q5, §5.1 mechanics, §10 upstream dependency)
- `teams/mvox-dev/memory/architecture-decisions.md` — "v4E schema mutation gate" (session 2): the trailer convention this rename will be subject to from the mvox side; "Entu mutation-op wire shapes" (session 8): the wire-shape primer Pérotin's migration will follow

---

(*MVOX:Josquin*)
