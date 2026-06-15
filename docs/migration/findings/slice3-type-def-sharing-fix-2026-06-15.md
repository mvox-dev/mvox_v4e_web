# Slice-3 Deployment Prerequisite: Type-def `_sharing` must be `domain`

**Date:** 2026-06-15 (session 37)
**Branch:** main
**Related issue:** #91 / #92 (Slice-3 native keyless invite/join)

---

## Finding

`resolveTypeId` in `src/lib/seasons/entuSeasons.ts:30` queries:

```
GET /{db}/entity?_type.string=entity&name.string=<typeName>&props=_id&limit=1
```

This query returns 0 results for any type-def whose `_sharing` is `private` when called by a non-db-owner JWT (e.g., the singer's account in the invite/join flow). The caller gets "type definition not found" even though the type-def entity exists.

## Root cause

The `application` and `invitation` type-defs were created with `_sharing: 'private'`. Only the db-root-omniscient PO JWT could resolve them. The singer's non-omniscient JWT was blind — `resolveTypeId('application')` returned 0 entities, throwing "type definition not found: 'application' in db 'polyphony'".

`member` was already `_sharing: 'domain'` (no action needed).

## Fix applied (2026-06-15, live on polyphony)

Set `_sharing: 'domain'` on both affected type-defs (clear-first replace mechanic):

| Type-def | Entity _id | Old `_sharing` prop _id (deleted) | New `_sharing` prop _id |
|---|---|---|---|
| `application` | `6a0d2e8390c8df7a1cc7de81` | `6a0d2e8390c8df7a1cc7de86` | `6a2fda114cd971291c5d5e76` |
| `invitation` | `6a0d2e8290c8df7a1cc7de3e` | `6a0d2e8290c8df7a1cc7de43` | `6a2fda114cd971291c5d5e77` |

**Reversibility:** to revert, delete the new prop `_id` and POST `_sharing: 'private'`.

## Verification

`resolveTypeId` queries run as singer (non-omniscient second OAuth account `6a2fc05e4cd971291c5d5ddc`):

| Type | Before fix | After fix |
|---|---|---|
| `application` | 0 results | 1 result (`6a0d2e8390c8df7a1cc7de81`) ✓ |
| `invitation` | 0 results | 1 result (`6a0d2e8290c8df7a1cc7de3e`) ✓ |
| `member` | 1 result (was already domain) | 1 result ✓ |

## Other private type-defs (flagged, not yet fixed)

The following type-defs are also `_sharing: 'private'`. Not in the current invite/join flow, but will need the same treatment when those features are built:

| Type-def | Entity _id | Note |
|---|---|---|
| `attendance` | `6a0d2e8690c8df7a1cc7df4b` | Conductor-created; both parties need to resolve it |
| `copy` | `6a0d2e8190c8df7a1cc7ddb0` | Library subtree |
| `lending` | `6a0d2e8190c8df7a1cc7dde8` | Library subtree |
| `library` | `6a0d2e8090c8df7a1cc7dd9d` | Library subtree |
| `rsvp` | `6a0d2e8590c8df7a1cc7df1b` | Singer-created; same visibility issue will recur |

## Deployment checklist addendum

This is a **deployment prerequisite** for any slice that uses `resolveTypeId` with a non-db-owner JWT. Alongside `add_user` on the db entity, the setup script (or seed) must ensure all type-defs that non-owner accounts need to reference are `_sharing: 'domain'`.

(*MVOX:Pérotin*)
