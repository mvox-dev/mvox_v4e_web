// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	consumeNonce,
	createNonce,
	decodeState,
	encodeState,
	storeNonce,
	verifyNonce,
} from './state';

beforeEach(() => {
	sessionStorage.clear();
});

describe('OAuth state', () => {
	it('createNonce returns a UUID-shaped string', () => {
		const n = createNonce();
		expect(n).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});

	it('encodes + decodes a state payload round-trip', () => {
		const payload = { nonce: 'abc', return_to: '/orgs?q=foo', intent: 'login' as const };
		const encoded = encodeState(payload);
		expect(decodeState(encoded)).toEqual(payload);
	});

	it('encoded state is base64url-safe (no +, /, =)', () => {
		const payload = {
			nonce: '?+/=&',
			return_to: '/path?with&special=chars',
			intent: 'reauth' as const,
		};
		const encoded = encodeState(payload);
		expect(encoded).not.toMatch(/[+/=]/);
	});

	it('storeNonce + consumeNonce returns the nonce once, then null', () => {
		storeNonce('abc-123');
		expect(consumeNonce()).toBe('abc-123');
		expect(consumeNonce()).toBeNull();
	});

	it('verifyNonce returns true when stored matches received', () => {
		storeNonce('abc-123');
		expect(verifyNonce('abc-123')).toBe(true);
	});

	it('verifyNonce returns false on mismatch + consumes the stored nonce', () => {
		storeNonce('abc-123');
		expect(verifyNonce('different')).toBe(false);
		expect(consumeNonce()).toBeNull();
	});

	it('verifyNonce returns false when nothing stored', () => {
		expect(verifyNonce('anything')).toBe(false);
	});

	it('verifyNonce called twice rejects the second attempt (replay protection)', () => {
		storeNonce('abc-123');
		expect(verifyNonce('abc-123')).toBe(true);
		expect(verifyNonce('abc-123')).toBe(false);
	});
});
