<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { PUBLIC_ENTU_DB } from '$env/static/public';
	import { getToken } from '$lib/auth/storage';
	import { selectedOrgStore } from '$lib/auth/userStore';
	import { listOrgMembers } from '$lib/seasons/entuSeasons';
	import { listOrgInvitations } from '$lib/invite/inviteData';
	import DeskSurface from '$lib/components/DeskSurface.svelte';
	import PaperCard from '$lib/components/PaperCard.svelte';
	import InviteForm from '$lib/components/members/InviteForm.svelte';
	import type { OrgMember } from '$lib/seasons/types';

	type LoadState = 'loading' | 'ready' | 'error';

	let loadState = $state<LoadState>('loading');
	let members = $state<OrgMember[]>([]);
	let pendingInvitations = $state<Array<{ invitationId: string; email: string; expiresAt: number; sections: string[] }>>([]);
	let loadError = $state<string | null>(null);

	const isOwner = $derived($selectedOrgStore?.role === 'owner');

	$effect(() => {
		const org = $selectedOrgStore;
		if (!org) return;
		const token = getToken();
		if (!token) return;
		const cfg = { db: PUBLIC_ENTU_DB, token };

		loadState = 'loading';
		loadError = null;

		Promise.all([listOrgMembers(cfg, org.id), listOrgInvitations(cfg, org.id)])
			.then(([memberList, invitationList]) => {
				members = memberList;
				pendingInvitations = invitationList;
				loadState = 'ready';
			})
			.catch((err: unknown) => {
				loadError = err instanceof Error ? err.message : String(err);
				loadState = 'error';
			});
	});
</script>

<DeskSurface>
	<div class="p-6 flex flex-col gap-6 max-w-2xl mx-auto">
		<h1 class="font-sans text-2xl font-semibold text-ink" data-desk-text>{m.members_heading()}</h1>

		{#if loadState === 'loading'}
			<div data-testid="members-loading" class="bg-paper rounded p-4 text-ink-3 font-sans text-sm">
				{m.members_heading()}…
			</div>
		{:else if loadState === 'error'}
			<div data-testid="members-error" class="bg-paper rounded p-4 text-ink-3 font-sans text-sm">
				{m.members_error()}
			</div>
		{:else}
			<!-- Member roster -->
			<PaperCard>
				<h2 class="font-sans text-base font-semibold text-ink mb-3">{m.members_heading()}</h2>
				{#if members.length === 0}
					<p data-testid="members-empty" class="font-sans text-sm text-ink-3">{m.members_empty()}</p>
				{:else}
					<ul data-testid="members-roster" class="flex flex-col gap-2">
						{#each members as member (member.personId)}
							<li class="font-sans text-sm text-ink">{member.name}</li>
						{/each}
					</ul>
				{/if}
			</PaperCard>

			<!-- Pending invitations + InviteForm (owner only) -->
			{#if isOwner}
				<PaperCard>
					<h2 class="font-sans text-base font-semibold text-ink mb-3">{m.members_invite_heading()}</h2>
					{#if pendingInvitations.length === 0}
						<p class="font-sans text-sm text-ink-3 mb-4">{m.members_invite_empty()}</p>
					{:else}
						<ul data-testid="invite-pending-list" class="flex flex-col gap-1 mb-4">
							{#each pendingInvitations as inv (inv.invitationId)}
								<li class="font-sans text-sm text-ink-3">{inv.email}</li>
							{/each}
						</ul>
					{/if}
					<InviteForm orgId={$selectedOrgStore?.id ?? ''} sections={[]} />
				</PaperCard>
			{/if}
		{/if}
	</div>
</DeskSurface>
