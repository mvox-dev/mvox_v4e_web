/**
 * RED regression net for CHORE-47: no process.env in server-side source files.
 *
 * CF Workers runtime (nodejs_als flag) does NOT expose `process`. Code using
 * process.env in server files passes vitest on Node but fails in production.
 * This spec asserts zero occurrences as a drift-detection gate.
 *
 * Scope: src/lib/server/, src/routes/, src/hooks.server.ts
 * Excludes test files (*.spec.ts, *.test.ts) — tests mock the env themselves.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');

function collectSourceFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		const st = statSync(full);
		if (st.isDirectory()) {
			results.push(...collectSourceFiles(full));
		} else if (['.ts', '.js', '.svelte'].includes(extname(entry))) {
			const base = basename(entry);
			if (!base.endsWith('.spec.ts') && !base.endsWith('.test.ts')) {
				results.push(full);
			}
		}
	}
	return results;
}

const SCANNED_PATHS = [
	join(REPO_ROOT, 'src/lib/server'),
	join(REPO_ROOT, 'src/routes'),
	join(REPO_ROOT, 'src/hooks.server.ts'),
];

function gatherFiles(): string[] {
	const files: string[] = [];
	for (const p of SCANNED_PATHS) {
		if (!existsSync(p)) continue;
		const st = statSync(p);
		if (st.isFile()) {
			files.push(p);
		} else {
			files.push(...collectSourceFiles(p));
		}
	}
	return files;
}

describe('no process.env in server source files (CHORE-47 regression net)', () => {
	it('src/lib/server/ contains no process.env references', () => {
		const dir = join(REPO_ROOT, 'src/lib/server');
		const files = collectSourceFiles(dir);
		const violations: string[] = [];
		for (const f of files) {
			const content = readFileSync(f, 'utf-8');
			if (/process\.env\b/.test(content)) violations.push(f.replace(REPO_ROOT + '/', ''));
		}
		expect(violations, `process.env found in: ${violations.join(', ')}`).toHaveLength(0);
	});

	it('src/routes/ contains no process.env references', () => {
		const dir = join(REPO_ROOT, 'src/routes');
		const files = collectSourceFiles(dir);
		const violations: string[] = [];
		for (const f of files) {
			const content = readFileSync(f, 'utf-8');
			if (/process\.env\b/.test(content)) violations.push(f.replace(REPO_ROOT + '/', ''));
		}
		expect(violations, `process.env found in: ${violations.join(', ')}`).toHaveLength(0);
	});

	it('src/hooks.server.ts contains no process.env references', () => {
		const p = join(REPO_ROOT, 'src/hooks.server.ts');
		if (!existsSync(p)) return;
		const content = readFileSync(p, 'utf-8');
		expect(/process\.env\b/.test(content), 'process.env found in src/hooks.server.ts').toBe(false);
	});

	it('all scanned source files are free of process.env (combined)', () => {
		const files = gatherFiles();
		const violations: string[] = [];
		for (const f of files) {
			const content = readFileSync(f, 'utf-8');
			if (/process\.env\b/.test(content)) violations.push(f.replace(REPO_ROOT + '/', ''));
		}
		expect(violations, `process.env found in: ${violations.join(', ')}`).toHaveLength(0);
	});
});
