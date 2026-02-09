import { readFileSync } from 'fs';
import { join } from 'path';
import { markdownToHtml } from '$lib/server/markdownToHtml.js';

export async function load() {
	const path = join(process.cwd(), 'static/docs/PRIVACY_POLICY.md');
	let html = '';
	try {
		const md = readFileSync(path, 'utf-8');
		html = markdownToHtml(md);
	} catch (err) {
		console.error('Error reading Privacy Policy:', err);
		html = '<h1>Privacy Policy</h1><p>Unable to load content.</p>';
	}
	return { policyHtml: html };
}
