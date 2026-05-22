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
});
