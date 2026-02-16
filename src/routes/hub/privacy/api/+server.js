import { readFileSync } from 'fs';
import { join } from 'path';
import { json } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { replaceOrgPlaceholder } from '$lib/crm/server/hubPrivacyPolicy.js';

async function getSuperAdminFallback(org) {
	if (!org) return null;
	const admins = await readCollection('admins');
	const email = (org.hubSuperAdminEmail || org.email || '').toLowerCase().trim();
	if (!email) return null;
	const admin = (Array.isArray(admins) ? admins : []).find(
		(a) => (a.email || '').toLowerCase().trim() === email
	) || null;
	return admin ? { name: admin.name || '', email: admin.email || '' } : null;
}

function slugify(text) {
	return text.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

function markdownToHtml(md) {
	let html = md;
	
	// Headers with IDs
	html = html.replace(/^#### (.*)$/gm, (match, title) => {
		const id = slugify(title);
		return `<h4 id="${id}">${title}</h4>`;
	});
	
	html = html.replace(/^### (.*)$/gm, (match, title) => {
		const id = slugify(title);
		return `<h3 id="${id}">${title}</h3>`;
	});
	
	html = html.replace(/^## (.*)$/gm, (match, title) => {
		const id = slugify(title);
		return `<h2 id="${id}">${title}</h2>`;
	});
	
	html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
	
	// Bold
	html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
	
	// Italic (but not bold)
	html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
	
	// Links
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
	
	// Code blocks (inline)
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
	
	// Horizontal rules
	html = html.replace(/^---$/gm, '<hr>');
	
	// Process lists - handle both - and * for unordered lists
	const lines = html.split('\n');
	const processed = [];
	let inList = false;
	let listType = null;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmedLine = line.trim();
		const olMatch = trimmedLine.match(/^(\d+)\.\s+(.*)$/);
		const ulMatch = trimmedLine.match(/^[-*]\s+(.*)$/);
		
		if (olMatch) {
			if (!inList || listType !== 'ol') {
				if (inList) processed.push(`</${listType}>`);
				processed.push('<ol>');
				inList = true;
				listType = 'ol';
			}
			processed.push(`<li>${olMatch[2]}</li>`);
		} else if (ulMatch) {
			if (!inList || listType !== 'ul') {
				if (inList) processed.push(`</${listType}>`);
				processed.push('<ul>');
				inList = true;
				listType = 'ul';
			}
			processed.push(`<li>${ulMatch[1]}</li>`);
		} else {
			if (inList) {
				processed.push(`</${listType}>`);
				inList = false;
				listType = null;
			}
			processed.push(line);
		}
	}
	
	if (inList) {
		processed.push(`</${listType}>`);
	}
	
	html = processed.join('\n');
	
	// Paragraphs (wrap consecutive non-empty lines that aren't already HTML)
	// But preserve list items and other block elements
	// Process line by line to handle blank lines as paragraph breaks
	const paragraphLines = html.split('\n');
	const paragraphProcessed = [];
	
	for (let i = 0; i < paragraphLines.length; i++) {
		const line = paragraphLines[i];
		const trimmed = line.trim();
		
		if (trimmed === '') {
			// Blank line - just add it for spacing
			paragraphProcessed.push('');
		} else if (trimmed.startsWith('<h') || trimmed.startsWith('</h')) {
			// Headings - don't wrap in paragraphs
			paragraphProcessed.push(line);
		} else if (trimmed.startsWith('<ul>') || trimmed.startsWith('</ul>') || 
		           trimmed.startsWith('<ol>') || trimmed.startsWith('</ol>') ||
		           trimmed.startsWith('<li>') || trimmed.startsWith('</li>')) {
			// List elements - don't wrap in paragraphs
			paragraphProcessed.push(line);
		} else if (trimmed.startsWith('<strong>')) {
			// Lines starting with bold text (like "What this enables:", "Who:", "Access:", etc.)
			// Each gets its own paragraph - this ensures proper line breaks
			paragraphProcessed.push(`<p>${line}</p>`);
		} else if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
			// Other HTML elements - don't wrap
			paragraphProcessed.push(line);
		} else {
			// Regular text - wrap in paragraph
			paragraphProcessed.push(`<p>${line}</p>`);
		}
	}
	
	html = paragraphProcessed.join('\n');
	
	// Clean up empty paragraphs and nested paragraphs
	html = html.replace(/<p><\/p>/g, '');
	
	// Remove paragraph tags from headings (but preserve content)
	html = html.replace(/<p>(<h[1-6][^>]*>)/g, '$1');
	html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
	
	// Remove paragraph tags from lists (but preserve content)
	html = html.replace(/<p>(<ul[^>]*>)/g, '$1');
	html = html.replace(/(<\/ul>)<\/p>/g, '$1');
	html = html.replace(/<p>(<ol[^>]*>)/g, '$1');
	html = html.replace(/(<\/ol>)<\/p>/g, '$1');
	html = html.replace(/<p>(<li[^>]*>)/g, '$1');
	html = html.replace(/(<\/li>)<\/p>/g, '$1');
	
	// IMPORTANT: Preserve paragraphs that start with <strong> (like "What this enables:")
	// These should remain wrapped in <p> tags, so we explicitly avoid removing them
	// Only remove paragraph tags from other block elements that shouldn't be in paragraphs
	html = html.replace(/<p>(<(?!strong|p|h[1-6]|ul|ol|li)[a-zA-Z][^>]*>)/g, '$1');
	html = html.replace(/(<\/(?!strong|p|h[1-6]|ul|ol|li)[a-zA-Z][^>]*>)<\/p>/g, '$1');
	
	return html;
}

export async function GET() {
	try {
		const privacyPolicyPath = join(process.cwd(), 'static/docs/HUB_PRIVACY_POLICY.md');
		const markdownContent = readFileSync(privacyPolicyPath, 'utf-8');
		const organisationId = await getCurrentOrganisationId();
		const orgs = await getCachedOrganisations();
		const org = organisationId && orgs?.length ? orgs.find((o) => o.id === organisationId) ?? null : null;
		const superAdminFallback = org ? await getSuperAdminFallback(org) : null;
		const contentWithOrg = replaceOrgPlaceholder(markdownContent, org || null, superAdminFallback);
		const privacyPolicyHtml = markdownToHtml(contentWithOrg);

		return json({ html: privacyPolicyHtml });
	} catch (error) {
		console.error('Error reading Hub privacy policy:', error);
		return json({ html: '<h1>Hub Privacy Policy</h1><p>Unable to load privacy policy content.</p>' }, { status: 500 });
	}
}
