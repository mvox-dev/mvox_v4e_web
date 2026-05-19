import type { V4eSchema, V4ePropertyDef } from './schema-loader';
import { isInPhaseAScope } from './phase-a-scope';

export interface DbTypeState {
	typeId: string;
	name: string;
	propertyNames: string[];
}

export interface CreateTypeOp {
	kind: 'CREATE_TYPE';
	typeName: string;
	blurb?: string;
	sharing?: string;
	inheritsRights?: boolean;
	properties: V4ePropertyDef[];
}

export interface AddPropertyOp {
	kind: 'ADD_PROPERTY';
	parentTypeName: string;
	parentTypeId: string;
	propertyName: string;
	def: V4ePropertyDef;
}

export type DiffOp = CreateTypeOp | AddPropertyOp;

export function computeAdditiveDiff(
	v4e: V4eSchema,
	dbState: DbTypeState[]
): DiffOp[] {
	const dbByName = new Map(dbState.map((t) => [t.name, t]));

	const creates: CreateTypeOp[] = [];
	const adds: AddPropertyOp[] = [];

	for (const v4eType of v4e.entities) {
		const existing = dbByName.get(v4eType.name);
		if (!existing) {
			creates.push({
				kind: 'CREATE_TYPE',
				typeName: v4eType.name,
				blurb: v4eType.blurb,
				sharing: v4eType.sharing,
				inheritsRights: v4eType.inheritsRights,
				properties: v4eType.properties
			});
		} else {
			const existingProps = new Set(existing.propertyNames);
			for (const prop of v4eType.properties) {
				if (existingProps.has(prop.name)) continue;
				if (!isInPhaseAScope(v4eType.name, prop.name)) continue;
				adds.push({
					kind: 'ADD_PROPERTY',
					parentTypeName: v4eType.name,
					parentTypeId: existing.typeId,
					propertyName: prop.name,
					def: prop
				});
			}
		}
	}

	return [...creates, ...adds];
}
