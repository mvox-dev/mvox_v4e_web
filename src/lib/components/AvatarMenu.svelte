<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	type Props = {
		name: string;
		initial: string;
	};

	let { name, initial }: Props = $props();

	let open = $state(false);
	let triggerEl: HTMLButtonElement | undefined = $state();
	let panelEl: HTMLDivElement | undefined = $state();
	let signoutLinkEl: HTMLAnchorElement | undefined = $state();

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	$effect(() => {
		if (!open) return;

		queueMicrotask(() => signoutLinkEl?.focus());

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				close();
				triggerEl?.focus();
			}
		}

		function onMouseDown(e: MouseEvent) {
			const target = e.target as Node;
			if (triggerEl?.contains(target)) return;
			if (panelEl?.contains(target)) return;
			close();
		}

		window.addEventListener('keydown', onKeyDown);
		window.addEventListener('mousedown', onMouseDown);

		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousedown', onMouseDown);
		};
	});
</script>

<div class="relative inline-flex">
	<button
		bind:this={triggerEl}
		data-testid="avatar-menu-trigger"
		type="button"
		onclick={toggle}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={m.nav_user_menu_aria()}
		class="inline-flex items-center justify-center w-[30px] h-[30px] bg-paper-3 text-ink rounded-full font-bold text-xs border border-ink-5"
	>
		{initial}
	</button>

	{#if open}
		<div
			bind:this={panelEl}
			data-testid="avatar-menu-panel"
			role="menu"
			class="absolute top-full right-0 mt-1.5 min-w-[200px] bg-paper border border-ink/10 rounded shadow-lg p-3 z-50"
		>
			<div class="font-mono text-[10px] text-ink-3 tracking-widest uppercase mb-0.5">
				{m.nav_signed_in_as()}
			</div>
			<div class="text-sm font-semibold text-ink mb-2">{name}</div>
			<div class="h-px bg-ink-5 -mx-3 mb-1"></div>
			<a
				bind:this={signoutLinkEl}
				data-testid="avatar-menu-signout"
				role="menuitem"
				href="/auth/logout"
				class="flex items-center justify-between text-sm text-ink hover:bg-paper-2 -mx-3 px-3 py-1.5 no-underline"
			>
				<span>{m.nav_sign_out()}</span>
				<span class="font-display text-base text-ink-3" aria-hidden="true">→</span>
			</a>
		</div>
	{/if}
</div>
