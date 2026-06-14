<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { userStore } from '$lib/auth/userStore';
	import { resolveInvite, createApplication, acceptInvite } from '$lib/invite/inviteData';
	import type { InviteProjection } from '$lib/invite/inviteData';

	type PageState = 'loading' | 'not-found' | 'expired' | 'valid';

	const token = $derived(page.params.token ?? '');

	let pageState = $state<PageState>('loading');
	let projection = $state<InviteProjection | null>(null);
	let accepting = $state(false);

	$effect(() => {
		const tok = token;
		if (!tok) return;

		pageState = 'loading';
		projection = null;

		resolveInvite(tok)
			.then((proj) => {
				projection = proj;
				if (!proj.valid) {
					pageState = 'not-found';
				} else if (proj.expired) {
					pageState = 'expired';
				} else {
					pageState = 'valid';
				}
			})
			.catch(() => {
				pageState = 'not-found';
			});
	});

	// isAuthed: token present AND userStore is ready (personId known)
	const isAuthed = $derived(getToken() !== null && $userStore.status === 'ready');

	const signInUrl = $derived(`/auth/login?redirect=/invite/${token}`);

	async function handleAccept() {
		const tok = token;
		const user = $userStore;
		if (user.status !== 'ready') return;
		const personId = (user as { status: 'ready'; personId: string }).personId;
		const clientToken = getToken();
		if (!clientToken) return;

		// orgId from projection (server may include it for the accept flow)
		const orgId = (projection as (InviteProjection & { orgId?: string }) | null)?.orgId ?? '';

		accepting = true;
		try {
			const applicationId = await createApplication(
				{ db: PUBLIC_ENTU_DB, token: clientToken },
				{ personId, orgId },
			);
			await acceptInvite(tok, { applicationId });
			await goto('/agenda');
		} catch {
			// TODO: surface error state
		} finally {
			accepting = false;
		}
	}
</script>

{#if pageState === 'loading'}
	<div data-testid="invite-loading" class="flex items-center justify-center min-h-screen">
		<p class="font-sans text-ink-3">{m.invite_loading()}</p>
	</div>
{:else if pageState === 'not-found'}
	<div data-testid="invite-not-found" class="flex items-center justify-center min-h-screen">
		<p class="font-sans text-ink-3">{m.invite_not_found()}</p>
	</div>
{:else if pageState === 'expired'}
	<div data-testid="invite-expired" class="flex items-center justify-center min-h-screen">
		<p class="font-sans text-ink-3">{m.invite_expired()}</p>
	</div>
{:else}
	<div data-testid="invite-valid" class="flex items-center justify-center min-h-screen">
		<div class="bg-paper border border-ink/10 rounded-lg p-8 max-w-md w-full shadow-lg">
			<h1 class="font-sans text-xl font-semibold text-ink mb-4">
				{m.invite_heading({ orgName: projection?.orgName ?? '' })}
			</h1>
			{#if projection?.message}
				<p class="font-sans text-sm text-ink-3 mb-6">{projection.message}</p>
			{/if}

			{#if !isAuthed}
				<a
					href={signInUrl}
					class="inline-block font-sans text-sm font-medium px-4 py-2 bg-ink text-paper rounded no-underline"
				>
					{m.invite_sign_in_to_accept()}
				</a>
			{:else}
				<button
					data-testid="invite-accept-button"
					type="button"
					onclick={handleAccept}
					disabled={accepting}
					class="font-sans text-sm font-medium px-4 py-2 bg-ink text-paper rounded disabled:opacity-50"
				>
					{accepting ? m.invite_accepting() : m.invite_accept()}
				</button>
			{/if}
		</div>
	</div>
{/if}
