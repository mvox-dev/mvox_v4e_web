import type { ServerLoad } from '@sveltejs/kit';

const PROVIDERS: ReadonlyArray<{ id: string; label: string }> = [
	{ id: 'smart-id', label: 'Smart-ID' },
	{ id: 'mobile-id', label: 'Mobile-ID' },
	{ id: 'id-card', label: 'ID-card' },
	{ id: 'google', label: 'Google' },
	{ id: 'apple', label: 'Apple' },
	{ id: 'e-mail', label: 'e-mail' },
];

export const load: ServerLoad = async () => {
	return { providers: PROVIDERS };
};
