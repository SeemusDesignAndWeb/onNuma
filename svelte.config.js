import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
		// Note: Body size limit is configured via BODY_SIZE_LIMIT environment variable
		// Set BODY_SIZE_LIMIT=150M in Railway environment variables for 150MB limit
	}
};

export default config;

