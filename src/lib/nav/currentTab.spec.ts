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

// (*MVOX:Tallis*)
