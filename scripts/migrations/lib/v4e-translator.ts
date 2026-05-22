import type { EntuProperty } from './entu-client';
import type { V4eEntityTypeDef, V4ePropertyDef } from './schema-loader';

export function translateEntityType(
	v4e: V4eEntityTypeDef,
	parentId: string,
	metaTypeEntityId: string,
): EntuProperty[] {
	const payload: EntuProperty[] = [
		{ type: '_type', reference: metaTypeEntityId },
		{ type: '_parent', reference: parentId },
		{ type: 'name', string: v4e.name },
		{ type: 'label', string: v4e.blurb ?? v4e.name },
	];
	if (typeof v4e.sharing === 'string') {
		payload.push({ type: '_sharing', string: v4e.sharing });
	}
	if (typeof v4e.inheritsRights === 'boolean') {
		payload.push({ type: '_inheritrights', boolean: v4e.inheritsRights });
	}
	return payload;
}

function translateType(def: V4ePropertyDef): string {
	if (def.type === 'oauth') return 'string';
	if (def.ref === true) return 'reference';
	return def.type;
}

export function translatePropertyDef(
	def: V4ePropertyDef,
	parentTypeId: string,
	metaTypePropertyId: string,
): EntuProperty[] {
	const payload: EntuProperty[] = [
		{ type: '_type', reference: metaTypePropertyId },
		{ type: '_parent', reference: parentTypeId },
		{ type: 'name', string: def.name },
		{ type: 'label', string: def.blurb ?? def.name },
		{ type: 'type', string: translateType(def) },
	];
	if (def.required) payload.push({ type: 'mandatory', boolean: true });
	if (def.list) payload.push({ type: 'list', boolean: true });
	if (def.formula) payload.push({ type: 'formula', string: def.formula });
	return payload;
}
