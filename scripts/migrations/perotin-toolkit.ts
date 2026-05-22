import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	deletePropertyValue,
	postProperties,
	listInstancesByType,
	createEntity,
	type EntuClient,
	type EntuProperty,
	type CreateEntityResponse,
} from './lib/entu-client';

export function isDryRun(): boolean {
	return process.argv.includes('--dry-run');
}

export async function writeResultArtifact(
	scriptSlug: string,
	payload: Record<string, unknown>,
	opts?: { at?: Date },
): Promise<string> {
	const at = opts?.at ?? new Date();
	const timestamp = at.toISOString().replace(/[:.]/g, '-');
	const dir = join('scripts', 'migrations', 'seed-results');
	const filename = `${scriptSlug}-${timestamp}.json`;
	const filePath = join(dir, filename);
	mkdirSync(dir, { recursive: true });
	writeFileSync(filePath, JSON.stringify(payload, null, 2));
	return filePath;
}

// DELETE all currentValueIds then POST the new value.
// Callers fetch the entity first to obtain existing value ids.
// Empty currentValueIds skips the DELETE phase (safe for fresh entities).
export async function replaceProperty(
	client: EntuClient,
	entityId: string,
	propType: string,
	currentValueIds: string[],
	newValue: EntuProperty | string | number,
): Promise<void> {
	for (const id of currentValueIds) {
		await deletePropertyValue(client, id);
	}
	const prop: EntuProperty =
		typeof newValue === 'string'
			? { type: propType, string: newValue }
			: typeof newValue === 'number'
				? { type: propType, number: newValue }
				: { ...newValue, type: propType };
	await postProperties(client, entityId, [prop]);
}

export async function findOrCreateByName(
	client: EntuClient,
	typeName: string,
	name: string,
	parentId: string | undefined,
	propsIfCreating: EntuProperty[],
): Promise<{ _id: string; created: boolean }> {
	const extraQuery: Record<string, string> = { 'name.string': name };
	if (parentId) extraQuery['_parent.reference'] = parentId;
	const resp = await listInstancesByType(client, typeName, '_id', extraQuery);
	const entities = resp.entities ?? [];

	if (entities.length > 0) {
		return { _id: entities[0]._id, created: false };
	}

	const created: CreateEntityResponse = await createEntity(client, propsIfCreating);
	return { _id: created._id, created: true };
}
