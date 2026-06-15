// @vitest-environment happy-dom
// /invite/[token] public landing page spec.
// Architecture (native keyless, C5): token decoded CLIENT-SIDE via
// decodeInviteToken($page.params.token) — ZERO fetch for invite resolve.
// Authed accept path: createApplication({personId, orgId: tok.orgId})
//   → grantEditorToAdmin({applicationId: returned id, adminPersonId: tok.inviterPersonId}).
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/invite/valid-tok'),
		params: { token: 'valid-tok' },
	},
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/paraglide/runtime.js', () => ({
	languageTag: () => 'en',
	setLanguageTag: vi.fn(),
}));
vi.mock('$lib/paraglide/messages.js', () => ({
	invite_heading: (opts: { orgName: string }) => `${opts.orgName} invites you`,
	invite_invalid: () => 'Invalid or expired invitation link',
	invite_sign_in_to_accept: () => 'Sign in to accept',
	invite_accept: () => 'Accept invitation',
	invite_accepting: () => 'Accepting…',
	invite_success: () => "You've joined",
}));

// inviteToken: decodeInviteToken is called by the page (client-side, C5).
vi.mock('$lib/invite/inviteToken', () => ({
	decodeInviteToken: vi.fn(),
}));

// inviteData: mock createApplication + grantEditorToAdmin for accept-flow tests.
vi.mock('$lib/invite/inviteData', () => ({
	createApplication: vi.fn(),
	grantEditorToAdmin: vi.fn(),
}));

// Auth: mock storage + userStore so tests can control authed/unauthed state.
vi.mock('$lib/auth/storage', () => ({
	getToken: vi.fn(),
}));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable({ status: 'loading' });
	return { userStore, selectedOrgStore: writable(null) };
});

import { decodeInviteToken } from '$lib/invite/inviteToken';
import { createApplication, grantEditorToAdmin } from '$lib/invite/inviteData';
import { getToken } from '$lib/auth/storage';
import { userStore } from '$lib/auth/userStore';
import type { Writable } from 'svelte/store';
import Page from './+page.svelte';

const mockDecode = vi.mocked(decodeInviteToken);
const mockCreateApplication = vi.mocked(createApplication);
const mockGrantEditor = vi.mocked(grantEditorToAdmin);
const mockGetToken = vi.mocked(getToken);
const writableUser = userStore as unknown as Writable<{ status: string; personId?: string; name?: string; initial?: string; orgs?: unknown[] }>;

const validToken = {
	orgId: 'org123',
	orgName: 'Eesti Filharmoonia Kammerkoor',
	inviterPersonId: 'p456',
	sections: ['sopr1'],
	exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
};

beforeEach(() => {
	vi.clearAllMocks();
	// Default: unauthed
	mockGetToken.mockReturnValue(null);
	writableUser.set({ status: 'signed-out' });
});
afterEach(cleanup);

// ── valid token ───────────────────────────────────────────────────────────────

