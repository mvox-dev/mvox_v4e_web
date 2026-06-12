// identity-cookie.spec.ts — RED (async Web Crypto round-trip + tamper tests)
// These run in Vitest's node environment which has globalThis.crypto (Web Crypto API).
import { describe, expect, it } from 'vitest';
import { signIdentity, verifyIdentity } from './identity-cookie';

const SECRET = 'test-secret-32-bytes-placeholder!';
const NOW_S = 2_000_000_000; // seconds; exp must be > this
const NOW_MS = NOW_S * 1000;

/** Build a valid payload for the given personId, already-unexpired. */
function makePayload(personId = 'person-99') {
	return { personId, iat: NOW_S, exp: NOW_S + 172800 }; // iat + 48h
}

describe('signIdentity + verifyIdentity', () => {
	it('round-trip: sign then verify returns { personId }', async () => {
		const payload = makePayload('person-42');
		const cookie = await signIdentity(payload, SECRET);
		const result = await verifyIdentity(cookie, SECRET, NOW_MS);
		expect(result).toEqual({ personId: 'person-42' });
	});

	it('payload tamper → null (signature no longer matches modified body)', async () => {
		const cookie = await signIdentity(makePayload('person-1'), SECRET);
		// Replace the body part (before the last dot) with a different personId encoded
		const lastDot = cookie.lastIndexOf('.');
		const sig = cookie.slice(lastDot);
		const tamperedBody = Buffer.from(
			JSON.stringify({ personId: 'attacker', iat: NOW_S, exp: NOW_S + 172800 }),
		).toString('base64url');
		const tampered = tamperedBody + sig;
		const result = await verifyIdentity(tampered, SECRET, NOW_MS);
		expect(result).toBeNull();
	});

	it('signature tamper → null (body intact but sig replaced)', async () => {
		const cookie = await signIdentity(makePayload('person-1'), SECRET);
		const lastDot = cookie.lastIndexOf('.');
		const body = cookie.slice(0, lastDot);
		// Append a clearly wrong signature
		const tampered = body + '.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
		const result = await verifyIdentity(tampered, SECRET, NOW_MS);
		expect(result).toBeNull();
	});

	it('expired (exp in past) → null', async () => {
		const expiredPayload = { personId: 'person-1', iat: NOW_S - 200000, exp: NOW_S - 1 };
		const cookie = await signIdentity(expiredPayload, SECRET);
		const result = await verifyIdentity(cookie, SECRET, NOW_MS);
		expect(result).toBeNull();
	});

	it('malformed (no dot, garbage string) → null', async () => {
		expect(await verifyIdentity('nodotinhere', SECRET, NOW_MS)).toBeNull();
		expect(await verifyIdentity('', SECRET, NOW_MS)).toBeNull();
		expect(await verifyIdentity('not.valid.base64!!!###', SECRET, NOW_MS)).toBeNull();
	});

	it('wrong secret → null (HMAC verification fails)', async () => {
		const cookie = await signIdentity(makePayload('person-1'), SECRET);
		const result = await verifyIdentity(cookie, 'completely-different-secret!!!!', NOW_MS);
		expect(result).toBeNull();
	});
});
