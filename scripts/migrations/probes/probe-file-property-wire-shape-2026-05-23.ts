/**
 * probe-file-property-wire-shape-2026-05-23.ts
 *
 * Empirically verifies the Entu file-property POST wire shape for photo uploads.
 * Relevant to task #14 (Layer 2 deferred), and to the Path C browser-direct upload
 * design for mvox.
 *
 * What this probe does:
 *   1. Creates a throwaway person entity named "_probe_file_wire_shape"
 *   2. POSTs a photo property with { filename, filesize, filetype } to that entity
 *   3. Records the full response shape — specifically the `upload` object
 *      ({ url, method, headers }) returned by Entu alongside the property _id
 *   4. Executes the S3 PUT using the signed URL (uploads a 1×1 pixel PNG)
 *   5. Verifies the upload landed: fetches property via GET /property/{_id}
 *      and confirms `url` is present (signed download URL) + `filename` etc.
 *   6. Verifies _thumbnail resolution via GET /entity/{id}?props=_thumbnail
 *   7. Tears down: DELETE the property value, DELETE the entity
 *   8. Writes result artifact to seed-results/
 *
 * In DRY-RUN mode (--dry-run flag): authenticates, shows the plan, but makes
 * NO mutations to Entu (no entity creation, no S3 upload, no deletion).
 *
 * Run (dry-run first):
 *   set -a; . ~/.config/mvox/credentials.env; set +a
 *   pnpm exec tsx scripts/migrations/probes/probe-file-property-wire-shape-2026-05-23.ts --dry-run
 *
 * Run (live — requires explicit team-lead "I authorize this run"):
 *   pnpm exec tsx scripts/migrations/probes/probe-file-property-wire-shape-2026-05-23.ts
 */

import {
	getJwt,
	createEntity,
	fetchEntity,
	deletePropertyValue,
	deleteEntity,
	type EntuClient,
} from '../lib/entu-client.js';
import { isDryRun, writeResultArtifact } from '../perotin-toolkit.js';

const API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const DB = process.env.ENTU_DB ?? 'polyphony';
const API_KEY = process.env.ENTU_API_KEY;

// Known from scratchpad — person type entity _id on polyphony
const PERSON_TYPE_ENTITY_ID = '69bcfd8e9c031ab8e6ce805f';

// 1×1 transparent PNG — smallest valid PNG, 68 bytes
const PROBE_PNG_B64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PROBE_PNG_BYTES = Buffer.from(PROBE_PNG_B64, 'base64');

const PROBE_FILENAME = '_probe_file_wire_shape.png';
const PROBE_FILETYPE = 'image/png';
const PROBE_FILESIZE = PROBE_PNG_BYTES.length;

interface UploadShape {
	url: string;
	method: string;
	headers: Record<string, string | number>;
}

interface PropertyRecord {
	_id: string;
	type: string;
	filename?: string;
	filesize?: number;
	filetype?: string;
	upload?: UploadShape;
	url?: string;
	[key: string]: unknown;
}

interface ArtifactResult {
	runAt: string;
	db: string;
	dryRun: boolean;
	plan: string[];
	phase1_createEntity: { entityId: string | null; ok: boolean; error?: string };
	phase2_postPhotoProperty: {
		ok: boolean;
		propertyId: string | null;
		uploadShape: UploadShape | null;
		rawResponse: unknown;
		error?: string;
	};
	phase3_s3Put: {
		ok: boolean;
		status: number | null;
		headersEchoed: string[];
		error?: string;
	};
	phase4_getProperty: {
		ok: boolean;
		propertyRecord: PropertyRecord | null;
		hasUrl: boolean;
		urlTtlNote: string;
		error?: string;
	};
	phase5_thumbnail: {
		ok: boolean;
		thumbnailPresent: boolean;
		thumbnailUrl: string | null;
		error?: string;
	};
	phase6_teardown: { propertyDeleted: boolean; entityDeleted: boolean; error?: string };
	conclusions: string[];
	errors: string[];
}

if (!API_KEY) {
	console.error('ERROR: ENTU_API_KEY env var required');
	process.exit(1);
}

