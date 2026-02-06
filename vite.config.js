import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/** Hub domains from file when present (data/organisations.ndjson). If using database-only, file may be empty; add allowedHosts in this file for local dev. */
function getAllowedHostsFromOrganisations() {
	const dataDir = process.env.CRM_DATA_DIR || join(process.cwd(), 'data');
	const path = join(dataDir, 'organisations.ndjson');
	if (!existsSync(path)) return [];
	try {
		const content = readFileSync(path, 'utf8');
		const hosts = [];
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				const org = JSON.parse(trimmed);
				if (org.hubDomain && typeof org.hubDomain === 'string') {
					const host = org.hubDomain.toLowerCase().trim();
					if (host && !hosts.includes(host)) hosts.push(host);
				}
			} catch {
				// skip invalid lines
			}
		}
		return hosts;
	} catch {
		return [];
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true,
		allowedHosts: ['localhost', '.localhost', ...getAllowedHostsFromOrganisations()]
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules')) {
						if (id.includes('svelte')) return 'svelte';
						// Don't put quill in its own chunk - it has circular deps that cause "Cannot access before initialization"
						if (id.includes('cloudinary')) return 'cloudinary';
						return 'vendor';
					}
				}
			}
		}
	},
	ssr: {
		// pg is CommonJS; let Node load it at runtime instead of Vite bundling it
		external: ['pg']
	}
});
