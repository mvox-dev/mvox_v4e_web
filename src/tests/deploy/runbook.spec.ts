import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../../..');
const RUNBOOK_PATH = resolve(ROOT, 'docs/operations/deploy.md');

describe('deploy runbook', () => {
	it('docs/operations/deploy.md exists', () => {
		expect(existsSync(RUNBOOK_PATH)).toBe(true);
	});

	it('runbook mentions the credentials env file path', () => {
		const content = existsSync(RUNBOOK_PATH) ? readFileSync(RUNBOOK_PATH, 'utf-8') : '';
		expect(content).toContain('~/.config/mvox/credentials.env');
	});

	it('runbook mentions the project URL', () => {
		const content = existsSync(RUNBOOK_PATH) ? readFileSync(RUNBOOK_PATH, 'utf-8') : '';
		expect(content).toContain('multivox.pages.dev');
	});
});
