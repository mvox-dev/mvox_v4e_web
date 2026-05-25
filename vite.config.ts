import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglide } from '@inlang/paraglide-sveltekit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		paraglide({ project: './project.inlang', outdir: './src/lib/paraglide' }),
		sveltekit(),
	],
	server: {
		// `true` should allow all hosts but Vite 8 was still rejecting the tailnet hostname;
		// explicit list works reliably. Add hostnames here when serving over new networks.
		allowedHosts: [
			'localhost',
			'127.0.0.1',
			'mvox-team',
			'mvox-team.tailccff13.ts.net',
			'.ts.net',
			'ai.mvox.eu',
		],
	},
});
