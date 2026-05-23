import { describe, expect, it, vi } from 'vitest';
import { handle } from './hooks.server';

describe('hooks.server.ts', () => {
	it('passes through to resolve without reading or setting cookies', async () => {
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));
		const event = {
			cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
			locals: {},
		};

		await handle({
			event: event as unknown as Parameters<typeof handle>[0]['event'],
			resolve,
		});

		expect(event.cookies.get).not.toHaveBeenCalled();
		expect(event.cookies.set).not.toHaveBeenCalled();
		expect(resolve).toHaveBeenCalledWith(event);
	});

	it('does NOT populate event.locals.entuJwt (cookie session model gone)', async () => {
		const resolve = vi.fn().mockResolvedValue(new Response('ok'));
		const event = {
			cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
			locals: {} as Record<string, unknown>,
		};

		await handle({
			event: event as unknown as Parameters<typeof handle>[0]['event'],
			resolve,
		});

		expect(event.locals.entuJwt).toBeUndefined();
	});
});
