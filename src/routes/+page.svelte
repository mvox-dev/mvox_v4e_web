<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { ENTU_API_BASE } from '$lib/entu-config';
	import { apiRequest } from '$lib/api/wrapper';
	import { getToken } from '$lib/auth/storage';
	import * as m from '$lib/paraglide/messages.js';

	type OrgEntity = {
		_id: string;
		name: string;
		description?: string;
		location?: string;
		photo?: string;
		member_count_per_section?: number;
	};

	type EntuOrgRaw = {
		_id: string;
		name?: Array<{ string?: string }>;
		description?: Array<{ string?: string }>;
		location?: Array<{ string?: string }>;
		_thumbnail?: string;
		member_count_per_section?: Array<{ number?: number }>;
	};

	let signedIn = $state(false);
	let orgs = $state<OrgEntity[] | null>(null);
	let loadError = $state(false);
	let loaded = $state(false);

	function pickString(arr: Array<{ string?: string }> | undefined): string | undefined {
		if (!Array.isArray(arr) || arr.length === 0) return undefined;
		return arr[0]?.string;
	}

	function pickNumber(arr: Array<{ number?: number }> | undefined): number | undefined {
		if (!Array.isArray(arr) || arr.length === 0) return undefined;
		return arr[0]?.number;
	}

	function mapOrg(o: EntuOrgRaw): OrgEntity {
		return {
			_id: o._id,
			name: pickString(o.name) ?? '',
			description: pickString(o.description),
			location: pickString(o.location),
			photo: o._thumbnail,
			member_count_per_section: pickNumber(o.member_count_per_section),
		};
	}

	async function fetchOrgs() {
		loaded = false;
		try {
			const params = new URLSearchParams({
				'_type.string': 'organization',
				props: '_id,name,description,location,_thumbnail,member_count_per_section',
				limit: '50',
				skip: '0',
			});
			const url = `${ENTU_API_BASE}${PUBLIC_ENTU_DB}/entity?${params.toString()}`;
			const body = await apiRequest<{ entities: EntuOrgRaw[] }>(url);
			orgs = body.entities.map(mapOrg);
			loadError = false;
		} catch {
			orgs = null;
			loadError = true;
		} finally {
			loaded = true;
		}
	}

	onMount(() => {
		signedIn = getToken() !== null;
		if (signedIn) {
			fetchOrgs();
		}
	});

	function retry() {
		fetchOrgs();
	}
</script>

{#if !signedIn}
	<section class="py-16 text-center">
		<h1 class="text-3xl font-bold text-gray-900 mb-6">{m.landing_signed_out_headline()}</h1>
		<a href="/auth/login" data-testid="signed-out-cta" class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700">
			{m.landing_signed_out_cta()}
		</a>
	</section>
{:else}
	<section>
		<h2 data-testid="orgs-heading" class="text-2xl font-bold text-gray-900 mb-6">
			{m.landing_signed_in_heading()}
		</h2>

		{#if loaded && loadError}
			<div data-testid="orgs-error-state" class="text-center py-8">
				<p class="text-gray-600 mb-4">{m.landing_error_state()}</p>
				<button data-testid="orgs-retry-button" onclick={retry} class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
					{m.landing_retry_button()}
				</button>
			</div>
		{:else if loaded && orgs !== null && orgs.length === 0}
			<div data-testid="orgs-empty-state" class="text-center py-8 text-gray-500">
				{m.landing_empty_state()}
			</div>
		{:else if orgs !== null && orgs.length > 0}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each orgs as org (org._id)}
					<article data-testid="org-card" class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
						{#if org.photo}
							<img src={org.photo} alt={org.name} class="w-full h-32 object-cover rounded mb-3" />
						{:else}
							<div data-testid="org-photo-placeholder" class="w-full h-32 bg-gray-100 rounded mb-3 flex items-center justify-center text-2xl font-bold text-gray-400">
								{org.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<h3 class="font-semibold text-gray-900 truncate">{org.name}</h3>
						{#if org.description}
							<p class="text-sm text-gray-500 mt-1 line-clamp-2">{org.description}</p>
						{/if}
						{#if org.location}
							<p class="text-sm text-gray-400 mt-1">{org.location}</p>
						{/if}
						{#if org.member_count_per_section != null}
							<p class="text-xs text-gray-400 mt-1">{m.landing_members_per_section({ count: org.member_count_per_section })}</p>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}
