import type { EntuClient } from './entu-client';

export interface TouchSaveOptions {
	parentType: string;
	propertyName: string;
	formulaExpression: string;
	listInstances: (client: EntuClient, parentType: string) => Promise<Array<{ _id: string }>>;
	touchSave: (
		entityId: string,
		propertyName: string,
		formulaExpression: string
	) => Promise<void>;
}

export interface TouchSaveResult {
	touchSaveCount: number;
	noInstances: boolean;
	failed: number;
}

export async function touchSaveFormula(
	client: EntuClient,
	opts: TouchSaveOptions
): Promise<TouchSaveResult> {
	const instances = await opts.listInstances(client, opts.parentType);

	if (instances.length === 0) {
		return { touchSaveCount: 0, noInstances: true, failed: 0 };
	}

	let touchSaveCount = 0;
	let failed = 0;

	for (const instance of instances) {
		try {
			await opts.touchSave(instance._id, opts.propertyName, opts.formulaExpression);
			touchSaveCount += 1;
		} catch {
			failed += 1;
		}
	}

	return { touchSaveCount, noInstances: false, failed };
}

// Concrete touch-save wire shape — default injectable for live runs.
// Resolved by Josquin's Q2 probe (docs/migration/findings/phase-b-api-probes-2026-05-20.md):
// formula values have no _id (virtual reads), so we cannot "re-assert the formula".
// Instead, POST any non-formula property back to /entity/{id} to trigger Entu's
// formula-recompute side-effect on save. _sharing is chosen because it is always present,
// single-value, and non-load-bearing.
export async function entuTouchSave(client: EntuClient, entityId: string): Promise<void> {
	const getUrl = `${client.apiBase}/${client.db}/entity/${entityId}`;
	const getRes = await fetch(getUrl, {
		method: 'GET',
		headers: { Authorization: `Bearer ${client.jwt}` }
	});
	if (!getRes.ok) {
		throw new Error(`entuTouchSave GET failed: ${getRes.status} ${await getRes.text()}`);
	}
	const body = (await getRes.json()) as {
		entity: { _sharing?: Array<{ string?: string }>; [key: string]: unknown };
	};
	const sharingValue = body.entity._sharing?.[0]?.string;
	if (typeof sharingValue !== 'string') {
		throw new Error(`entuTouchSave: _sharing absent on entity ${entityId}`);
	}

	const postRes = await fetch(getUrl, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${client.jwt}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify([{ type: '_sharing', string: sharingValue }])
	});
	if (!postRes.ok) {
		throw new Error(`entuTouchSave POST failed: ${postRes.status} ${await postRes.text()}`);
	}
}
