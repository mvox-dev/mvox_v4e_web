// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				// Elevated BFF service key (slice-3 invite/join). Distinct from the
				// data-manager key; grants _editor per org. PO-provisioned CF secret.
				ENTU_SERVICE_KEY?: string;
				// Tenant database name, also available as a CF build var ($env/static/public).
				PUBLIC_ENTU_DB?: string;
			};
		}
	}
}

export {};
