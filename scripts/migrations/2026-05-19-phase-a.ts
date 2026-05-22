import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadV4eSchema } from './lib/schema-loader';
import {
	getJwt,
	listEntities,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
} from './lib/entu-client';
import { computeAdditiveDiff, type DbTypeState } from './lib/diff';
import { executeAdditions, type ExecutionResult } from './lib/executor';
import { formatJsonReport, formatMarkdownReport, type ReportMeta } from './lib/reporter';

export interface RunPhaseAInput {
	apiBase: string;
	db: string;
	apiKey: string;
	schemaPath: string;
	reportsDir: string;
	dryRun: boolean;
	now?: () => string;
}

export interface RunPhaseAOutput {
	exitCode: 0 | 1;
	report: ReturnType<typeof JSON.parse>;
	reportPaths: { json: string; md: string };
	result: ExecutionResult;
}

async function fetchDbState(client: EntuClient): Promise<DbTypeState[]> {
	const typesResp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		props: 'name._id,name.string',
		limit: '200',
	});

	const dbTypes: DbTypeState[] = [];
	for (const t of typesResp.entities) {
		const typeId = t._id;
		const name = (t as { name?: Array<{ string?: string }> }).name?.[0]?.string ?? '';
		if (!name) continue;
		const propsResp = await listEntities(client, {
			'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
			'_parent.reference': typeId,
			props: 'name.string',
		});
		const propertyNames = propsResp.entities
			.map((p) => (p as { name?: Array<{ string?: string }> }).name?.[0]?.string)
			.filter((n): n is string => !!n);
		dbTypes.push({ typeId, name, propertyNames });
	}
	return dbTypes;
}

async function sha256OfFile(path: string): Promise<string> {
	const buf = await readFile(path);
	return 'sha256:' + createHash('sha256').update(buf).digest('hex');
}

export async function runPhaseA(input: RunPhaseAInput): Promise<RunPhaseAOutput> {
	const now = input.now ?? (() => new Date().toISOString());

	const schema = await loadV4eSchema(input.schemaPath);
	const schemaHash = await sha256OfFile(input.schemaPath);

	const jwt = await getJwt({
		apiBase: input.apiBase,
		db: input.db,
		apiKey: input.apiKey,
	});
	const client: EntuClient = { apiBase: input.apiBase, db: input.db, jwt };

	const dbState = await fetchDbState(client);

	const ops = computeAdditiveDiff(schema, dbState);

	const result = await executeAdditions(client, ops, {
		dryRun: input.dryRun,
		now,
	});

	const meta: ReportMeta = {
		phase: 'A',
		executedAt: now(),
		schemaSourcePath: input.schemaPath,
		schemaFileHash: schemaHash,
		db: input.db,
	};
	const json = formatJsonReport(result, meta);
	const md = formatMarkdownReport(result, meta);

	await mkdir(input.reportsDir, { recursive: true });
	const stamp = (input.dryRun ? 'dry-run-' : '') + meta.executedAt.replace(/[:.]/g, '-');
	const jsonPath = resolve(input.reportsDir, `2026-05-19-phase-a-${stamp}.json`);
	const mdPath = resolve(input.reportsDir, `2026-05-19-phase-a-${stamp}.md`);
	await writeFile(jsonPath, json, 'utf8');
	await writeFile(mdPath, md, 'utf8');

	const exitCode = result.failed.length === 0 ? 0 : 1;
	return {
		exitCode,
		report: JSON.parse(json),
		reportPaths: { json: jsonPath, md: mdPath },
		result,
	};
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const apiBase = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
	const db = process.env.ENTU_DB ?? 'polyphony';
	const apiKey = process.env.ENTU_API_KEY;
	const schemaPath =
		process.env.V4E_SCHEMA_PATH ??
		resolve(
			process.env.HOME ?? '/home/michelek',
			'projects/entu-research/docs/schema/v4E/schema.json',
		);
	const reportsDir = resolve(__dirname, 'reports');

	if (!apiKey) {
		console.error('ERROR: ENTU_API_KEY env var is required');
		process.exit(1);
	}

	console.log(`Phase A migration ${dryRun ? '(dry-run) ' : ''}starting…`);
	console.log(`  API base: ${apiBase}`);
	console.log(`  DB: ${db}`);
	console.log(`  Schema: ${schemaPath}`);

	const out = await runPhaseA({
		apiBase,
		db,
		apiKey,
		schemaPath,
		reportsDir,
		dryRun,
	});

	console.log(`\nReport: ${out.reportPaths.md}`);
	console.log(`        ${out.reportPaths.json}`);
	console.log(
		`\nSummary: ${out.result.createdTypes.length} type(s) created, ${out.result.addedProperties.length} property(ies) added, ${out.result.failed.length} failure(s)`,
	);
	process.exit(out.exitCode);
}

const isMain = process.argv[1]?.endsWith('2026-05-19-phase-a.ts');
if (isMain) {
	main().catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	});
}