describe('/invite/[token] — valid token', () => {
	it('renders org name from the decoded token (no fetch required)', () => {
		mockDecode.mockReturnValue(validToken);
		const { container } = render(Page);
		// GREEN: page decodes token and shows org name in an invite-heading element.
		// RED: stub renders invite-loading; orgName absent.
		const heading = container.querySelector('[data-testid="invite-heading"]');
		expect(heading).not.toBeNull();
		expect(heading?.textContent).toContain('Eesti Filharmoonia Kammerkoor');
	});

	it('decodeInviteToken is called exactly once with the route token param', () => {
		mockDecode.mockReturnValue(validToken);
		render(Page);
		expect(mockDecode).toHaveBeenCalledOnce();
		expect(mockDecode).toHaveBeenCalledWith('valid-tok');
	});

	it('does NOT call fetch (token is self-describing — zero API calls to resolve)', () => {
		mockDecode.mockReturnValue(validToken);
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		render(Page);
		// fetch may be called later (accept flow), but NOT on mount for invite resolve.
		expect(fetchSpy).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});

// ── invalid / null token ──────────────────────────────────────────────────────

describe('/invite/[token] — invalid token', () => {
	it('renders an error state when decodeInviteToken returns null', () => {
		mockDecode.mockReturnValue(null);
		const { container } = render(Page);
		// GREEN: page shows invite-invalid element.
		// RED: stub renders invite-loading; invalid state absent.
		const errorEl = container.querySelector('[data-testid="invite-invalid"]');
		expect(errorEl).not.toBeNull();
	});

	it('does NOT render the org-name heading when the token is invalid', () => {
		mockDecode.mockReturnValue(null);
		const { container } = render(Page);
		const heading = container.querySelector('[data-testid="invite-heading"]');
		expect(heading).toBeNull();
	});
});

// ── authed accept flow ────────────────────────────────────────────────────────

describe('/invite/[token] — authed accept flow', () => {
	beforeEach(() => {
		mockDecode.mockReturnValue(validToken);
		mockGetToken.mockReturnValue('user-jwt');
		writableUser.set({ status: 'ready', personId: 'p789', name: 'Singer', initial: 'S', orgs: [] });
	});

	it('shows Accept button when authed (not sign-in link)', async () => {
		const { container } = render(Page);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="invite-accept-button"]')).not.toBeNull();
		});
		expect(container.querySelector('[data-testid="invite-sign-in-link"]')).toBeNull();
	});

	it('calls createApplication with personId from user and orgId from token', async () => {
		mockCreateApplication.mockResolvedValue({ applicationId: 'app-001' });
		mockGrantEditor.mockResolvedValue(undefined);
		const { container } = render(Page);
		const btn = await waitFor(() => {
			const el = container.querySelector('[data-testid="invite-accept-button"]');
			if (!el) throw new Error('button not found');
			return el;
		});
		await fireEvent.click(btn);
		await waitFor(() => expect(mockCreateApplication).toHaveBeenCalledOnce());
		expect(mockCreateApplication).toHaveBeenCalledWith(
			{ db: 'testdb', token: 'user-jwt' },
			{ personId: 'p789', orgId: 'org123' },
		);
	});

	it('calls grantEditorToAdmin with applicationId returned by createApplication and adminPersonId from token', async () => {
		mockCreateApplication.mockResolvedValue({ applicationId: 'app-001' });
		mockGrantEditor.mockResolvedValue(undefined);
		const { container } = render(Page);
		const btn = await waitFor(() => {
			const el = container.querySelector('[data-testid="invite-accept-button"]');
			if (!el) throw new Error('button not found');
			return el;
		});
		await fireEvent.click(btn);
		await waitFor(() => expect(mockGrantEditor).toHaveBeenCalledOnce());
		expect(mockGrantEditor).toHaveBeenCalledWith(
			{ db: 'testdb', token: 'user-jwt' },
			{ applicationId: 'app-001', adminPersonId: 'p456' },
		);
	});

	it('renders invite-success after successful accept', async () => {
		mockCreateApplication.mockResolvedValue({ applicationId: 'app-001' });
		mockGrantEditor.mockResolvedValue(undefined);
		const { container } = render(Page);
		const btn = await waitFor(() => {
			const el = container.querySelector('[data-testid="invite-accept-button"]');
			if (!el) throw new Error('button not found');
			return el;
		});
		await fireEvent.click(btn);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="invite-success"]')).not.toBeNull();
		});
	});

	it('renders invite-error when accept throws', async () => {
		mockCreateApplication.mockRejectedValue(new Error('Network failure'));
		const { container } = render(Page);
		const btn = await waitFor(() => {
			const el = container.querySelector('[data-testid="invite-accept-button"]');
			if (!el) throw new Error('button not found');
			return el;
		});
		await fireEvent.click(btn);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="invite-error"]')).not.toBeNull();
		});
	});
});

// (*MVOX:Tallis*)
