# Entu File-Property POST Wire Shape

**Date:** 2026-05-23  
**Session:** 18  
**Probe:** `scripts/migrations/probes/probe-file-property-wire-shape-2026-05-23.ts`  
**Artifact:** `scripts/migrations/seed-results/probe-file-property-wire-shape-2026-05-23-2026-05-23T16-57-37-229Z.json`  
**Status:** All 6 phases PASS — teardown complete, 0 errors

(*MVOX:Perotin*)

---

## Summary

Entu file uploads use a **two-step** flow: the browser first announces the file to Entu (step 1, gets a signed S3 upload URL back), then PUTs the file bytes directly to that URL (step 2). Under Path C (browser-direct), both steps run entirely client-side. The Entu JWT is only needed for step 1; step 2 is an unauthenticated PUT to a pre-signed S3 URL.

The S3 provider for polyphony is **DigitalOcean Spaces** (Frankfurt, `fra1`), not AWS S3. The API surface is S3-compatible (AWS4 signatures, same presigned URL params), but the endpoint domain is `entu-files.fra1.digitaloceanspaces.com`.

---

## Step 1: Announce the file to Entu

**Request:**
```
POST /polyphony/entity/{entityId}
Authorization: Bearer <jwt>
Content-Type: application/json

[{
  "type": "photo",
  "filename": "photo.jpg",
  "filesize": 12345,
  "filetype": "image/jpeg"
}]
```

All three of `filename`, `filesize`, `filetype` are **required**. If any one is present without the others, Entu returns `400 "File property must have filename, filesize and filetype"` (source: `utils/entity.js` lines 216-225).

**Response** (the property record, with an `upload` object appended):
```json
{
  "_id": "<entityId>",
  "properties": [
    {
      "_id": "<propertyId>",
      "type": "photo",
      "filename": "photo.jpg",
      "filesize": 12345,
      "filetype": "image/jpeg",
      "upload": {
        "url": "https://entu-files.fra1.digitaloceanspaces.com/{db}/{entityId}/{propertyId}?<aws4-sig-params>",
        "method": "PUT",
        "headers": {
          "ACL": "private",
          "Content-Disposition": "inline;filename=\"<url-encoded-filename>\"",
          "Content-Length": 12345,
          "Content-Type": "image/jpeg"
        }
      }
    }
  ]
}
```

Key observations:
- The `upload` object is returned **only** when all three file fields are present. POST with `{ type:'photo' }` alone (no `filename`/`filesize`/`filetype`) returns a property with no `upload` field — the S3 object is never bound. This is the session-12 architecture-decision finding: "POST `[{type:'photo'}]` (empty file property) silently destroys the S3 file binding."
- The S3 object key is `{db}/{entityId}/{propertyId}` — the property `_id` IS the S3 key segment. The key is derived at insert time; the `upload.url` is a pre-signed `PutObject` URL for exactly that key.
- The `upload` object is NOT persisted to the database — it is generated at response time and not present on subsequent `GET /entity/{id}` calls. There is no "re-fetch the upload URL" endpoint. If the 60-second TTL expires before the PUT completes, the client must POST the property again (which will create a NEW property `_id` and a NEW S3 key), then DELETE the old stale property value.

---

## Step 2: PUT file to S3

**Request:**
```
PUT <upload.url>
Content-Type: image/jpeg
Content-Disposition: inline;filename="photo.jpg"
ACL: private
<file bytes>
```

**Critical:** `Content-Disposition` is included in the AWS4 signature (`X-Amz-SignedHeaders=content-disposition%3Bhost`). Omitting it from the PUT will cause a `SignatureDoesNotMatch` error from S3. It must be sent exactly as provided in `upload.headers`.

**Critical:** `Content-Length` is in `upload.headers` but must **NOT** be set explicitly by the caller. `entu/webapp` explicitly skips it (`if (header.toLowerCase() === 'content-length') continue`). Browser `fetch` and `XMLHttpRequest` set it automatically from the body. In Node `fetch`, the body buffer sets it implicitly. Explicitly setting it can cause header conflicts or rejection.

**ACL:** `private` is required. DigitalOcean Spaces enforces this via the presigned URL's `x-amz-acl=private` query param. The `ACL: private` header must be sent to match the signature.

**Response:** HTTP 200 with an empty body on success. No S3 response body to parse.

---

## Step 3: Verify — GET /property/{id}

After a successful S3 PUT, the Entu property record gains a `url` field on read:

```
GET /polyphony/property/{propertyId}
Authorization: Bearer <jwt>
```

