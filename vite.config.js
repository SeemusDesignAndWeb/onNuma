import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		// pg is CommonJS; let Node load it at runtime instead of Vite bundling it
		external: ['pg']
	}
});
