<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import AvatarMenu from './AvatarMenu.svelte';
	import BrandMark from './BrandMark.svelte';
	import OrgPicker from './OrgPicker.svelte';
	import type { OrgPickerMode } from '$lib/auth/userStore';

	type Tab = 'agenda' | 'library' | 'roster' | 'notices' | 'settings' | 'seasons';
	const TAB_LABELS: Record<Tab, () => string> = {
		agenda: m.nav_tab_agenda,
		library: m.nav_tab_library,
		roster: m.nav_tab_roster,
		notices: m.nav_tab_notices,
		settings: m.nav_tab_settings,
		seasons: m.nav_tab_rehearsals,
	};
	const TABS: Tab[] = ['agenda', 'library', 'roster', 'notices', 'settings', 'seasons'];
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

	// Mobile tab menu state — mirrors AvatarMenu keyboard/focus pattern
	let tabMenuOpen = $state(false);
	let tabMenuTriggerEl: HTMLButtonElement | undefined = $state();
	let tabMenuPanelEl: HTMLDivElement | undefined = $state();

	function toggleTabMenu() {
		tabMenuOpen = !tabMenuOpen;
	}

	function closeTabMenu() {
		tabMenuOpen = false;
	}

	$effect(() => {
		if (!tabMenuOpen) return;

		// Focus first item on open — mirrors AvatarMenu focus-on-open pattern
		const firstItem = tabMenuPanelEl?.querySelector<HTMLElement>('[data-testid^="nav-tab-menu-item-"]');
		queueMicrotask(() => firstItem?.focus());

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				closeTabMenu();
				tabMenuTriggerEl?.focus();
			}
		}

		function onMouseDown(e: MouseEvent) {
			const target = e.target as Node;
			if (tabMenuTriggerEl?.contains(target)) return;
			if (tabMenuPanelEl?.contains(target)) return;
			closeTabMenu();
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousedown', onMouseDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousedown', onMouseDown);
		};
	});
</script>

<header class="relative z-30 flex items-center justify-between py-2 px-6 border-b-[1.5px] border-ink-2 bg-paper">
	<!-- Left: brand + org picker (min-w-0 lets org chip truncate instead of overflow) -->
	<div class="flex items-center gap-4 min-w-0">
		<a href="/"><BrandMark size="m" /></a>
		<div data-testid="nav-org-area" class="flex items-center gap-1.5 min-w-0">
			{#if orgPickerMode === 'placeholder'}
				<span class="text-ink-4">/</span>
				<span class="font-sans font-semibold text-[11px] text-ink-3"
					>{m.nav_org_picker_placeholder()}</span
				>
			{:else if orgPickerMode === 'static'}
				<span class="text-ink-4">/</span>
				<span
					class="inline-flex items-center gap-1.5 py-0.5 px-2 border border-[1.25px] border-ink-3 rounded min-w-0"
				>
					<span
						class="w-[16px] h-[16px] rounded-[3px] bg-[#293556] text-white font-sans font-bold text-[7px] inline-flex items-center justify-center flex-shrink-0"
						>{orgInitials}</span
					>
					<span class="font-sans font-semibold text-[11px] truncate">{orgLabel}</span>
				</span>
			{:else}
				<span class="text-ink-4">/</span>
				<OrgPicker />
			{/if}
		</div>
	</div>

	<!-- Right: tabs (desktop inline + mobile hamburger) + avatar / sign-in -->
	<div class="flex items-center gap-3.5 flex-shrink-0">
		{#if signedIn}
			<!-- Desktop inline tab row — hidden on mobile, visible at sm+ -->
			<div data-testid="nav-inline-tabs" class="hidden sm:flex gap-3">
				{#each TABS as tab (tab)}
					{#if tab === 'seasons' || tab === 'agenda'}
						<a
							data-testid="nav-inline-tab-{tab}"
							href="/{tab}"
							class="font-sans text-[11.5px] {tab === currentTab
								? 'text-ink font-semibold border-b-2 border-ink pb-1'
								: 'text-ink-3 font-medium'} inline-flex items-center gap-1 no-underline"
						>
							{TAB_LABELS[tab]()}
						</a>
					{:else}
						<span
							data-testid="nav-inline-tab-{tab}"
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
					{/if}
				{/each}
			</div>

			<!-- Mobile hamburger — visible below sm, hidden at sm+ -->
			<div class="relative sm:hidden">
				<button
					bind:this={tabMenuTriggerEl}
					data-testid="nav-tab-menu-trigger"
					type="button"
					onclick={toggleTabMenu}
					aria-haspopup="menu"
					aria-expanded={tabMenuOpen}
					aria-label={m.nav_menu_open()}
					class="sm:hidden inline-flex items-center justify-center w-[30px] h-[30px] text-ink border border-ink-5 rounded font-sans text-lg"
				>
					☰
				</button>

				{#if tabMenuOpen}
					<!-- Paper-card dropdown — mirrors AvatarMenu panel style -->
					<div
						bind:this={tabMenuPanelEl}
						data-testid="nav-tab-menu"
						role="menu"
						class="absolute top-full right-0 mt-1.5 min-w-[160px] bg-paper border border-ink/10 rounded shadow-lg p-2 z-50"
					>
						{#each TABS as tab (tab)}
							<div
								data-testid="nav-tab-menu-item-{tab}"
								role="menuitem"
								tabindex="0"
								class="flex items-center gap-1 font-sans text-[12px] {tab === currentTab
									? 'text-ink font-semibold'
									: 'text-ink-3 font-medium'} hover:bg-paper-2 -mx-2 px-2 py-1.5 rounded cursor-default"
							>
								{TAB_LABELS[tab]()}
								{#if tab === 'library' && tab === currentTab}
									<span
										data-testid="nav-chip-librarian"
										class="font-sans text-[7px] tracking-wider py-px px-1 bg-ink text-paper rounded-sm font-semibold"
										>{m.nav_chip_librarian()}</span
									>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<span class="text-ink-4">·</span>
			<!-- Avatar always visible — flex-shrink-0 prevents it being squeezed off-screen -->
			<div data-testid="nav-avatar-wrapper" class="flex-shrink-0">
				<AvatarMenu name={userName} initial={userInitial} />
			</div>
		{:else}
			<!-- Sign-in link — flex-shrink-0 keeps it visible at narrow widths -->
			<div data-testid="nav-signin-wrapper" class="flex-shrink-0">
				<a href="/auth/login" class="font-sans text-[11.5px] text-ink-3">{m.nav_sign_in()}</a>
			</div>
		{/if}
	</div>
</header>