Response:
```json
{
  "_id": "<propertyId>",
  "type": "photo",
  "filename": "photo.jpg",
  "filesize": 12345,
  "filetype": "image/jpeg",
  "entity": "<entityId>",
  "created": { "at": "...", "by": "<userId>" },
  "url": "https://entu-files.fra1.digitaloceanspaces.com/..."
}
```

The `url` is a **presigned download URL with 60-second TTL** (source: `utils/file.js` `getSignedDownloadUrl` with `expiresIn: 60`). It must be used immediately or re-fetched.

`?download=true` on this endpoint causes a 302 redirect directly to the S3 URL — useful for `<img src>` via proxy, but under Path C the browser fetches `_thumbnail` directly.

**Important:** The `url` field is generated at GET time, not stored in the DB. Every `GET /property/{id}` call generates a fresh signed URL.

---

## _thumbnail resolution

```
GET /polyphony/entity/{entityId}?props=_thumbnail
Authorization: Bearer <jwt>
```

Response:
```json
{
  "entity": {
    "_id": "<entityId>",
    "_thumbnail": "https://entu-files.fra1.digitaloceanspaces.com/..."
  }
}
```

`_thumbnail` is resolved by `cleanupEntity()` in `utils/entity.js` (line 588): it calls `getSignedDownloadUrl()` against `entity.photo[0]` — the **first** `photo` property value on the entity. It is a signed 60-second URL pointing to the same S3 object as `GET /property/{id}` → `url`.

There is **no separate thumbnail generation** — `_thumbnail` IS the full photo, served via a signed download URL. No resizing, no CDN thumbnail pipeline. Implications:
- No thumbnail delay after upload — `_thumbnail` is available immediately after the S3 PUT succeeds.
- Large photos are served at full resolution via `_thumbnail`. If mvox needs resized thumbnails, it must implement its own transform layer.
- `_thumbnail` is absent if the entity has no `photo` property values. Callers must handle the absent case.

---

## S3 object lifecycle — orphan finding

**`DELETE /property/{id}` does NOT delete the S3 object.**

The OpenAPI description for the property DELETE endpoint states "Files are removed from S3." This is incorrect — the route handler (`routes/[db]/property/[_id]/index.delete.js`) only soft-deletes the property in MongoDB and triggers re-aggregation. There is no S3 delete call in the route or in `utils/aggregate.js`.

**Implication:** Every `DELETE /property/{id}` on a file-typed property leaves a Spaces orphan at `{db}/{entityId}/{propertyId}`. This accumulates indefinitely unless Argo has a server-side cleanup job outside the public API source.

**For the probe:** The probe teardown deleted property `6a11dc804ff8277cd4306b24` and entity `6a11dc804ff8277cd4306b1e` from Entu's DB. Both are confirmed 404. However, the 1×1 PNG at `polyphony/6a11dc804ff8277cd4306b1e/6a11dc804ff8277cd4306b24` on DigitalOcean Spaces is an orphan (70 bytes, no user-visible impact). Flag to Argo for cleanup if needed.

**For mvox photo upload UX:** A "delete photo" button that calls `DELETE /property/{id}` removes the photo from Entu's data model but NOT from storage. Old photos accumulate in Spaces. This is acceptable for MVP (storage cost near zero at current scale) but should be noted for longer-term operations.

## Replacing an existing photo

To replace a photo on an entity (e.g., user uploads a new org photo):

1. `DELETE /property/{oldPropertyId}` — removes the old property value from Entu's DB. Does **not** delete the S3 object (S3 objects accumulate; Entu's cleanup path is not exposed via public API).
2. `POST /entity/{entityId}` with the new `{ type:'photo', filename, filesize, filetype }` — creates a new property `_id` and returns a new signed upload URL.
3. PUT the new file bytes to the new signed URL.

The stale S3 object at the old key (`{db}/{entityId}/{oldPropertyId}`) is orphaned but harmless for the app. Entu may clean it up server-side — not confirmed.

---

## Browser-direct (Path C) caveats

### CORS

The DigitalOcean Spaces bucket serves `entu-files.fra1.digitaloceanspaces.com`. The probe confirmed the PUT succeeds from Node (no browser origin). CORS for browser PUT is not verifiable from the probe, but the presigned URL approach is standard S3-compatible CORS practice: the bucket must have a CORS rule allowing `PUT` from the mvox origin. This is a DigitalOcean Spaces admin config, not something mvox controls.

