// @vitest-environment happy-dom
// RED phase — InviteForm component.
// email (required) + optional sections + optional message;
// submit → createInvitation → shows copyable link; optimistic-append.
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/invite/inviteData', () => ({
	createInvitation: vi.fn(),
	buildInviteUrl: vi.fn((origin: string, token: string) => `${origin}/invite/${token}`),
}));
vi.mock('$env/static/public', () => ({ PUBLIC_ENTU_DB: 'testdb' }));
vi.mock('$lib/auth/storage', () => ({ getToken: () => 'user-jwt' }));

import { createInvitation } from '$lib/invite/inviteData';
import InviteForm from './InviteForm.svelte';

const mockCreateInvitation = vi.mocked(createInvitation);

beforeEach(() => {
	vi.clearAllMocks();
	mockCreateInvitation.mockResolvedValue({ invitationId: 'inv-new', token: 'new-tok-uuid' });
});

afterEach(cleanup);

describe('InviteForm', () => {
	it('renders an email input (required)', () => {
		const { container } = render(InviteForm, {
			props: { orgId: 'org-111', sections: [] },
		});
		const emailInput = container.querySelector('input[type="email"], input[name="email"]');
		expect(emailInput).not.toBeNull();
		// After GREEN: required attribute present
		expect((emailInput as HTMLInputElement | null)?.required ?? false).toBe(true);
	});

	it('does not submit when email is empty', async () => {
		const { container } = render(InviteForm, {
			props: { orgId: 'org-111', sections: [] },
		});
		const form = container.querySelector('form');
		if (form) await fireEvent.submit(form);
		expect(mockCreateInvitation).not.toHaveBeenCalled();
	});

	it('submits with valid email → calls createInvitation with orgId and email', async () => {
		const { container } = render(InviteForm, {
			props: { orgId: 'org-111', sections: ['sec-soprano'] },
		});
		const emailInput = container.querySelector('input[type="email"], input[name="email"]');
		if (emailInput) await fireEvent.input(emailInput, { target: { value: 'singer@example.com' } });
		const form = container.querySelector('form');
		if (form) await fireEvent.submit(form);
		expect(mockCreateInvitation).toHaveBeenCalledWith(
			expect.objectContaining({ db: 'testdb' }),
			expect.objectContaining({ orgId: 'org-111', email: 'singer@example.com' }),
		);
	});

	it('shows a CopyLink with the invite URL after successful submission', async () => {
		const { container } = render(InviteForm, {
			props: { orgId: 'org-111', sections: [] },
		});
		const emailInput = container.querySelector('input[type="email"], input[name="email"]');
		if (emailInput) await fireEvent.input(emailInput, { target: { value: 'singer@example.com' } });
		const form = container.querySelector('form');
		if (form) await fireEvent.submit(form);
		// After GREEN: a CopyLink element appears showing the invite URL
		// stub renders nothing — RED: this assertion will fail
		const copyLink = container.querySelector('[data-testid="copy-link-button"]');
		expect(copyLink).not.toBeNull();
	});

	it('optimistic-appends the new invitation to a pending list', async () => {
		const { container } = render(InviteForm, {
			props: { orgId: 'org-111', sections: [] },
		});
		const emailInput = container.querySelector('input[type="email"], input[name="email"]');
		if (emailInput) await fireEvent.input(emailInput, { target: { value: 'new@example.com' } });
		const form = container.querySelector('form');
		if (form) await fireEvent.submit(form);
		// After GREEN: the pending invitations list grows by 1 entry showing the email
		const pendingList = container.querySelector('[data-testid="invite-pending-list"]');
		// RED: stub has no such element
		expect(pendingList).not.toBeNull();
	});
});

// (*MVOX:Tallis*)
