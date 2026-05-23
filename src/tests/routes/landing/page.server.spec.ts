import { describe, expect, it } from 'vitest';
import { load } from '../../../routes/+page.server';

describe('/ landing server load', () => {
	it('returns minimal data — no session, no orgs', async () => {
		const result = await (load as unknown as (e: object) => Promise<unknown>)({});
		// Under Path C the server has no auth context. Server load returns nothing
		// session-bound; the client decides what to render based on storage.
		expect(result).toEqual({});
	});
});
