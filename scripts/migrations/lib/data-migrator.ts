import type { EntuClient } from './entu-client';
import type { BackfillKind } from './phase-b-scope';

export interface MigratePropertyOptions {
	parentType: string;
	sourceProperty: string;
	targetProperty: string;
	backfillKind: BackfillKind;
	voiceLookup?: Map<string, string>;
	parentLookup?: Map<string, string>;
	listInstances: (client: EntuClient, parentType: string) => Promise<EntuInstance[]>;
	writeProperty: (
		client: EntuClient,
		entityId: string,
		propertyName: string,
		value: unknown
	) => Promise<{ _id: string }>;
}

export interface MigrationResult {
	migrated: number;
	skipped: number;
	failed: number;
	unmatchedVoiceTypes?: string[];
}

type PropertyValue = {
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

export async function migrateProperty(
	client: EntuClient,
	opts: MigratePropertyOptions
): Promise<MigrationResult> {
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
				await opts.writeProperty(client, instance._id, opts.targetProperty, sourceNum);
				result.migrated += 1;
			} else if (opts.backfillKind === 'string_list') {
				const sourceList = extractStringList(sourceValues);
				const targetList = targetValues ? extractStringList(targetValues) : [];
				if (listsMatch(sourceList, targetList)) {
					result.skipped += 1;
					continue;
				}
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
				const lookupId = opts.voiceLookup?.get(sourceStr);
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
