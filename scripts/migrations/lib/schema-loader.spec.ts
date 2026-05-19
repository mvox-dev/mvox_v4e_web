import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { loadV4eSchema } from './schema-loader';

const fixturesDir = resolve(__dirname, 'fixtures');

describe('loadV4eSchema', () => {
	it('loads minimal fixture and exposes entities + properties', async () => {
		const schema = await loadV4eSchema(`${fixturesDir}/schema-minimal.json`);
		expect(schema.version).toBe('v4E');
		expect(schema.entities).toHaveLength(2);
		expect(schema.entities[0].name).toBe('season');
		expect(schema.entities[0].properties).toHaveLength(2);
		expect(schema.entities[0].properties[0].name).toBe('start_date');
		expect(schema.entities[1].name).toBe('voice');
	});

	it('throws on file not found', async () => {
		await expect(
			loadV4eSchema(`${fixturesDir}/nonexistent.json`)
		).rejects.toThrow(/schema file not found/i);
	});

	it('throws on malformed JSON', async () => {
		await expect(
			loadV4eSchema(`${fixturesDir}/schema-malformed.txt`)
		).rejects.toThrow(/invalid json/i);
	});

	it('throws on missing entities array', async () => {
		// inline a malformed-shape fixture via temp string
		const tmp = `${fixturesDir}/schema-no-entities.json`;
		await import('node:fs/promises').then((fs) =>
			fs.writeFile(tmp, JSON.stringify({ version: 'v4E' }))
		);
		await expect(loadV4eSchema(tmp)).rejects.toThrow(/missing entities/i);
		await import('node:fs/promises').then((fs) => fs.unlink(tmp));
	});
});
