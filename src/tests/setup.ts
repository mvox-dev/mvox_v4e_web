import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

vi.mock('$env/dynamic/private', () => ({
	env: {} as Record<string, string | undefined>,
}));

afterEach(() => cleanup());
