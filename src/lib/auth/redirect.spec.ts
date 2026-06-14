import { describe, expect, it } from 'vitest';
import { safeRedirectTarget } from './redirect';

// RED: safeRedirectTarget must live at this client-safe path (src/lib/auth/redirect.ts),
// not only in src/lib/server/auth/session-cookie.ts which is forbidden on the client.

describe('safeRedirectTarget (shared client-safe util)', () => {
	it('returns the path unchanged for a normal local path', () => {
		expect(safeRedirectTarget('/library')).toBe('/library');
	});

	it('returns the path unchanged for a path with query params', () => {
		expect(safeRedirectTarget('/library?work=abc')).toBe('/library?work=abc');
	});

	it('returns / for a protocol-relative URL (// attack)', () => {
		expect(safeRedirectTarget('//evil.com')).toBe('/');
	});

	it('returns / for an absolute https URL', () => {
		expect(safeRedirectTarget('https://evil.com')).toBe('/');
	});

	it('returns / for an absolute http URL', () => {
		expect(safeRedirectTarget('http://evil.com/steal')).toBe('/');
	});

	it('returns / for a value that does not start with /', () => {
		expect(safeRedirectTarget('evil')).toBe('/');
	});

	it('returns / for null', () => {
		expect(safeRedirectTarget(null)).toBe('/');
	});

	it('returns / for an empty string', () => {
		expect(safeRedirectTarget('')).toBe('/');
	});
});

// (*MVOX:Tallis*)
