<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { userStore } from '$lib/auth/userStore';
	import { decodeInviteToken } from '$lib/invite/inviteToken';
	import { createApplication, grantEditorToAdmin } from '$lib/invite/inviteData';

	// C5: decode client-side — zero fetch required for invite resolve.
	// Token is self-describing (orgId, orgName, inviterPersonId, sections, exp).
	const rawToken = $derived(page.params.token ?? '');
	const decoded = $derived(decodeInviteToken(rawToken));

	type AcceptState = 'idle' | 'accepting' | 'success' | 'error';
	let acceptState = $state<AcceptState>('idle');
	let acceptError = $state<string | null>(null);

	// Sign-in redirects back to /invite/<token> with the existing ?redirect= flow.
	const signInUrl = $derived(`/auth/login?redirect=${encodeURIComponent(`/invite/${rawToken}`)}`);

	const isAuthed = $derived(browser && getToken() !== null && $userStore.status === 'ready');
	const userReady = $derived($userStore.status === 'ready' ? $userStore : null);

	async function handleAccept() {
		const tok = decoded;
		const user = userReady;
		if (!tok || !user) return;
		const authToken = getToken();
		if (!authToken) return;

		const cfg = { db: PUBLIC_ENTU_DB, token: authToken };
		acceptState = 'accepting';
		acceptError = null;

		try {
			const { applicationId } = await createApplication(cfg, {
				personId: user.personId,
				orgId: tok.orgId,
			});
			await grantEditorToAdmin(cfg, {
				applicationId,
				adminPersonId: tok.inviterPersonId,
			});
			acceptState = 'success';
		} catch (err) {
			acceptError = err instanceof Error ? err.message : String(err);
			acceptState = 'error';
		}
	}
</script>

{#if decoded === null}
	<!-- Invalid or malformed token -->
	<div
		data-testid="invite-invalid"
		class="flex items-center justify-center min-h-screen px-6"
	>
		<div class="bg-paper border border-ink/10 rounded-lg p-8 max-w-md w-full shadow-lg text-center">
			<p class="font-sans text-sm text-ink-3">{m.invite_invalid()}</p>
		</div>
	</div>
{:else}
	<div
		data-testid="invite-valid"
		class="flex items-center justify-center min-h-screen px-6"
	>
		<div class="bg-paper border border-ink/10 rounded-lg p-8 max-w-md w-full shadow-lg">
			<h1
				data-testid="invite-heading"
				class="font-sans text-xl font-semibold text-ink mb-4"
			>
				{m.invite_heading({ orgName: decoded.orgName })}
			</h1>

			{#if acceptState === 'success'}
				<p data-testid="invite-success" class="font-sans text-sm text-ink">
					{m.invite_success()}
				</p>
			{:else if acceptState === 'error'}
				<p data-testid="invite-error" class="font-sans text-sm text-red-600">
					{acceptError ?? m.invite_invalid()}
				</p>
			{:else if !isAuthed}
				<!-- Not signed in — prompt to sign in, token carried through ?redirect= -->
				<a
					data-testid="invite-sign-in-link"
					href={signInUrl}
					class="inline-block font-sans text-sm font-medium px-4 py-2 bg-ink text-paper rounded no-underline"
				>
					{m.invite_sign_in_to_accept()}
				</a>
			{:else}
				<!-- Authed — show accept button -->
				<button
					data-testid="invite-accept-button"
					type="button"
					onclick={handleAccept}
					disabled={acceptState === 'accepting'}
					class="font-sans text-sm font-medium px-4 py-2 bg-ink text-paper rounded disabled:opacity-50"
				>
					{acceptState === 'accepting' ? m.invite_accepting() : m.invite_accept()}
				</button>
			{/if}
		</div>
	</div>
{/if}
