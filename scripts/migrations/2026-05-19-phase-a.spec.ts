import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPhaseA } from './2026-05-19-phase-a';
import { resolve } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

let tempReportsDir: string;

beforeEach(async () => {
	tempReportsDir = await mkdtemp(`${tmpdir()}/phase-a-test-`);
	vi.restoreAllMocks();
});

afterEach(async () => {
	await rm(tempReportsDir, { recursive: true, force: true });
});

describe('runPhaseA — E2E', () => {
	it('happy path: dry-run produces a report against minimal fixture + empty db', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		// /auth → JWT
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		// list entity types (filter: meta-type=entity) → empty
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: true,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.summary.dryRun).toBe(true);
		expect(result.report.summary.wouldCreateTypes).toBe(2); // season + voice
		expect(result.report.summary.wouldAddProperties).toBe(4); // season×3 + voice×1

		// Report files written
		const jsonContent = await readFile(result.reportPaths.json, 'utf8');
		const mdContent = await readFile(result.reportPaths.md, 'utf8');
		expect(JSON.parse(jsonContent).summary.dryRun).toBe(true);
		expect(mdContent).toContain('**DRY-RUN**');
	});

	it('happy path: real (not dry) run posts each addition', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		// Empty db state
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// Create season type
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'season-id' }), { status: 200 })
		);
		// Create season.start_date
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p1' }), { status: 200 })
		);
		// Create season.end_date
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p2' }), { status: 200 })
		);
		// Create season.description
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p3' }), { status: 200 })
		);
		// Create voice type
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'voice-id' }), { status: 200 })
		);
		// Create voice.name
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ _id: 'p4' }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: false,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(0);
		expect(result.report.summary.createdTypes).toBe(2);
		expect(result.report.summary.addedProperties).toBe(4); // season×3 + voice×1
		expect(result.report.summary.failed).toBe(0);
	});

	it('exits 1 if any operation fails', async () => {
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ token: 'fake-jwt' }), { status: 200 })
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ entities: [], count: 0 }), { status: 200 })
		);
		// First create fails (season type)
		fetchMock.mockResolvedValueOnce(new Response('Boom', { status: 500 }));
		// Subsequent calls succeed
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify({ _id: 'whatever' }), { status: 200 })
		);

		const result = await runPhaseA({
			apiBase: 'https://api.entu.app',
			db: 'polyphony',
			apiKey: 'key',
			schemaPath: resolve(__dirname, 'lib/fixtures/schema-minimal.json'),
			reportsDir: tempReportsDir,
			dryRun: false,
			now: () => '2026-05-19T20:55:00Z'
		});

		expect(result.exitCode).toBe(1);
		expect(result.report.summary.failed).toBeGreaterThan(0);
	});
});
