// @vitest-environment happy-dom
// /members page spec.
// Owner-gated: listPendingApplications on mount, approveApplication + optimistic removal.
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/paraglide/runtime.js', () => ({
	languageTag: () => 'en',
	setLanguageTag: vi.fn(),
}));
vi.mock('$lib/paraglide/messages.js', () => ({
	members_heading: () => 'Members',
	members_pending_heading: () => 'Pending join requests',
	members_pending_empty: () => 'No pending requests',
	members_approve: () => 'Approve',
	members_approving: () => 'Approving…',
	members_error: () => 'Failed to load',
	members_invite_heading: () => 'Invite a member',
	members_invite_email_label: () => 'Email',
	members_invite_submit: () => 'Send invite',
	members_invite_submitting: () => 'Sending…',
	common_loading: () => 'Loading…',
}));

vi.mock('$lib/invite/inviteData', () => ({
	listPendingApplications: vi.fn(),
	approveApplication: vi.fn(),
	createInvitation: vi.fn(),
	buildInviteUrl: vi.fn(() => 'http://localhost/invite/tok'),
}));

vi.mock('$lib/auth/storage', () => ({
	getToken: vi.fn(),
}));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const userStore = writable<{ status: string; personId?: string }>({ status: 'loading' });
	const selectedOrgStore = writable<null | { id: string; label: string; role: string }>(null);
	return { userStore, selectedOrgStore };
});

import { listPendingApplications, approveApplication } from '$lib/invite/inviteData';
import { getToken } from '$lib/auth/storage';
import { userStore, selectedOrgStore } from '$lib/auth/userStore';
import type { Writable } from 'svelte/store';
import type { PendingApplication } from '$lib/types';
import Page from './+page.svelte';

const mockListPending = vi.mocked(listPendingApplications);
const mockApprove = vi.mocked(approveApplication);
const mockGetToken = vi.mocked(getToken);
const writableUser = userStore as unknown as Writable<{ status: string; personId?: string }>;
const writableOrg = selectedOrgStore as unknown as Writable<null | { id: string; label: string; role: string }>;

const ownerOrg = { id: 'org123', label: 'Eesti Filharmoonia Kammerkoor', role: 'owner' };
const memberOrg = { id: 'org123', label: 'Eesti Filharmoonia Kammerkoor', role: 'member' };

const pendingApp: PendingApplication = {
	applicationId: 'app-001',
	personId: 'p789',
	applicantName: 'Mari Maasikas',
	message: undefined,
	sections: ['sopr1'],
};

beforeEach(() => {
	vi.clearAllMocks();
	mockGetToken.mockReturnValue('admin-jwt');
	writableUser.set({ status: 'ready', personId: 'p456' });
	writableOrg.set(null);
	mockListPending.mockResolvedValue([]);
	mockApprove.mockResolvedValue(undefined);
});
afterEach(cleanup);

// ── load — listPendingApplications ────────────────────────────────────────────

describe('/members — listPendingApplications', () => {
	it('calls listPendingApplications with org id when owner is set', async () => {
		writableOrg.set(ownerOrg);
		render(Page);
		await waitFor(() => expect(mockListPending).toHaveBeenCalledOnce());
		expect(mockListPending).toHaveBeenCalledWith(
			{ db: 'testdb', token: 'admin-jwt' },
			'org123',
		);
	});

	it('does NOT call listPendingApplications when org is null', async () => {
		writableOrg.set(null);
		render(Page);
		await new Promise((r) => setTimeout(r, 10));
		expect(mockListPending).not.toHaveBeenCalled();
	});

	it('shows members-loading initially when load has not resolved', () => {
		// listPendingApplications never resolves — stays loading
		mockListPending.mockReturnValue(new Promise(() => {}));
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		expect(container.querySelector('[data-testid="members-loading"]')).not.toBeNull();
	});

	it('shows members-error when listPendingApplications rejects', async () => {
		mockListPending.mockRejectedValue(new Error('API down'));
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="members-error"]')).not.toBeNull();
		});
	});
});

// ── owner gate ────────────────────────────────────────────────────────────────

describe('/members — owner gate', () => {
	it('shows members-pending-empty to owner when list is empty', async () => {
		mockListPending.mockResolvedValue([]);
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="members-pending-empty"]')).not.toBeNull();
		});
	});

	it('does NOT show pending-list or approve button to non-owner member', async () => {
		mockListPending.mockResolvedValue([pendingApp]);
		writableOrg.set(memberOrg);
		const { container } = render(Page);
		await new Promise((r) => setTimeout(r, 20));
		expect(container.querySelector('[data-testid="members-pending-list"]')).toBeNull();
		expect(container.querySelector('[data-testid="members-approve-button"]')).toBeNull();
	});

	it('renders pending items list for owner when applications exist', async () => {
		mockListPending.mockResolvedValue([pendingApp]);
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		await waitFor(() => {
			expect(container.querySelector('[data-testid="members-pending-list"]')).not.toBeNull();
		});
		const items = container.querySelectorAll('[data-testid="members-pending-item"]');
		expect(items).toHaveLength(1);
		expect(items[0].textContent).toContain('Mari Maasikas');
	});
});

// ── approve + optimistic removal ──────────────────────────────────────────────

describe('/members — approve + optimistic removal', () => {
	it('calls approveApplication with correct args on Approve click', async () => {
		mockListPending.mockResolvedValue([pendingApp]);
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		const btn = await waitFor(() => {
			const el = container.querySelector('[data-testid="members-approve-button"]');
			if (!el) throw new Error('approve button not found');
			return el;
		});
		await fireEvent.click(btn);
		await waitFor(() => expect(mockApprove).toHaveBeenCalledOnce());
		expect(mockApprove).toHaveBeenCalledWith(
			{ db: 'testdb', token: 'admin-jwt' },
			{
				applicationId: 'app-001',
				invitationId: '',
				orgId: 'org123',
				personId: 'p789',
				sections: ['sopr1'],
			},
		);
	});

	it('removes approved item from list immediately (optimistic removal)', async () => {
		const second: PendingApplication = {
			applicationId: 'app-002',
			personId: 'p790',
			applicantName: 'Jaan Tamm',
			message: undefined,
			sections: [],
		};
		mockListPending.mockResolvedValue([pendingApp, second]);
		writableOrg.set(ownerOrg);
		const { container } = render(Page);
		const btns = await waitFor(() => {
			const els = container.querySelectorAll('[data-testid="members-approve-button"]');
			if (els.length < 2) throw new Error('buttons not yet rendered');
			return els;
		});
		// Approve first item
		await fireEvent.click(btns[0]);
		await waitFor(() => {
			const remaining = container.querySelectorAll('[data-testid="members-pending-item"]');
			expect(remaining).toHaveLength(1);
			expect(remaining[0].textContent).toContain('Jaan Tamm');
		});
	});
});

// (*MVOX:Tallis*)
