import type { EntuClient } from './entu-client';
import type { BackfillKind } from './phase-b-scope';
import type { BackfillDataOp } from './diff';

// voiceLookup can be a pre-built Map (test convenience) or an async resolver fn (live
// per-source lookup). Resolver returns undefined when no voice entity matches.
export type VoiceLookup =
	| Map<string, string>
	| ((sourceValue: string) => Promise<string | undefined>);

export interface MigratePropertyOptions {
	parentType: string;
	sourceProperty: string;
	targetProperty: string;
	backfillKind: BackfillKind;
	voiceLookup?: VoiceLookup;
	parentLookup?: Map<string, string>;
	listInstances: (client: EntuClient, parentType: string) => Promise<EntuInstance[]>;
	writeProperty: (
		client: EntuClient,
		entityId: string,
		propertyName: string,
		value: unknown
	) => Promise<{ _id: string }>;
	// Q5 multi-value gotcha: POSTing to a property that already has values APPENDS rather
	// than replacing. The migrator must DELETE all existing target property `_id`s before
	// writing the new value. Idempotency check (target already matches source) runs first
	// so a matching value never triggers a DELETE+POST cycle.
	deleteProperty?: (client: EntuClient, propertyId: string) => Promise<void>;
}

export interface MigrationResult {
	migrated: number;
	skipped: number;
	failed: number;
	unmatchedVoiceTypes?: string[];
}

type PropertyValue = {
	_id?: string;
	type?: string;
	string?: string;
	number?: number;
	reference?: string;
	[key: string]: unknown;
};

type EntuInstance = {
	_id: string;
	[key: string]: unknown;
};

function readPropertyValues(instance: EntuInstance, prop: string): PropertyValue[] | null {
	const raw = instance[prop];
	if (!Array.isArray(raw) || raw.length === 0) return null;
	return raw as PropertyValue[];
}

function extractFileRef(values: PropertyValue[]): string | null {
	const ref = values[0]?.reference;
	return typeof ref === 'string' ? ref : null;
}

function extractString(values: PropertyValue[]): string | null {
	const s = values[0]?.string;
	return typeof s === 'string' ? s : null;
}

function extractNumber(values: PropertyValue[]): number | null {
	const n = values[0]?.number;
	return typeof n === 'number' ? n : null;
}

function extractStringList(values: PropertyValue[]): string[] {
	return values.map((v) => v.string).filter((s): s is string => typeof s === 'string');
}

function listsMatch(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const sortedA = [...a].sort();
	const sortedB = [...b].sort();
	return sortedA.every((v, i) => v === sortedB[i]);
}

// Pre-delete all existing target property values to avoid Q5's multi-value POST gotcha.
// Caller MUST run the idempotency-skip check first; this is for the "target diverges from
// source, replace it cleanly" path.
async function pruneExistingTarget(
	client: EntuClient,
	targetValues: PropertyValue[] | null,
	deleteProperty: MigratePropertyOptions['deleteProperty']
): Promise<void> {
	if (!targetValues || !deleteProperty) return;
	for (const v of targetValues) {
		if (typeof v._id === 'string') {
			await deleteProperty(client, v._id);
		}
	}
}

// Injectables-only options for the 3-arg call shape (op carries parentType/sourceProperty/etc.).
// Used by buildLiveCallbacks to delegate: dataMigrator.migrateProperty(client, op, injectables).
export interface MigratePropertyInjectables {
	voiceLookup?: VoiceLookup;
	parentLookup?: Map<string, string>;
	listInstances: (client: EntuClient, parentType: string) => Promise<EntuInstance[]>;
	writeProperty: (
		client: EntuClient,
		entityId: string,
		propertyName: string,
		value: unknown
	) => Promise<{ _id: string }>;
	deleteProperty?: (client: EntuClient, propertyId: string) => Promise<void>;
}

