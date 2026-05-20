import type { V4eSchema, V4ePropertyDef } from './schema-loader';
import { isInPhaseAScope, isPhaseANewType } from './phase-a-scope';
import {
	PHASE_B_RENAMES,
	PHASE_B_MIGRATIONS,
	PHASE_B_OBSOLETE_DELETES,
	PHASE_B_FORMULA_UPDATES,
	PHASE_B_TOUCH_SAVES,
	type BackfillKind,
	type PhaseBRenameOp
} from './phase-b-scope';

export interface DbTypeState {
	typeId: string;
	name: string;
	propertyNames: string[];
	propertyIds?: Record<string, string>;
	currentFormulas?: Record<string, string>;
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
	parentType?: string;
	propertyName: string;
	def: V4ePropertyDef;
}

export interface RenameSubOp {
	kind: 'RENAME';
	parentType: string;
	source: string;
	target: string;
}

export interface BackfillDataOp {
	kind: 'BACKFILL_DATA';
	parentType: string;
	sourceProperty: string;
	targetProperty: string;
	backfillKind: BackfillKind;
	// For parent_copy: which type to iterate. parentType remains the source type;
	// targetParentType names the target type whose instances are written to.
	targetParentType?: string;
}

export interface DeletePropertyOp {
	kind: 'DELETE_PROPERTY';
	parentType: string;
	propertyName: string;
	propertyDefId: string;
	verifyPreconditions?: boolean;
	// When set, verifyDeleteSafe runs Probe 3: every instance of parentType must have
	// a non-whitespace value at this property (typically a formula prop like person.name)
	// before deletion is allowed. Used for §2 verify_then_delete (forename/surname).
	materializedNameProperty?: string;
}

export interface UpdateFormulaOp {
	kind: 'UPDATE_FORMULA';
	parentType: string;
	propertyName: string;
	propertyDefId: string;
	newFormula: string;
	alreadyCurrent?: boolean;
}

export interface TouchSaveOp {
	kind: 'TOUCH_SAVE';
	parentType: string;
	propertyName: string;
	formulaExpression: string;
}

