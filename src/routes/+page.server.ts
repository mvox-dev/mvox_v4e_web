import type { ServerLoad } from '@sveltejs/kit';

type OrgEntity = {
	_id: string;
	name: string;
	description?: string;
	location?: string;
	photo?: string;
	member_count_per_section?: number;
};

type LoadResult = {
	session: { jwt: string } | null;
	orgs: OrgEntity[] | null;
	error?: boolean;
};

export const load: ServerLoad = async ({ locals, fetch }) => {
	const jwt = locals.entuJwt;
	if (!jwt) {
		return { session: null, orgs: null } satisfies LoadResult;
	}

	const session = { jwt };

	try {
		const res = await fetch('/api/organizations');
		if (!res.ok) {
			return { session, orgs: null, error: true } satisfies LoadResult;
		}
		const body = (await res.json()) as { entities: OrgEntity[] };
		return { session, orgs: body.entities } satisfies LoadResult;
	} catch {
		return { session, orgs: null, error: true } satisfies LoadResult;
	}
};
