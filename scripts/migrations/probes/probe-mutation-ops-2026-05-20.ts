/**
 * Practice probe — exercises three Entu mutation wire shapes never run live before.
 *
 * Targets (deterministic, chosen from live polyphony state 2026-05-20):
 *
 *   UPDATE: EFK "Soprano" section.display_order (prop value 6a0d709990c8df7a1cc7e16b)
 *     Roundtrip: set to 10, verify, restore to 1, verify. Exercises DELETE+POST replace semantics.
 *     Rationale: section with known display_order=1; roundtrip is safe (same final value) and
 *     exercises both the overwrite path (must DELETE old value before POSTing new) and the
 *     Entu multi-value append gotcha.
 *
 *   REMOVE: EFK "Soprano" section.ordinal (prop value 69c7f8728489bfcb0e81b080)
 *     Pre-v4E artifact (renamed to display_order in Phase B). Still present on all sections.
 *     Removing from one section is a legitimate v4E cleanup and a safe test of DELETE /property/.
 *     Rationale: non-v4E property; removing it is net-positive; reversible only by re-adding.
 *
 *   DELETE_ENTITY: last pre-v4E member by _id (69c7f88b8489bfcb0e81b5ee, name "Mait Vaher")
 *     Deterministic: highest _id among 116 pre-v4E members = last created. After: 115 real members.
 *     Rationale: pre-v4E members use member.name string (not person ref) — they will all be
 *     replaced by v4E-clean seed members. Deleting one now exercises DELETE /entity/ safely.
 *     Not reversible; chosen as last-by-_id to be maximally deterministic.
 *
 * Dry-run: pass --dry-run. Prints target details + payloads without writing.
 * Live: executes ops sequentially; captures pre/post state in result artifact.
 *
 * Result artifact: scripts/migrations/seed-results/probe-mutation-ops-<ISO>.json
 */

import { getJwt, listEntities, type EntuClient } from '../lib/entu-client.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const ENTU_API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const ENTU_DB = process.env.ENTU_DB ?? 'polyphony';
const ENTU_API_KEY = process.env.ENTU_API_KEY;

if (!ENTU_API_KEY) {
	console.error('ERROR: ENTU_API_KEY is not set');
	process.exit(1);
}

// ---------------------------------------------------------------------------
// Hardcoded targets (verified against live polyphony 2026-05-20)
// ---------------------------------------------------------------------------

const TARGETS = {
	update: {
		description: 'EFK "Soprano" section.display_order roundtrip (1 → 10 → 1)',
		entityId: '69c7f8728489bfcb0e81b07b',
		entityName: 'Soprano (EFK)',
		propName: 'display_order',
		existingPropValueId: '6a0d709990c8df7a1cc7e16b',
		currentValue: 1,
		intermediateValue: 10,
		finalValue: 1,
	},
	remove: {
		description: 'EFK "Soprano" section.ordinal removal (pre-v4E artifact)',
		entityId: '69c7f8728489bfcb0e81b07b',
		entityName: 'Soprano (EFK)',
		propName: 'ordinal',
		propValueId: '69c7f8728489bfcb0e81b080',
		currentValue: 1,
	},
	deleteEntity: {
		description: 'Delete last pre-v4E member by _id (name: "Mait Vaher")',
		entityId: '69c7f88b8489bfcb0e81b5ee',
		entityName: 'Mait Vaher',
		rationale: 'Last-created pre-v4E member (highest _id among 116); will be replaced by v4E-clean seed members',
	},
} as const;

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function getEntityProps(client: EntuClient, entityId: string): Promise<Record<string, unknown>> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, { headers: { Authorization: `Bearer ${client.jwt}` } });
	if (!res.ok) throw new Error(`GET entity ${entityId} failed: ${res.status} ${await res.text()}`);
	const body = await res.json() as { entity: Record<string, unknown> };
	return body.entity;
}

