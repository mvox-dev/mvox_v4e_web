import type { Work, Member } from '../types/library';

export interface LibStats {
	works: number;
	editions: number;
	copies: number;
	on_loan: number;
	overdue: number;
	available: number;
}

export interface WorkStats {
	total: number;
	loaned: number;
	overdue: number;
	returned_today: number;
	available: number;
	has_limitless: boolean;
}

export function libStats(works: Work[]): LibStats {
	let editions = 0,
		copies = 0,
		on_loan = 0,
		overdue = 0;
	for (const w of works) {
		editions += w.editions.length;
		for (const e of w.editions) {
			copies += e.total || 0;
			on_loan += e.on_loan || 0;
			overdue += e.overdue || 0;
		}
	}
	return { works: works.length, editions, copies, on_loan, overdue, available: copies - on_loan };
}

export function workStats(w: Work): WorkStats {
	let total = 0,
		loaned = 0,
		overdue = 0,
		returned_today = 0,
		has_limitless = false;
	for (const e of w.editions) {
		if (e.limitless) {
			has_limitless = true;
			continue;
		}
		total += e.total || 0;
		loaned += e.on_loan || 0;
		overdue += e.overdue || 0;
		returned_today += e.returned_today || 0;
	}
	return { total, loaned, overdue, returned_today, available: total - loaned, has_limitless };
}

export function byMemberId(members: Member[], id: string): Member | undefined {
	return members.find((m) => m.id === id);
}

export function workById(works: Work[], id: string): Work | undefined {
	return works.find((w) => w.id === id);
}

export function editionById(work: Work | undefined, eid: string) {
	return work?.editions.find((e) => e.id === eid);
}
