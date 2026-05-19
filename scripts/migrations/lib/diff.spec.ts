import { describe, it, expect } from 'vitest';
import { computeAdditiveDiff, type DbTypeState, type CreateTypeOp, type AddPropertyOp } from './diff';
import type { V4eSchema } from './schema-loader';

const v4e: V4eSchema = {
	version: 'v4E',
	sections: [],
	entities: [
		{
			name: 'season',
			blurb: "A choir's working year",
			properties: [
				{ name: 'start_date', type: 'date', required: true },
				{ name: 'end_date', type: 'date' },
				{ name: 'description', type: 'text' }
			]
		},
		{
			name: 'voice',
			blurb: 'Vocal range taxonomy',
			properties: [{ name: 'name', type: 'string' }]
		}
	]
};

describe('computeAdditiveDiff', () => {
	it('produces all CREATE_TYPE ops for an empty db; new-type properties are inline', () => {
		const dbState: DbTypeState[] = [];
		const ops = computeAdditiveDiff(v4e, dbState);

		const creates = ops.filter((o) => o.kind === 'CREATE_TYPE') as CreateTypeOp[];
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY');
		expect(creates).toHaveLength(2);
		expect(adds).toHaveLength(0); // properties on new types are inline in CreateTypeOp, not separate ops
		expect(creates[0].properties).toHaveLength(3); // season's 3 props inline
		expect(creates[1].properties).toHaveLength(1); // voice's 1 prop inline
	});

	it('skips existing types but adds their missing properties as ADD_PROPERTY ops', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 'season-id', name: 'season', propertyNames: ['start_date'] }
		];
		const ops = computeAdditiveDiff(v4e, dbState);

		expect(ops.filter((o) => o.kind === 'CREATE_TYPE')).toHaveLength(1); // voice
		const voiceCreate = ops.find((o) => o.kind === 'CREATE_TYPE') as CreateTypeOp;
		expect(voiceCreate.typeName).toBe('voice');
		expect(voiceCreate.properties).toHaveLength(1); // voice.name inline

		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY') as AddPropertyOp[];
		// season missing 2 properties (end_date, description) → 2 ADD ops
		expect(adds).toHaveLength(2);
		expect(adds.map((a) => `${a.parentTypeName}.${a.propertyName}`).sort()).toEqual([
			'season.description',
			'season.end_date'
		]);
	});

	it('returns empty ops when db is already at v4E', () => {
		const dbState: DbTypeState[] = [
			{ typeId: 's', name: 'season', propertyNames: ['start_date', 'end_date', 'description'] },
			{ typeId: 'v', name: 'voice', propertyNames: ['name'] }
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