**Assumption:** Since `entu/webapp` performs browser-direct S3 PUT from arbitrary origins (the webapp is served from `app.entu.app` or any custom domain), the bucket CORS policy must already allow `PUT` from browser origins. If mvox encounters CORS errors on photo upload, the fix is to ask Argo to add `https://multivox.pages.dev` (and any custom domain) to the bucket CORS allowlist — this is not a code change.

### 60-second upload TTL

The signed upload URL expires 60 seconds after `POST /entity/{entityId}`. For photo uploads over slow connections, this is tight. The 60s TTL is set server-side in `getSignedUploadUrl` (`expiresIn: 60`) and is not configurable by the client. Mitigation in the mvox UI: start the S3 PUT immediately on receiving the Entu response (no additional user confirmation between step 1 and step 2).

### No re-upload endpoint

If the S3 PUT fails or times out after the property `_id` is created in Entu's DB, there is no "retry with the same upload URL" path. The upload URL is single-use (60s TTL). The recovery path is:
1. `DELETE /property/{stalePropertyId}` — removes the stale property from Entu.
2. Restart from step 1 (POST with file metadata, get a new signed URL).

mvox UI should handle this gracefully — on upload failure, show a retry button that re-initiates the full two-step flow.

### Property _id is the S3 key

`upload.url` contains `/{db}/{entityId}/{propertyId}` as the path. The `propertyId` from the POST response must be kept in client state until the S3 PUT succeeds (needed to match the property to the entity after the fact, and for DELETE if rollback is needed).

### Content-Disposition filename encoding

Entu encodes the filename via `encodeURI(filename.replace('"', '\"'))` (source: `utils/entity.js` line 492). Non-ASCII filenames are percent-encoded. The client must send exactly the `Content-Disposition` value from `upload.headers` — do not reconstruct it.

---

## EntuProperty type extension needed

The current `EntuProperty` interface in `src/lib/server/entu/client.ts` (or equivalent) declares only `string`/`number`/`boolean`/`reference` value fields. File property POSTs require `filename: string`, `filesize: number`, `filetype: string`. Before any photo upload flow is implemented in mvox source code, the type must be extended:

```typescript
interface EntuFilePropertyInput {
  type: string;        // e.g. 'photo'
  filename: string;
  filesize: number;
  filetype: string;    // MIME type
}

interface EntuUploadShape {
  url: string;
  method: 'PUT';
  headers: {
    ACL: string;
    'Content-Disposition': string;
    'Content-Length': number;  // must NOT be set explicitly on PUT; runtime sets from body
    'Content-Type': string;
  };
}

interface EntuFilePropertyResponse {
  _id: string;
  type: string;
  filename: string;
  filesize: number;
  filetype: string;
  upload?: EntuUploadShape;  // present only immediately after POST; not on subsequent GETs
}
```

This is a task for Josquin (who owns `src/lib/`) — surfaced here as a Pérotin finding, routing via team-lead.

---

## Session-12 architecture-decision validation

The session-12 decision "File-property mutations must round-trip full file payload" (architecture-decisions.md) is now empirically confirmed:

- Posting `[{ type:'photo' }]` without `filename`/`filesize`/`filetype` would produce a property record with no `upload` field — the S3 object is never created, and the property is a broken reference. The 400 validation in `utils/entity.js` ("File property must have filename, filesize and filetype") only fires if any ONE of the three is present without the others; posting NONE of the three fields bypasses the check and creates an empty-shell property.
- The correct DELETE-then-POST replace semantics must round-trip all three file metadata fields (plus the actual byte upload). The prior architecture decision stands.

---

## Probe wire-shape summary table

| Step | Endpoint | Auth | Key fields |
|---|---|---|---|
| 1. Announce | `POST /{db}/entity/{id}` | Bearer JWT | `filename`, `filesize`, `filetype` in body |
| 1. Response | — | — | `upload.url`, `upload.method=PUT`, `upload.headers` (ACL, Content-Disposition, Content-Length, Content-Type) |
| 2. Upload | `PUT <upload.url>` | None (signed) | Send ACL, Content-Disposition, Content-Type; skip Content-Length (runtime sets) |
| 3. Download | `GET /{db}/property/{id}` | Bearer JWT | Returns `url` (60s TTL signed download) |
| 3. Redirect | `GET /{db}/property/{id}?download=true` | Bearer JWT | 302 → S3 URL |
| 4. Thumbnail | `GET /{db}/entity/{id}?props=_thumbnail` | Bearer JWT | Returns `_thumbnail` (60s TTL, same URL as download) — IS the photo, no resize |

Upload URL TTL: **60 seconds**. Download URL TTL: **60 seconds**. Both generated fresh on each Entu API call.
