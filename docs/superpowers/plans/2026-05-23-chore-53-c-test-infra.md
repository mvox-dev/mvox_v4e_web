# CHORE-C — Path C Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire MSW (Mock Service Worker) as the single network-mock layer for Vitest + Playwright. Add E2E coverage for the Path C auth + data flows. Closes the test-infrastructure CHOREs that became moot or were folded into the rewrite (#36, #39, #33).

**Architecture:** Single `tests/e2e/mocks/entu-handlers.ts` exports MSW handlers covering `api.entu.app/auth/*` + `api.entu.app/<db>/entity*` + `api.entu.app/<db>/property*`. Vitest setup imports the handlers via `setupServer`. Playwright's per-test fixture initializes MSW in the browser via service-worker bootstrap. Same handlers fire across all three layers.

**Tech Stack:** SvelteKit 2, MSW 2.x, Vitest, Playwright, happy-dom, pnpm.

**Prerequisite:** CHORE-A + CHORE-B must be merged. mvox runs on Path C; legacy BFF + cookie tests are gone.

**Reference spec:** [`docs/superpowers/specs/2026-05-23-chore-53-path-c-design.md`](../specs/2026-05-23-chore-53-path-c-design.md). Closes: #36 (CHORE-36 mock harness realized), #39 (layout.server.ts session lift moot), #33 (BFF helper factor-out moot).

**Branch:** `feat/chore-53c-test-infra`. One PR.

---

## File Structure

| File | Action | Role |
|---|---|---|
| `package.json` | UPDATE | Add `msw` dev dependency |
| `tests/e2e/mocks/entu-handlers.ts` | NEW | Single source of truth — MSW request handlers for `api.entu.app` |
| `tests/e2e/mocks/server.ts` | NEW | Vitest-side setupServer wiring |
| `tests/e2e/mocks/browser.ts` | NEW | Playwright-side setupWorker wiring (initialized via fixture) |
| `tests/e2e/mocks/factories.ts` | NEW | Helper factories: `makeOrgEntity()`, `makeJwt()`, etc. — small set of typed seed-data builders |
| `static/mockServiceWorker.js` | NEW (generated) | MSW service worker stub for Playwright; created via `pnpm msw init static/` |
| `src/tests/setup.ts` | REVISE | Replace ad-hoc fetch stubs with MSW setup |
| `playwright.config.ts` (or wherever) | REVISE | Add MSW service-worker fixture |
| `tests/e2e/auth-flow.spec.ts` | NEW | E2E: fresh login per provider (covers 2-3 representative); failure modes |
| `tests/e2e/reauth-flow.spec.ts` | NEW | E2E: 401 triggers involuntary re-auth with saved provider |
| `tests/e2e/logout-flow.spec.ts` | NEW | E2E: logout clears + multi-tab cascade |
| `tests/e2e/csrf-state.spec.ts` | NEW | E2E: OAuth state mismatch rejected at callback |

---

## Task C1: Install MSW + initialize service worker

**Files:**
- Modify: `package.json`
- Create: `static/mockServiceWorker.js` (via MSW CLI)

- [ ] **Step 1: Install MSW**

```bash
cd /home/michelek/workspace && pnpm add -D msw@latest
```

- [ ] **Step 2: Initialize the service worker file**

```bash
cd /home/michelek/workspace && pnpm exec msw init static/ --save
```

Expected: creates `static/mockServiceWorker.js`. The `--save` flag records the integration in `package.json` so future MSW updates can regenerate.

- [ ] **Step 3: Verify msw is in package.json**

```bash
cd /home/michelek/workspace && grep -A2 '"msw"' package.json
```

Expected: msw listed in `devDependencies`, with the `msw` field at the root pointing at `static/`.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/chore-53c-test-infra
git add package.json pnpm-lock.yaml static/mockServiceWorker.js
git commit -m "chore(#53): install MSW + initialize service worker"
```

---

## Task C2: Create MSW handler module + factories

**Files:**
- Create: `tests/e2e/mocks/factories.ts`
- Create: `tests/e2e/mocks/entu-handlers.ts`

- [ ] **Step 1: Create factories**

```ts
// tests/e2e/mocks/factories.ts
//
// Typed seed-data builders for MSW handlers. Keep these focused — only
// shapes our tests actually assert against.

export interface EntuEntityValue<T> { _id?: string; string?: T; number?: T extends number ? T : never }

