# mvox-dev — Test Gaps

Untested areas for triage. **Tallis** appends; **Victoria** triages into issues.

Format: `[GAP] <area> — <what's missing> — <risk level: low/med/high> — <date>`

---

## Open Gaps

[GAP] Auth flow — No tests for Entu OAuth callback, JWT cookie creation, session expiry redirect, or unauthenticated BFF route rejection. HIGH. 2026-05-18. (No auth routes exist yet — add when CHORE-5 BFF skeleton lands.)

[GAP] wrangler TOML inline table — binding check regex doesn't catch `d1_databases = {}` inline style. LOW. 2026-05-18.

[GAP] Paraglide i18n — No tests for locale switching, missing-key fallback, or SSR locale detection. MED. 2026-05-18. (Block on CHORE-3 landing.)

[GAP] Tailwind purge — No test verifying that dynamic class names aren't stripped at build time. MED. 2026-05-18. (Block on CHORE-2 + first component.)

[GAP] Cloudflare adapter output shape — smoke test only checks that `.svelte-kit/cloudflare/` exists; doesn't verify `_worker.js` or `_routes.json` are present. LOW. 2026-05-18.

[GAP] CHORE-32 — Section-of-section recursion not tested end-to-end. Current tests verify `parent_section` field is exposed in the flat response, but the recursive traversal path (GET /api/organizations/[id]/sections?parent=<sectionId>) is deferred to phase 2. MED. 2026-05-22.

[GAP] CHORE-32 — No test for Entu upstream 5xx/502 handling in org or sections endpoints. Both endpoints currently only gate on 401 and org-not-found (404). Upstream unavailability → 502 behavior untested. LOW. 2026-05-22.

[GAP] CHORE-32 — Anonymous /public/orgs endpoint not tested (deferred entirely to future scope). LOW. 2026-05-22.

(*MVOX:Tallis*)
