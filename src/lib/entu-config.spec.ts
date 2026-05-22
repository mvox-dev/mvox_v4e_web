/**
 * RED tests for src/lib/entu-config.ts (CHORE-41.2)
 *
 * Single shared source of truth for the Entu API base URL.
 * Imported by both server-side (EntuClient) and client-side (exchange.ts) code.
 * Lives outside src/lib/server/ to avoid the server-only boundary.
 */
import { describe, it, expect } from 'vitest';

describe('src/lib/entu-config.ts', () => {
	it('exports ENTU_API_BASE as a string', async () => {
		const config = await import('./entu-config.ts');
		expect(typeof config.ENTU_API_BASE).toBe('string');
	});

	it('ENTU_API_BASE default value is the Entu API root URL', async () => {
		const config = await import('./entu-config.ts');
		expect(config.ENTU_API_BASE).toBe('https://entu.app/api/');
	});

	it('ENTU_API_BASE ends with a trailing slash', async () => {
		const config = await import('./entu-config.ts');
		expect(config.ENTU_API_BASE).toMatch(/\/$/);
	});
});