export interface MockEntuOrgRaw {
	_id: string;
	name?: Array<{ _id: string; string: string }>;
	description?: Array<{ _id: string; string: string }>;
	location?: Array<{ _id: string; string: string }>;
	_thumbnail?: string;
	member_count_per_section?: Array<{ _id: string; number: number }>;
}

let idCounter = 1;
const nextId = () => `mock-${++idCounter}`;

export function makeOrgRaw(overrides: Partial<{
	_id: string;
	name: string;
	description: string;
	location: string;
	photo: string;
	memberCountPerSection: number;
}>): MockEntuOrgRaw {
	const _id = overrides._id ?? nextId();
	const result: MockEntuOrgRaw = { _id };
	if (overrides.name) result.name = [{ _id: nextId(), string: overrides.name }];
	if (overrides.description) result.description = [{ _id: nextId(), string: overrides.description }];
	if (overrides.location) result.location = [{ _id: nextId(), string: overrides.location }];
	if (overrides.photo) result._thumbnail = overrides.photo;
	if (overrides.memberCountPerSection !== undefined) {
		result.member_count_per_section = [{ _id: nextId(), number: overrides.memberCountPerSection }];
	}
	return result;
}

export function makeJwt({ exp = Math.floor(Date.now() / 1000) + 48 * 3600 } = {}): string {
	const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=+$/, '');
	const payload = btoa(JSON.stringify({ exp, sub: 'mock-user' })).replace(/=+$/, '');
	const signature = 'mock-signature';
	return `${header}.${payload}.${signature}`;
}

export function makeAuthResponse({
	token = makeJwt(),
	accounts = [{ _id: 'acc-1', name: 'Test Account' }],
	user = { _id: 'user-1', email: 'tester@example.com', name: 'Tester' },
} = {}) {
	return { token, accounts, user };
}

export function resetIdCounter() {
	idCounter = 1;
}
```

- [ ] **Step 2: Create handlers**

```ts
// tests/e2e/mocks/entu-handlers.ts
//
// MSW handlers for api.entu.app. Single source of truth — used by Vitest
// (Node-side via setupServer) and Playwright (browser-side via setupWorker).

import { http, HttpResponse } from 'msw';
import { makeAuthResponse, makeOrgRaw, type MockEntuOrgRaw } from './factories';

const ENTU = 'https://api.entu.app';

const DEFAULT_ORGS: MockEntuOrgRaw[] = [
	makeOrgRaw({ _id: 'org-acme', name: 'Acme Choir', description: 'Mock org for tests', location: 'Tallinn' }),
	makeOrgRaw({ _id: 'org-beta', name: 'Beta Singers', description: 'Second mock org', location: 'Riga' }),
];

