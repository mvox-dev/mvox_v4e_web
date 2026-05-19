import { readFile } from 'node:fs/promises';

export interface V4ePropertyDef {
	name: string;
	type: string;
	label?: string;
	mandatory?: boolean;
	formula?: string;
	reference_query?: unknown;
	[key: string]: unknown;
}

export interface V4eEntityTypeDef {
	name: string;
	label: string;
	label_plural?: string;
	description?: string;
	properties: V4ePropertyDef[];
	[key: string]: unknown;
}

export interface V4eSchema {
	version: string;
	sections: unknown[];
	entities: V4eEntityTypeDef[];
}

export async function loadV4eSchema(path: string): Promise<V4eSchema> {
	let raw: string;
	try {
		raw = await readFile(path, 'utf8');
	} catch {
		throw new Error(`schema file not found: ${path}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`invalid JSON in schema file: ${path}`);
	}
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		!Array.isArray((parsed as { entities?: unknown }).entities)
	) {
		throw new Error(`missing entities array in schema file: ${path}`);
	}
	return parsed as V4eSchema;
}
