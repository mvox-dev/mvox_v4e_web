import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.entuJwt = event.cookies.get('entu_jwt') ?? null;
	return resolve(event);
};