async function deleteProperty(client: EntuClient, propValueId: string): Promise<void> {
	const url = `${client.apiBase}/${client.db}/property/${propValueId}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) throw new Error(`DELETE /property/${propValueId} failed: ${res.status} ${await res.text()}`);
}

async function postProperty(client: EntuClient, entityId: string, properties: Array<{ type: string; number?: number; string?: string }>): Promise<void> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(properties),
	});
	if (!res.ok) throw new Error(`POST entity ${entityId} failed: ${res.status} ${await res.text()}`);
}

async function deleteEntity(client: EntuClient, entityId: string): Promise<void> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const res = await fetch(url, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) throw new Error(`DELETE /entity/${entityId} failed: ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// Helpers: find property value _id by name on an entity
// ---------------------------------------------------------------------------

function extractPropValueId(entityProps: Record<string, unknown>, propName: string): string | null {
	const vals = entityProps[propName];
	if (!Array.isArray(vals) || vals.length === 0) return null;
	const first = vals[0] as Record<string, unknown>;
	return (first['_id'] as string) ?? null;
}

function extractPropValue(entityProps: Record<string, unknown>, propName: string): unknown {
	const vals = entityProps[propName];
	if (!Array.isArray(vals) || vals.length === 0) return null;
	const first = vals[0] as Record<string, unknown>;
	return first['number'] ?? first['string'] ?? first['reference'] ?? null;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

interface OpResult {
	op: string;
	target: string;
	status: 'dry-run' | 'success' | 'skipped' | 'failed';
	detail: Record<string, unknown>;
	error?: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log(`[probe-mutation-ops] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${ENTU_DB}`);

	const jwt = await getJwt({ apiBase: ENTU_API_BASE, db: ENTU_DB, apiKey: ENTU_API_KEY! });
	const client: EntuClient = { apiBase: ENTU_API_BASE, db: ENTU_DB, jwt };

	const ops: OpResult[] = [];

	// -------------------------------------------------------------------------
	// Op 1: UPDATE display_order roundtrip
	// -------------------------------------------------------------------------
	console.log(`\n[probe-mutation-ops] Op 1 — UPDATE: ${TARGETS.update.description}`);

	if (DRY_RUN) {
		console.log(`  Target entity: ${TARGETS.update.entityId} (${TARGETS.update.entityName})`);
		console.log(`  Prop: ${TARGETS.update.propName}, current value _id: ${TARGETS.update.existingPropValueId}`);
		console.log(`  Step A: DELETE /property/${TARGETS.update.existingPropValueId}`);
		console.log(`  Step B: POST entity/${TARGETS.update.entityId} [{type:"display_order", number:${TARGETS.update.intermediateValue}}]`);
		console.log(`  Step C: verify display_order === ${TARGETS.update.intermediateValue}`);
		console.log(`  Step D: DELETE /property/<new-prop-value-id>`);
		console.log(`  Step E: POST entity/${TARGETS.update.entityId} [{type:"display_order", number:${TARGETS.update.finalValue}}]`);
		console.log(`  Step F: verify display_order === ${TARGETS.update.finalValue}`);
		ops.push({ op: 'UPDATE', target: TARGETS.update.entityName, status: 'dry-run', detail: TARGETS.update });
	} else {
		try {
			// Pre-state
			const preBefore = await getEntityProps(client, TARGETS.update.entityId);
			const preValue = extractPropValue(preBefore, 'display_order');
			const prePropId = extractPropValueId(preBefore, 'display_order');
			console.log(`  Pre-state: display_order=${preValue}, prop_value_id=${prePropId}`);

			if (prePropId !== TARGETS.update.existingPropValueId) {
				console.warn(`  WARNING: expected prop_value_id ${TARGETS.update.existingPropValueId}, got ${prePropId} — proceeding with live id`);
			}
			const actualPropId = prePropId ?? TARGETS.update.existingPropValueId;

			// Step A: delete old value
			await deleteProperty(client, actualPropId);
			console.log(`  Step A: DELETE /property/${actualPropId} — OK`);

			// Step B: post intermediate value
			await postProperty(client, TARGETS.update.entityId, [{ type: 'display_order', number: TARGETS.update.intermediateValue }]);
			console.log(`  Step B: POST display_order=${TARGETS.update.intermediateValue} — OK`);

			// Step C: verify
			const afterIntermediate = await getEntityProps(client, TARGETS.update.entityId);
			const midValue = extractPropValue(afterIntermediate, 'display_order');
			const midPropId = extractPropValueId(afterIntermediate, 'display_order');
			console.log(`  Step C: verify display_order=${midValue} (expected ${TARGETS.update.intermediateValue}) — ${midValue === TARGETS.update.intermediateValue ? 'PASS' : 'FAIL'}`);

			// Step D: delete intermediate
			if (!midPropId) throw new Error('Could not find intermediate prop value _id for cleanup');
			await deleteProperty(client, midPropId);
			console.log(`  Step D: DELETE /property/${midPropId} — OK`);

			// Step E: restore original value
			await postProperty(client, TARGETS.update.entityId, [{ type: 'display_order', number: TARGETS.update.finalValue }]);
			console.log(`  Step E: POST display_order=${TARGETS.update.finalValue} (restore) — OK`);

			// Step F: verify restored
			const afterFinal = await getEntityProps(client, TARGETS.update.entityId);
			const finalValue = extractPropValue(afterFinal, 'display_order');
			console.log(`  Step F: verify display_order=${finalValue} (expected ${TARGETS.update.finalValue}) — ${finalValue === TARGETS.update.finalValue ? 'PASS' : 'FAIL'}`);

			ops.push({
				op: 'UPDATE',
				target: TARGETS.update.entityName,
				status: 'success',
				detail: {
					entityId: TARGETS.update.entityId,
					propName: 'display_order',
					preValue,
					intermediate: midValue,
					finalValue,
					roundtripCorrect: finalValue === TARGETS.update.finalValue,
				},
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  Op 1 FAILED: ${msg}`);
			ops.push({ op: 'UPDATE', target: TARGETS.update.entityName, status: 'failed', detail: {}, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Op 2: REMOVE section.ordinal (pre-v4E artifact)
	// -------------------------------------------------------------------------
	console.log(`\n[probe-mutation-ops] Op 2 — REMOVE: ${TARGETS.remove.description}`);

	if (DRY_RUN) {
		console.log(`  Target entity: ${TARGETS.remove.entityId} (${TARGETS.remove.entityName})`);
		console.log(`  Prop: ${TARGETS.remove.propName}, prop value _id: ${TARGETS.remove.propValueId}`);
		console.log(`  Op: DELETE /property/${TARGETS.remove.propValueId}`);
		console.log(`  Post-verify: GET entity, confirm ordinal absent`);
		ops.push({ op: 'REMOVE', target: TARGETS.remove.entityName, status: 'dry-run', detail: TARGETS.remove });
	} else {
		try {
			// Pre-state
			const pre = await getEntityProps(client, TARGETS.remove.entityId);
			const ordinalBefore = pre['ordinal'];
			const actualPropId = extractPropValueId(pre, 'ordinal');
			console.log(`  Pre-state: ordinal=${JSON.stringify(ordinalBefore)}, prop_value_id=${actualPropId}`);

			if (!actualPropId) {
				console.log(`  ordinal already absent — SKIPPED (idempotent)`);
				ops.push({ op: 'REMOVE', target: TARGETS.remove.entityName, status: 'skipped', detail: { reason: 'ordinal already absent' } });
			} else {
				await deleteProperty(client, actualPropId);
				console.log(`  DELETE /property/${actualPropId} — OK`);

				// Verify absent
				const post = await getEntityProps(client, TARGETS.remove.entityId);
				const ordinalAfter = post['ordinal'];
				const absent = !ordinalAfter || (Array.isArray(ordinalAfter) && ordinalAfter.length === 0);
				console.log(`  Post-verify: ordinal absent=${absent} — ${absent ? 'PASS' : 'FAIL'}`);

				ops.push({
					op: 'REMOVE',
					target: TARGETS.remove.entityName,
					status: 'success',
					detail: {
						entityId: TARGETS.remove.entityId,
						propName: 'ordinal',
						propValueId: actualPropId,
						preValue: TARGETS.remove.currentValue,
						postAbsent: absent,
					},
				});
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  Op 2 FAILED: ${msg}`);
			ops.push({ op: 'REMOVE', target: TARGETS.remove.entityName, status: 'failed', detail: {}, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Op 3: DELETE entity (last pre-v4E member)
	// -------------------------------------------------------------------------
	console.log(`\n[probe-mutation-ops] Op 3 — DELETE_ENTITY: ${TARGETS.deleteEntity.description}`);

	if (DRY_RUN) {
		console.log(`  Target entity: ${TARGETS.deleteEntity.entityId} (${TARGETS.deleteEntity.entityName})`);
		console.log(`  Rationale: ${TARGETS.deleteEntity.rationale}`);
		console.log(`  Op: DELETE /entity/${TARGETS.deleteEntity.entityId}`);
		console.log(`  Post-verify: GET entity returns 404 or deleted flag`);
		ops.push({ op: 'DELETE_ENTITY', target: TARGETS.deleteEntity.entityName, status: 'dry-run', detail: TARGETS.deleteEntity });
	} else {
		try {
			// Pre-state: verify entity exists
			const pre = await getEntityProps(client, TARGETS.deleteEntity.entityId);
			const nameBefore = extractPropValue(pre, 'name');
			console.log(`  Pre-state: entity exists, name=${JSON.stringify(nameBefore)}`);

			await deleteEntity(client, TARGETS.deleteEntity.entityId);
			console.log(`  DELETE /entity/${TARGETS.deleteEntity.entityId} — OK`);

			// Verify deleted: GET should return error or deleted entity
			let postState: string;
			try {
				const postRes = await fetch(`${client.apiBase}/${client.db}/entity/${TARGETS.deleteEntity.entityId}`, {
					headers: { Authorization: `Bearer ${client.jwt}` },
				});
				if (postRes.status === 404) {
					postState = '404 (not found — confirmed deleted)';
				} else {
					const postBody = await postRes.json() as Record<string, unknown>;
					postState = `${postRes.status}: ${JSON.stringify(postBody).slice(0, 100)}`;
				}
			} catch {
				postState = 'fetch error on post-verify';
			}
			console.log(`  Post-verify: ${postState}`);

			// Verify member count reduced
			const memberCount = await listEntities(client, { '_type.string': 'member', props: '_id' });
			console.log(`  Member count after delete: ${memberCount.count} (expected 115 pre-v4E members)`);

			ops.push({
				op: 'DELETE_ENTITY',
				target: TARGETS.deleteEntity.entityName,
				status: 'success',
				detail: {
					entityId: TARGETS.deleteEntity.entityId,
					nameBefore,
					postState,
					memberCountAfter: memberCount.count,
				},
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  Op 3 FAILED: ${msg}`);
			ops.push({ op: 'DELETE_ENTITY', target: TARGETS.deleteEntity.entityName, status: 'failed', detail: {}, error: msg });
		}
	}

	// -------------------------------------------------------------------------
	// Summary + artifact
	// -------------------------------------------------------------------------
	const failed = ops.filter(o => o.status === 'failed').length;
	console.log(`\n[probe-mutation-ops] ===== SUMMARY =====`);
	for (const op of ops) {
		console.log(`  ${op.op} (${op.target}): ${op.status}${op.error ? ' — ' + op.error : ''}`);
	}

	if (!DRY_RUN) {
		const executedAt = new Date().toISOString();
		const artifact = { executedAt, db: ENTU_DB, dryRun: false, ops };
		const resultsDir = join(import.meta.dirname ?? '', '..', 'seed-results');
		mkdirSync(resultsDir, { recursive: true });
		const fileName = `probe-mutation-ops-${executedAt.replace(/[:.]/g, '-')}.json`;
		const filePath = join(resultsDir, fileName);
		writeFileSync(filePath, JSON.stringify(artifact, null, 2));
		console.log(`[probe-mutation-ops] result artifact: ${filePath}`);
	}

	if (failed > 0) {
		console.error(`[probe-mutation-ops] ${failed} op(s) failed — exit 1`);
		process.exit(1);
	}
}

main().catch(err => {
	console.error('[probe-mutation-ops] fatal:', err);
	process.exit(1);
});
