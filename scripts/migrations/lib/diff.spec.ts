import { describe, it, expect } from 'vitest';
import {
	computeAdditiveDiff,
	computePhaseBDiff,
	type DbTypeState,
	type CreateTypeOp,
	type AddPropertyOp,
	type RenameSubOp,
	type BackfillDataOp,
	type DeletePropertyOp,
	type UpdateFormulaOp,
	type TouchSaveOp
} from './diff';
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

	it('respects Phase A scope filter — skips properties not in §4.2', () => {
		// Use a v4e fixture that includes a known Phase-B-rename property
		const v4eWithRename: V4eSchema = {
			version: 'v4E',
			sections: [],
			entities: [
				{
					name: 'person',
					properties: [
						{ name: 'bio', type: 'text' },   // in §4.2 — should be added
						{ name: 'avatar', type: 'file' } // Phase B rename — should be skipped
					]
				}
			]
		};
		const dbState: DbTypeState[] = [
			{ typeId: 'person-id', name: 'person', propertyNames: ['photo'] } // existing
		];
		const ops = computeAdditiveDiff(v4eWithRename, dbState);
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY') as AddPropertyOp[];
		expect(adds.map((a) => `${a.parentTypeName}.${a.propertyName}`)).toEqual(['person.bio']);
		// person.avatar should not appear
		expect(adds.some((a) => a.propertyName === 'avatar')).toBe(false);
	});

	it('processes §4.1 new-type properties even if type already exists in db (partial-failure recovery)', () => {
		// Scenario: a previous run crashed after creating the `voice` type entity but
		// before all its inline properties landed. The db now has `voice` with only
		// some of its v4E properties. Re-run must complete the missing inline props
		// despite the scope filter normally excluding §4.1 type props.
		const v4e: V4eSchema = {
			version: 'v4E',
			sections: [],
			entities: [
				{
					name: 'voice',
					blurb: 'Vocal range taxonomy',
					properties: [
						{ name: 'name', type: 'string' },
						{ name: 'label', type: 'string' },
						{ name: 'iso_code', type: 'string' }
					]
				}
			]
		};
		const dbState: DbTypeState[] = [
			{ typeId: 'voice-id', name: 'voice', propertyNames: ['name'] } // partial — only `name` landed
		];
		const ops = computeAdditiveDiff(v4e, dbState);
		const adds = ops.filter((o) => o.kind === 'ADD_PROPERTY') as AddPropertyOp[];
		expect(adds).toHaveLength(2);
		expect(adds.map((a) => `${a.parentTypeName}.${a.propertyName}`).sort()).toEqual([
			'voice.iso_code',
			'voice.label'
		]);
	});
});

// ── Phase B diff additions ─────────────────────────────────────────────────

interface MinimalDbState {
	typeId: string;
	name: string;
	propertyNames: string[];
	propertyIds: Record<string, string>; // propertyName → Entu property-def _id
}