const DRY_RUN = isDryRun();

async function fetchPropertyRecord(
	client: EntuClient,
	propertyId: string,
): Promise<PropertyRecord> {
	const url = `${client.apiBase}/${client.db}/property/${propertyId}`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`GET /property/${propertyId} failed: ${res.status} ${await res.text()}`);
	}
	return (await res.json()) as PropertyRecord;
}

async function postPhotoProperty(
	client: EntuClient,
	entityId: string,
): Promise<{ _id: string; upload: UploadShape | undefined; rawResponse: unknown }> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const body = [
		{
			type: 'photo',
			filename: PROBE_FILENAME,
			filesize: PROBE_FILESIZE,
			filetype: PROBE_FILETYPE,
		},
	];
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		throw new Error(`POST photo property failed: ${res.status} ${await res.text()}`);
	}
	const json = (await res.json()) as { _id: string; properties: PropertyRecord[] };
	const photoProp = json.properties?.find((p) => p.type === 'photo');
	if (!photoProp) {
		throw new Error(
			`POST succeeded but no 'photo' in returned properties: ${JSON.stringify(json)}`,
		);
	}
	return {
		_id: photoProp._id,
		upload: photoProp.upload as UploadShape | undefined,
		rawResponse: json,
	};
}

async function s3Put(
	uploadShape: UploadShape,
): Promise<{ status: number; headersEchoed: string[] }> {
	// Build headers — skip Content-Length (browsers can't set it; fetch ignores it).
	// The real Content-Type and Content-Disposition must be sent or S3 rejects.
	const headers: Record<string, string> = {};
	for (const [k, v] of Object.entries(uploadShape.headers)) {
		if (k.toLowerCase() === 'content-length') continue;
		headers[k] = String(v);
	}
	// Content-Type must come from the headers map (Entu echoes filetype there)
	const res = await fetch(uploadShape.url, {
		method: uploadShape.method,
		headers,
		body: PROBE_PNG_BYTES,
		// @ts-expect-error Node 20+ fetch supports duplex for body streaming
		duplex: 'half',
	});
	return { status: res.status, headersEchoed: Object.keys(headers) };
}

