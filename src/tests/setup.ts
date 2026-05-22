import { vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {} as Record<string, string | undefined>,
}));
