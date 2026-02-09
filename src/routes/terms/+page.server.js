import { readFileSync } from 'fs';
import { join } from 'path';
import { markdownToHtml } from '$lib/server/markdownToHtml.js';

export async function load() {
	const path = join(process.cwd(), 'static/docs/TERMS_AND_CONDITIONS.md');
	let html = '';
	try {
		const md = readFileSync(path, 'utf-8');
		html = markdownToHtml(md);
	} catch (err) {
		console.error('Error reading Terms and Conditions:', err);
		html = '<h1>Terms and Conditions</h1><p>Unable to load content.</p>';
	}
	return { policyHtml: html };
}
