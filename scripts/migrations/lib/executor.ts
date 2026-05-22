import {
	POLYPHONY_DB_ENTITY_ID,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
	type EntuProperty,
	type CreateEntityResponse,
	createEntity as defaultCreateEntity,
} from './entu-client';
import type {
	DiffOp,
	CreateTypeOp,
	AddPropertyOp,
	BackfillDataOp,
	DeletePropertyOp,
	UpdateFormulaOp,
	TouchSaveOp,
} from './diff';
import { translateEntityType, translatePropertyDef } from './v4e-translator';

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
	createEntity?: (client: EntuClient, properties: EntuProperty[]) => Promise<CreateEntityResponse>;
	now?: () => string;
}

export async function executeAdditions(
	client: EntuClient,
	ops: DiffOp[],
	opts: ExecuteOptions,
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
		formulaTouchSaveDeferred: [],
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
						def: prop,
					});
					if (prop.formula) {
						result.formulaTouchSaveDeferred.push({
							parentType: op.typeName,
							property: prop.name,
							formula: prop.formula,
						});
					}
				}
			} else {
				result.wouldAddProperties.push(op);
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula,
					});
				}
			}
		}
		return result;
	}

	for (const op of ops) {
		if (op.kind === 'CREATE_TYPE') {
			try {
				const typePayload = translateEntityType(
					{
						name: op.typeName,
						blurb: op.blurb,
						sharing: op.sharing,
						inheritsRights: op.inheritsRights,
						properties: [],
					},
					POLYPHONY_DB_ENTITY_ID,
					POLYPHONY_META_TYPE_ENTITY_ID,
				);
				const created = await createEntity(client, typePayload);
				const typeId = created._id;
				result.createdTypes.push({ name: op.typeName, id: typeId, createdAt: now() });

				for (const prop of op.properties) {
					try {
						const propCreated = await createEntity(
							client,
							translatePropertyDef(prop, typeId, POLYPHONY_META_TYPE_PROPERTY_ID),
						);
						result.addedProperties.push({
							parentType: op.typeName,
							name: prop.name,
							id: propCreated._id,
							createdAt: now(),
						});
						if (prop.formula) {
							result.formulaTouchSaveDeferred.push({
								parentType: op.typeName,
								property: prop.name,
								formula: prop.formula,
							});
						}
					} catch (err) {
						result.failed.push({
							kind: 'property',
							name: `${op.typeName}.${prop.name}`,
							error: err instanceof Error ? err.message : String(err),
						});
					}
				}
			} catch (err) {
				result.failed.push({
					kind: 'type',
					name: op.typeName,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		} else {
			try {
				const propCreated = await createEntity(
					client,
					translatePropertyDef(op.def, op.parentTypeId, POLYPHONY_META_TYPE_PROPERTY_ID),
				);
				result.addedProperties.push({
					parentType: op.parentTypeName,
					name: op.propertyName,
					id: propCreated._id,
					createdAt: now(),
				});
				if (op.def.formula) {
					result.formulaTouchSaveDeferred.push({
						parentType: op.parentTypeName,
						property: op.propertyName,
						formula: op.def.formula,
					});
				}
			} catch (err) {
				result.failed.push({
					kind: 'property',
					name: `${op.parentTypeName}.${op.propertyName}`,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
	}

	return result;
}

// ── Phase B executor ──────────────────────────────────────────────────────

export interface BackfilledRecord {
	parentType: string;
	sourceProperty: string;
	targetProperty: string;
	migrated: number;
	skipped: number;
	failed: number;
	unmatchedVoiceTypes?: string[];
}

export interface AddedPhaseBRecord {
	parentType: string;
	propertyName: string;
	propertyDefId: string;
	addedAt: string;
}

export interface DeletedRecord {
	parentType: string;
	propertyName: string;
	propertyDefId: string;
	deletedAt: string;
}

export interface BlockedDeleteRecord {
	parentType: string;
	propertyName: string;
	reason: string;
}

export interface FormulaUpdateRecord {
	parentType: string;
	propertyName: string;
	propertyDefId: string;
	updatedAt: string;
}

export interface TouchSaveRecord {
	parentType: string;
	propertyName: string;
	count: number;
	noInstances: boolean;
	failed: number;
}

export interface SkippedPhaseBRecord {
	kind: string;
	parentType: string;
	propertyName: string;
	reason: string;
}

export interface FailedPhaseBRecord {
	kind: string;
	parentType: string;
	propertyName: string;
	error: string;
}

export interface PhaseBExecutionResult {
	dryRun: boolean;
	addedProperties: AddedPhaseBRecord[];
	backfilled: BackfilledRecord[];
	deleted: DeletedRecord[];
	blockedDeletes: BlockedDeleteRecord[];
	formulaUpdates: FormulaUpdateRecord[];
	touchSaves: TouchSaveRecord[];
	skipped: SkippedPhaseBRecord[];
	failed: FailedPhaseBRecord[];
	wouldExecute: DiffOp[];
}

export interface AddPropertyFn {
	(client: EntuClient, op: AddPropertyOp): Promise<{ _id: string }>;
}

export interface MigratePropertyFn {
	(
		client: EntuClient,
		op: BackfillDataOp,
	): Promise<{
		migrated: number;
		skipped: number;
		failed: number;
		unmatchedVoiceTypes?: string[];
	}>;
}

export interface DeletePropertyFn {
	(client: EntuClient, op: DeletePropertyOp): Promise<{ deleted: boolean }>;
}

export interface VerifyDeleteSafeFn {
	(client: EntuClient, op: DeletePropertyOp): Promise<{ safe: boolean; reason?: string }>;
}

export interface UpdateFormulaFn {
	(client: EntuClient, op: UpdateFormulaOp): Promise<{ updated: boolean }>;
}

export interface TouchSaveFormulaFn {
	(
		client: EntuClient,
		op: TouchSaveOp,
	): Promise<{
		touchSaveCount: number;
		noInstances: boolean;
		failed: number;
	}>;
}

export interface ExecutePhaseBOptions {
	dryRun: boolean;
	addProperty?: AddPropertyFn;
	migrateProperty?: MigratePropertyFn;
	deleteProperty?: DeletePropertyFn;
	verifyDeleteSafe?: VerifyDeleteSafeFn;
	updateFormula?: UpdateFormulaFn;
	touchSaveFormula?: TouchSaveFormulaFn;
	now?: () => string;
}

export async function executePhaseBOps(
	client: EntuClient,
	ops: DiffOp[],
	opts: ExecutePhaseBOptions,
): Promise<PhaseBExecutionResult> {
	const now = opts.now ?? (() => new Date().toISOString());

	const result: PhaseBExecutionResult = {
		dryRun: opts.dryRun,
		addedProperties: [],
		backfilled: [],
		deleted: [],
		blockedDeletes: [],
		formulaUpdates: [],
		touchSaves: [],
		skipped: [],
		failed: [],
		wouldExecute: [],
	};

	if (opts.dryRun) {
		result.wouldExecute = ops;
		return result;
	}

	const hasVerifyDeletes = ops.some(
		(o) => o.kind === 'DELETE_PROPERTY' && o.verifyPreconditions === true,
	);
	if (hasVerifyDeletes && !opts.verifyDeleteSafe) {
		throw new Error(
			'executePhaseBOps: DELETE_PROPERTY ops with verifyPreconditions=true require a verifyDeleteSafe injectable',
		);
	}

	for (const op of ops) {
		if (op.kind === 'ADD_PROPERTY') {
			if (!opts.addProperty) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentTypeName,
					propertyName: op.propertyName,
					error: 'addProperty not provided',
				});
				continue;
			}
			try {
				const created = await opts.addProperty(client, op);
				result.addedProperties.push({
					parentType: op.parentTypeName,
					propertyName: op.propertyName,
					propertyDefId: created._id,
					addedAt: now(),
				});
			} catch (err) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentTypeName,
					propertyName: op.propertyName,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		} else if (op.kind === 'BACKFILL_DATA') {
			if (!opts.migrateProperty) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.targetProperty,
					error: 'migrateProperty not provided',
				});
				continue;
			}
			try {
				const r = await opts.migrateProperty(client, op);
				result.backfilled.push({
					parentType: op.parentType,
					sourceProperty: op.sourceProperty,
					targetProperty: op.targetProperty,
					migrated: r.migrated,
					skipped: r.skipped,
					failed: r.failed,
					unmatchedVoiceTypes: r.unmatchedVoiceTypes,
				});
			} catch (err) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.targetProperty,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		} else if (op.kind === 'DELETE_PROPERTY') {
			if (op.verifyPreconditions && opts.verifyDeleteSafe) {
				const verify = await opts.verifyDeleteSafe(client, op);
				if (!verify.safe) {
					result.blockedDeletes.push({
						parentType: op.parentType,
						propertyName: op.propertyName,
						reason: verify.reason ?? 'verifyDeleteSafe returned unsafe',
					});
					continue;
				}
			}
			if (!opts.deleteProperty) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: 'deleteProperty not provided',
				});
				continue;
			}
			try {
				await opts.deleteProperty(client, op);
				result.deleted.push({
					parentType: op.parentType,
					propertyName: op.propertyName,
					propertyDefId: op.propertyDefId,
					deletedAt: now(),
				});
			} catch (err) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		} else if (op.kind === 'UPDATE_FORMULA') {
			if (op.alreadyCurrent) {
				result.skipped.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					reason: 'formula_current',
				});
				continue;
			}
			if (!opts.updateFormula) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: 'updateFormula not provided',
				});
				continue;
			}
			try {
				await opts.updateFormula(client, op);
				result.formulaUpdates.push({
					parentType: op.parentType,
					propertyName: op.propertyName,
					propertyDefId: op.propertyDefId,
					updatedAt: now(),
				});
			} catch (err) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		} else if (op.kind === 'TOUCH_SAVE') {
			if (!opts.touchSaveFormula) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: 'touchSaveFormula not provided',
				});
				continue;
			}
			try {
				const r = await opts.touchSaveFormula(client, op);
				result.touchSaves.push({
					parentType: op.parentType,
					propertyName: op.propertyName,
					count: r.touchSaveCount,
					noInstances: r.noInstances,
					failed: r.failed,
				});
			} catch (err) {
				result.failed.push({
					kind: op.kind,
					parentType: op.parentType,
					propertyName: op.propertyName,
					error: err instanceof Error ? err.message : String(err),
				});
			}
		}
	}

	return result;
}
