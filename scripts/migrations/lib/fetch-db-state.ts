import {
	listEntities,
	POLYPHONY_META_TYPE_ENTITY_ID,
	POLYPHONY_META_TYPE_PROPERTY_ID,
	type EntuClient,
} from './entu-client';

export interface TypeDbState {
	typeId: string;
	name: string;
	propertyNames: string[];
	propertyIds: Record<string, string>;
	currentFormulas: Record<string, string>;
}

export type PhaseBDbState = Record<string, TypeDbState>;

export async function fetchPhaseBDbState(client: EntuClient): Promise<PhaseBDbState> {
	const typesResp = await listEntities(client, {
		'_type.reference': POLYPHONY_META_TYPE_ENTITY_ID,
		props: 'name._id,name.string',
		limit: '200',
	});

	const state: PhaseBDbState = {};
	for (const t of typesResp.entities) {
		const name = (t as { name?: Array<{ string?: string }> }).name?.[0]?.string ?? '';
		if (!name) continue;

		const propsResp = await listEntities(client, {
			'_type.reference': POLYPHONY_META_TYPE_PROPERTY_ID,
			'_parent.reference': t._id,
			props: 'name.string,formula.string',
			limit: '200',
		});

		const propertyNames: string[] = [];
		const propertyIds: Record<string, string> = {};
		const currentFormulas: Record<string, string> = {};

		for (const p of propsResp.entities) {
			const propName = (p as { name?: Array<{ string?: string }> }).name?.[0]?.string;
			if (!propName) continue;
			propertyNames.push(propName);
			propertyIds[propName] = p._id;
			const formula = (p as { formula?: Array<{ string?: string }> }).formula?.[0]?.string;
			if (formula) currentFormulas[propName] = formula;
		}

		state[name] = {
			typeId: t._id,
			name,
			propertyNames,
			propertyIds,
			currentFormulas,
		};
	}

	return state;
}
