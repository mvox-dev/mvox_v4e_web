import { describe, it, expect } from 'vitest';
import { occurrenceDates, toStartDatetime } from './recurrence';

describe('occurrenceDates', () => {
	it('weekly across a month → 5 dates inclusive of boundary', () => {
		expect(occurrenceDates('2026-09-01', '2026-09-29', 7)).toEqual([
			'2026-09-01',
			'2026-09-08',
			'2026-09-15',
			'2026-09-22',
			'2026-09-29',
		]);
	});
	it('same-day series → exactly 1', () => {
		expect(occurrenceDates('2026-09-01', '2026-09-01', 7)).toEqual(['2026-09-01']);
	});
	it('end exactly one interval after start → 2 (boundary inclusive)', () => {
		expect(occurrenceDates('2026-09-01', '2026-09-08', 7)).toEqual(['2026-09-01', '2026-09-08']);
	});
	it('biweekly — only dates within window returned', () => {
		expect(occurrenceDates('2026-09-01', '2026-09-21', 14)).toEqual(['2026-09-01', '2026-09-15']);
	});
	it('returns empty array when end is before start', () => {
		expect(occurrenceDates('2026-09-08', '2026-09-01', 7)).toEqual([]);
	});
});

describe('toStartDatetime (Europe/Tallinn, DST-aware)', () => {
	it('winter 19:00 EET → 17:00 UTC', () => {
		// 2026-01-06 is EET (UTC+2)
		expect(toStartDatetime('2026-01-06', '19:00')).toBe('2026-01-06T17:00:00.000Z');
	});
	it('summer 19:00 EEST → 16:00 UTC', () => {
		// 2026-06-16 is EEST (UTC+3)
		expect(toStartDatetime('2026-06-16', '19:00')).toBe('2026-06-16T16:00:00.000Z');
	});
	it('midnight 00:00 EET (winter) → correct UTC', () => {
		// 2026-02-03 is EET (UTC+2): 00:00 local → 22:00 UTC previous day
		expect(toStartDatetime('2026-02-03', '00:00')).toBe('2026-02-02T22:00:00.000Z');
	});
});
