import { describe, it, expect } from 'vitest';
import { formatJsonReport, formatMarkdownReport, type ReportMeta } from './reporter';
import type { ExecutionResult } from './executor';

const meta: ReportMeta = {
	phase: 'A',
	executedAt: '2026-05-19T20:55:00Z',
	schemaSourcePath: '/home/x/v4E/schema.json',
	schemaFileHash: 'sha256:abc123',
	db: 'polyphony'
};

const baseResult: ExecutionResult = {
	dryRun: false,
	createdTypes: [
		{ name: 'voice', id: 'voice-id', createdAt: '2026-05-19T20:55:01Z' }
	],
	addedProperties: [
		{ parentType: 'season', name: 'end_date', id: 'p-id', createdAt: '2026-05-19T20:55:02Z' }
	],
	wouldCreateTypes: [],
	wouldAddProperties: [],
	skipped: [{ kind: 'type', name: 'organization', reason: 'already exists' }],
	failed: [],
	formulaTouchSaveDeferred: [
		{ parentType: 'edition', property: 'work', formula: 'x.*.y CONCAT' }
	]
};

describe('formatJsonReport', () => {
	it('produces correct JSON shape', () => {
		const json = JSON.parse(formatJsonReport(baseResult, meta));
		expect(json.phase).toBe('A');
		expect(json.executedAt).toBe('2026-05-19T20:55:00Z');
		expect(json.schemaSource.path).toBe('/home/x/v4E/schema.json');
		expect(json.summary.createdTypes).toBe(1);
		expect(json.summary.addedProperties).toBe(1);
		expect(json.summary.skipped).toBe(1);
		expect(json.summary.failed).toBe(0);
		expect(json.summary.formulaTouchSaveDeferred).toBe(1);
		expect(json.createdTypes[0].name).toBe('voice');
		expect(json.formulaTouchSaveDeferred[0].parentType).toBe('edition');
	});

	it('flags dry-run runs with executedAt: null', () => {
		const dryResult: ExecutionResult = {
			...baseResult,
			dryRun: true,
			createdTypes: [],
			addedProperties: [],
			wouldCreateTypes: [
				{
					kind: 'CREATE_TYPE',
					typeName: 'voice',
					blurb: 'Vocal range taxonomy',
					properties: []
				}
			],
			wouldAddProperties: []
		};
		const json = JSON.parse(formatJsonReport(dryResult, meta));
		expect(json.executedAt).toBeNull();
		expect(json.summary.dryRun).toBe(true);
		expect(json.wouldCreateTypes).toHaveLength(1);
	});
});

describe('formatMarkdownReport', () => {
	it('includes counts, created lists, deferred section', () => {
		const md = formatMarkdownReport(baseResult, meta);
		expect(md).toContain('# Phase A migration report');
		expect(md).toContain('Executed at: 2026-05-19T20:55:00Z');
		expect(md).toContain('| Created entity types | 1 |');
		expect(md).toContain('| Added properties | 1 |');
		expect(md).toContain('| Skipped (already exists) | 1 |');
		expect(md).toContain('| Failed | 0 |');
		expect(md).toContain('voice');
		expect(md).toContain('season.end_date');
		expect(md).toContain('## Formula properties needing touch-save');
		expect(md).toContain('edition.work');
	});

	it('flags dry-run prominently', () => {
		const dryResult: ExecutionResult = { ...baseResult, dryRun: true };
		const md = formatMarkdownReport(dryResult, meta);
		expect(md).toContain('**DRY-RUN** — no writes performed');
	});

	it('includes Would create / Would add sections on dry-run', () => {
		const dryResult: ExecutionResult = {
			dryRun: true,
			createdTypes: [],
			addedProperties: [],
			wouldCreateTypes: [
				{ kind: 'CREATE_TYPE', typeName: 'voice', blurb: 'Vocal range', properties: [] }
			],
			wouldAddProperties: [
				{
					kind: 'ADD_PROPERTY',
					parentTypeName: 'season',
					parentTypeId: 'season-id',
					propertyName: 'end_date',
					def: { name: 'end_date', type: 'date' }
				}
			],
			skipped: [],
			failed: [],
			formulaTouchSaveDeferred: []
		};
		const md = formatMarkdownReport(dryResult, meta);
		expect(md).toContain('## Would create entity types');
		expect(md).toContain('`voice`');
		expect(md).toContain('## Would add properties');
		expect(md).toContain('`season.end_date`');
	});
});
