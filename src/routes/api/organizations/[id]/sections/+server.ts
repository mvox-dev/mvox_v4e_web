import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { EntuClient, type EntuEntity } from '../../../../../lib/entu/client.ts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function parseLimit(raw: string | null): number {
	if (raw === null) return DEFAULT_LIMIT;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return DEFAULT_LIMIT;
	return Math.min(n, MAX_LIMIT);
}

function parseSkip(raw: string | null): number {
	if (raw === null) return 0;
	const n = Number.parseInt(raw, 10);
	if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) return 0;
	return n;
}

function extractStringProp(entity: EntuEntity, key: string): string | undefined {
	const values = entity[key];
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const v = values[0] as { string?: unknown };
	return typeof v?.string === 'string' ? v.string : undefined;
}

function extractNumberProp(entity: EntuEntity, key: string): number | undefined {
	const values = entity[key];
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const v = values[0] as { number?: unknown };
	return typeof v?.number === 'number' ? v.number : undefined;
}

function extractReferenceId(entity: EntuEntity, key: string): string | undefined {
	const values = entity[key];
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const v = values[0] as { reference?: unknown };
	return typeof v?.reference === 'string' ? v.reference : undefined;
}

function extractVoice(entity: EntuEntity): { _id: string; name: string | undefined } | undefined {
	const values = entity.voice;
	if (!Array.isArray(values) || values.length === 0) return undefined;
	const v = values[0] as { reference?: unknown; string?: unknown };
	if (typeof v?.reference !== 'string') return undefined;
	return {
		_id: v.reference,
		name: typeof v.string === 'string' ? v.string : undefined,
	};
}

export const GET: RequestHandler = async ({ locals, params, url }) => {
	if (!locals.entuJwt) {
		return json({ error: 'auth_required' }, { status: 401 });
	}

	const orgId = params.id;
	if (!orgId) {
		return json({ error: 'not_found' }, { status: 404 });
	}

	const client = new EntuClient({ jwt: locals.entuJwt, db: env.ENTU_DB ?? '', baseUrl: env.ENTU_BASE_URL });

	const org = await client.get(orgId).catch(() => null);
	if (!org) {
		return json({ error: 'not_found' }, { status: 404 });
	}

	const limit = parseLimit(url.searchParams.get('limit'));
	const skip = parseSkip(url.searchParams.get('skip'));

	const entities = await client.search({
		'_type.string': 'section',
		'_parent.reference': orgId,
		limit,
		skip,
	});

	const mapped = entities.map((s) => ({
		_id: s._id,
		name: extractStringProp(s, 'name'),
		voice: extractVoice(s),
		description: extractStringProp(s, 'description'),
		display_order: extractNumberProp(s, 'display_order'),
		member_count: extractNumberProp(s, 'member_count'),
		parent_section: extractReferenceId(s, 'parent_section'),
	}));

	return json({ entities: mapped });
};
