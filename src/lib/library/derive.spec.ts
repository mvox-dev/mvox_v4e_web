import { describe, expect, it } from 'vitest';
import { CHOIR, MEMBERS, WORKS } from '../fixtures/library-mock';
import { libStats, workStats, byMemberId, workById, editionById } from './derive';

describe('library derive helpers', () => {
	it('libStats sums totals across all works', () => {
		const s = libStats(WORKS);
		expect(s.works).toBe(13);
		expect(s.copies).toBeGreaterThan(500);
		expect(s.on_loan).toBeGreaterThanOrEqual(4);
		expect(s.overdue).toBe(4);
	});

	it('workStats excludes limitless editions from total', () => {
		const part = WORKS.find((w) => w.id === 'part-magnificat')!;
		const s = workStats(part);
		expect(s.total).toBe(54);
		expect(s.overdue).toBe(4);
		expect(s.has_limitless).toBe(true);
	});

	it('byMemberId returns the member for a known id', () => {
		const m = byMemberId(MEMBERS, 'hk');
		expect(m?.name).toBe('Henn Kuusik');
		expect(m?.voice).toBe('B2');
	});

	it('byMemberId returns undefined for unknown id', () => {
		expect(byMemberId(MEMBERS, 'xx')).toBeUndefined();
	});

	it('workById + editionById round-trip', () => {
		const w = workById(WORKS, 'tallis-spem');
		expect(w?.composer).toBe('Thomas Tallis');
		const e = editionById(w, 'tallis-40');
		expect(e?.publisher).toBe('Chester Novello');
	});

	it('CHOIR matches expected slug + rehearsal size', () => {
		expect(CHOIR.slug).toBe('epcc');
		expect(CHOIR.rehearsal_size).toBe(48);
	});

	it('MEMBERS has 8 entries with valid voices', () => {
		expect(MEMBERS.length).toBe(8);
		expect(MEMBERS.every((m) => m.voice.length <= 2)).toBe(true);
	});
});
