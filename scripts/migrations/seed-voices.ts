import { getJwt, createEntity, listEntities, POLYPHONY_META_TYPE_ENTITY_ID } from './lib/entu-client.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const VOICE_NAMES = ['alto', 'baritone', 'bass', 'soprano', 'tenor'] as const;

const DRY_RUN = process.argv.includes('--dry-run');

const ENTU_API_BASE = process.env.ENTU_API_BASE ?? 'https://api.entu.app';
const ENTU_DB = process.env.ENTU_DB ?? 'polyphony';
const ENTU_API_KEY = process.env.ENTU_API_KEY;

if (!ENTU_API_KEY) {
	console.error('ERROR: ENTU_API_KEY is not set');
	process.exit(1);
}

async function findVoiceTypeId(client: { apiBase: string; db: string; jwt: string }): Promise<string> {
	const resp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		'name.string': 'voice',
		props: '_id',
	});
	if (resp.count === 0) {
		throw new Error('voice entity-type not found on db — seed cannot proceed');
	}
	return resp.entities[0]._id;
}

async function main() {
	console.log(`[seed-voices] mode=${DRY_RUN ? 'dry-run' : 'live'} db=${ENTU_DB}`);

	const jwt = await getJwt({ apiBase: ENTU_API_BASE, db: ENTU_DB, apiKey: ENTU_API_KEY! });
	const client = { apiBase: ENTU_API_BASE, db: ENTU_DB, jwt };

	const voiceTypeId = await findVoiceTypeId(client);
	console.log(`[seed-voices] voice type-id: ${voiceTypeId}`);

	const created: Array<{ name: string; _id: string }> = [];
	const skipped: Array<{ name: string; _id: string }> = [];
	const failed: Array<{ name: string; error: string }> = [];

	for (const voiceName of VOICE_NAMES) {
		const existing = await listEntities(client, {
			'_type.string': 'voice',
			'name.string': voiceName,
			props: '_id',
		});

		if (existing.count > 0) {
			const existingId = existing.entities[0]._id;
			console.log(`[seed-voices] ${voiceName}: EXISTS (${existingId}) — skip`);
			skipped.push({ name: voiceName, _id: existingId });
			continue;
		}

		if (DRY_RUN) {
			console.log(`[seed-voices] ${voiceName}: WOULD CREATE`);
			continue;
		}

		try {
			const result = await createEntity(client, [
				{ type: '_type', reference: voiceTypeId },
				{ type: 'name', string: voiceName },
				{ type: '_sharing', string: 'public' },
			]);
			console.log(`[seed-voices] ${voiceName}: CREATED (${result._id})`);
			created.push({ name: voiceName, _id: result._id });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`[seed-voices] ${voiceName}: FAILED — ${msg}`);
			failed.push({ name: voiceName, error: msg });
		}
	}

	const executedAt = new Date().toISOString();
	const result = {
		voices: VOICE_NAMES,
		created,
		skipped,
		failed,
		executedAt,
		db: ENTU_DB,
		dryRun: DRY_RUN,
	};

	if (!DRY_RUN) {
		const resultsDir = join(import.meta.dirname ?? '', 'seed-results');
		mkdirSync(resultsDir, { recursive: true });
		const fileName = `seed-voices-${executedAt.replace(/[:.]/g, '-')}.json`;
		const filePath = join(resultsDir, fileName);
		writeFileSync(filePath, JSON.stringify(result, null, 2));
		console.log(`[seed-voices] result artifact: ${filePath}`);
	}

	if (DRY_RUN) {
		const wouldCreate = VOICE_NAMES.length - skipped.length;
		console.log(`[seed-voices] dry-run summary: ${wouldCreate} would create, ${skipped.length} already exist`);
	} else {
		console.log(`[seed-voices] summary: ${created.length} created, ${skipped.length} skipped, ${failed.length} failed`);
	}

	if (failed.length > 0) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error('[seed-voices] fatal:', err);
	process.exit(1);
});
