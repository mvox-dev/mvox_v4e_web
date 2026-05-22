import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { EntuClient } from './entu-client';

export interface SnapshotOptions {
	snapshotDir: string;
	pageSize?: number;
	dryRun?: boolean;
	skipSnapshot?: boolean;
	now?: () => string;
}

export interface SnapshotResult {
	entityCount: number;
	snapshotPath: string | null;
	sha256: string | null;
	dryRun?: boolean;
	skipped?: boolean;
}

interface PaginatedListResponse {
	entities: Array<{ _id: string; [key: string]: unknown }>;
	count: number;
}

interface GetEntityResponse {
	entity: { _id: string; [key: string]: unknown };
}

const DEFAULT_PAGE_SIZE = 200;

async function fetchEntity(
	client: EntuClient,
	entityId: string,
): Promise<{ _id: string; [key: string]: unknown }> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`entity fetch failed: ${res.status} ${await res.text()}`);
	}
	const body = (await res.json()) as GetEntityResponse;
	return body.entity;
}

export async function takeSnapshot(
	client: EntuClient,
	opts: SnapshotOptions,
): Promise<SnapshotResult> {
	const now = opts.now ?? (() => new Date().toISOString());

	if (opts.skipSnapshot) {
		return {
			entityCount: 0,
			snapshotPath: null,
			sha256: null,
			skipped: true,
		};
	}

	const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
	const listed: Array<{ _id: string; [key: string]: unknown }> = [];
	let skip = 0;

	while (true) {
		const url = `${client.apiBase}/${client.db}/entity?skip=${skip}&limit=${pageSize}`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${client.jwt}` },
		});
		if (!res.ok) {
			throw new Error(`snapshot fetch failed: ${res.status} ${await res.text()}`);
		}
		const body = (await res.json()) as PaginatedListResponse;
		listed.push(...body.entities);
		if (listed.length >= body.count || body.entities.length === 0) break;
		skip += pageSize;
	}

	const entities: Array<{ _id: string; [key: string]: unknown }> = [];
	for (const stub of listed) {
		entities.push(await fetchEntity(client, stub._id));
	}

	const snapshotAt = now();
	const payload = {
		snapshotAt,
		db: client.db,
		entityCount: entities.length,
		entities,
	};
	const json = JSON.stringify(payload, null, 2);
	const sha256 = createHash('sha256').update(json).digest('hex');

	if (opts.dryRun) {
		return {
			entityCount: entities.length,
			snapshotPath: null,
			sha256,
			dryRun: true,
		};
	}

	await mkdir(opts.snapshotDir, { recursive: true });
	const stamp = snapshotAt.replace(/[:.]/g, '-');
	const snapshotPath = resolve(opts.snapshotDir, `polyphony-pre-phase-b-${stamp}.json`);
	await writeFile(snapshotPath, json, 'utf8');

	return {
		entityCount: entities.length,
		snapshotPath,
		sha256,
	};
}
