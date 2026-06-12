import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listAgenda } from './agendaData';
import * as entuSeasons from '$lib/seasons/entuSeasons';

vi.mock('$lib/seasons/entuSeasons', () => ({
	listSeasons: vi.fn(),
	listRehearsals: vi.fn(),
}));

const cfg = { db: 'testdb', token: 'jwt' };
const NOW = new Date('2026-06-12T10:00:00.000Z');
const org = (id: string, label: string) => ({ id, label, initials: label.slice(0, 2) });

beforeEach(() => vi.clearAllMocks());

describe('listAgenda', () => {
	it('merges rehearsals across orgs, sorted chronologically, annotated with org', async () => {
		vi.mocked(entuSeasons.listSeasons).mockImplementation(async (_c, orgId) => [
			{ id: `season-${orgId}`, name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockImplementation(async (_c, { orgId }) =>
			orgId === 'orgA'
				? [
						{
							id: 'r2',
							seriesId: 's1',
							startDatetime: '2026-06-20T16:00:00.000Z',
							durationMinutes: 120,
							location: 'Hall A',
							name: 'Tue',
							description: undefined,
						},
					]
				: [
						{
							id: 'r1',
							seriesId: 's2',
							startDatetime: '2026-06-15T16:00:00.000Z',
							durationMinutes: 90,
							location: undefined,
							name: 'Mon',
							description: undefined,
						},
					],
		);
		const res = await listAgenda(cfg, [org('orgA', 'EFK'), org('orgB', 'Koor B')], NOW);
		expect(res).toEqual({
			items: [
				{
					id: 'r1',
					seriesId: 's2',
					startDatetime: '2026-06-15T16:00:00.000Z',
					durationMinutes: 90,
					location: undefined,
					name: 'Mon',
					description: undefined,
					orgId: 'orgB',
					orgLabel: 'Koor B',
				},
				{
					id: 'r2',
					seriesId: 's1',
					startDatetime: '2026-06-20T16:00:00.000Z',
					durationMinutes: 120,
					location: 'Hall A',
					name: 'Tue',
					description: undefined,
					orgId: 'orgA',
					orgLabel: 'EFK',
				},
			],
			errors: [],
		});
	});

	it('skips seasons that ended before today', async () => {
		vi.mocked(entuSeasons.listSeasons).mockResolvedValue([
			{ id: 'old', name: 'Old', startDate: '2025-09-01', endDate: '2026-05-31' },
			{ id: 'cur', name: 'Cur', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([]);
		await listAgenda(cfg, [org('o1', 'A')], NOW);
		expect(entuSeasons.listRehearsals).toHaveBeenCalledTimes(1);
		expect(entuSeasons.listRehearsals).toHaveBeenCalledWith(cfg, { orgId: 'o1', seasonId: 'cur' });
	});

	it('filters out rehearsals earlier than now (boundary: this morning excluded)', async () => {
		vi.mocked(entuSeasons.listSeasons).mockResolvedValue([
			{ id: 's', name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' },
		]);
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([
			{
				id: 'past',
				seriesId: 'x',
				startDatetime: '2026-06-12T07:00:00.000Z',
				durationMinutes: 60,
				location: undefined,
				name: undefined,
				description: undefined,
			},
			{
				id: 'next',
				seriesId: 'x',
				startDatetime: '2026-06-12T16:00:00.000Z',
				durationMinutes: 60,
				location: undefined,
				name: undefined,
				description: undefined,
			},
		]);
		const res = await listAgenda(cfg, [org('o1', 'A')], NOW);
		expect(res.items.map((i) => i.id)).toEqual(['next']);
	});

	it('a failing org contributes errors entry, other orgs still load', async () => {
		vi.mocked(entuSeasons.listSeasons).mockImplementation(async (_c, orgId) => {
			if (orgId === 'bad') throw new Error('403');
			return [{ id: 's', name: 'S', startDate: '2026-06-01', endDate: '2027-05-31' }];
		});
		vi.mocked(entuSeasons.listRehearsals).mockResolvedValue([
			{
				id: 'r1',
				seriesId: 'x',
				startDatetime: '2026-07-01T16:00:00.000Z',
				durationMinutes: 60,
				location: undefined,
				name: undefined,
				description: undefined,
			},
		]);
		const res = await listAgenda(cfg, [org('bad', 'Broken'), org('ok', 'Fine')], NOW);
		expect(res.errors).toEqual(['Broken']);
		expect(res.items.map((i) => i.orgId)).toEqual(['ok']);
	});

	it('returns empty result for zero orgs without fetching', async () => {
		const res = await listAgenda(cfg, [], NOW);
		expect(res).toEqual({ items: [], errors: [] });
		expect(entuSeasons.listSeasons).not.toHaveBeenCalled();
	});
});
