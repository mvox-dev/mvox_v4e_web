import { createRawSnippet, type Snippet } from 'svelte';

export const textSnippet = (text: string): Snippet =>
	createRawSnippet(() => ({ render: () => text }));
