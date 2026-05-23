import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { EntuClient, type EntuEntity } from '../../../lib/entu/client.ts';

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

function extractThumbnail(entity: EntuEntity): string | undefined {
	const t = entity._thumbnail;
	return typeof t === 'string' ? t : undefined;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.entuJwt) {
		return json({ error: 'auth_required' }, { status: 401 });
	}

	const limit = parseLimit(url.searchParams.get('limit'));
	const skip = parseSkip(url.searchParams.get('skip'));

	const client = new EntuClient({ jwt: locals.entuJwt, db: env.ENTU_DB ?? '', baseUrl: env.ENTU_BASE_URL });
	const entities = await client.search({
		'_type.string': 'organization',
		props: '_id,name,description,location,_thumbnail,member_count_per_section',
		limit,
		skip,
	});

	const mapped = entities.map((o) => ({
		_id: o._id,
		name: extractStringProp(o, 'name'),
		description: extractStringProp(o, 'description'),
		location: extractStringProp(o, 'location'),
		photo: extractThumbnail(o),
		member_count_per_section: extractNumberProp(o, 'member_count_per_section'),
	}));

	return json({ entities: mapped });
};
