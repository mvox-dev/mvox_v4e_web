/**
 * RED tests for perotin-toolkit.ts (#57).
 * Pins the API surface of the 4 toolkit functions before implementation exists.
 *
 * (*MVOX:Tallis*)
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock node:fs before importing toolkit so writeResultArtifact never touches disk.
vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>();
	return {
		...actual,
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn()
	};
});

// Mock entu-client so toolkit's composed calls can be spied on.
vi.mock('./lib/entu-client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./lib/entu-client')>();
	return {
		...actual,
		deletePropertyValue: vi.fn().mockResolvedValue(undefined),
		postProperties: vi.fn().mockResolvedValue(undefined),
		listInstancesByType: vi.fn().mockResolvedValue({ entities: [], count: 0 }),
		createEntity: vi.fn().mockResolvedValue({ _id: 'new-entity-id' })
	};
});

import { mkdirSync, writeFileSync } from 'node:fs';
import {
	deletePropertyValue,
	postProperties,
	listInstancesByType,
	createEntity,
	type EntuClient
} from './lib/entu-client';
import {
	isDryRun,
	writeResultArtifact,
	replaceProperty,
	findOrCreateByName
} from './perotin-toolkit';

const client: EntuClient = {
	apiBase: 'https://api.entu.app',
	db: 'polyphony',
	jwt: 'test-jwt'
};

afterEach(() => {
	vi.clearAllMocks();
});

// ── isDryRun ──────────────────────────────────────────────────────────────────

describe('isDryRun', () => {
	it('returns true when --dry-run is in process.argv', () => {
		const original = process.argv;
		process.argv = ['node', 'script.ts', '--dry-run'];
		expect(isDryRun()).toBe(true);
		process.argv = original;
	});

	it('returns false when --dry-run is absent from process.argv', () => {
		const original = process.argv;
		process.argv = ['node', 'script.ts'];
		expect(isDryRun()).toBe(false);
		process.argv = original;
	});
});

// ── writeResultArtifact ───────────────────────────────────────────────────────
//
// Bentham contract pin C: returns Promise<string> (written file path);
// auto-creates seed-results/ directory if absent.

describe('writeResultArtifact', () => {
	it('returns a string (the written file path)', async () => {
		const result = await writeResultArtifact('seed-voices', { count: 5 });
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});

	it('calls mkdirSync (auto-mkdir for seed-results/ directory)', async () => {
		await writeResultArtifact('seed-voices', { count: 5 });
		expect(mkdirSync).toHaveBeenCalledOnce();
	});

	it('calls writeFileSync with the returned path and JSON-serialised payload', async () => {
		const payload = { voices: ['alto', 'bass'], total: 2 };
		const returnedPath = await writeResultArtifact('seed-voices', payload);
		expect(writeFileSync).toHaveBeenCalledOnce();
		const [writtenPath, writtenContent] = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
		expect(writtenPath).toBe(returnedPath);
		expect(JSON.parse(writtenContent)).toEqual(payload);
	});

	it('includes the scriptSlug in the returned file path', async () => {
		const result = await writeResultArtifact('probe-mutation-ops', {});
		expect(result).toContain('probe-mutation-ops');
	});

	it('uses a fixed timestamp when opts.at is provided', async () => {
		const at = new Date('2026-05-20T14:00:00.000Z');
		const result = await writeResultArtifact('seed-collectives', {}, { at });
		expect(result).toContain('2026-05-20');
	});
});

// ── replaceProperty ────────────────────────────────────────────────────────────
//
// Bentham contract pin A: empty currentValueIds → skip DELETE, only POST.

describe('replaceProperty', () => {
	it('DELETEs each id in currentValueIds then POSTs the new value', async () => {
		await replaceProperty(client, 'entity-1', 'name', ['pv1', 'pv2'], { string: 'soprano' });

		expect(deletePropertyValue).toHaveBeenCalledTimes(2);
		expect(deletePropertyValue).toHaveBeenCalledWith(client, 'pv1');
		expect(deletePropertyValue).toHaveBeenCalledWith(client, 'pv2');
		expect(postProperties).toHaveBeenCalledOnce();
		expect(postProperties).toHaveBeenCalledWith(
			client,
			'entity-1',
			expect.arrayContaining([expect.objectContaining({ type: 'name', string: 'soprano' })])
		);
	});

	it('(Bentham pin A) skips DELETE phase when currentValueIds is empty — only POSTs', async () => {
		await replaceProperty(client, 'entity-1', 'foo', [], 'bar');

		expect(deletePropertyValue).not.toHaveBeenCalled();
		expect(postProperties).toHaveBeenCalledOnce();
	});

	it('DELETE runs before POST (order guaranteed)', async () => {
		const callOrder: string[] = [];
		(deletePropertyValue as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
			callOrder.push('DELETE');
		});
		(postProperties as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {
			callOrder.push('POST');
		});

		await replaceProperty(client, 'entity-1', 'name', ['pv1'], { string: 'tenor' });

		expect(callOrder).toEqual(['DELETE', 'POST']);
	});
});

// ── findOrCreateByName ─────────────────────────────────────────────────────────
//
// Bentham contract pin B: parentId filter honored — two entities with the same
// name under different parents are distinct; query must scope by _parent.reference.

describe('findOrCreateByName', () => {
	it('returns existing entity {_id, created: false} when found by name', async () => {
		(listInstancesByType as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			entities: [{ _id: 'existing-section' }],
			count: 1
		});

		const result = await findOrCreateByName(client, 'section', 'altos', undefined, []);

		expect(result._id).toBe('existing-section');
		expect(result.created).toBe(false);
		expect(createEntity).not.toHaveBeenCalled();
	});

	it('creates and returns {_id, created: true} when not found', async () => {
		(listInstancesByType as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			entities: [],
			count: 0
		});

		const result = await findOrCreateByName(client, 'section', 'tenors', undefined, [
			{ type: 'name', string: 'tenors' }
		]);

		expect(result.created).toBe(true);
		expect(createEntity).toHaveBeenCalledOnce();
	});

	it('(Bentham pin B) passes parentId as _parent.reference filter in lookup query', async () => {
		(listInstancesByType as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			entities: [{ _id: 'org-a-altos' }],
			count: 1
		});

		await findOrCreateByName(client, 'section', 'altos', 'org-a-id', []);

		const [, , , query] = (listInstancesByType as ReturnType<typeof vi.fn>).mock.calls[0] as [
			EntuClient, string, string, Record<string, string>?
		];
		expect(query?.['_parent.reference'] ?? (listInstancesByType as ReturnType<typeof vi.fn>).mock.calls[0].join(' ')).toContain('org-a-id');
	});

	it('(Bentham pin B) without parentId omits _parent.reference from the query', async () => {
		(listInstancesByType as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
			entities: [{ _id: 'any-section' }],
			count: 1
		});

		await findOrCreateByName(client, 'section', 'altos', undefined, []);

		const rawCall = (listInstancesByType as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
		const callStr = JSON.stringify(rawCall);
		expect(callStr).not.toContain('_parent.reference');
	});
});
