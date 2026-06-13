import { describe, it, expect } from 'vitest';
import { tabForPath } from './currentTab';

describe('tabForPath()', () => {
	it('returns "agenda" for /agenda path', () => {
		expect(tabForPath('/agenda')).toBe('agenda');
	});

	it('returns "agenda" for root / path', () => {
		expect(tabForPath('/')).toBe('agenda');
	});

	it('returns "library" for /library path', () => {
		expect(tabForPath('/library')).toBe('library');
	});

	it('returns "seasons" for /seasons path (not "rehearsals")', () => {
		expect(tabForPath('/seasons')).toBe('seasons');
	});

	it('returns "roster" for /roster path', () => {
		expect(tabForPath('/roster')).toBe('roster');
	});

	it('returns "notices" for /notices path', () => {
		expect(tabForPath('/notices')).toBe('notices');
	});

	it('returns "settings" for /settings path', () => {
		expect(tabForPath('/settings')).toBe('settings');
	});

	it('returns "agenda" for unknown paths (fallback)', () => {
		expect(tabForPath('/unknown/route')).toBe('agenda');
	});
});

// YELLOW-33.3 — tabForPath() prefix edge cases.
// Paths like /libraryxyz or /settingspage must NOT match their tab's prefix.
// The current startsWith() check incorrectly returns 'library' for /libraryxyz.
// Fix: require exact segment match (path === '/tab' || path.startsWith('/tab/')).
// RED until Byrd updates the implementation.
describe('tabForPath() — exact-segment edge cases (YELLOW-33.3)', () => {
	it('/libraryxyz does NOT match library tab (prefix-only false-match)', () => {
		expect(tabForPath('/libraryxyz')).toBe('agenda');
	});

	it('/roster-admin does NOT match roster tab', () => {
		expect(tabForPath('/roster-admin')).toBe('agenda');
	});

	it('/settings-page does NOT match settings tab', () => {
		expect(tabForPath('/settings-page')).toBe('agenda');
	});

	it('/seasons2026 does NOT match seasons tab', () => {
		expect(tabForPath('/seasons2026')).toBe('agenda');
	});

	it('/library/works DOES match library tab (sub-path)', () => {
		expect(tabForPath('/library/works')).toBe('library');
	});

	it('/roster/members DOES match roster tab (sub-path)', () => {
		expect(tabForPath('/roster/members')).toBe('roster');
	});
});

// (*MVOX:Tallis*)
