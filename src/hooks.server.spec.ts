import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

function mockEvent(pathname: string, cookie?: string) {
	return {
		url: new URL(`https://mvox.eu${pathname}`),
		cookies: { get: (n: string) => (n === 'mvox_session' ? cookie : undefined) },
	} as any;
}
const resolve = vi.fn(async () => new Response('ok'));

// A non-expired token for "valid" cases (exp far in the future)
const valid = (() => {
	const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	return `${b64({})}.${b64({ exp: 4_000_000_000 })}.s`;
})();
const expired = (() => {
	const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	return `${b64({})}.${b64({ exp: 1 })}.s`;
})();

describe('auth guard hook', () => {
	it('AC1: unauthenticated protected request → 302 to /auth/login?redirect=', async () => {
		// SvelteKit redirect() throws a Redirect object with status + location
		await expect(handle({ event: mockEvent('/library?work=a'), resolve })).rejects.toMatchObject({
			status: 302,
			location: '/auth/login?redirect=%2Flibrary%3Fwork%3Da',
		});
	});

	it('AC2: public paths pass through without redirect', async () => {
		for (const p of ['/', '/about', '/auth/login']) {
			resolve.mockClear();
			await handle({ event: mockEvent(p), resolve });
			expect(resolve).toHaveBeenCalledOnce();
		}
	});

	it('AC3: expired cookie on protected path → redirect', async () => {
		await expect(handle({ event: mockEvent('/library', expired), resolve })).rejects.toMatchObject({
			status: 302,
		});
	});

	it('AC4: valid cookie on protected path → pass through', async () => {
		resolve.mockClear();
		await handle({ event: mockEvent('/library', valid), resolve });
		expect(resolve).toHaveBeenCalledOnce();
	});
});

// (*MVOX:Tallis*)
