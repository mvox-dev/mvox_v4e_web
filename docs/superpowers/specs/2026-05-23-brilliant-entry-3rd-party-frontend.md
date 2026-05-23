# Brilliant entry — `Patterns/entu/3rd-party-frontend-browser-direct` (version-control trail)

*Published 2026-05-23T18:13Z to Brilliant KB. Entry ID `06e6196e-21e1-4ed4-b77e-9ebff4740875`, `content_type: intelligence`, `sensitivity: shared`. This file is the version-control trail of the published content; updates should flow Brilliant-first, then sync here. Sibling artifact: [entu/research PR #50](https://github.com/entu/research/pull/50) — the longer-form case study (same author, same session).*

---

# Building a 3rd-party browser-direct frontend on Entu

If you are building a web frontend that talks to a public [Entu](https://entu.app) database that you do not run, the only architecture that survives contact with production is to **mirror Entu's own reference frontend** ([entu/webapp](https://github.com/entu/webapp)): JWT in `localStorage`, all data calls browser-direct to `api.entu.app`, no backend proxy in between.

Anything that tries to terminate the user's JWT in a backend (so the backend can re-issue cookies, hide the token from JS, or add cross-cutting concerns) will fail in production because **Entu's session JWT is bound to the requesting IP** (`aud: <browser-IP>` claim). Your backend's egress IP is not the browser's IP — so every call your backend proxies on the user's behalf will return `401 Invalid JWT audience`. The IP-binding is documented and intentional: it is the load-bearing XSS mitigation that compensates for the JS-readable token.

This is the architecture pattern. The mvox web app (https://multivox.pages.dev) ships this in production and was the first 3rd-party Entu frontend to discover the BFF-proxy antipattern the expensive way.

## The constraint that drives everything: IP-bound JWT

From [Entu's authentication docs](https://entu.ee/api/authentication):

> "The session token is short-lived (5 minutes) and bound to the user's browser IP. Your app's frontend must exchange it for a full JWT by calling `GET /api/auth` **directly from the browser** — server-side exchange will fail because the IP will not match."

The mechanics:

- The OAuth callback receives a session token (short, 5 min)
- The browser exchanges it for a full JWT via `GET https://api.entu.app/auth?db=<db>`
- The full JWT carries `aud: <callerIP>` and `exp: now + 48h`
- Any request from a different IP returns `401 Invalid JWT audience`
- **No `?bind_ip=false`. No audience flag. No refresh endpoint.** The user re-signs-in on IP change.

Entu's documented pattern for server-to-server work is a **service entity with `entu_api_key`** — but that uses service rights, not user rights. If you need to act as the authenticated user, you must call from the browser. There is no escape hatch for "trusted backend acting on user's behalf."

## The three paths every 3rd-party frontend considers

| Path | What it is | Verdict |
|---|---|---|
| **A** | Service-entity API key in the backend; backend enforces rights using your own model on top of Entu's data | **Rejected.** Defeats the purpose of using Entu. As the mvox PO put it: *"if we have to own rights management, why use Entu at all."* |
| **B** | Ask the platform to relax IP-binding (issue a JWT variant that backends can use on the user's behalf) | **Wrong direction.** IP-binding is the load-bearing security primitive — stolen-token-different-IP is useless. Removing it weakens Entu's threat model platform-wide. |
| **C** | Mirror entu/webapp exactly: localStorage JWT, browser-direct API, IP-binding-as-security-model | **What you actually want.** Battle-tested in Entu's own frontend. You stop swimming upstream. |

If you find yourself reaching for an OAuth callback that posts to your backend, or a `httpOnly` cookie containing the user's Entu JWT, you are on Path A or B by accident. Stop and re-read this section.

## What you copy verbatim from entu/webapp

The reference implementation is open-source ([github.com/entu/webapp](https://github.com/entu/webapp)). Read its actual source — do not infer the wire shape from the docs.

**Storage keys** (`app/utils/user.js`):
- `localStorage.token` — the 48h JWT, `Bearer <token>` on every API call
- `localStorage.accounts` — JSON list of `{ db, user, name }` for accounts the user is signed into across Entu databases
- `localStorage.user` — currently-selected account

**OAuth init URL** (`app/pages/auth/[provider].vue`):
```js
const callbackUrl = `${window.location.origin}/auth/callback?key=`
await navigateTo(
  `${apiUrl}/auth/${provider}?next=${encodeURIComponent(callbackUrl)}`,
  { external: true }
)
```

Three load-bearing details:
1. **`next` ends in `?key=` with NO value.** Entu appends the session-token JWT by string concatenation directly after `key=`. Putting any other query param into `next` shifts the JWT into a malformed position and the callback reads `null`.
2. **The param name is `key`** (not `token`, not `jwt`). Callback reads `route.query.key`.
3. **No state in the URL at all.** Return path goes to `localStorage('next')` before redirect; callback reads it back. CSRF is implicit (same-origin localStorage access).

**OAuth callback flow** (`app/pages/auth/callback.vue`):
1. Read `route.query.key` (the session token, 5 min lifetime, IP-bound)
2. `GET ${apiUrl}/auth?db=<db>` with `Authorization: Bearer <key>` → get full JWT
3. Write JWT + accounts + user to localStorage
4. Read `localStorage('next')` → `router.replace(next || '/')`

**Data calls** (`app/utils/api.js`):
- All calls go to `api.entu.app` directly via `apiRequest()` wrapper
- `Authorization: Bearer ${localStorage.token}` on every request
- On `401`: clear localStorage, redirect to `/auth/login` (or last-used provider for convenience)
- On `403`/`404`: caller's responsibility (typically a route guard or empty state)

**File uploads — two-step pattern** (verified by wire-shape probe; see [[project_entu_file_upload_two_step]]):

```
Step 1 (announce):
  POST /<db>/entity/<id>
  Body: { filename, filesize, filetype }
  → Returns { upload: { url, method: "PUT", headers: { ... } } }

Step 2 (PUT to signed URL):
  PUT <upload.url>  (browser-direct to DigitalOcean Spaces)
  Headers: Content-Disposition, Content-Type, ACL  (NOT Content-Length — browser sets it)
  Body: <file bytes>
```

Notes:
- S3 provider is DigitalOcean Spaces (`fra1`), not AWS — S3-compatible API
- `Content-Disposition` is in `X-Amz-SignedHeaders`; omitting it causes `SignatureDoesNotMatch` 403
- Upload URL TTL: **60 seconds**. So is the download URL (regenerated per call, not stored)
- `_thumbnail` on an entity = signed download URL for `photo[0]` — full image, no resize pipeline
- S3 key = `<db>/<entityId>/<propertyId>` — the property `_id` IS the S3 key segment

## What you gain by going browser-direct

- **Testability collapses to honest network mocks.** Wire up MSW (or equivalent) to intercept `api.entu.app`. No need to mock your own BFF layer's interpretation of Entu.
- **Modularity.** The Entu client wrapper becomes framework-agnostic — same code works in Svelte, Vue, React, vanilla JS.
- **Fewer hops, fewer failure modes.** Three round-trips collapse to two; the BFF state machine for cookie issuance disappears.
- **Edge-compute cost drops dramatically.** Your CF/Vercel/Netlify Workers run only for static assets + OAuth login init — not for every authenticated data fetch.
- **Security model becomes coherent.** IP-binding IS the mitigation. The BFF-with-httpOnly-cookie was security theater that couldn't survive its own underpinning.
- **Federation-ready by construction.** Nothing about your client code is tied to a specific deploy URL or backend. A different deployer with their own credentials can point at the same Entu db and the frontend Just Works.
- **Smaller learning surface.** A new contributor reads entu/webapp's source as their Entu-API-call tutorial; your codebase looks exactly the same.

## Honest non-wins

- **XSS scope.** A successful XSS on your origin gets the user's full Entu API surface as that user. This is the same trade-off entu/webapp accepted; mitigation is strict CSP plus IP-binding (a stolen token from a different IP is useless). It is real and you cannot dodge it on this architecture.
- **No silent re-auth via `login_hint` or `prompt=none`.** Entu's OAuth proxy through oauth.ee uses a fixed 5-parameter set; caller params do not pass through. You can include `login_hint` forward-compat (it's a no-op until Argo accepts a passthrough), but today the user re-picks their provider on every IP change.
- **No refresh-token flow.** 48h hard cap; IP shift is logout. UX has to make re-auth painless (remember last provider, prefill if you can).
- **No server-side session.** Rendering personalized pages requires a hydration round-trip; SSR can only render the public shell. Gate auth-state-dependent UI on a `mounted` flag to avoid flash-of-incorrect-content.

## Pitfalls (from production hardening)

The mvox CHORE-B branch landed Path C across 16 atomic commits, then hit four hotfixes in the first 30 minutes of PO live-testing on the deployed surface. Each one taught the same meta-lesson — **mirror the reference implementation exactly; do not infer the wire shape from the docs**.

| Pitfall | What we did wrong | Lesson |
|---|---|---|
| OAuth callback got `null` for the JWT | Put `?state=<base64>` into the `next` URL before `?key=`; Entu's string-concat shifted the JWT into the wrong position | The `next` URL must end in `?key=` exactly. State goes to localStorage, not the URL. |
| After sign-in, the OAuth provider was lost | Did not encode provider in the OAuth state payload | Encode `provider` in the state JSON so callback can recover it |
| Email OAuth (tab-jump flow) broke | Verified a sessionStorage nonce in the callback; sessionStorage is per-tab and lost on tab-jump | Don't put load-bearing CSRF state in sessionStorage — localStorage or no nonce |
| Layout nav didn't update on login/logout | Bound to SSR-rendered session variable; localStorage changes don't trigger SSR re-render | Gate auth-state-dependent rendering on a `mounted` flag set in `onMount` / `useEffect` |

Other production surprises worth knowing upfront:

- **To clear a file property, POST with an empty list — don't reach for `DELETE /property/<id>`.** Entu's user-facing model is overwrite-with-empty: `POST /<db>/entity/<id>` with body `{ photo: [] }` clears all values for that property. The DELETE endpoint exists, but it's an admin / teardown primitive (migrations, test fixtures), not the canonical pattern for application code. Multi-valued semantics drive this: POST appends, POST-empty-list clears. If you're modeling Entu like a relational DB and reaching for DELETE on a property, you're at the wrong layer.
- **CF Workers + `process.env`.** If you deploy on Cloudflare with `compatibility_flags: ["nodejs_als"]`, `process.env` is undefined at runtime (vitest passes on Node; production 500s). Use `nodejs_compat` (superset) or move to `$env/static/private` / `$env/dynamic/private`.
- **CF Pages rejects non-ASCII commit messages** with cryptic error `8000111`. Em-dash (U+2014) in a commit subject = failed deploy. Use `--` not `—` in commit messages that will ride a CF Pages deploy.
- **CORS for browser-direct S3 PUT.** Entu/webapp uploads work from arbitrary origins, so DigitalOcean Spaces CORS should already allow it. If you hit CORS, it's an Argo-side allowlist fix.

## When to use this pattern, when not to

**Use it when:**
- You are building a 3rd-party frontend against a public Entu database
- Your users are interactive humans (not server-to-server callers)
- You want to keep Entu as the rights authority (not reinvent it)

**Do not use it when:**
- You are running a server-to-server integration (background jobs, scheduled tasks, machine clients) — use a **service entity API key** instead, with service-scoped rights
- You need elevated cross-cutting operations the user shouldn't perform themselves (admin reporting, federation aggregation) — use a service entity for those specific operations, and keep an explicit enumerated list of elevated ops so reviewers can catch additions
- You need to combine multiple Entu databases in a single view AND each user only has rights to one — federation may demand a fan-out at the frontend, which is messy; service-entity-per-db with your own rights layer becomes more defensible at that point

## What to ask the Entu platform for

One long-standing 3rd-party-frontend ask worth filing if you hit it: **`login_hint` / `prompt=none` passthrough on OAuth init.** Entu's auth proxy through oauth.ee uses a fixed 5-param set. Allowing the caller to add `login_hint` (or `prompt=none` for silent re-auth) would unlock the "remember provider AND account" UX without weakening anything. Forward-compat in the caller is cheap (`?login_hint=<email>` in the OAuth init URL is silently dropped today; the day Argo accepts it, the feature lights up with zero client code change).

## Related

- `Patterns/mirror-reference-implementation` — the meta-pattern this entry is a case of
- `Patterns/closes-n-comprehensive` — backfill-close subsumed issues on the squash commit
- `Patterns/atomic-git-chaining` — git ops as a single chained call when the working tree may flip mid-sequence
- `Decisions/mvox/path-c-browser-direct` — the codified architectural decision in mvox
- `Projects/mvox` — the project applying this pattern

## Sources

- `entu/webapp` source: https://github.com/entu/webapp (the reference; read the actual code)
- Entu authentication docs: https://entu.ee/api/authentication (IP-binding semantics)
- mvox CHORE-53 design spec: `mvox-dev/mvox_v4e_web` repo, `docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`
- entu/research case study: `entu/research` repo, `docs/case-studies/2026-05-3rd-party-frontend-on-entu.md` (longer-form companion to this entry; same author, same session)
- mvox production deploy: https://multivox.pages.dev — Path C live as of 2026-05-23

(*MVOX:Palestrina*)
