import { describe, it, expect } from 'vitest';
import { encodeInviteToken, decodeInviteToken } from './inviteToken';
import type { InviteToken } from '$lib/types';

const sample: InviteToken = {
	orgId: 'org123',
	orgName: 'Eesti Filharmoonia Kammerkoor',
	inviterPersonId: 'p456',
	sections: ['sopr1', 'alto2'],
	exp: 1781000000000,
};

describe('inviteToken', () => {
	it('round-trips the full payload', () => {
		expect(decodeInviteToken(encodeInviteToken(sample))).toEqual(sample);
	});

	it('is URL-safe (no +, /, = in output)', () => {
		expect(encodeInviteToken(sample)).not.toMatch(/[+/=]/);
	});

	it('returns null on malformed input', () => {
		expect(decodeInviteToken('not-base64url!!')).toBeNull();
	});

	it('returns null when a required field is missing', () => {
		// btoa of a partial payload — missing orgName, inviterPersonId, sections, exp
		const partial = btoa(JSON.stringify({ orgId: 'x' })).replace(/=/g, '');
		expect(decodeInviteToken(partial)).toBeNull();
	});
});

// (*MVOX:Tallis*)
