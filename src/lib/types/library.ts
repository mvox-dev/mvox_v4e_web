export type Voice = 'S1' | 'S2' | 'A' | 'T1' | 'T2' | 'B1' | 'B2';

export interface Choir {
	name: string;
	short: string;
	slug: string;
	initials: string;
	rehearsal_size: number;
}

export interface Member {
	id: string;
	name: string;
	voice: Voice;
}

export interface Loan {
	copy: string;
	member: string;
	since: string;
	days_overdue: number;
}

export interface Edition {
	id: string;
	label: string;
	voicing: string;
	publisher: string;
	year: number;
	isbn?: string;
	location?: string;
	total: number;
	on_loan: number;
	overdue: number;
	returned_today: number;
	limitless?: boolean;
	loans?: Loan[];
}

export interface Work {
	id: string;
	composer: string;
	title: string;
	title_alt?: string;
	year: number;
	lang: string;
	period: string;
	tags: string[];
	notes?: string;
	editions: Edition[];
}

export type TaskKind = 'returns' | 'overdue' | 'pull';

export interface Task {
	id: string;
	rank: number;
	kind: TaskKind;
	title: string;
	summary: string;
	work_id?: string;
	edition_id?: string;
	work_ids?: string[];
	count?: number;
	confirmed?: number;
	pending?: number;
	borrowers?: string[];
	days?: number;
	pulled?: Record<string, number>;
}

export interface Today {
	iso: string;
	dow: string;
	date: string;
	time: string;
}