async function getThumbnail(
	client: EntuClient,
	entityId: string,
): Promise<{ present: boolean; url: string | null }> {
	const url = `${client.apiBase}/${client.db}/entity/${entityId}?props=_thumbnail`;
	const res = await fetch(url, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` },
	});
	if (!res.ok) {
		throw new Error(`GET entity for _thumbnail failed: ${res.status} ${await res.text()}`);
	}
	const json = (await res.json()) as { entity: Record<string, unknown> };
	const thumb = json.entity?._thumbnail;
	return {
		present: typeof thumb === 'string' && thumb.length > 0,
		url: typeof thumb === 'string' ? thumb : null,
	};
}

async function main() {
	const runAt = new Date().toISOString();
	console.log('probe-file-property-wire-shape-2026-05-23');
	console.log(`DB: ${DB}  DRY-RUN: ${DRY_RUN}  Time: ${runAt}\n`);

	const artifact: ArtifactResult = {
		runAt,
		db: DB,
		dryRun: DRY_RUN,
		plan: [
			'Phase 1: CREATE throwaway person entity (_probe_file_wire_shape)',
			'Phase 2: POST photo property { filename, filesize, filetype } — capture upload shape',
			'Phase 3: PUT 1×1 PNG to S3 signed URL from upload.url',
			'Phase 4: GET /property/{id} — verify url (signed download), filename, filesize',
			'Phase 5: GET /entity/{id}?props=_thumbnail — verify _thumbnail resolution',
			'Phase 6: TEARDOWN — DELETE property value, DELETE entity',
		],
		phase1_createEntity: { entityId: null, ok: false },
		phase2_postPhotoProperty: { ok: false, propertyId: null, uploadShape: null, rawResponse: null },
		phase3_s3Put: { ok: false, status: null, headersEchoed: [] },
		phase4_getProperty: { ok: false, propertyRecord: null, hasUrl: false, urlTtlNote: '' },
		phase5_thumbnail: { ok: false, thumbnailPresent: false, thumbnailUrl: null },
		phase6_teardown: { propertyDeleted: false, entityDeleted: false },
		conclusions: [],
		errors: [],
	};

	if (DRY_RUN) {
		console.log('DRY-RUN: plan only — no mutations.\n');
		for (const step of artifact.plan) {
			console.log(`  WOULD: ${step}`);
		}
		console.log(`\n  Probe entity name  : _probe_file_wire_shape`);
		console.log(
			`  File to upload     : ${PROBE_FILENAME} (${PROBE_FILESIZE} bytes, ${PROBE_FILETYPE})`,
		);
		console.log(`  POST body shape    : [{ type:'photo', filename, filesize, filetype }]`);
		console.log(
			`  S3 PUT headers     : Content-Type, Content-Disposition, ACL (no Content-Length)`,
		);
		console.log(`  Download verify    : GET /property/{id} → expects { url, filename, filesize }`);
		console.log(
			`  Thumbnail verify   : GET /entity/{id}?props=_thumbnail → expects _thumbnail: "<url>"`,
		);
		console.log('\nDRY-RUN complete. Send "I authorize this run" to proceed live.');

		artifact.conclusions.push('DRY-RUN only — no live data touched.');
		await writeResultArtifact('probe-file-property-wire-shape-2026-05-23-dry-run', artifact);
		return;
	}

	// ── LIVE EXECUTION ─────────────────────────────────────────────────────────

	const jwt = await getJwt({ apiBase: API_BASE, db: DB, apiKey: API_KEY! });
	const client: EntuClient = { apiBase: API_BASE, db: DB, jwt };

	let entityId: string | null = null;
	let propertyId: string | null = null;

	try {
		// ── Phase 1: Create probe entity ─────────────────────────────────────
		console.log('Phase 1: Creating probe person entity...');
		const createResp = await createEntity(client, [
			{ type: '_type', reference: PERSON_TYPE_ENTITY_ID },
			{ type: 'name', string: '_probe_file_wire_shape' },
			{ type: '_sharing', string: 'private' },
		]);
		entityId = createResp._id;
		artifact.phase1_createEntity = { entityId, ok: true };
		console.log(`  Created: ${entityId}`);
	} catch (err) {
		const msg = String(err);
		artifact.phase1_createEntity = { entityId: null, ok: false, error: msg };
		artifact.errors.push(`Phase 1: ${msg}`);
		console.error('Phase 1 FAILED:', msg);
		await writeResultArtifact('probe-file-property-wire-shape-2026-05-23', artifact);
		process.exit(1);
	}

	try {
		// ── Phase 2: POST photo property ─────────────────────────────────────
		console.log('\nPhase 2: POSTing photo property { filename, filesize, filetype }...');
		const { _id, upload, rawResponse } = await postPhotoProperty(client, entityId);
		propertyId = _id;
		artifact.phase2_postPhotoProperty = {
			ok: true,
			propertyId: _id,
			uploadShape: upload ?? null,
			rawResponse,
		};
		if (upload) {
			console.log(`  Property _id : ${_id}`);
			console.log(`  upload.method: ${upload.method}`);
			console.log(`  upload.url   : ${upload.url.slice(0, 80)}...`);
			console.log(`  upload.headers keys: ${Object.keys(upload.headers).join(', ')}`);
		} else {
			console.warn(
				'  WARNING: no upload object in response — file property may not trigger upload URL',
			);
			artifact.conclusions.push(
				'UNEXPECTED: no upload object returned by POST photo — investigate Entu version',
			);
		}
	} catch (err) {
		const msg = String(err);
		artifact.phase2_postPhotoProperty = {
			ok: false,
			propertyId: null,
			uploadShape: null,
			rawResponse: null,
			error: msg,
		};
		artifact.errors.push(`Phase 2: ${msg}`);
		console.error('Phase 2 FAILED:', msg);
	}

	// ── Phase 3: S3 PUT ───────────────────────────────────────────────────
	if (artifact.phase2_postPhotoProperty.uploadShape) {
		try {
			console.log('\nPhase 3: Uploading 1×1 PNG to S3 signed URL...');
			const { status, headersEchoed } = await s3Put(artifact.phase2_postPhotoProperty.uploadShape);
			const ok = status === 200;
			artifact.phase3_s3Put = { ok, status, headersEchoed };
			if (ok) {
				console.log(`  S3 PUT status: ${status} OK`);
				console.log(`  Headers sent : ${headersEchoed.join(', ')}`);
			} else {
				console.warn(`  S3 PUT status: ${status} (expected 200)`);
				artifact.conclusions.push(`S3 PUT returned ${status} — check ACL/headers`);
			}
		} catch (err) {
			const msg = String(err);
			artifact.phase3_s3Put = { ok: false, status: null, headersEchoed: [], error: msg };
			artifact.errors.push(`Phase 3: ${msg}`);
			console.error('Phase 3 FAILED:', msg);
		}
	} else {
		console.log('\nPhase 3: SKIPPED (no upload shape from Phase 2)');
		artifact.phase3_s3Put = {
			ok: false,
			status: null,
			headersEchoed: [],
			error: 'skipped — no upload shape',
		};
	}

	// ── Phase 4: Verify property via GET /property/{id} ──────────────────
	if (propertyId) {
		try {
			console.log('\nPhase 4: Verifying property via GET /property/{id}...');
			const propRecord = await fetchPropertyRecord(client, propertyId);
			const hasUrl = typeof propRecord.url === 'string' && propRecord.url.length > 0;
			artifact.phase4_getProperty = {
				ok: true,
				propertyRecord: propRecord,
				hasUrl,
				urlTtlNote:
					'Signed download URL TTL is 60s (GetObjectCommand expiresIn:60 in utils/file.js)',
			};
			console.log(`  filename     : ${propRecord.filename ?? '(absent)'}`);
			console.log(`  filesize     : ${propRecord.filesize ?? '(absent)'}`);
			console.log(`  filetype     : ${propRecord.filetype ?? '(absent)'}`);
			console.log(`  has url      : ${hasUrl}`);
			if (hasUrl) {
				console.log(`  url (60s TTL): ${String(propRecord.url).slice(0, 80)}...`);
			}
		} catch (err) {
			const msg = String(err);
			artifact.phase4_getProperty = {
				ok: false,
				propertyRecord: null,
				hasUrl: false,
				urlTtlNote: '',
				error: msg,
			};
			artifact.errors.push(`Phase 4: ${msg}`);
			console.error('Phase 4 FAILED:', msg);
		}
	} else {
		console.log('\nPhase 4: SKIPPED (no property _id from Phase 2)');
	}

	// ── Phase 5: Verify _thumbnail ────────────────────────────────────────
	if (entityId) {
		try {
			console.log('\nPhase 5: Verifying _thumbnail via GET /entity/{id}?props=_thumbnail...');
			const { present, url } = await getThumbnail(client, entityId);
			artifact.phase5_thumbnail = { ok: true, thumbnailPresent: present, thumbnailUrl: url };
			console.log(`  _thumbnail present: ${present}`);
			if (url) console.log(`  _thumbnail url    : ${url.slice(0, 80)}...`);
			if (!present) {
				console.warn(
					'  _thumbnail absent after upload — may need aggregation trigger or S3 PUT failed',
				);
				artifact.conclusions.push(
					'_thumbnail absent post-upload — see Entu aggregate pipeline or S3 PUT status',
				);
			}
		} catch (err) {
			const msg = String(err);
			artifact.phase5_thumbnail = {
				ok: false,
				thumbnailPresent: false,
				thumbnailUrl: null,
				error: msg,
			};
			artifact.errors.push(`Phase 5: ${msg}`);
			console.error('Phase 5 FAILED:', msg);
		}
	}

	// ── Phase 6: Teardown ─────────────────────────────────────────────────
	console.log('\nPhase 6: Teardown...');
	let propDeleted = false;
	let entityDeleted = false;

	if (propertyId) {
		try {
			await deletePropertyValue(client, propertyId);
			propDeleted = true;
			console.log(`  Deleted property value: ${propertyId}`);
		} catch (err) {
			const msg = String(err);
			artifact.errors.push(`Phase 6 property DELETE: ${msg}`);
			console.error('  Property DELETE failed:', msg);
		}
	}

	if (entityId) {
		try {
			await deleteEntity(client, entityId);
			entityDeleted = true;
			console.log(`  Deleted entity: ${entityId}`);
		} catch (err) {
			const msg = String(err);
			artifact.errors.push(`Phase 6 entity DELETE: ${msg}`);
			console.error('  Entity DELETE failed:', msg);
		}
	}

	artifact.phase6_teardown = { propertyDeleted: propDeleted, entityDeleted: entityDeleted };

	// ── Conclusions ───────────────────────────────────────────────────────
	if (artifact.phase2_postPhotoProperty.uploadShape) {
		artifact.conclusions.push(
			'CONFIRMED: POST with { filename, filesize, filetype } returns upload { url, method, headers }',
		);
		artifact.conclusions.push(
			`upload.method: ${artifact.phase2_postPhotoProperty.uploadShape.method}`,
		);
		artifact.conclusions.push(
			`upload.headers keys: ${Object.keys(artifact.phase2_postPhotoProperty.uploadShape.headers).join(', ')}`,
		);
	}
	if (artifact.phase3_s3Put.ok) {
		artifact.conclusions.push('CONFIRMED: S3 PUT with signed URL succeeds (status 200)');
		artifact.conclusions.push(
			`S3 PUT headers required (no Content-Length): ${artifact.phase3_s3Put.headersEchoed.join(', ')}`,
		);
	}
	if (artifact.phase4_getProperty.hasUrl) {
		artifact.conclusions.push(
			'CONFIRMED: GET /property/{id} returns { url, filename, filesize, filetype } post-upload',
		);
		artifact.conclusions.push(
			'Download URL TTL: 60s (from utils/file.js getSignedDownloadUrl expiresIn:60)',
		);
	}

	// ── Write artifact ────────────────────────────────────────────────────
	const artifactPath = await writeResultArtifact(
		'probe-file-property-wire-shape-2026-05-23',
		artifact,
	);
	console.log(`\nArtifact: ${artifactPath}`);

	console.log('\n=== SUMMARY ===');
	console.log(`Phase 1 (create entity)  : ${artifact.phase1_createEntity.ok ? 'OK' : 'FAIL'}`);
	console.log(
		`Phase 2 (post photo)     : ${artifact.phase2_postPhotoProperty.ok ? 'OK' : 'FAIL'} — upload shape: ${artifact.phase2_postPhotoProperty.uploadShape ? 'PRESENT' : 'ABSENT'}`,
	);
	console.log(
		`Phase 3 (S3 PUT)         : ${artifact.phase3_s3Put.ok ? 'OK' : 'FAIL'} — status: ${artifact.phase3_s3Put.status ?? 'N/A'}`,
	);
	console.log(
		`Phase 4 (verify property): ${artifact.phase4_getProperty.ok ? 'OK' : 'FAIL'} — has url: ${artifact.phase4_getProperty.hasUrl}`,
	);
	console.log(
		`Phase 5 (_thumbnail)     : ${artifact.phase5_thumbnail.ok ? 'OK' : 'FAIL'} — present: ${artifact.phase5_thumbnail.thumbnailPresent}`,
	);
	console.log(
		`Phase 6 (teardown)       : prop=${artifact.phase6_teardown.propertyDeleted} entity=${artifact.phase6_teardown.entityDeleted}`,
	);
	console.log(`Errors                   : ${artifact.errors.length}`);
	if (artifact.conclusions.length > 0) {
		console.log('\nConclusions:');
		for (const c of artifact.conclusions) console.log(`  • ${c}`);
	}

	if (artifact.errors.length > 0 || !artifact.phase6_teardown.entityDeleted) {
		console.error('\nWARNING: errors or incomplete teardown — verify db state manually');
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('Fatal:', err);
	process.exit(1);
});
