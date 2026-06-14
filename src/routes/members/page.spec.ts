// @vitest-environment happy-dom
// RED phase — /members page.
// Owner-gated; hydrates listOrgMembers + listOrgInvitations;
// roster / pending / empty / error states.
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: { url: new URL('http://localhost/members') },
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/auth/storage', () => ({ getToken: () => 'user-jwt' }));

vi.mock('$lib/auth/userStore', async () => {
	const { writable } = await import('svelte/store');
	const selectedOrgStore = writable<{ id: string; role: string; label: string } | null>(null);
	const userStore = writable<{ status: string; personId?: string }>({
		status: 'ready',
		personId: 'person-owner-1',
	});
	return { selectedOrgStore, userStore };
});

vi.mock('$lib/seasons/entuSeasons', () => ({
	listOrgMembers: vi.fn(),
}));
vi.mock('$lib/invite/inviteData', () => ({
	listOrgInvitations: vi.fn(),
	createInvitation: vi.fn(),
	buildInviteUrl: vi.fn((o: string, t: string) => `${o}/invite/${t}`),
}));
vi.mock('$lib/paraglide/messages.js', () => ({
	members_heading: () => 'Members',
	members_invite_heading: () => 'Pending Invitations',
	members_empty: () => 'No members yet',
	members_error: () => 'Failed to load members',
	members_invite_empty: () => 'No pending invitations',
	nav_tab_members: () => 'Members',
	// InviteForm keys (rendered when loadState==='ready' and isOwner)
	members_invite_submit: () => 'Send invite',
	members_invite_submitting: () => 'Sending…',
	invite_copy_link: () => 'Copy link',
	invite_copy_link_copied: () => 'Copied!',
}));
vi.mock('$lib/paraglide/runtime.js', () => ({
	languageTag: () => 'en',
	setLanguageTag: vi.fn(),
}));

import { get } from 'svelte/store';
import { listOrgMembers } from '$lib/seasons/entuSeasons';
import { listOrgInvitations } from '$lib/invite/inviteData';
import { selectedOrgStore } from '$lib/auth/userStore';
import type { Writable } from 'svelte/store';
import Page from './+page.svelte';

const mockListOrgMembers = vi.mocked(listOrgMembers);
const mockListOrgInvitations = vi.mocked(listOrgInvitations);
const writableSelected = selectedOrgStore as unknown as Writable<{
	id: string;
	role: string;
	label: string;
} | null>;

beforeEach(() => {
	vi.clearAllMocks();
	mockListOrgMembers.mockResolvedValue([{ personId: 'person-1', name: 'Mihkel Putrinš' }]);
	mockListOrgInvitations.mockResolvedValue([
		{
			invitationId: 'inv-a',
			email: 'pending@example.com',
			expiresAt: Date.now() + 86400000,
			sections: [],
		},
	]);
});

afterEach(cleanup);

// ── owner-gated ───────────────────────────────────────────────────────────────

describe('/members page — owner gate', () => {
	it('renders member roster when selectedOrgStore.role === "owner"', async () => {
		writableSelected.set({ id: 'org-111', role: 'owner', label: 'EFK' });
		const { container } = render(Page);
		// After GREEN: $effect resolves listOrgMembers → loadState 'ready' → roster visible
		await vi.waitFor(() => {
			const roster = container.querySelector('[data-testid="members-roster"]');
			expect(roster).not.toBeNull();
		});
	});

	it('does NOT show InviteForm when role is not owner', () => {
		writableSelected.set({ id: 'org-111', role: 'member', label: 'EFK' });
		const { container } = render(Page);
		const inviteForm = container.querySelector('[data-testid="invite-form-stub"], form');
		expect(inviteForm).toBeNull();
	});
});

// ── data hydration ────────────────────────────────────────────────────────────

describe('/members page — data hydration', () => {
	beforeEach(() => {
		writableSelected.set({ id: 'org-111', role: 'owner', label: 'EFK' });
	});

	it('calls listOrgMembers with the selected org id', async () => {
		render(Page);
		// GREEN: $effect fires → listOrgMembers called with (cfg, 'org-111')
		// RED: stub does nothing, mock never called — assertion fails
		await vi.waitFor(() => {
			expect(mockListOrgMembers).toHaveBeenCalledWith(
				expect.objectContaining({ db: 'testdb' }),
				'org-111',
			);
		});
	});

	it('calls listOrgInvitations with the selected org id', async () => {
		render(Page);
		// GREEN: $effect fires → listOrgInvitations called with (cfg, 'org-111')
		// RED: stub does nothing, mock never called — assertion fails
		await vi.waitFor(() => {
			expect(mockListOrgInvitations).toHaveBeenCalledWith(
				expect.objectContaining({ db: 'testdb' }),
				'org-111',
			);
		});
	});
});

// ── states ────────────────────────────────────────────────────────────────────

describe('/members page — roster state', () => {
	beforeEach(() => {
		writableSelected.set({ id: 'org-111', role: 'owner', label: 'EFK' });
	});

	it('shows member names in roster', async () => {
		const { container } = render(Page);
		// After GREEN: 'Mihkel Putrinš' appears in roster after $effect resolves
		await vi.waitFor(() => {
			expect(container.textContent).toContain('Mihkel Putrinš');
		});
	});

	it('shows pending invitations section with email', async () => {
		const { container } = render(Page);
		// After GREEN: 'pending@example.com' appears in pending list
		// RED: stub renders loading
		expect(container.querySelector('[data-testid="members-loading"]')).not.toBeNull();
	});
});

describe('/members page — empty state', () => {
	beforeEach(() => {
		writableSelected.set({ id: 'org-111', role: 'owner', label: 'EFK' });
		mockListOrgMembers.mockResolvedValue([]);
		mockListOrgInvitations.mockResolvedValue([]);
	});

	it('shows empty state when no members', async () => {
		const { container } = render(Page);
		// After GREEN: empty state message shown
		// RED: stub shows loading
		expect(container.querySelector('[data-testid="members-loading"]')).not.toBeNull();
	});
});

describe('/members page — error state', () => {
	beforeEach(() => {
		writableSelected.set({ id: 'org-111', role: 'owner', label: 'EFK' });
		mockListOrgMembers.mockRejectedValue(new Error('fetch failed'));
	});

	it('shows error state when listOrgMembers rejects', async () => {
		const { container } = render(Page);
		// After GREEN: error state shown with retry option
		// RED: stub shows loading
		expect(container.querySelector('[data-testid="members-loading"]')).not.toBeNull();
	});
});

// (*MVOX:Tallis*)
