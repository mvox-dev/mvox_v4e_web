<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { userStore, selectedOrgStore, pickerModeStore, selectOrg } from '$lib/auth/userStore';

	let open = $state(false);

	async function handleSelect(orgId: string) {
		await selectOrg(orgId);
		open = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	});
</script>

{#if $pickerModeStore === 'placeholder'}
	<span
		data-testid="org-picker-chip"
		class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded opacity-50"
	>
		<span class="font-sans font-semibold text-[11px] text-ink-3"
			>{m.nav_org_picker_placeholder()}</span
		>
	</span>
{:else if $pickerModeStore === 'static' && $selectedOrgStore}
	<span
		data-testid="org-picker-chip"
		class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded"
	>
		<span
			class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center"
			>{$selectedOrgStore.initials}</span
		>
		<span class="font-sans font-semibold text-[11px]">{$selectedOrgStore.label}</span>
	</span>
{:else if $pickerModeStore === 'dropdown' && $selectedOrgStore}
	<div class="relative">
		<button
			data-testid="org-picker-chip"
			type="button"
			onclick={() => (open = !open)}
			class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded"
		>
			<span
				class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center"
				>{$selectedOrgStore.initials}</span
			>
			<span class="font-sans font-semibold text-[11px]">{$selectedOrgStore.label}</span>
			<span class="text-ink-4">▾</span>
		</button>

		{#if open}
			<ul
				role="menu"
				class="absolute left-0 top-full mt-1 min-w-[160px] bg-paper border border-ink-2 rounded shadow-md z-50"
			>
				{#if $userStore.status === 'ready'}
					{#each $userStore.orgs as org (org.id)}
						<li role="menuitem">
							<button
								type="button"
								onclick={() => handleSelect(org.id)}
								aria-label={m.nav_org_picker_switch_to({ orgName: org.label })}
								class="w-full text-left flex items-center gap-2 px-3 py-2 font-sans text-[11.5px] hover:bg-highlight"
							>
								<span
									class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center"
									>{org.initials}</span
								>
								{org.label}
							</button>
						</li>
					{/each}
				{/if}
			</ul>
		{/if}
	</div>
{/if}
