import { describe, it, expect } from 'vitest';
import { translateEntityType, translatePropertyDef } from './v4e-translator';
import type { V4eEntityTypeDef, V4ePropertyDef } from './schema-loader';
import {
	POLYPHONY_DB_ENTITY_ID,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID
} from './entu-client';

describe('translateEntityType', () => {
	it('produces minimal entity-type payload (name + label only)', () => {
		const v4e: V4eEntityTypeDef = { name: 'voice', properties: [] };
		const payload = translateEntityType(v4e, POLYPHONY_DB_ENTITY_ID, POLYPHONY_META_TYPE_ENTITY_ID);
		expect(payload).toEqual([
			{ type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID },
			{ type: '_parent', reference: POLYPHONY_DB_ENTITY_ID },
			{ type: 'name', string: 'voice' },
			{ type: 'label', string: 'voice' } // fallback when no blurb
		]);
	});

	it('translates v4E blurb → Entu label on the type entity', () => {
		const v4e: V4eEntityTypeDef = {
			name: 'voice',
			blurb: 'Vocal range taxonomy',
			properties: []
		};
		const payload = translateEntityType(v4e, POLYPHONY_DB_ENTITY_ID, POLYPHONY_META_TYPE_ENTITY_ID);
		expect(payload).toContainEqual({ type: 'label', string: 'Vocal range taxonomy' });
	});

	it('translates v4E sharing → Entu _sharing on the type entity', () => {
		const v4e: V4eEntityTypeDef = { name: 'voice', sharing: 'public', properties: [] };
		const payload = translateEntityType(v4e, POLYPHONY_DB_ENTITY_ID, POLYPHONY_META_TYPE_ENTITY_ID);
		expect(payload).toContainEqual({ type: '_sharing', string: 'public' });
	});

	it('translates v4E inheritsRights → Entu _inheritrights on the type entity', () => {
		const v4e: V4eEntityTypeDef = { name: 'voice', inheritsRights: false, properties: [] };
		const payload = translateEntityType(v4e, POLYPHONY_DB_ENTITY_ID, POLYPHONY_META_TYPE_ENTITY_ID);
		expect(payload).toContainEqual({ type: '_inheritrights', boolean: false });
	});

	it('omits v4E docs-only fields (parents, parentConstraint, recursion, creators, roleMapping, notes)', () => {
		const v4e = {
			name: 'voice',
			properties: [],
			parents: ['organization'],
			parentConstraint: 'sectionTree',
			recursion: 'self',
			creators: ['_owner'],
			roleMapping: { conductor: '_editor' },
			notes: 'see polyphony case study'
		} as V4eEntityTypeDef;
		const payload = translateEntityType(v4e, POLYPHONY_DB_ENTITY_ID, POLYPHONY_META_TYPE_ENTITY_ID);
		// None of the docs-only fields should appear in payload
		const payloadKeys = payload.map((p) => p.type);
		expect(payloadKeys).not.toContain('parents');
		expect(payloadKeys).not.toContain('parentConstraint');
		expect(payloadKeys).not.toContain('recursion');
		expect(payloadKeys).not.toContain('creators');
		expect(payloadKeys).not.toContain('roleMapping');
		expect(payloadKeys).not.toContain('notes');
	});
});

describe('translatePropertyDef', () => {
	it('produces minimal property payload (name + label + type)', () => {
		const v4e: V4ePropertyDef = { name: 'end_date', type: 'date' };
		const payload = translatePropertyDef(v4e, 'season-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toEqual([
			{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
			{ type: '_parent', reference: 'season-id' },
			{ type: 'name', string: 'end_date' },
			{ type: 'label', string: 'end_date' }, // fallback when no blurb
			{ type: 'type', string: 'date' }
		]);
	});

	it('translates v4E required → Entu mandatory', () => {
		const v4e: V4ePropertyDef = { name: 'end_date', type: 'date', required: true };
		const payload = translatePropertyDef(v4e, 'season-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'mandatory', boolean: true });
	});

	it('translates v4E list → Entu list', () => {
		const v4e: V4ePropertyDef = { name: 'language', type: 'string', list: true };
		const payload = translatePropertyDef(v4e, 'work-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'list', boolean: true });
	});

	it('translates v4E formula → Entu formula', () => {
		const v4e: V4ePropertyDef = { name: 'work', type: 'string', formula: '_parent' };
		const payload = translatePropertyDef(v4e, 'edition-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'formula', string: '_parent' });
	});

	it('translates v4E blurb → Entu label on property', () => {
		const v4e: V4ePropertyDef = { name: 'end_date', type: 'date', blurb: 'Season end date' };
		const payload = translatePropertyDef(v4e, 'season-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'label', string: 'Season end date' });
	});

	it('translates entity-name type → Entu reference', () => {
		const v4e: V4ePropertyDef = { name: 'voice', type: 'voice' as any, ref: true };
		const payload = translatePropertyDef(v4e, 'section-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'type', string: 'reference' });
	});

	it('translates v4E oauth type → Entu string', () => {
		const v4e: V4ePropertyDef = { name: 'entu_user', type: 'oauth' as any };
		const payload = translatePropertyDef(v4e, 'person-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		expect(payload).toContainEqual({ type: 'type', string: 'string' });
	});

	it('omits v4E docs-only fields (note, system, sharing on property)', () => {
		const v4e = {
			name: 'work',
			type: 'string',
			note: 'denormalization',
			system: true,
			sharing: 'private'
		} as V4ePropertyDef;
		const payload = translatePropertyDef(v4e, 'edition-id', POLYPHONY_META_TYPE_PROPERTY_ID);
		const keys = payload.map((p) => p.type);
		expect(keys).not.toContain('note');
		expect(keys).not.toContain('system');
		expect(keys).not.toContain('sharing');
	});
});
