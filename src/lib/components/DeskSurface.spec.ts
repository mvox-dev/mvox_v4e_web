// @vitest-environment happy-dom
import { render, cleanup } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DeskSurface from './DeskSurface.svelte';
import DeskSurfaceSource from './DeskSurface.svelte?raw';
import { textSnippet } from '../../tests/snippet-helpers';

describe('DeskSurface', () => {
	afterEach(cleanup);

	it('renders slot content', () => {
		const { container } = render(DeskSurface, { props: { children: textSnippet('desk content') } });
		expect(container.textContent).toContain('desk content');
	});

	it('applies the wood-bg class to the data-desk element', () => {
		const { container } = render(DeskSurface, { props: { children: textSnippet('x') } });
		const el = container.querySelector('[data-desk]');
		expect(el).not.toBeNull();
		// Svelte scopes class names; check the unscoped substring is present
		expect(el?.className).toContain('wood-bg');
	});
});

// S33 sub-chain 2 — 12-point orbit keyframes (13 stops, every 30°)
// RED until Byrd replaces the 4-stop cardinal keyframes with 13-stop versions.
// These tests parse the .svelte source file directly (via ?raw import) since
// jsdom/happy-dom have no CSS keyframe engine to evaluate at runtime.
// Helper: extract the content of a named @keyframes block, handling nested stop-braces.
// Uses a regex that matches one level of inner {} (each keyframe stop) inside the outer {}.
function extractKeyframeContent(src: string, name: string): string | null {
	const re = new RegExp(`@keyframes ${name} \\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}`);
	return src.match(re)?.[1] ?? null;
}

describe('DeskSurface — wood-orbit keyframes (S33 §4.1)', () => {
	it('wood-orbit1 contains 13 keyframe stops (every 30°)', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit1');
		expect(frameContent).not.toBeNull();
		// Count percentage rules: "0%", "8.333%", etc. — each stop opens with "N%  {"
		const stops = (frameContent!.match(/\d+(?:\.\d+)?%\s*\{/g) || []).length;
		expect(stops).toBe(13); // 0%, 8.333%, 16.667%, ..., 100%
	});

	it('wood-orbit2 contains 13 keyframe stops (phase = 120°)', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit2');
		expect(frameContent).not.toBeNull();
		const stops = (frameContent!.match(/\d+(?:\.\d+)?%\s*\{/g) || []).length;
		expect(stops).toBe(13);
	});

	it('wood-orbit3 contains 13 keyframe stops (phase = 240°)', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit3');
		expect(frameContent).not.toBeNull();
		const stops = (frameContent!.match(/\d+(?:\.\d+)?%\s*\{/g) || []).length;
		expect(stops).toBe(13);
	});

	it('wood-orbit1 defines --dx1 and --dy1 at all 13 stops', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit1');
		expect(frameContent).not.toBeNull();
		const dx1Count = (frameContent!.match(/--dx1:/g) || []).length;
		const dy1Count = (frameContent!.match(/--dy1:/g) || []).length;
		expect(dx1Count).toBe(13);
		expect(dy1Count).toBe(13);
	});

	it('wood-orbit2 defines --dx2 and --dy2 at all 13 stops', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit2');
		expect(frameContent).not.toBeNull();
		const dx2Count = (frameContent!.match(/--dx2:/g) || []).length;
		const dy2Count = (frameContent!.match(/--dy2:/g) || []).length;
		expect(dx2Count).toBe(13);
		expect(dy2Count).toBe(13);
	});

	it('wood-orbit3 defines --dx3 and --dy3 at all 13 stops', () => {
		const frameContent = extractKeyframeContent(DeskSurfaceSource, 'wood-orbit3');
		expect(frameContent).not.toBeNull();
		const dx3Count = (frameContent!.match(/--dx3:/g) || []).length;
		const dy3Count = (frameContent!.match(/--dy3:/g) || []).length;
		expect(dx3Count).toBe(13);
		expect(dy3Count).toBe(13);
	});
});

// S33 sub-chain 2 — base gradient color swap (PO decision, 2026-06-13)
// Warm cream→peach replaces the brown wood tone.
// Source assertion: check the new hex values appear in the file; the old ones must be absent.
// Visual conformance (smooth circular orbit, correct warm tone) is Bentham's visual-review gate.
describe('DeskSurface — base gradient color (S33 §4.1 PO color swap)', () => {
	it('base gradient uses new warm cream (#f7ecd4) as start color', () => {
		expect(DeskSurfaceSource).toContain('#f7ecd4');
	});

	it('base gradient uses new warm peach (#f7dcca) as end color', () => {
		expect(DeskSurfaceSource).toContain('#f7dcca');
	});

	it('base gradient does NOT contain old brown start color (#b8895a)', () => {
		expect(DeskSurfaceSource).not.toContain('#b8895a');
	});

	it('base gradient does NOT contain old brown end color (#a87850)', () => {
		expect(DeskSurfaceSource).not.toContain('#a87850');
	});
});

// (*MVOX:Tallis*)
