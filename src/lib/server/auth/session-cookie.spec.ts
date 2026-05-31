import { describe, expect, it } from 'vitest';
import {
	SESSION_COOKIE,
	decodeJwtExpMs,
	isProtectedPath,
	isSessionValid,
	safeRedirectTarget,
	sessionCookieOptions,
} from './session-cookie';

// helper: build an unsigned JWT with a given exp (seconds)
function jwtWithExp(expSec: number): string {
	const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	return `${b64({ alg: 'none' })}.${b64({ exp: expSec })}.sig`;
}

describe('session-cookie helpers', () => {
	it('cookie name is mvox_session', () => {
		expect(SESSION_COOKIE).toBe('mvox_session');
	});

	it('cookie options are httpOnly/lax/path=//48h, secure per flag', () => {
		const opts = sessionCookieOptions(true);
		expect(opts).toMatchObject({
			httpOnly: true,
			sameSite: 'lax',
			path: '/',
			maxAge: 172800,
			secure: true,
		});
		expect(sessionCookieOptions(false).secure).toBe(false);
	});

	it('decodeJwtExpMs returns exp in ms, null on garbage', () => {
		expect(decodeJwtExpMs(jwtWithExp(1000))).toBe(1000 * 1000);
		expect(decodeJwtExpMs('not-a-jwt')).toBeNull();
		expect(decodeJwtExpMs('')).toBeNull();
	});

	it('isSessionValid: present + unexpired = true; expired/absent = false', () => {
		const now = 2_000_000_000; // ms
		expect(isSessionValid(jwtWithExp(2_000_001), now)).toBe(true); // exp after now
		expect(isSessionValid(jwtWithExp(1_999_999), now)).toBe(false); // exp before now
		expect(isSessionValid(undefined, now)).toBe(false);
		expect(isSessionValid('garbage', now)).toBe(false);
	});

	it('isProtectedPath: allowlist passes, app routes protected', () => {
		for (const p of [
			'/',
			'/about',
			'/auth/login',
			'/auth/callback',
			'/_app/immutable/x.js',
			'/favicon.png',
		])
			expect(isProtectedPath(p)).toBe(false);
		for (const p of ['/library', '/agenda', '/roster', '/notices', '/settings', '/library/x'])
			expect(isProtectedPath(p)).toBe(true);
	});

	it('safeRedirectTarget: local path kept, unsafe → /', () => {
		expect(safeRedirectTarget('/library?work=a')).toBe('/library?work=a');
		expect(safeRedirectTarget('//evil.com')).toBe('/');
		expect(safeRedirectTarget('https://evil.com')).toBe('/');
		expect(safeRedirectTarget(null)).toBe('/');
	});
});

// (*MVOX:Tallis*)