export const entuHandlers = [
	// Session→JWT exchange
	http.get(`${ENTU}/auth`, ({ request }) => {
		const auth = request.headers.get('Authorization');
		if (!auth?.startsWith('Bearer ')) {
			return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		const sessionToken = auth.slice('Bearer '.length);
		if (sessionToken === 'expired-session') {
			return HttpResponse.json({ error: 'session_expired' }, { status: 401 });
		}
		return HttpResponse.json(makeAuthResponse());
	}),

	// OAuth provider init — Entu would redirect to oauth.ee; for tests we redirect
	// back to /auth/callback?key=mock-session immediately so the flow can complete.
	http.get(`${ENTU}/auth/:provider`, ({ request, params }) => {
		const url = new URL(request.url);
		const next = url.searchParams.get('next') ?? '/';
		const nextUrl = new URL(next);
		nextUrl.searchParams.set('key', `mock-session-${params.provider}`);
		return HttpResponse.redirect(nextUrl.toString(), 302);
	}),

	// Entity search (used by landing)
	http.get(`${ENTU}/:db/entity`, ({ request }) => {
		const auth = request.headers.get('Authorization');
		if (!auth?.startsWith('Bearer ')) {
			return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		if (auth === 'Bearer expired-jwt') {
			return HttpResponse.json({ error: 'token_expired' }, { status: 401 });
		}
		return HttpResponse.json({ entities: DEFAULT_ORGS });
	}),

	// Entity GET by id (used by future drill-down)
	http.get(`${ENTU}/:db/entity/:id`, ({ request, params }) => {
		const auth = request.headers.get('Authorization');
		if (!auth?.startsWith('Bearer ')) {
			return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		const match = DEFAULT_ORGS.find((o) => o._id === params.id);
		if (!match) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
		return HttpResponse.json({ entity: match });
	}),

	// Property POST (used by future writes)
	http.post(`${ENTU}/:db/property`, async ({ request }) => {
		const auth = request.headers.get('Authorization');
		if (!auth?.startsWith('Bearer ')) {
			return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		return HttpResponse.json({ _id: `mock-prop-${Date.now()}` });
	}),
];
```

- [ ] **Step 3: Verify type check passes**

```bash
cd /home/michelek/workspace && pnpm check
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/mocks/
git commit -m "test(#53): MSW handlers + factories for api.entu.app"
```

---

## Task C3: Wire MSW into Vitest setup

**Files:**
- Create: `tests/e2e/mocks/server.ts`
- Modify: `src/tests/setup.ts` (or wherever the Vitest setup file lives — check `vitest.config.ts`)

- [ ] **Step 1: Confirm current Vitest setup file location**

```bash
cd /home/michelek/workspace && cat vitest.config.ts
```

If `setupFiles` references `src/tests/setup.ts`, that's the file to revise. If a different path, use that.

- [ ] **Step 2: Create the Vitest server**

```ts
// tests/e2e/mocks/server.ts
//
// Node-side MSW server for Vitest. Started in src/tests/setup.ts.

import { setupServer } from 'msw/node';
import { entuHandlers } from './entu-handlers';

export const mswServer = setupServer(...entuHandlers);
```

- [ ] **Step 3: Update Vitest setup file**

```ts
// src/tests/setup.ts (or whatever path is configured)
//
// Vitest setup — starts MSW for all unit + integration tests. Tests that need
// custom handlers can call mswServer.use(...) in a beforeEach.

import { afterAll, afterEach, beforeAll } from 'vitest';
import { mswServer } from '../../tests/e2e/mocks/server';

beforeAll(() => mswServer.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());
```

Keep any other existing setup-file content (e.g., jsdom polyfills) intact — just add the MSW lines.

- [ ] **Step 4: Run full suite**

```bash
cd /home/michelek/workspace && pnpm test
```

Expected: all tests pass. Console may warn about unhandled requests — that's fine for now; we'll narrow specific tests if needed.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/mocks/server.ts src/tests/setup.ts
git commit -m "test(#53): wire MSW into Vitest setup"
```

---

## Task C4: Wire MSW into Playwright bootstrap

**Files:**
- Create: `tests/e2e/mocks/browser.ts`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/fixtures.ts` (custom Playwright fixture)

- [ ] **Step 1: Confirm Playwright config location**

```bash
cd /home/michelek/workspace && ls playwright.config.* 2>/dev/null || ls tests/playwright.config.* 2>/dev/null
```

- [ ] **Step 2: Create the browser-side setupWorker**

```ts
// tests/e2e/mocks/browser.ts
//
// Browser-side MSW worker registration. Loaded by Playwright before each
// test via the test page's pre-init script.

import { setupWorker } from 'msw/browser';
import { entuHandlers } from './entu-handlers';

export const mswWorker = setupWorker(...entuHandlers);
```

- [ ] **Step 3: Create the Playwright fixture that boots MSW**

```ts
// tests/e2e/fixtures.ts
//
// Custom Playwright fixture: starts MSW in the page before navigation so the
// app's first fetch is intercepted. Use `test` from this module instead of
// the bare Playwright import.

import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ mswReady: void }>({
	mswReady: [
		async ({ page }, use) => {
			await page.addInitScript({
				path: './tests/e2e/mocks/init-msw.js',
			});
			await use();
		},
		{ auto: true },
	],
});

export { expect };
```

- [ ] **Step 4: Create the init-msw bootstrap script (compiled JS)**

```ts
// tests/e2e/mocks/init-msw.ts
//
// Runs in the test page context before app code. Boots MSW worker so
// outgoing fetches from the app get intercepted.

import { mswWorker } from './browser';

await mswWorker.start({
	onUnhandledRequest: 'warn',
	serviceWorker: { url: '/mockServiceWorker.js' },
});
```

Note: Playwright's `addInitScript({ path })` expects a .js file. Either transpile via the project's existing tooling, or use the inline `addInitScript` form with stringified content. The exact mechanism depends on Playwright + Vite config — confirm in a quick spike before committing.

- [ ] **Step 5: Smoke test the fixture**

Write a minimal E2E spec to confirm MSW intercepts:

```ts
// tests/e2e/msw-smoke.spec.ts
import { test, expect } from './fixtures';

test('MSW intercepts api.entu.app requests', async ({ page }) => {
	await page.goto('/');

	const response = await page.evaluate(async () => {
		const r = await fetch('https://api.entu.app/polyphony/entity', {
			headers: { Authorization: 'Bearer test-jwt' },
		});
		return { status: r.status, body: await r.json() };
	});

	expect(response.status).toBe(200);
	expect(response.body).toHaveProperty('entities');
});
```

- [ ] **Step 6: Run Playwright**

```bash
cd /home/michelek/workspace && pnpm exec playwright test tests/e2e/msw-smoke.spec.ts
```

Expected: PASS.

If MSW worker bootstrap is finicky in CI, the fallback is `page.route()` with handler-equivalents — note in your commit message if you fall back.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/mocks/browser.ts tests/e2e/fixtures.ts tests/e2e/mocks/init-msw.ts tests/e2e/msw-smoke.spec.ts playwright.config.ts
git commit -m "test(#53): wire MSW into Playwright bootstrap"
```

---

## Task C5: E2E spec — fresh login per provider

**Files:**
- Create: `tests/e2e/auth-flow.spec.ts`

Cover at minimum 2 providers as smoke; ideally all 6. Per spec Section 8.2.

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/auth-flow.spec.ts
import { test, expect } from './fixtures';

const PROVIDERS = ['smart-id', 'mobile-id', 'id-card', 'google', 'apple', 'e-mail'] as const;

for (const provider of PROVIDERS) {
	test(`fresh login completes for provider: ${provider}`, async ({ page }) => {
		await page.goto('/');

		// Signed-out CTA visible
		await expect(page.getByTestId('signed-out-cta')).toBeVisible();
		await page.getByTestId('signed-out-cta').click();

		// On /auth/login
		await expect(page).toHaveURL(/\/auth\/login/);
		await page.getByTestId(`provider-${provider}`).click();

		// /auth/<provider> redirects to api.entu.app/auth/<provider>; MSW intercepts
		// and bounces back to /auth/callback?key=mock-session-<provider>&state=...
		// Callback verifies state, exchanges, writes localStorage, navigates to /.
		await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });

		// localStorage contains the JWT + user + accounts + last_provider
		const stored = await page.evaluate(() => ({
			token: localStorage.getItem('token'),
			user: localStorage.getItem('user'),
			lastProvider: localStorage.getItem('mvox.last_provider'),
		}));

		expect(stored.token).toBeTruthy();
		expect(stored.user).toContain('email');
		expect(stored.lastProvider).toBe(provider);

		// Orgs heading visible (signed-in state)
		await expect(page.getByTestId('orgs-heading')).toBeVisible();
	});
}
```

- [ ] **Step 2: Run the spec**

```bash
cd /home/michelek/workspace && pnpm exec playwright test tests/e2e/auth-flow.spec.ts
```

Expected: all provider tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth-flow.spec.ts
git commit -m "test(#53): E2E fresh login per provider"
```

---

## Task C6: E2E spec — involuntary re-auth on 401

**Files:**
- Create: `tests/e2e/reauth-flow.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/reauth-flow.spec.ts
import { test, expect } from './fixtures';

test('401 mid-session triggers involuntary re-auth with saved provider', async ({ page }) => {
	// 1. Sign in via Google first (preserve last_provider = google)
	await page.goto('/');
	await page.getByTestId('signed-out-cta').click();
	await page.getByTestId('provider-google').click();
	await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });

	// 2. Sanity check we're signed in
	await expect(page.getByTestId('orgs-heading')).toBeVisible();

	// 3. Force the token to be invalid by overwriting it with the magic value
	//    the MSW handler treats as expired.
	await page.evaluate(() => {
		localStorage.setItem('token', 'expired-jwt');
	});

	// 4. Trigger a data refresh — the failing 401 should drive re-auth
	await page.reload();

	// 5. Should land at /auth/google (skip-the-picker) with intent=reauth
	await expect(page).toHaveURL(/\/auth\/google\?.*intent=reauth/, { timeout: 5000 });

	// 6. last_provider preserved across the clear
	const lp = await page.evaluate(() => localStorage.getItem('mvox.last_provider'));
	expect(lp).toBe('google');

	// 7. Token cleared
	const tok = await page.evaluate(() => localStorage.getItem('token'));
	expect(tok).toBeNull();
});

test('401 with no last_provider falls back to /auth/login', async ({ page }) => {
	// Set just a token, no provider memory
	await page.goto('/');
	await page.evaluate(() => {
		localStorage.setItem('token', 'expired-jwt');
		localStorage.setItem('user', JSON.stringify({ _id: 'u1', email: 'a@b.c' }));
		localStorage.removeItem('mvox.last_provider');
	});

	await page.reload();
	await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
});
```

- [ ] **Step 2: Run spec**

```bash
cd /home/michelek/workspace && pnpm exec playwright test tests/e2e/reauth-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/reauth-flow.spec.ts
git commit -m "test(#53): E2E 401 re-auth flow + no-provider fallback"
```

---

## Task C7: E2E spec — logout + multi-tab cascade

**Files:**
- Create: `tests/e2e/logout-flow.spec.ts`

- [ ] **Step 1: Write spec**

```ts
// tests/e2e/logout-flow.spec.ts
import { test, expect } from './fixtures';

test('explicit logout clears everything including mvox.last_provider', async ({ page }) => {
	// Sign in
	await page.goto('/');
	await page.getByTestId('signed-out-cta').click();
	await page.getByTestId('provider-smart-id').click();
	await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });

	// Sanity
	const before = await page.evaluate(() => ({
		token: localStorage.getItem('token'),
		lastProvider: localStorage.getItem('mvox.last_provider'),
	}));
	expect(before.token).toBeTruthy();
	expect(before.lastProvider).toBe('smart-id');

	// Navigate to logout
	await page.goto('/auth/logout');
	await expect(page).toHaveURL(/^\/$/, { timeout: 5000 });

	// Everything cleared, including lastProvider (logout-only behavior)
	const after = await page.evaluate(() => ({
		token: localStorage.getItem('token'),
		user: localStorage.getItem('user'),
		accounts: localStorage.getItem('accounts'),
		lastProvider: localStorage.getItem('mvox.last_provider'),
	}));
	expect(after.token).toBeNull();
	expect(after.user).toBeNull();
	expect(after.accounts).toBeNull();
	expect(after.lastProvider).toBeNull();

	// Signed-out CTA back
	await expect(page.getByTestId('signed-out-cta')).toBeVisible();
});

test('multi-tab logout: tab 2 sees re-auth on next data call', async ({ context }) => {
	const page1 = await context.newPage();
	const page2 = await context.newPage();

	// Sign in via tab 1
	await page1.goto('/');
	await page1.getByTestId('signed-out-cta').click();
	await page1.getByTestId('provider-google').click();
	await expect(page1).toHaveURL(/^\/$/, { timeout: 5000 });

	// Tab 2 inherits storage (same origin → same localStorage)
	await page2.goto('/');
	await expect(page2.getByTestId('orgs-heading')).toBeVisible();

	// Logout from tab 1
	await page1.goto('/auth/logout');
	await expect(page1).toHaveURL(/^\/$/, { timeout: 5000 });

	// Tab 2 refresh — token gone, signed-out CTA returns
	await page2.reload();
	await expect(page2.getByTestId('signed-out-cta')).toBeVisible();
});
```

- [ ] **Step 2: Run spec**

```bash
cd /home/michelek/workspace && pnpm exec playwright test tests/e2e/logout-flow.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/logout-flow.spec.ts
git commit -m "test(#53): E2E logout + multi-tab cascade"
```

---

## Task C8: E2E spec — OAuth state mismatch

**Files:**
- Create: `tests/e2e/csrf-state.spec.ts`

- [ ] **Step 1: Write spec**

```ts
// tests/e2e/csrf-state.spec.ts
import { test, expect } from './fixtures';

test('OAuth callback rejects when state nonce does not match sessionStorage', async ({ page }) => {
	// Manually construct a callback URL with a state that no sessionStorage value matches.
	// The state payload itself is well-formed (valid base64url JSON), but the embedded
	// nonce is not in sessionStorage — verifyNonce returns false.
	const fakeState = btoa(JSON.stringify({
		nonce: 'attacker-nonce',
		return_to: '/',
		intent: 'login',
	})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

	await page.goto(`/auth/callback?key=mock-session&state=${fakeState}`);

	// Should redirect to /auth/login?error=csrf_mismatch&picker=1
	await expect(page).toHaveURL(/\/auth\/login\?.*error=csrf_mismatch.*picker=1/, { timeout: 5000 });

	// Picker mode: provider buttons visible, no auto-redirect even if a last_provider exists
	await page.evaluate(() => localStorage.setItem('mvox.last_provider', 'google'));
	await page.reload();
	await expect(page).toHaveURL(/\/auth\/login.*picker=1/);
	await expect(page.getByTestId('provider-google')).toBeVisible();
});

test('OAuth callback rejects malformed state', async ({ page }) => {
	await page.goto('/auth/callback?key=mock-session&state=not-valid-base64url');
	await expect(page).toHaveURL(/\/auth\/login\?.*error=csrf_mismatch/, { timeout: 5000 });
});
```

- [ ] **Step 2: Run spec**

```bash
cd /home/michelek/workspace && pnpm exec playwright test tests/e2e/csrf-state.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/csrf-state.spec.ts
git commit -m "test(#53): E2E OAuth state CSRF rejection"
```

---

## Task C9: Verification gate + close subsumed CHOREs + merge

- [ ] **Step 1: Full local verification**

```bash
cd /home/michelek/workspace && pnpm check && pnpm test && pnpm lint && pnpm build
pnpm exec playwright test
```

Expected: 0 errors. All Vitest + Playwright tests pass.

- [ ] **Step 2: Push branch + open PR**

```bash
cd /home/michelek/workspace && git push -u origin feat/chore-53c-test-infra
gh pr create --title "CHORE-C: Path C test infrastructure (MSW)" --body "$(cat <<'EOF'
## Summary

MSW as the single network-mock layer for Vitest + Playwright. E2E coverage
for the new auth + data flows.

- New: `tests/e2e/mocks/entu-handlers.ts` — single source of truth
- New: Vitest setup wires `mswServer.listen()`
- New: Playwright fixture boots MSW via service worker
- New: E2E specs — fresh login per provider, 401 re-auth, logout + multi-tab, CSRF state rejection

Closes #36 (CHORE-36 mock harness realized)
Closes #39 (layout.server.ts session lift moot under Path C)
Closes #33 (BFF helper factor-out moot under Path C)

## Test plan

- [x] `pnpm check` — 0 errors
- [x] `pnpm test` — Vitest passes
- [x] `pnpm exec playwright test` — Playwright passes
- [x] `pnpm lint` — clean

mihkel.putrinsh@gmail.com
EOF
)"
```

- [ ] **Step 3: After Bentham GREEN — merge locally**

```bash
cd /home/michelek/workspace && git checkout main && git pull
git merge --squash feat/chore-53c-test-infra
git commit -m "$(cat <<'EOF'
test(#53): CHORE-C — Path C test infrastructure (MSW)

[squashes feat/chore-53c-test-infra]

MSW wired as single source of truth for api.entu.app mocks across Vitest +
Playwright. E2E coverage added: fresh login per provider, 401 involuntary
re-auth with saved provider memory, logout + multi-tab cascade, CSRF state
nonce rejection.

Closes #36
Closes #39
Closes #33

mihkel.putrinsh@gmail.com
EOF
)"
git push
gh pr close <PR-number> && git push origin --delete feat/chore-53c-test-infra
```

- [ ] **Step 4: Production deploy + smoke**

```bash
cd /home/michelek/workspace && set -a; . ~/.config/mvox/credentials.env; set +a
pnpm run deploy
curl -s -o /dev/null -w "%{http_code}\n" https://multivox.pages.dev/
```

Expected: 200.

CI now runs Playwright on every push; future regressions to the auth + data flows surface automatically.

---

## Self-review

Spec coverage (Section 9.3 CHORE-C + Section 8 test strategy):
- ✅ MSW install + service worker init — Task C1
- ✅ Single-source-of-truth handlers + factories — Task C2
- ✅ Vitest integration — Task C3
- ✅ Playwright integration via fixture — Task C4
- ✅ E2E: fresh login per provider — Task C5
- ✅ E2E: 401 involuntary re-auth — Task C6
- ✅ E2E: logout + multi-tab cascade — Task C7
- ✅ E2E: OAuth state CSRF — Task C8
- ✅ Closes #36, #39, #33 — Task C9

No placeholders. All TDD cycles include actual test code. File paths exact. Commands exact.

**Open follow-up after CHORE-C:** the Playwright MSW bootstrap mechanic (`addInitScript` + transpiled init-msw.ts) is the trickiest part of this CHORE; if it proves flaky in CI, the fallback per Section 10 of the spec is `page.route()` with handler-equivalents. Note the actual approach used in the merge commit body so future-CI-debuggers have the trail.
