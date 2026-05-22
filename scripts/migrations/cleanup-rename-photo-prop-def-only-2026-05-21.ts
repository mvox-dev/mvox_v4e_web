/**
 * cleanup-rename-photo-prop-def-only-2026-05-21.ts
 *
 * Layer 1 of the avatar+logo → photo rename migration: prop-def renames only.
 *
 * Renames the property definition name on the type-entity level:
 *   person type:       prop-def "avatar" → "photo"
 *   organization type: prop-def "logo"   → "photo"
 *
 * Wire shape per op:
 *   DELETE /property/{nameValueId}     — remove the old name value from the prop-def entity
 *   POST /entity/{propDefEntityId} [{type:'name', string:'photo'}]  — write the new name
 *   Per architecture-decisions "Entu mutation-op wire shapes" (session 8).
 *
 * Why Layer 1 only (RED-1 split rationale):
 *   Bentham RED'd the original cleanup-rename-avatar-logo-to-photo-2026-05-21.ts because
 *   the Layer 2 (instance value migration) DELETE-then-POST assumed {type:'photo'} is
 *   sufficient to re-attach an S3 file — unverified. Entu file-property POST semantics
 *   (md5, content-type, S3 key propagation) need an empirical probe before the code
 *   is trustworthy. Layer 2 deferred to task #14 (future session, after probe).
 *   The original script is deleted from this branch; this script replaces it.
 *
 * Layer 2 (instance value migration) — deferred to task #14:
 *   Will cover: per-instance DELETE-then-POST for any person with `avatar` values
 *   and any org with `logo` values. Requires a prior empirical probe of Entu's
 *   file-property POST semantics (md5/content-type/S3 key propagation).
 *   Current probe found 0 affected instances, so Layer 2 is a no-op today.
 *
 * Idempotent: checks current name on prop-def before each rename; skips if already 'photo'.
 * Halt-on-surprise: if nameValueId not found in live entity, halts.
 *
 * Background:
 *   Entu's `_thumbnail` derived field is hardcoded to look for a property named exactly
 *   `photo` on the entity. Renaming unlocks one-hop pre-signed S3 URL resolution.
 *   See: docs/architecture/bff-rights-aware-contracts.md §5.1 + §10
 *        docs/migration/findings/v4e-rename-avatar-logo-to-photo-2026-05-21.md
 *
 * GATE: Live mode MUST NOT execute until:
 *   (a) entu/research PR renaming avatar+logo to photo has MERGED upstream
 *   (b) Team-lead sends explicit "I authorize this run" SendMessage
 * Dry-run completing cleanly is NOT authorization. Bentham GREEN is NOT authorization.
 *
 * Run (dry-run, safe):
 *   set -a; . ~/.config/mvox/credentials.env; set +a
 *   pnpm exec tsx scripts/migrations/cleanup-rename-photo-prop-def-only-2026-05-21.ts --dry-run
 *
 * Run (live — BLOCKED):
 *   pnpm exec tsx scripts/migrations/cleanup-rename-photo-prop-def-only-2026-05-21.ts --live
 *
 * IDs from probe-rename-photo-impact-2026-05-21T23-53-25-680.json:
 *   person.avatar      propDefEntityId: 6a0d709890c8df7a1cc7e12e  nameValueId: 6a0d709890c8df7a1cc7e131
 *   organization.logo  propDefEntityId: 6a0d2e8790c8df7a1cc7dfad  nameValueId: 6a0d2e8790c8df7a1cc7dfb0
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	getJwt,
	fetchEntity,
	listEntities,
	postProperties,
	deletePropertyValue,
	type EntuClient,
} from './lib/entu-client.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--live');

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

// Gate cleared 2026-05-22:
//   (a) entu/research#49 merged — SHA f52adc4 "rename avatar+logo to photo for _thumbnail support"
//   (b) Team-lead "I authorize this run" SendMessage received 2026-05-22 13:30

// ── Hardcoded from probe-rename-photo-impact-2026-05-21T23-53-25-680.json ────
const PROP_DEFS = [
	{
		typeName: 'person',
		oldName: 'avatar',
		newName: 'photo',
		propDefEntityId: '6a0d709890c8df7a1cc7e12e',
		nameValueId: '6a0d709890c8df7a1cc7e131',
	},
	{
		typeName: 'organization',
		oldName: 'logo',
		newName: 'photo',
		propDefEntityId: '6a0d2e8790c8df7a1cc7dfad',
		nameValueId: '6a0d2e8790c8df7a1cc7dfb0',
	},
] as const;

interface ManifestEntry {
	kind: 'rename_prop_def' | 'skip';
	typeName: string;
	oldName: string;
	newName: string;
	propDefEntityId: string;
	nameValueId: string;
	skipReason?: string;
}

interface ManifestEntryResult extends ManifestEntry {
	outcome: 'would-rename' | 'renamed' | 'skipped' | 'failed';
	error?: string;
}

async function buildManifestEntry(
	client: EntuClient,
	config: (typeof PROP_DEFS)[number],
): Promise<ManifestEntry> {
	const entity = (await fetchEntity(client, config.propDefEntityId)) as {
		_id: string;
		name?: Array<{ _id?: string; string?: string }>;
	};

	const nameValues = entity.name ?? [];
	const currentName = nameValues.find((v) => v._id)?.string ?? null;

	if (currentName === config.newName) {
		return {
			kind: 'skip',
			typeName: config.typeName,
			oldName: config.oldName,
			newName: config.newName,
			propDefEntityId: config.propDefEntityId,
			nameValueId: config.nameValueId,
			skipReason: `already named "${config.newName}" — idempotent skip`,
		};
	}

	const nameValue = nameValues.find((v) => v._id === config.nameValueId);
	if (!nameValue) {
		throw new Error(
			`HALT: prop-def ${config.propDefEntityId} (${config.typeName}.${config.oldName}) ` +
				`nameValueId ${config.nameValueId} not found in live entity. ID drift detected. ` +
				`Current name values: ${JSON.stringify(nameValues)}`,
		);
	}

	return {
		kind: 'rename_prop_def',
		typeName: config.typeName,
		oldName: config.oldName,
		newName: config.newName,
		propDefEntityId: config.propDefEntityId,
		nameValueId: config.nameValueId,
	};
}

async function executeRename(
	client: EntuClient,
	entry: ManifestEntry,
): Promise<ManifestEntryResult> {
	try {
		await deletePropertyValue(client, entry.nameValueId);
		await postProperties(client, entry.propDefEntityId, [{ type: 'name', string: entry.newName }]);
		return { ...entry, outcome: 'renamed' };
	} catch (err) {
		return { ...entry, outcome: 'failed', error: String(err) };
	}
}

async function main() {
	console.log('cleanup-rename-photo-prop-def-only-2026-05-21 (Layer 1: prop-def renames only)');
	console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
	console.log(`DB: ${DB}  Time: ${new Date().toISOString()}\n`);

	const startedAt = new Date().toISOString();
	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	const artifact: {
		script: string;
		layer: string;
		dryRun: boolean;
		startedAt: string;
		completedAt: string;
		manifest: ManifestEntry[];
		results: ManifestEntryResult[];
		summary: { renames: number; skipped: number; failed: number };
		errors: string[];
		exitCode: number;
	} = {
		script: 'cleanup-rename-photo-prop-def-only-2026-05-21',
		layer: 'Layer 1 — prop-def renames only',
		dryRun: DRY_RUN,
		startedAt,
		completedAt: '',
		manifest: [],
		results: [],
		summary: { renames: 0, skipped: 0, failed: 0 },
		errors: [],
		exitCode: 0,
	};

	try {
		// ── Phase 1: Build manifest ─────────────────────────────────────────────
		console.log('=== Phase 1: Build manifest ===');
		for (const config of PROP_DEFS) {
			const entry = await buildManifestEntry(client, config);
			artifact.manifest.push(entry);
			if (entry.kind === 'skip') {
				console.log(`  SKIP: ${entry.typeName}.${entry.oldName} — ${entry.skipReason}`);
			} else {
				console.log(`  PLAN: rename prop-def ${entry.propDefEntityId}`);
				console.log(
					`        ${entry.typeName}.${entry.oldName} → ${entry.typeName}.${entry.newName}`,
				);
				console.log(`        DELETE nameValueId=${entry.nameValueId}`);
				console.log(
					`        POST name="${entry.newName}" to propDefEntityId=${entry.propDefEntityId}`,
				);
			}
		}

		const renameEntries = artifact.manifest.filter((e) => e.kind === 'rename_prop_def');
		const skipEntries = artifact.manifest.filter((e) => e.kind === 'skip');
		console.log(
			`\nManifest: ${renameEntries.length} renames + ${skipEntries.length} skips = ${artifact.manifest.length} entries`,
		);

		// ── Phase 2: Execute ────────────────────────────────────────────────────
		console.log('\n=== Phase 2: Execute ===');
		for (const entry of artifact.manifest) {
			if (entry.kind === 'skip') {
				console.log(`  SKIP: ${entry.typeName}.${entry.oldName} (${entry.skipReason})`);
				artifact.results.push({ ...entry, outcome: 'skipped' });
				artifact.summary.skipped++;
				continue;
			}

			if (DRY_RUN) {
				console.log(
					`  [DRY-RUN] WOULD RENAME ${entry.typeName}.${entry.oldName} → ${entry.typeName}.${entry.newName}`,
				);
				console.log(`             DELETE /property/${entry.nameValueId}`);
				console.log(
					`             POST name="${entry.newName}" to /entity/${entry.propDefEntityId}`,
				);
				artifact.results.push({ ...entry, outcome: 'would-rename' });
				artifact.summary.renames++;
			} else {
				// Live mode exits at startup; this branch never executes today.
				const result = await executeRename(client, entry);
				artifact.results.push(result);
				if (result.outcome === 'renamed') {
					console.log(
						`  RENAMED ${entry.typeName}.${entry.oldName} → ${entry.typeName}.${entry.newName}`,
					);
					artifact.summary.renames++;
				} else {
					console.error(`  FAILED ${entry.typeName}.${entry.oldName}: ${result.error}`);
					artifact.errors.push(`${entry.typeName}.${entry.oldName}: ${result.error}`);
					artifact.summary.failed++;
				}
			}
		}

		// ── Phase 3: Post-execution verification (live only) ──────────────────
		if (!DRY_RUN) {
			console.log('\n=== Phase 3: Post-execution verification ===');
			let verifyOk = true;
			for (const config of PROP_DEFS) {
				const entity = (await fetchEntity(client, config.propDefEntityId)) as {
					name?: Array<{ _id?: string; string?: string }>;
				};
				const currentName = (entity.name ?? []).find((v) => v._id)?.string;
				const ok = currentName === 'photo';
				console.log(`  ${config.typeName} prop-def: name="${currentName}" ${ok ? 'OK' : 'FAIL'}`);
				if (!ok) {
					verifyOk = false;
					artifact.errors.push(
						`post-verify: ${config.typeName} prop-def name="${currentName}", expected "photo"`,
					);
				}
			}
			if (verifyOk) {
				console.log('  POST-EXECUTION VERIFICATION: PASS');
			} else {
				console.error('  POST-EXECUTION VERIFICATION: FAIL');
				artifact.exitCode = 1;
			}

			// ── Phase 4: _thumbnail smoke probe ────────────────────────────────
			console.log('\n=== Phase 4: _thumbnail smoke probe ===');
			const orgResp = await listEntities(client, {
				'_type.string': 'organization',
				props: '_id,name,_thumbnail',
				limit: '1',
			});
			if (orgResp.entities.length > 0) {
				const org = orgResp.entities[0] as {
					_id: string;
					_thumbnail?: string;
					name?: Array<{ string?: string }>;
				};
				const orgName = (org.name ?? [])[0]?.string ?? org._id;
				console.log(`  Org: ${orgName} (${org._id})`);
				console.log(
					`  _thumbnail: ${org._thumbnail ?? '(absent — expected when no file uploaded to photo property)'}`,
				);
			} else {
				console.log('  (no org instances found for smoke probe)');
			}
		}
	} catch (err) {
		const msg = String(err);
		console.error('\nERROR:', msg);
		artifact.errors.push(msg);
		artifact.exitCode = 1;
	}

	artifact.completedAt = new Date().toISOString();
	if (artifact.errors.length > 0 && artifact.exitCode === 0) artifact.exitCode = 1;

	// ── Write artifact ────────────────────────────────────────────────────────
	const ts = startedAt.replace(/[:.]/g, '-').slice(0, 23);
	const dir = join(process.cwd(), 'scripts/migrations/seed-results');
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `cleanup-rename-photo-prop-def-only-${ts}.json`);
	writeFileSync(path, JSON.stringify(artifact, null, 2));
	console.log(`\nArtifact: ${path}`);

	console.log('\n=== SUMMARY ===');
	console.log(`dryRun   : ${artifact.dryRun}`);
	console.log(`renames  : ${artifact.summary.renames}`);
	console.log(`skipped  : ${artifact.summary.skipped}`);
	console.log(`failed   : ${artifact.summary.failed}`);
	console.log(`errors   : ${artifact.errors.length}`);

	if (artifact.exitCode !== 0) process.exit(1);
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
