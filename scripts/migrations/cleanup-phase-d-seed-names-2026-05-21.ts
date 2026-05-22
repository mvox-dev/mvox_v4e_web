/**
 * Phase D — Sub-op 2: Backfill real names onto 120 seed persons
 *
 * The 120 seed persons created by seed-collectives.ts have name=" " (a single
 * space — the formula `forename ' ' surname` materialized against empty sources).
 * After sub-op 1 converts person.name to a plain prop, this script writes each
 * person's real name from the seed manifest.
 *
 * Source of truth: scripts/migrations/seed-results/seed-collectives-2026-05-20T15-25-21-045Z.json
 * (the name→_id map from the original seed run).
 *
 * Idempotency: skip any person whose current name already matches the manifest name
 * (matches /\S/ AND equals the manifest string). Write only where name is " " or absent.
 *
 * Wire shape: POST {type:'name', string:'<name>'} — per formula-unwrap probe finding,
 * direct POST replaces the stale " " formula-cached value (no pre-delete needed).
 * But we must run AFTER sub-op 1 converts the prop-def to plain; otherwise POST is
 * silently dropped by the formula evaluator.
 *
 * Run: npx tsx scripts/migrations/cleanup-phase-d-seed-names-2026-05-21.ts [--dry-run]
 *
 * Prerequisite: cleanup-phase-d-name-to-plain-2026-05-21.ts must have run (live) first.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getJwt, fetchEntity, postProperties, type EntuClient } from './lib/entu-client.js';
import { isDryRun, writeResultArtifact } from './perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

const SEED_ARTIFACT_PATH = join(
	'scripts',
	'migrations',
	'seed-results',
	'seed-collectives-2026-05-20T15-25-21-045Z.json',
);

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

interface SeedPersonEntry {
	name: string;
	_id: string;
}

interface SeedArtifact {
	result: {
		persons: {
			created: SeedPersonEntry[];
		};
	};
}

interface PersonEntity {
	_id: string;
	name?: Array<{ _id?: string; string?: string }>;
}

async function main() {
	const dryRun = isDryRun();
	console.log('Phase D — Sub-op 2: Backfill 120 seed person names');
	console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	// Load name→_id map from seed artifact
	const artifact = JSON.parse(readFileSync(SEED_ARTIFACT_PATH, 'utf-8')) as SeedArtifact;
	const seedPersons = artifact.result.persons.created;
	console.log(`Loaded ${seedPersons.length} seed persons from manifest\n`);

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const results: {
		name: string;
		_id: string;
		currentName: string | null;
		action: 'WRITTEN' | 'SKIPPED' | 'DRY-RUN' | 'FAILED';
		error?: string;
	}[] = [];

	let written = 0;
	let skipped = 0;
	let failed = 0;

	for (const seedPerson of seedPersons) {
		const { name: expectedName, _id: personId } = seedPerson;

		// Read current state
		let currentName: string | null = null;
		try {
			const entity = (await fetchEntity(client, personId)) as PersonEntity;
			const nameVal = (entity.name ?? [])[0]?.string ?? null;
			currentName = nameVal;
		} catch (err) {
			console.error(`  ERROR reading ${personId}: ${err}`);
			results.push({
				name: expectedName,
				_id: personId,
				currentName: null,
				action: 'FAILED',
				error: String(err),
			});
			failed++;
			continue;
		}

		// Idempotency: skip if already correct
		const isAlreadyCorrect =
			currentName !== null && currentName.match(/\S/) && currentName === expectedName;
		if (isAlreadyCorrect) {
			console.log(`  SKIP ${personId} "${expectedName}" — already set`);
			results.push({ name: expectedName, _id: personId, currentName, action: 'SKIPPED' });
			skipped++;
			continue;
		}

		if (dryRun) {
			const fromStr = currentName !== null ? `"${currentName}"` : '(absent)';
			console.log(`  [DRY-RUN] WOULD write "${expectedName}" to ${personId} (current: ${fromStr})`);
			results.push({ name: expectedName, _id: personId, currentName, action: 'DRY-RUN' });
			continue;
		}

		// Write real name
		try {
			await postProperties(client, personId, [{ type: 'name', string: expectedName }]);
			console.log(`  WRITTEN "${expectedName}" → ${personId}`);
			results.push({ name: expectedName, _id: personId, currentName, action: 'WRITTEN' });
			written++;
		} catch (err) {
			console.error(`  ERROR writing "${expectedName}" to ${personId}: ${err}`);
			results.push({
				name: expectedName,
				_id: personId,
				currentName,
				action: 'FAILED',
				error: String(err),
			});
			failed++;
		}
	}

	// Write artifact
	const payload = {
		dryRun,
		runAt: new Date().toISOString(),
		seedPersonCount: seedPersons.length,
		written,
		skipped,
		failed,
		dryRunWouldWrite: dryRun ? results.filter((r) => r.action === 'DRY-RUN').length : 0,
		results,
	};
	const filePath = await writeResultArtifact('cleanup-phase-d-seed-names', payload);
	console.log(`\nArtifact: ${filePath}`);

	// Summary
	console.log('\n=== SUMMARY ===');
	if (dryRun) {
		console.log(
			`DRY-RUN: WOULD write ${results.filter((r) => r.action === 'DRY-RUN').length} names, skip ${skipped}`,
		);
		console.log('No writes performed. Re-run without --dry-run to execute.');
	} else {
		console.log(`Written: ${written}  Skipped: ${skipped}  Failed: ${failed}`);
		if (failed > 0) {
			console.log('FAILURES detected — check artifact for details');
			process.exit(1);
		} else {
			console.log('All seed person names backfilled successfully.');
		}
	}
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
