import type { ExecutionResult } from './executor';

export interface ReportMeta {
	phase: string;
	executedAt: string;
	schemaSourcePath: string;
	schemaFileHash: string;
	db: string;
}

export function formatJsonReport(result: ExecutionResult, meta: ReportMeta): string {
	const payload = {
		phase: meta.phase,
		executedAt: result.dryRun ? null : meta.executedAt,
		schemaSource: { path: meta.schemaSourcePath, fileHash: meta.schemaFileHash },
		db: meta.db,
		summary: {
			dryRun: result.dryRun,
			createdTypes: result.createdTypes.length,
			addedProperties: result.addedProperties.length,
			wouldCreateTypes: result.wouldCreateTypes.length,
			wouldAddProperties: result.wouldAddProperties.length,
			skipped: result.skipped.length,
			failed: result.failed.length,
			formulaTouchSaveDeferred: result.formulaTouchSaveDeferred.length
		},
		createdTypes: result.createdTypes,
		addedProperties: result.addedProperties,
		wouldCreateTypes: result.wouldCreateTypes,
		wouldAddProperties: result.wouldAddProperties,
		skipped: result.skipped,
		failed: result.failed,
		formulaTouchSaveDeferred: result.formulaTouchSaveDeferred
	};
	return JSON.stringify(payload, null, 2);
}

export function formatMarkdownReport(result: ExecutionResult, meta: ReportMeta): string {
	const lines: string[] = [];
	lines.push(`# Phase ${meta.phase} migration report`);
	lines.push('');
	if (result.dryRun) lines.push('**DRY-RUN** — no writes performed.');
	lines.push(`- Executed at: ${result.dryRun ? '(dry-run)' : meta.executedAt}`);
	lines.push(`- Schema source: \`${meta.schemaSourcePath}\` (hash: \`${meta.schemaFileHash}\`)`);
	lines.push(`- Database: ${meta.db}`);
	lines.push('');
	lines.push('## Summary');
	lines.push('');
	lines.push('| Metric | Count |');
	lines.push('|---|---|');
	lines.push(`| Created entity types | ${result.createdTypes.length} |`);
	lines.push(`| Added properties | ${result.addedProperties.length} |`);
	if (result.dryRun) {
		lines.push(`| Would create types | ${result.wouldCreateTypes.length} |`);
		lines.push(`| Would add properties | ${result.wouldAddProperties.length} |`);
	}
	lines.push(`| Skipped (already exists) | ${result.skipped.length} |`);
	lines.push(`| Failed | ${result.failed.length} |`);
	lines.push(`| Formula touch-save deferred | ${result.formulaTouchSaveDeferred.length} |`);
	lines.push('');
	if (result.createdTypes.length) {
		lines.push('## Created entity types');
		lines.push('');
		for (const t of result.createdTypes) {
			lines.push(`- \`${t.name}\` → ${t.id}`);
		}
		lines.push('');
	}
	if (result.addedProperties.length) {
		lines.push('## Added properties');
		lines.push('');
		for (const p of result.addedProperties) {
			lines.push(`- \`${p.parentType}.${p.name}\` → ${p.id}`);
		}
		lines.push('');
	}
	if (result.wouldCreateTypes.length) {
		lines.push('## Would create entity types');
		lines.push('');
		for (const t of result.wouldCreateTypes) {
			const blurb = t.blurb ? ` — ${t.blurb}` : '';
			lines.push(`- \`${t.typeName}\` (${t.properties.length} inline prop(s))${blurb}`);
		}
		lines.push('');
	}
	if (result.wouldAddProperties.length) {
		lines.push('## Would add properties');
		lines.push('');
		for (const p of result.wouldAddProperties) {
			const formula = p.def.formula ? ' [formula]' : '';
			lines.push(`- \`${p.parentTypeName}.${p.propertyName}\` (type: ${p.def.type})${formula}`);
		}
		lines.push('');
	}
	if (result.skipped.length) {
		lines.push('## Skipped');
		lines.push('');
		for (const s of result.skipped) {
			lines.push(`- ${s.kind}: \`${s.name}\` (${s.reason})`);
		}
		lines.push('');
	}
	if (result.failed.length) {
		lines.push('## Failed');
		lines.push('');
		for (const f of result.failed) {
			lines.push(`- ${f.kind}: \`${f.name}\` — ${f.error}`);
		}
		lines.push('');
	}
	if (result.formulaTouchSaveDeferred.length) {
		lines.push('## Formula properties needing touch-save');
		lines.push('');
		lines.push(
			'These formula properties were created but existing instances will not show computed values until each instance is re-saved (touch-save). See handbook §5.1.'
		);
		lines.push('');
		for (const f of result.formulaTouchSaveDeferred) {
			lines.push(`- \`${f.parentType}.${f.property}\` — formula: \`${f.formula}\``);
		}
		lines.push('');
	}
	return lines.join('\n');
}
