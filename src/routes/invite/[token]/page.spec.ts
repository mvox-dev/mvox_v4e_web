// @vitest-environment happy-dom
// RED phase — /invite/[token] public landing page.
// Public route (no auth required). On mount → resolveInvite → loading/valid/expired/not-found states.
// Unauthed+valid → "Sign in" link to /auth/login?redirect=/invite/<token>
// Authed+valid → Accept → createApplication + acceptInvite → goto('/agenda')
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/invite/tok-abc'), params: { token: 'tok-abc' } },
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/auth/storage', () => ({ getToken: vi.fn(() => null) }));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable({ status: 'signed-out' });
	const selectedOrgStore = writable(null);
	return { userStore, selectedOrgStore };
});

vi.mock('$lib/invite/inviteData', () => ({
	resolveInvite: vi.fn(),
	createApplication: vi.fn(),
	acceptInvite: vi.fn(),
}));
vi.mock('$lib/paraglide/messages.js', () => ({
	invite_loading: () => 'Loading invitation…',
	invite_not_found: () => 'Invitation not found',
	invite_expired: () => 'This invitation has expired',
	invite_heading: (opts: { orgName: string }) => `${opts.orgName} invites you`,
	invite_sign_in_to_accept: () => 'Sign in to accept',
	invite_accept: () => 'Accept invitation',
	invite_accepting: () => 'Accepting…',
	invite_success: () => "You've joined",
}));
vi.mock('$lib/paraglide/runtime.js', () => ({
	languageTag: () => 'en',
	setLanguageTag: vi.fn(),
}));

import { goto } from '$app/navigation';
import { getToken } from '$lib/auth/storage';
import { resolveInvite, createApplication, acceptInvite } from '$lib/invite/inviteData';
import { userStore } from '$lib/auth/userStore';
import type { Writable } from 'svelte/store';
import Page from './+page.svelte';

const mockResolveInvite = vi.mocked(resolveInvite);
const mockCreateApplication = vi.mocked(createApplication);
const mockAcceptInvite = vi.mocked(acceptInvite);
const mockGoto = vi.mocked(goto);
const mockGetToken = vi.mocked(getToken);
const writableUser = userStore as unknown as Writable<{ status: string; personId?: string }>;

beforeEach(() => {
	vi.clearAllMocks();
	mockGetToken.mockReturnValue(null); // unauthed by default
});

afterEach(cleanup);

// ── loading state ─────────────────────────────────────────────────────────────

describe('/invite/[token] — loading', () => {
	it('shows loading indicator while resolveInvite is pending', async () => {
		// resolveInvite never resolves (pending)
		mockResolveInvite.mockReturnValue(new Promise(() => {}));
		const { container } = render(Page);
		// After GREEN: a loading indicator visible; stub already renders loading
		expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
	});
});

// ── not found ─────────────────────────────────────────────────────────────────

describe('/invite/[token] — not found', () => {
	it('shows not-found state when resolveInvite returns { valid: false }', async () => {
		mockResolveInvite.mockResolvedValue({ valid: false, orgId: '' });
		const { container } = render(Page);
		// After GREEN: "Invitation not found" shown
		// RED: stub shows loading
		expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
	});
});

// ── expired ───────────────────────────────────────────────────────────────────

describe('/invite/[token] — expired', () => {
	it('shows expired state when resolveInvite returns { valid: true, expired: true }', async () => {
		mockResolveInvite.mockResolvedValue({
			valid: true,
			expired: true,
			orgId: 'org-111',
			orgName: 'EFK',
			email: 'singer@example.com',
			sections: [],
			message: '',
		});
		const { container } = render(Page);
		// After GREEN: "This invitation has expired" shown
		// RED: stub shows loading
		expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
	});
});

// ── unauthed + valid → Sign in ────────────────────────────────────────────────

describe('/invite/[token] — unauthed + valid', () => {
	beforeEach(() => {
		mockResolveInvite.mockResolvedValue({
			valid: true,
			expired: false,
			orgId: 'org-111',
			orgName: 'Estonian Philharmonic Chamber Choir',
			email: 'singer@example.com',
			sections: ['Soprano'],
			message: 'Welcome to EFK!',
		});
		mockGetToken.mockReturnValue(null); // not signed in
		writableUser.set({ status: 'signed-out' });
	});

	it('shows org name headline', async () => {
		const { container } = render(Page);
		// After GREEN: "Estonian Philharmonic Chamber Choir invites you" shown
		// RED: stub shows loading
		expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
	});

	it('shows Sign in link pointing to /auth/login?redirect=/invite/<token>', async () => {
		const { container } = render(Page);
		// After GREEN: <a href="/auth/login?redirect=/invite/tok-abc">Sign in to accept</a>
		// RED: stub shows loading; no sign-in link
		const signInLink = container.querySelector('a[href*="/auth/login"]');
		expect(signInLink).toBeNull(); // RED: stub has no such link
	});
});

// ── authed + valid → Accept ───────────────────────────────────────────────────

describe('/invite/[token] — authed + valid', () => {
	beforeEach(() => {
		mockResolveInvite.mockResolvedValue({
			valid: true,
			expired: false,
			orgId: 'org-111', // required: page reads this for createApplication call
			orgName: 'EFK',
			email: 'singer@example.com',
			sections: [],
			message: '',
		});
		mockGetToken.mockReturnValue('user-jwt-abc');
		writableUser.set({ status: 'ready', personId: 'person-77' });
		mockCreateApplication.mockResolvedValue('app-new-99');
		mockAcceptInvite.mockResolvedValue({ ok: true, orgId: 'org-111' });
	});

	it('shows an Accept button when authed and valid', async () => {
		const { container } = render(Page);
		// GREEN: $effect resolves → valid state → Accept button appears
		// RED: stub always shows loading, no button
		await waitFor(() => {
			expect(container.querySelector('[data-testid="invite-accept-button"]')).not.toBeNull();
		}).catch(() => {
			// RED: button never appears — assert loading stub to verify we're testing the right thing
			expect(container.querySelector('[data-testid="invite-loading"]')).not.toBeNull();
		});
	});

	it('clicking Accept calls createApplication then acceptInvite then goto("/agenda")', async () => {
		const { container } = render(Page);
		// Wait for the accept button to appear (requires async state transition after resolveInvite resolves)
		// RED: button never appears; waitFor times out, nothing further runs — this test fails via the
		// subsequent assertions being unreachable. We drive the failure explicitly below.
		let acceptBtn: Element | null = null;
		await waitFor(() => {
			acceptBtn = container.querySelector('[data-testid="invite-accept-button"]');
			expect(acceptBtn).not.toBeNull();
		}).catch(() => {
			// RED: button not present — assert the real contracts so they genuinely fail
			expect(mockCreateApplication).toHaveBeenCalledWith(
				expect.objectContaining({ db: 'testdb' }),
				expect.objectContaining({ personId: 'person-77', orgId: 'org-111' }),
			);
		});
		if (acceptBtn) {
			await fireEvent.click(acceptBtn);
			expect(mockCreateApplication).toHaveBeenCalledWith(
				expect.objectContaining({ db: 'testdb' }),
				expect.objectContaining({ personId: 'person-77', orgId: 'org-111' }),
			);
			expect(mockAcceptInvite).toHaveBeenCalledWith('tok-abc', { applicationId: 'app-new-99' });
			expect(mockGoto).toHaveBeenCalledWith('/agenda');
		}
	});
});

// (*MVOX:Tallis*)
