import type { V4eSchema, V4ePropertyDef } from './schema-loader';

export interface DbTypeState {
	typeId: string;
	name: string;
	propertyNames: string[];
}

export interface CreateTypeOp {
	kind: 'CREATE_TYPE';
	typeName: string;
	label: string;
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
				label: v4eType.label,
				properties: v4eType.properties
			});
		} else {
			const existingProps = new Set(existing.propertyNames);
			for (const prop of v4eType.properties) {
				if (!existingProps.has(prop.name)) {
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
	}

	return [...creates, ...adds];
}
