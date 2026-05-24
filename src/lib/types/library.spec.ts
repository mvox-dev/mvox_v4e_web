import { describe, expect, it, expectTypeOf } from 'vitest';
import type { Work, Edition, Loan, Member, Choir, Task, Voice } from './library';

describe('library types', () => {
	it('Voice is a literal-union of valid voice parts', () => {
		expectTypeOf<Voice>().toEqualTypeOf<'S1' | 'S2' | 'A' | 'T1' | 'T2' | 'B1' | 'B2'>();
	});

	it('Member has id, name, voice', () => {
		const m: Member = { id: 'x', name: 'Test Member', voice: 'S1' };
		expect(m.id).toBe('x');
	});

	it('Edition has total/on_loan/overdue numerics + optional limitless', () => {
		const e: Edition = {
			id: 'e1',
			label: 'L',
			voicing: 'SATB',
			publisher: 'P',
			year: 2020,
			total: 12,
			on_loan: 0,
			overdue: 0,
			returned_today: 0,
		};
		expect(e.total).toBe(12);
		const limitless: Edition = { ...e, total: 0, limitless: true };
		expect(limitless.limitless).toBe(true);
	});

	it('Work has nested editions', () => {
		const w: Work = {
			id: 'w1',
			composer: 'C',
			title: 'T',
			year: 2020,
			lang: 'Latin',
			period: 'Contemporary',
			tags: [],
			editions: [],
		};
		expect(w.editions).toEqual([]);
	});

	it('Loan has copy/member/since/days_overdue', () => {
		const l: Loan = { copy: '#1', member: 'x', since: '2025-01-01', days_overdue: 30 };
		expect(l.days_overdue).toBe(30);
	});

	it('Task has rank, kind, title, summary', () => {
		const t: Task = { id: 'x', rank: 1, kind: 'returns', title: 'T', summary: 'S' };
		expect(t.kind).toBe('returns');
	});

	it('Choir has slug, initials, rehearsal_size', () => {
		const c: Choir = { name: 'N', short: 'S', slug: 's', initials: 'SS', rehearsal_size: 48 };
		expect(c.rehearsal_size).toBe(48);
	});
});
