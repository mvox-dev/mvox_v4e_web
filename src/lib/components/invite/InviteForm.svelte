<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { userStore } from '$lib/auth/userStore';
	import { createInvitation, buildInviteUrl } from '$lib/invite/inviteData';
	import CopyLink from '$lib/components/CopyLink.svelte';

	const {
		orgId = '',
		orgName = '',
		sections = [] as string[],
		oncreated = (_result: { invitationId: string; token: string }) => {},
	}: {
		orgId?: string;
		orgName?: string;
		sections?: string[];
		oncreated?: (result: { invitationId: string; token: string }) => void;
	} = $props();

	let email = $state('');
	let message = $state('');
	let submitting = $state(false);
	let inviteUrl = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email) return;
		const token = getToken();
		if (!token) return;
		const cfg = { db: PUBLIC_ENTU_DB, token };

		const user = $userStore;
		const inviterPersonId =
			user.status === 'ready' ? (user as { status: 'ready'; personId: string }).personId : '';
		if (!inviterPersonId) return;

		submitting = true;
		error = null;
		try {
			const result = await createInvitation(cfg, {
				orgId,
				orgName,
				email,
				sections: sections.length > 0 ? sections : [],
				message: message || undefined,
				inviterPersonId,
			});
			const url = buildInviteUrl(window.location.origin, result.token);
			inviteUrl = url;
			email = '';
			message = '';
			oncreated(result);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			submitting = false;
		}
	}
</script>

<form data-testid="invite-form" onsubmit={handleSubmit} class="flex flex-col gap-3">
	<div class="flex flex-col gap-1">
		<label for="invite-email" class="font-sans text-[11px] font-medium text-ink-3">
			{m.members_invite_email_label()}
		</label>
		<input
			id="invite-email"
			data-testid="invite-email-input"
			type="email"
			name="email"
			required
			bind:value={email}
			disabled={submitting}
			class="font-sans text-sm border border-ink-4 rounded px-2 py-1.5 bg-paper focus:outline-none focus:border-ink-2"
			placeholder="singer@example.com"
		/>
	</div>

	{#if inviteUrl}
		<CopyLink url={inviteUrl} />
	{/if}

	{#if error}
		<p data-testid="invite-form-error" class="font-sans text-[11px] text-red-600">{error}</p>
	{/if}

	<button
		data-testid="invite-submit-button"
		type="submit"
		disabled={submitting || !email}
		class="font-sans text-[12px] font-medium px-3 py-1.5 bg-ink text-paper rounded self-start disabled:opacity-50"
	>
		{submitting ? m.members_invite_submitting() : m.members_invite_submit()}
	</button>
</form>