export async function migrateProperty(
	client: EntuClient,
	opts: MigratePropertyOptions
): Promise<MigrationResult>;
export async function migrateProperty(
	client: EntuClient,
	op: BackfillDataOp,
	injectables: MigratePropertyInjectables
): Promise<MigrationResult>;
export async function migrateProperty(
	client: EntuClient,
	optsOrOp: MigratePropertyOptions | BackfillDataOp,
	injectables?: MigratePropertyInjectables
): Promise<MigrationResult> {
	const opts: MigratePropertyOptions = injectables
		? {
				parentType: (optsOrOp as BackfillDataOp).parentType,
				sourceProperty: (optsOrOp as BackfillDataOp).sourceProperty,
				targetProperty: (optsOrOp as BackfillDataOp).targetProperty,
				backfillKind: (optsOrOp as BackfillDataOp).backfillKind,
				voiceLookup: injectables.voiceLookup,
				parentLookup: injectables.parentLookup,
				listInstances: injectables.listInstances,
				writeProperty: injectables.writeProperty,
				deleteProperty: injectables.deleteProperty
			}
		: (optsOrOp as MigratePropertyOptions);

	if (opts.backfillKind === 'parent_copy' && !opts.parentLookup) {
		throw new Error(
			"migrateProperty: backfillKind='parent_copy' requires a parentLookup Map injection (source values live on the parent entity, not the same instance)"
		);
	}

	const result: MigrationResult = { migrated: 0, skipped: 0, failed: 0 };
	const unmatched: Set<string> = new Set();

	const instances = await opts.listInstances(client, opts.parentType);

	for (const instance of instances) {
		if (opts.backfillKind === 'parent_copy') {
			try {
				const parentValue = opts.parentLookup!.get(instance._id);
				if (parentValue === undefined) {
					result.skipped += 1;
					continue;
				}
				const targetValues = readPropertyValues(instance, opts.targetProperty);
				const targetStr = targetValues ? extractString(targetValues) : null;
				if (targetStr === parentValue) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				await opts.writeProperty(client, instance._id, opts.targetProperty, parentValue);
				result.migrated += 1;
			} catch {
				result.failed += 1;
			}
			continue;
		}

		const sourceValues = readPropertyValues(instance, opts.sourceProperty);
		if (!sourceValues) {
			result.skipped += 1;
			continue;
		}
		const targetValues = readPropertyValues(instance, opts.targetProperty);

		try {
			if (opts.backfillKind === 'file') {
				const sourceRef = extractFileRef(sourceValues);
				if (sourceRef === null) {
					result.skipped += 1;
					continue;
				}
				const targetRef = targetValues ? extractFileRef(targetValues) : null;
				if (targetRef === sourceRef) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				await opts.writeProperty(client, instance._id, opts.targetProperty, sourceRef);
				result.migrated += 1;
			} else if (opts.backfillKind === 'string') {
				const sourceStr = extractString(sourceValues);
				if (sourceStr === null) {
					result.skipped += 1;
					continue;
				}
				const targetStr = targetValues ? extractString(targetValues) : null;
				if (targetStr === sourceStr) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				await opts.writeProperty(client, instance._id, opts.targetProperty, sourceStr);
				result.migrated += 1;
			} else if (opts.backfillKind === 'number') {
				const sourceNum = extractNumber(sourceValues);
				if (sourceNum === null) {
					result.skipped += 1;
					continue;
				}
				const targetNum = targetValues ? extractNumber(targetValues) : null;
				if (targetNum === sourceNum) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				await opts.writeProperty(client, instance._id, opts.targetProperty, sourceNum);
				result.migrated += 1;
			} else if (opts.backfillKind === 'string_list') {
				const sourceList = extractStringList(sourceValues);
				const targetList = targetValues ? extractStringList(targetValues) : [];
				if (listsMatch(sourceList, targetList)) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				for (const value of sourceList) {
					await opts.writeProperty(client, instance._id, opts.targetProperty, value);
				}
				result.migrated += 1;
			} else if (opts.backfillKind === 'string_to_reference') {
				const sourceStr = extractString(sourceValues);
				if (sourceStr === null) {
					result.skipped += 1;
					continue;
				}
				const lookup = opts.voiceLookup;
				const lookupId =
					typeof lookup === 'function'
						? await lookup(sourceStr)
						: lookup?.get(sourceStr);
				if (!lookupId) {
					result.failed += 1;
					unmatched.add(sourceStr);
					continue;
				}
				const targetRef = targetValues ? targetValues[0]?.reference : null;
				if (targetRef === lookupId) {
					result.skipped += 1;
					continue;
				}
				await pruneExistingTarget(client, targetValues, opts.deleteProperty);
				await opts.writeProperty(client, instance._id, opts.targetProperty, lookupId);
				result.migrated += 1;
			}
		} catch {
			result.failed += 1;
		}
	}

	if (unmatched.size > 0) {
		result.unmatchedVoiceTypes = [...unmatched];
	}
	return result;
}
