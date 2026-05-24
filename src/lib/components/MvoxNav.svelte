<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import BrandMark from './BrandMark.svelte';
	import OrgPicker from './OrgPicker.svelte';
	import type { OrgPickerMode } from '$lib/auth/userStore';

	type Tab = 'agenda' | 'library' | 'roster' | 'notices' | 'settings';
	const TAB_LABELS: Record<Tab, () => string> = {
		agenda: m.nav_tab_agenda,
		library: m.nav_tab_library,
		roster: m.nav_tab_roster,
		notices: m.nav_tab_notices,
		settings: m.nav_tab_settings,
	};
	const TABS: Tab[] = ['agenda', 'library', 'roster', 'notices', 'settings'];
	const {
		signedIn = false,
		currentTab = 'agenda' as Tab,
		orgLabel = '',
		orgInitials = '',
		userInitial = '',
		userName = '',
		orgPickerMode = 'placeholder' as OrgPickerMode,
	}: {
		signedIn?: boolean;
		currentTab?: Tab;
		orgLabel?: string;
		orgInitials?: string;
		userInitial?: string;
		userName?: string;
		orgPickerMode?: OrgPickerMode;
	} = $props();
</script>

<header class="flex items-center justify-between py-2 px-6 border-b-[1.5px] border-ink-2 bg-paper">
	<div class="flex items-center gap-4">
		<a href="/"><BrandMark size="m" /></a>
		{#if orgPickerMode === 'placeholder'}
			<span class="text-ink-4">/</span>
			<span class="font-sans font-semibold text-[11px] text-ink-3"
				>{m.nav_org_picker_placeholder()}</span
			>
		{:else if orgPickerMode === 'static'}
			<span class="text-ink-4">/</span>
			<span
				class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded"
			>
				<span
					class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center"
					>{orgInitials}</span
				>
				<span class="font-sans font-semibold text-[11px]">{orgLabel}</span>
			</span>
		{:else}
			<span class="text-ink-4">/</span>
			<OrgPicker />
		{/if}
	</div>
	<div class="flex items-center gap-3.5">
		{#if signedIn}
			<div class="flex gap-3">
				{#each TABS as tab (tab)}
					<span
						class="font-sans text-[11.5px] {tab === currentTab
							? 'text-ink font-semibold border-b-2 border-ink pb-1'
							: 'text-ink-3 font-medium'} inline-flex items-center gap-1"
					>
						{TAB_LABELS[tab]()}
						{#if tab === 'library' && tab === currentTab}
							<span
								class="font-sans text-[7px] tracking-wider py-px px-1 bg-ink text-paper rounded-sm font-semibold"
								>{m.nav_chip_librarian()}</span
							>
						{/if}
					</span>
				{/each}
			</div>
			<span class="text-ink-4">·</span>
			<span class="inline-flex items-center gap-1.5 font-sans text-[11.5px]">
				<span
					class="w-[22px] h-[22px] rounded-full bg-[#c8b290] border border-ink-3 inline-flex items-center justify-center font-display text-[13px] font-bold"
					>{userInitial}</span
				>
				<span class="font-medium">{userName}</span>
			</span>
		{:else}
			<a href="/auth/login" class="font-sans text-[11.5px] text-ink-3">{m.nav_sign_in()}</a>
		{/if}
	</div>
</header>
