import { describe, it, expect } from 'vitest';
import { computeAdditiveDiff, type DbTypeState } from './diff';
import type { V4eSchema } from './schema-loader';

const v4e: V4eSchema = {
	version: 'v4E',
	sections: [],
	entities: [
		{
			name: 'season',
			label: 'Season',
			properties: [
				{ name: 'start_date', type: 'date' },
				{ name: 'end_date', type: 'date' },
				{ name: 'description', type: 'text' }
			]
		},
		{
			name: 'voice',
			label: 'Voice',
			properties: [{ name: 'label', type: 'string' }]
		}
	]
};

describe('computeAdditiveDiff', () => {
	it('produces all CREATE_TYPE + ADD_PROPERTY ops for an empty db', () => {
		const dbState: DbTypeState[] = [];
		const ops = computeAdditiveDiff(v4e, dbState);

		const creates = ops.filter((o) => o.kind === 'CREATE_TYPE');
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY');
		expect(creates).toHaveLength(2);
		expect(adds).toHaveLength(4);

		// Ordering invariant
		const lastCreateIdx = ops.findIndex(
			(o, i) => o.kind === 'ADD_PROPERTY' && ops[i - 1]?.kind === 'CREATE_TYPE'
		);
		const firstAddIdx = ops.findIndex((o) => o.kind === 'ADD_PROPERTY');
		expect(firstAddIdx).toBeGreaterThan(-1);
		expect(creates.every((c, i) => ops.indexOf(c) < firstAddIdx)).toBe(true);
	});

	it('skips existing types but still adds their missing properties', () => {
		const dbState: DbTypeState[] = [
			{
				typeId: 'season-id',
				name: 'season',
				propertyNames: ['start_date']
			}
		];
		const ops = computeAdditiveDiff(v4e, dbState);

		expect(ops.filter((o) => o.kind === 'CREATE_TYPE')).toHaveLength(1); // voice only
		expect((ops.filter((o) => o.kind === 'CREATE_TYPE')[0] as { typeName: string }).typeName).toBe(
			'voice'
		);
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY') as Array<{
			parentTypeName: string;
			propertyName: string;
		}>;
		// Season needs end_date + description; voice needs label
		expect(adds).toHaveLength(3);
		expect(adds.map((a) => `${a.parentTypeName}.${a.propertyName}`).sort()).toEqual([
			'season.description',
			'season.end_date',
			'voice.label'
		]);
	});

	it('returns empty ops when db is already at v4E', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 's', name: 'season', propertyNames: ['start_date', 'end_date', 'description'] },
			{ typeId: 'v', name: 'voice', propertyNames: ['label'] }
		];
		expect(computeAdditiveDiff(v4e, dbState)).toEqual([]);
	});

	it('ignores db-only types (Phase A is additive, not destructive)', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 'role-id', name: 'role', propertyNames: ['name'] } // not in v4E
		];
		const ops = computeAdditiveDiff(v4e, dbState);
		// Role is left alone; we only add what v4E specifies
		expect(ops.find((o) => o.kind === 'CREATE_TYPE' && (o as { typeName: string }).typeName === 'role')).toBeUndefined();
	});
});
