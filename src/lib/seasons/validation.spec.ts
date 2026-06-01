import { describe, it, expect } from 'vitest';
import { validateSeason, validateSeries } from './validation';

describe('validateSeason', () => {
	it('rejects end before start', () => {
		expect(validateSeason({ name: 'S', startDate: '2026-09-01', endDate: '2026-08-31' })).toEqual({
			ok: false,
			field: 'endDate',
			code: 'end_before_start',
		});
	});
	it('accepts same-day', () => {
		expect(validateSeason({ name: 'S', startDate: '2026-09-01', endDate: '2026-09-01' }).ok).toBe(
			true,
		);
	});
	it('rejects blank name', () => {
		expect(validateSeason({ name: '   ', startDate: '2026-09-01', endDate: '2026-09-02' })).toEqual(
			{ ok: false, field: 'name', code: 'blank' },
		);
	});
	it('rejects empty name', () => {
		expect(validateSeason({ name: '', startDate: '2026-09-01', endDate: '2026-09-02' })).toEqual({
			ok: false,
			field: 'name',
			code: 'blank',
		});
	});
	it('accepts valid season', () => {
		expect(
			validateSeason({ name: 'Autumn 2026', startDate: '2026-09-01', endDate: '2027-05-31' }).ok,
		).toBe(true);
	});
});

describe('validateSeries', () => {
	const season = { startDate: '2026-09-01', endDate: '2027-05-31' };
	const base = {
		name: 'Tue',
		intervalDays: 7,
		startTime: '19:00',
		durationMinutes: 120,
		startDate: '2026-09-02',
		endDate: '2027-05-30',
	};
	it('rejects intervalDays < 1', () => {
		expect(validateSeries({ ...base, intervalDays: 0 }, season)).toMatchObject({
			ok: false,
			code: 'interval_too_small',
		});
	});
	it('rejects series start before season start', () => {
		expect(validateSeries({ ...base, startDate: '2026-08-01' }, season)).toEqual({
			ok: false,
			field: 'startDate',
			code: 'outside_season',
		});
	});
	it('rejects series end after season end', () => {
		expect(validateSeries({ ...base, endDate: '2027-06-30' }, season)).toMatchObject({
			ok: false,
			code: 'outside_season',
		});
	});
	it('accepts a valid series', () => {
		expect(validateSeries(base, season).ok).toBe(true);
	});
	it('rejects durationMinutes < 1', () => {
		expect(validateSeries({ ...base, durationMinutes: 0 }, season)).toEqual({
			ok: false,
			field: 'durationMinutes',
			code: 'duration_too_small',
		});
	});
	it('rejects blank series name', () => {
		expect(validateSeries({ ...base, name: '  ' }, season)).toEqual({
			ok: false,
			field: 'name',
			code: 'blank',
		});
	});
	it('series start == season start is accepted (boundary inclusive)', () => {
		expect(validateSeries({ ...base, startDate: '2026-09-01' }, season).ok).toBe(true);
	});
	it('series end == season end is accepted (boundary inclusive)', () => {
		expect(validateSeries({ ...base, endDate: '2027-05-31' }, season).ok).toBe(true);
	});
});
