import { readFileSync } from 'fs';
import { join } from 'path';
import { markdownToHtml } from '$lib/server/markdownToHtml.js';

export async function load() {
	// Read the Hub privacy policy markdown file
	const privacyPolicyPath = join(process.cwd(), 'static/docs/HUB_PRIVACY_POLICY.md');
	let privacyPolicyHtml = '';
	
	try {
		const markdownContent = readFileSync(privacyPolicyPath, 'utf-8');
		privacyPolicyHtml = markdownToHtml(markdownContent);
	} catch (error) {
		console.error('Error reading Hub privacy policy:', error);
		privacyPolicyHtml = '<h1>Hub Privacy Policy</h1><p>Unable to load privacy policy content.</p>';
	}
	
	return {
		privacyPolicyHtml
	};
}
