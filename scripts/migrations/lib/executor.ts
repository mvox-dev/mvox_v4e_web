import {
	POLYPHONY_DB_ENTITY_ID,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
	type EntuProperty,
	type CreateEntityResponse,
	createEntity as defaultCreateEntity
} from './entu-client';
import type { DiffOp, CreateTypeOp, AddPropertyOp } from './diff';
import type { V4ePropertyDef } from './schema-loader';

export interface CreatedTypeRecord {
	name: string;
	id: string;
	createdAt: string;
}

export interface AddedPropertyRecord {
	parentType: string;
	name: string;
	id: string;
	createdAt: string;
}

export interface SkippedRecord {
	kind: 'type' | 'property';
	name: string;
	reason: string;
}

export interface FailedRecord {
	kind: 'type' | 'property';
	name: string;
	error: string;
}

export interface FormulaDeferred {
	parentType: string;
	property: string;
	formula: string;
}

export interface ExecutionResult {
	dryRun: boolean;
	createdTypes: CreatedTypeRecord[];
	addedProperties: AddedPropertyRecord[];
	wouldCreateTypes: CreateTypeOp[];
	wouldAddProperties: AddPropertyOp[];
	skipped: SkippedRecord[];
	failed: FailedRecord[];
	formulaTouchSaveDeferred: FormulaDeferred[];
}

export interface ExecuteOptions {
	dryRun: boolean;
	createEntity?: (
		client: EntuClient,
		properties: EntuProperty[]
	) => Promise<CreateEntityResponse>;
	now?: () => string;
}

function propertyToPayload(parentTypeId: string, def: V4ePropertyDef): EntuProperty[] {
	const payload: EntuProperty[] = [
		{ type: '_type', reference: POLYPHONY_META_TYPE_PROPERTY_ID },
		{ type: '_parent', reference: parentTypeId },
		{ type: 'name', string: def.name },
		{ type: 'label', string: def.label ?? def.name },
		{ type: 'type', string: def.type }
	];
	if (def.mandatory) payload.push({ type: 'mandatory', boolean: true });
	if (def.formula) payload.push({ type: 'formula', string: def.formula });
	return payload;
}

export async function executeAdditions(
	client: EntuClient,
	ops: DiffOp[],
	opts: ExecuteOptions
): Promise<ExecutionResult> {
	const createEntity = opts.createEntity ?? defaultCreateEntity;
	const now = opts.now ?? (() => new Date().toISOString());

	const result: ExecutionResult = {
		dryRun: opts.dryRun,
		createdTypes: [],
		addedProperties: [],
		wouldCreateTypes: [],
		wouldAddProperties: [],
		skipped: [],
		failed: [],
		formulaTouchSaveDeferred: []
	};

	if (opts.dryRun) {
		for (const op of ops) {
			if (op.kind === 'CREATE_TYPE') {
				result.wouldCreateTypes.push(op);
				for (const prop of op.properties) {
					result.wouldAddProperties.push({
						kind: 'ADD_PROPERTY',
						parentTypeName: op.typeName,
						parentTypeId: '(pending — type not yet created)',
						propertyName: prop.name,
						def: prop
					});
					if (prop.formula) {
						result.formulaTouchSaveDeferred.push({
							parentType: op.typeName,
							property: prop.name,
							formula: prop.formula
						});
					}
				}
			} else {
				result.wouldAddProperties.push(op);
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula
					});
				}
			}
		}
		return result;
	}

	for (const op of ops) {
		if (op.kind === 'CREATE_TYPE') {
			try {
				const typePayload: EntuProperty[] = [
					{ type: '_type', reference: POLYPHONY_META_TYPE_ENTITY_ID },
					{ type: '_parent', reference: POLYPHONY_DB_ENTITY_ID },
					{ type: 'name', string: op.typeName },
					{ type: 'label', string: op.label }
				];
				const created = await createEntity(client, typePayload);
				const typeId = created._id;
				result.createdTypes.push({ name: op.typeName, id: typeId, createdAt: now() });

				for (const prop of op.properties) {
					try {
						const propCreated = await createEntity(
							client,
							propertyToPayload(typeId, prop)
						);
						result.addedProperties.push({
							parentType: op.typeName,
							name: prop.name,
							id: propCreated._id,
							createdAt: now()
						});
						if (prop.formula) {
							result.formulaTouchSaveDeferred.push({
								parentType: op.typeName,
								property: prop.name,
								formula: prop.formula
							});
						}
					} catch (err) {
						result.failed.push({
							kind: 'property',
							name: `${op.typeName}.${prop.name}`,
							error: err instanceof Error ? err.message : String(err)
						});
					}
				}
			} catch (err) {
				result.failed.push({
					kind: 'type',
					name: op.typeName,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		} else {
			try {
				const propCreated = await createEntity(
					client,
					propertyToPayload(op.parentTypeId, op.def)
				);
				result.addedProperties.push({
					parentType: op.parentTypeName,
					name: op.propertyName,
					id: propCreated._id,
					createdAt: now()
				});
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula
					});
				}
			} catch (err) {
				result.failed.push({
					kind: 'property',
					name: `${op.parentTypeName}.${op.propertyName}`,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	return result;
}