export type DiffOp =
	| CreateTypeOp
	| AddPropertyOp
	| RenameSubOp
	| BackfillDataOp
	| DeletePropertyOp
	| UpdateFormulaOp
	| TouchSaveOp;

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
			const bypassScope = isPhaseANewType(v4eType.name);
			for (const prop of v4eType.properties) {
				if (existingProps.has(prop.name)) continue;
				if (!bypassScope && !isInPhaseAScope(v4eType.name, prop.name)) continue;
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

function splitDotted(qualified: string): [string, string] {
	const idx = qualified.indexOf('.');
	return [qualified.slice(0, idx), qualified.slice(idx + 1)];
}

function backfillDefaultDef(propertyName: string, kind: BackfillKind): V4ePropertyDef {
	const def: V4ePropertyDef = { name: propertyName, type: 'string' };
	if (kind === 'number') def.type = 'number';
	else if (kind === 'file') def.type = 'file';
	else if (kind === 'string_to_reference') def.type = 'reference';
	else if (kind === 'string_list') {
		def.type = 'string';
		(def as V4ePropertyDef & { list?: boolean }).list = true;
	}
	return def;
}

function computeRenameOps(
	dbByName: Map<string, DbTypeState>,
	rename: PhaseBRenameOp
): { adds: AddPropertyOp[]; backfills: BackfillDataOp[]; deletes: DeletePropertyOp[] } {
	const [parentType, sourceProp] = splitDotted(rename.source);
	const [, targetProp] = splitDotted(rename.target);

	const existing = dbByName.get(parentType);
	const adds: AddPropertyOp[] = [];
	const backfills: BackfillDataOp[] = [];
	const deletes: DeletePropertyOp[] = [];

	if (!existing) return { adds, backfills, deletes };

	const existingProps = new Set(existing.propertyNames);
	if (!existingProps.has(targetProp)) {
		adds.push({
			kind: 'ADD_PROPERTY',
			parentTypeName: parentType,
			parentTypeId: existing.typeId,
			parentType,
			propertyName: targetProp,
			def: backfillDefaultDef(targetProp, rename.backfillKind)
		});
	}

	if (existingProps.has(sourceProp)) {
		backfills.push({
			kind: 'BACKFILL_DATA',
			parentType,
			sourceProperty: sourceProp,
			targetProperty: targetProp,
			backfillKind: rename.backfillKind
		});

		const sourceId = existing.propertyIds?.[sourceProp];
		if (sourceId) {
			deletes.push({
				kind: 'DELETE_PROPERTY',
				parentType,
				propertyName: sourceProp,
				propertyDefId: sourceId
			});
		}
	}

	return { adds, backfills, deletes };
}

export function computePhaseBDiff(dbState: DbTypeState[]): DiffOp[] {
	const dbByName = new Map(dbState.map((t) => [t.name, t]));

	const renameMarkers: RenameSubOp[] = [];
	const renameAdds: AddPropertyOp[] = [];
	const renameBackfills: BackfillDataOp[] = [];
	const renameDeletes: DeletePropertyOp[] = [];

	for (const rename of PHASE_B_RENAMES) {
		const { adds, backfills, deletes } = computeRenameOps(dbByName, rename);
		if (adds.length === 0 && backfills.length === 0 && deletes.length === 0) continue;
		const [parentType, sourceProp] = splitDotted(rename.source);
		const [, targetProp] = splitDotted(rename.target);
		renameMarkers.push({
			kind: 'RENAME',
			parentType,
			source: sourceProp,
			target: targetProp
		});
		renameAdds.push(...adds);
		renameBackfills.push(...backfills);
		renameDeletes.push(...deletes);
	}

	// §2 migrations — parent_copy backfills + verify_then_delete drops
	const migrationBackfills: BackfillDataOp[] = [];
	const migrationDeletes: DeletePropertyOp[] = [];
	for (const mig of PHASE_B_MIGRATIONS) {
		if (mig.action === 'verify_then_delete') {
			// Source format: "person.forename+surname" — split on '+' to get each prop
			const [parentType, propList] = splitDotted(mig.source);
			const propNames = propList.split('+');
			const existing = dbByName.get(parentType);
			if (!existing) continue;
			for (const propName of propNames) {
				if (!existing.propertyNames.includes(propName)) continue;
				const propertyDefId = existing.propertyIds?.[propName];
				if (!propertyDefId) continue;
				migrationDeletes.push({
					kind: 'DELETE_PROPERTY',
					parentType,
					propertyName: propName,
					propertyDefId,
					verifyPreconditions: true,
					materializedNameProperty: 'name'
				});
			}
		} else if (mig.backfillKind === 'parent_copy' && mig.target) {
			const [sourceParent, sourceProp] = splitDotted(mig.source);
			const [targetParent, targetProp] = splitDotted(mig.target);
			const existing = dbByName.get(sourceParent);
			if (!existing) continue;
			if (!existing.propertyNames.includes(sourceProp)) continue;
			migrationBackfills.push({
				kind: 'BACKFILL_DATA',
				parentType: sourceParent,
				sourceProperty: sourceProp,
				targetProperty: targetProp,
				backfillKind: 'parent_copy',
				targetParentType: targetParent
			});
			const sourceId = existing.propertyIds?.[sourceProp];
			if (sourceId) {
				migrationDeletes.push({
					kind: 'DELETE_PROPERTY',
					parentType: sourceParent,
					propertyName: sourceProp,
					propertyDefId: sourceId
				});
			}
		}
	}

	const obsoleteDeletes: DeletePropertyOp[] = [];
	for (const od of PHASE_B_OBSOLETE_DELETES) {
		const existing = dbByName.get(od.parentType);
		if (!existing) continue;
		if (!existing.propertyNames.includes(od.propertyName)) continue;
		const propertyDefId = existing.propertyIds?.[od.propertyName];
		if (!propertyDefId) continue;
		obsoleteDeletes.push({
			kind: 'DELETE_PROPERTY',
			parentType: od.parentType,
			propertyName: od.propertyName,
			propertyDefId,
			verifyPreconditions: true
		});
	}

	const formulaOps: DiffOp[] = [];
	for (const fu of PHASE_B_FORMULA_UPDATES) {
		const existing = dbByName.get(fu.parentType);
		if (!existing) continue;
		if (!existing.propertyNames.includes(fu.propertyName)) continue;
		const propertyDefId = existing.propertyIds?.[fu.propertyName];
		if (!propertyDefId) continue;

		if (fu.action === 'DELETE_PROPERTY') {
			formulaOps.push({
				kind: 'DELETE_PROPERTY',
				parentType: fu.parentType,
				propertyName: fu.propertyName,
				propertyDefId
			});
		} else {
			const current = existing.currentFormulas?.[fu.propertyName];
			if (current && current === fu.newFormula) {
				continue;
			}
			formulaOps.push({
				kind: 'UPDATE_FORMULA',
				parentType: fu.parentType,
				propertyName: fu.propertyName,
				propertyDefId,
				newFormula: fu.newFormula ?? ''
			});
		}
	}

	const touchSaves: TouchSaveOp[] = [];
	for (const ts of PHASE_B_TOUCH_SAVES) {
		const existing = dbByName.get(ts.parentType);
		if (!existing) continue;
		if (!existing.propertyNames.includes(ts.propertyName)) continue;
		touchSaves.push({
			kind: 'TOUCH_SAVE',
			parentType: ts.parentType,
			propertyName: ts.propertyName,
			formulaExpression: ts.formulaExpression
		});
	}

	return [
		...renameMarkers,
		...renameAdds,
		...renameBackfills,
		...renameDeletes,
		...migrationBackfills,
		...migrationDeletes,
		...obsoleteDeletes,
		...formulaOps,
		...touchSaves
	];
}