describe('computePhaseBDiff', () => {
	describe('§1 rename: number→number (section.ordinal → section.display_order)', () => {
		it('emits ADD_PROPERTY + BACKFILL_DATA + DELETE_PROPERTY in that order', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal', 'name'],
					propertyIds: { ordinal: 'ordinal-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const sectionOps = ops.filter(o =>
				(o as { parentType?: string }).parentType === 'section' ||
				(o as { sourceType?: string }).sourceType === 'section'
			);

			const kinds = sectionOps.map(o => o.kind);
			const addIdx = kinds.indexOf('ADD_PROPERTY');
			const backfillIdx = kinds.indexOf('BACKFILL_DATA');
			const deleteIdx = kinds.indexOf('DELETE_PROPERTY');

			expect(addIdx).toBeGreaterThanOrEqual(0);
			expect(backfillIdx).toBeGreaterThan(addIdx);
			expect(deleteIdx).toBeGreaterThan(backfillIdx);
		});

		it('ADD_PROPERTY op targets display_order on section', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal'],
					propertyIds: { ordinal: 'ordinal-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const add = ops.find(o => o.kind === 'ADD_PROPERTY' && (o as AddPropertyOp).propertyName === 'display_order') as AddPropertyOp | undefined;
			expect(add).toBeDefined();
			expect(add?.parentTypeName).toBe('section');
		});

		it('skips ADD_PROPERTY when display_order already exists (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal', 'display_order'],
					propertyIds: { ordinal: 'ordinal-prop-id', display_order: 'display-order-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const adds = ops.filter(o => o.kind === 'ADD_PROPERTY' && (o as AddPropertyOp).propertyName === 'display_order');
			expect(adds).toHaveLength(0);
		});

		it('BACKFILL_DATA op carries source + target prop names and kind=number', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal'],
					propertyIds: { ordinal: 'ordinal-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfill = ops.find(o => o.kind === 'BACKFILL_DATA' &&
				(o as BackfillDataOp).sourceProperty === 'ordinal') as BackfillDataOp | undefined;
			expect(backfill).toBeDefined();
			expect(backfill?.targetProperty).toBe('display_order');
			expect(backfill?.backfillKind).toBe('number');
		});

		it('DELETE_PROPERTY op carries the source prop id', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal'],
					propertyIds: { ordinal: 'ordinal-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(o => o.kind === 'DELETE_PROPERTY' &&
				(o as DeletePropertyOp).propertyName === 'ordinal') as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
			expect(del?.propertyDefId).toBe('ordinal-prop-id');
		});
	});

	describe('§3 obsolete delete: organization.contact_email', () => {
		it('emits DELETE_PROPERTY with verify_preconditions flag', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['contact_email', 'name'],
					propertyIds: { contact_email: 'contact-email-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(o =>
				o.kind === 'DELETE_PROPERTY' &&
				(o as DeletePropertyOp).propertyName === 'contact_email'
			) as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
			expect(del?.verifyPreconditions).toBe(true);
		});

		it('skips DELETE_PROPERTY when property not present in db (already deleted)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['name'], // contact_email already gone
					propertyIds: {}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(o =>
				o.kind === 'DELETE_PROPERTY' &&
				(o as DeletePropertyOp).propertyName === 'contact_email'
			);
			expect(del).toBeUndefined();
		});
	});

	describe('§4 formula update: section.member_count', () => {
		it('emits UPDATE_FORMULA op with new recursive formula', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['member_count'],
					propertyIds: { member_count: 'member-count-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const update = ops.find(o =>
				o.kind === 'UPDATE_FORMULA' &&
				(o as UpdateFormulaOp).propertyName === 'member_count'
			) as UpdateFormulaOp | undefined;
			expect(update).toBeDefined();
			expect(update?.parentType).toBe('section');
			expect(update?.newFormula).toContain('_child');
		});

		it('skips UPDATE_FORMULA when formula already matches target (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['member_count'],
					propertyIds: { member_count: 'member-count-prop-id' },
					// We'll simulate "current formula matches" via an extended field
					currentFormulas: { member_count: '(_child.member COUNT) (_child.section.member_count SUM) +' }
				} as MinimalDbState & { currentFormulas?: Record<string, string> }
			];
			// computePhaseBDiff should accept optional currentFormulas on each type state
			const ops = computePhaseBDiff(dbState as Parameters<typeof computePhaseBDiff>[0]);
			const updates = ops.filter(o =>
				o.kind === 'UPDATE_FORMULA' && (o as UpdateFormulaOp).propertyName === 'member_count'
			);
			expect(updates).toHaveLength(0);
		});
	});

	describe('§4 formula delete: season.work_count', () => {
		it('emits DELETE_PROPERTY for season.work_count', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'season-type-id',
					name: 'season',
					propertyNames: ['work_count', 'start_date'],
					propertyIds: { work_count: 'work-count-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(o =>
				o.kind === 'DELETE_PROPERTY' &&
				(o as DeletePropertyOp).propertyName === 'work_count'
			) as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
		});
	});

	describe('§5 touch-save: organization.member_count_per_section', () => {
		it('emits TOUCH_SAVE op for organization.member_count_per_section', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['member_count_per_section'],
					propertyIds: { member_count_per_section: 'mcp-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const touch = ops.find(o =>
				o.kind === 'TOUCH_SAVE' &&
				(o as TouchSaveOp).parentType === 'organization' &&
				(o as TouchSaveOp).propertyName === 'member_count_per_section'
			) as TouchSaveOp | undefined;
			expect(touch).toBeDefined();
		});

		it('touch-saves come after all formula updates in the op list', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['member_count'],
					propertyIds: { member_count: 'mc-id' }
				},
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['member_count_per_section'],
					propertyIds: { member_count_per_section: 'mcp-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const lastUpdateIdx = ops.reduce((max, o, i) => o.kind === 'UPDATE_FORMULA' ? i : max, -1);
			const firstTouchIdx = ops.findIndex(o => o.kind === 'TOUCH_SAVE');
			if (lastUpdateIdx >= 0 && firstTouchIdx >= 0) {
				expect(firstTouchIdx).toBeGreaterThan(lastUpdateIdx);
			}
		});
	});

	// RED-A1: §2 migration — work.arranger → edition.arranger (parent_copy)
	// PHASE_B_MIGRATIONS[0] is dead code; computePhaseBDiff never processes it.
	describe('§2 migration: work.arranger → edition.arranger (parent_copy)', () => {
		it('emits BACKFILL_DATA(parent_copy) + DELETE_PROPERTY for work.arranger', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['arranger', 'title'],
					propertyIds: { arranger: 'work-arranger-prop-id' }
				},
				{
					typeId: 'edition-type-id',
					name: 'edition',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'edition-arranger-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfill = ops.find(
				(o) =>
					o.kind === 'BACKFILL_DATA' &&
					(o as BackfillDataOp).sourceProperty === 'arranger' &&
					(o as BackfillDataOp).parentType === 'work'
			) as BackfillDataOp | undefined;
			expect(backfill).toBeDefined();
			expect(backfill?.backfillKind).toBe('parent_copy');
			expect(backfill?.targetProperty).toBe('arranger');

			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'work' &&
					(o as DeletePropertyOp).propertyName === 'arranger'
			) as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
			expect(del?.propertyDefId).toBe('work-arranger-prop-id');
		});

		it('BACKFILL_DATA op for parent_copy comes before DELETE_PROPERTY for work.arranger', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'work-arranger-prop-id' }
				},
				{
					typeId: 'edition-type-id',
					name: 'edition',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'edition-arranger-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfillIdx = ops.findIndex(
				(o) => o.kind === 'BACKFILL_DATA' && (o as BackfillDataOp).parentType === 'work'
			);
			const deleteIdx = ops.findIndex(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'work' &&
					(o as DeletePropertyOp).propertyName === 'arranger'
			);
			expect(backfillIdx).toBeGreaterThanOrEqual(0);
			expect(deleteIdx).toBeGreaterThan(backfillIdx);
		});

		it('skips work.arranger migration when arranger already absent from work (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['title'], // arranger already gone
					propertyIds: {}
				},
				{
					typeId: 'edition-type-id',
					name: 'edition',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'edition-arranger-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfill = ops.find(
				(o) => o.kind === 'BACKFILL_DATA' && (o as BackfillDataOp).parentType === 'work'
			);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'work' &&
					(o as DeletePropertyOp).propertyName === 'arranger'
			);
			expect(backfill).toBeUndefined();
			expect(del).toBeUndefined();
		});
	});

	// RED-5: parent_copy op shape must carry targetParentType
	// The executor's migrateProperty callback needs to iterate the TARGET type (editions),
	// not the source type (works). Encoding targetParentType on BackfillDataOp makes the
	// iteration target explicit, avoiding the latent bug where listInstances(work) fetches wrong entities.
	describe('§2 parent_copy: BackfillDataOp carries targetParentType', () => {
		it('BACKFILL_DATA(parent_copy) op for work.arranger carries targetParentType: "edition"', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'work-arranger-prop-id' }
				},
				{
					typeId: 'edition-type-id',
					name: 'edition',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'edition-arranger-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfill = ops.find(
				(o) =>
					o.kind === 'BACKFILL_DATA' &&
					(o as BackfillDataOp).backfillKind === 'parent_copy'
			) as BackfillDataOp | undefined;
			expect(backfill).toBeDefined();
			// targetParentType must name the type to iterate (edition), not the source (work)
			expect((backfill as BackfillDataOp & { targetParentType?: string }).targetParentType).toBe('edition');
		});

		it('parentType on parent_copy op remains the source type (work)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'work-arranger-prop-id' }
				},
				{
					typeId: 'edition-type-id',
					name: 'edition',
					propertyNames: ['arranger'],
					propertyIds: { arranger: 'edition-arranger-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const backfill = ops.find(
				(o) =>
					o.kind === 'BACKFILL_DATA' &&
					(o as BackfillDataOp).backfillKind === 'parent_copy'
			) as BackfillDataOp | undefined;
			expect(backfill?.parentType).toBe('work');
		});
	});

	// v9.1: §2.8 deferred to Phase D (PO decision 2026-05-20).
	// person.forename+surname verify_then_delete removed from PHASE_B_MIGRATIONS.
	// Q5 probe: freezing whitespace-only names is a UX commitment deferred to Phase D.
	describe('§2 migration: person.forename + person.surname (verify_then_delete) — DEFERRED to Phase D', () => {
		it('does NOT emit DELETE_PROPERTY for person.forename (§2.8 deferred)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'person-type-id',
					name: 'person',
					propertyNames: ['forename', 'surname', 'name'],
					propertyIds: {
						forename: 'person-forename-prop-id',
						surname: 'person-surname-prop-id'
					}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const delForename = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'person' &&
					(o as DeletePropertyOp).propertyName === 'forename'
			);
			expect(delForename).toBeUndefined();
		});

		it('does NOT emit DELETE_PROPERTY for person.surname (§2.8 deferred)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'person-type-id',
					name: 'person',
					propertyNames: ['forename', 'surname'],
					propertyIds: {
						forename: 'person-forename-prop-id',
						surname: 'person-surname-prop-id'
					}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const delSurname = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'person' &&
					(o as DeletePropertyOp).propertyName === 'surname'
			);
			expect(delSurname).toBeUndefined();
		});

		it('skips forename/surname delete when already absent (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'person-type-id',
					name: 'person',
					propertyNames: ['name'], // forename + surname already deleted
					propertyIds: {}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const personDeletes = ops.filter(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'person'
			);
			expect(personDeletes).toHaveLength(0);
		});
	});

	// RED-A3: §4 formula delete — work.edition_count
	// PHASE_B_FORMULA_UPDATES has no work.edition_count entry; computePhaseBDiff won't emit it.
	describe('§4 formula delete: work.edition_count', () => {
		it('emits DELETE_PROPERTY for work.edition_count', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['edition_count', 'title'],
					propertyIds: { edition_count: 'work-edition-count-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'work' &&
					(o as DeletePropertyOp).propertyName === 'edition_count'
			) as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
			expect(del?.propertyDefId).toBe('work-edition-count-prop-id');
		});

		it('skips work.edition_count delete when already absent (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'work-type-id',
					name: 'work',
					propertyNames: ['title'], // edition_count already gone
					propertyIds: {}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'work' &&
					(o as DeletePropertyOp).propertyName === 'edition_count'
			);
			expect(del).toBeUndefined();
		});
	});

	// RED-A4: §3 obsolete delete — organization.member_count (legacy wrong formula)
	// PHASE_B_OBSOLETE_DELETES has no organization.member_count entry; diff won't emit it.
	describe('§3 obsolete delete: organization.member_count (legacy wrong formula)', () => {
		it('emits DELETE_PROPERTY for organization.member_count', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['member_count', 'name'],
					propertyIds: { member_count: 'org-member-count-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'organization' &&
					(o as DeletePropertyOp).propertyName === 'member_count'
			) as DeletePropertyOp | undefined;
			expect(del).toBeDefined();
			expect(del?.propertyDefId).toBe('org-member-count-prop-id');
		});

		it('organization.member_count delete carries verifyPreconditions flag', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['member_count'],
					propertyIds: { member_count: 'org-member-count-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'organization' &&
					(o as DeletePropertyOp).propertyName === 'member_count'
			) as DeletePropertyOp | undefined;
			expect(del?.verifyPreconditions).toBe(true);
		});

		it('skips organization.member_count delete when already absent (idempotency)', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['name'], // member_count already gone
					propertyIds: {}
				}
			];
			const ops = computePhaseBDiff(dbState);
			const del = ops.find(
				(o) =>
					o.kind === 'DELETE_PROPERTY' &&
					(o as DeletePropertyOp).parentType === 'organization' &&
					(o as DeletePropertyOp).propertyName === 'member_count'
			);
			expect(del).toBeUndefined();
		});
	});

	describe('ordering: §1 → §2 → §3 → §4 → §5', () => {
		it('all BACKFILL_DATA (§1/§2) ops precede all obsolete DELETE_PROPERTY (§3) ops', () => {
			const dbState: MinimalDbState[] = [
				{
					typeId: 'section-type-id',
					name: 'section',
					propertyNames: ['ordinal'],
					propertyIds: { ordinal: 'ordinal-prop-id' }
				},
				{
					typeId: 'org-type-id',
					name: 'organization',
					propertyNames: ['contact_email'],
					propertyIds: { contact_email: 'ce-prop-id' }
				}
			];
			const ops = computePhaseBDiff(dbState);
			// Last BACKFILL_DATA index should be before first §3 DELETE
			// §3 deletes have verifyPreconditions: true, §1 deletes come after their own backfill
			const backfillIndices = ops.reduce<number[]>((acc, o, i) =>
				o.kind === 'BACKFILL_DATA' ? [...acc, i] : acc, []);
			const section3DeleteIndices = ops.reduce<number[]>((acc, o, i) =>
				(o.kind === 'DELETE_PROPERTY' && (o as DeletePropertyOp).verifyPreconditions &&
				(o as DeletePropertyOp).propertyName === 'contact_email') ? [...acc, i] : acc, []);

			if (backfillIndices.length > 0 && section3DeleteIndices.length > 0) {
				expect(Math.max(...backfillIndices)).toBeLessThan(Math.min(...section3DeleteIndices));
			}
		});
	});
});
