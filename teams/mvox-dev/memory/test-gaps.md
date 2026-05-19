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

(*MVOX:Tallis*)
