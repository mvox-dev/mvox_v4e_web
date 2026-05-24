import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_CSS = readFileSync(resolve(__dirname, '../app.css'), 'utf-8');

describe('app.css design tokens', () => {
	it('imports Tailwind', () => {
		expect(APP_CSS).toMatch(/@import\s+["']tailwindcss["']/);
	});

	it('imports Caveat, Inter, JetBrains Mono fonts', () => {
		expect(APP_CSS).toMatch(/fonts\.googleapis\.com.*Caveat/);
		expect(APP_CSS).toMatch(/Inter/);
		expect(APP_CSS).toMatch(/JetBrains\+Mono/);
	});

	it('declares paper/ink color tokens in @theme', () => {
		expect(APP_CSS).toMatch(/@theme/);
		expect(APP_CSS).toMatch(/--color-paper:\s*#f7f1e1/);
		expect(APP_CSS).toMatch(/--color-ink:\s*#2a2620/);
		expect(APP_CSS).toMatch(/--color-red:\s*#b54a3a/);
		expect(APP_CSS).toMatch(/--color-green:\s*#5f7a3b/);
		expect(APP_CSS).toMatch(/--color-indigo:\s*#4f46e5/);
		expect(APP_CSS).toMatch(/--color-highlight:\s*#f7e58a/);
	});

	it('declares voice color tokens', () => {
		expect(APP_CSS).toMatch(/--color-voice-s:/);
		expect(APP_CSS).toMatch(/--color-voice-a:/);
		expect(APP_CSS).toMatch(/--color-voice-t:/);
		expect(APP_CSS).toMatch(/--color-voice-b:/);
	});

	it('declares desk wood-grain colors', () => {
		expect(APP_CSS).toMatch(/--color-desk-1:/);
		expect(APP_CSS).toMatch(/--color-desk-base:/);
	});

	it('declares display font (Caveat)', () => {
		expect(APP_CSS).toMatch(/--font-display:.*Caveat/);
	});
});
