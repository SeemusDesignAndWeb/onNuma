import { readFileSync } from 'fs';
import { join } from 'path';

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
	
	// Process lists
	const lines = html.split('\n');
	const processed = [];
	let inList = false;
	let listType = null;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
		const ulMatch = line.match(/^-\s+(.*)$/);
		
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
	html = html.split('\n').map(line => {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('<') || trimmed.startsWith('</')) {
			return line;
		}
		return `<p>${line}</p>`;
	}).join('\n');
	
	// Clean up empty paragraphs and nested paragraphs
	html = html.replace(/<p><\/p>/g, '');
	html = html.replace(/<p>(<[^>]+>)/g, '$1');
	html = html.replace(/(<\/[^>]+>)<\/p>/g, '$1');
	html = html.replace(/<p>(<h[1-6])/g, '$1');
	html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
	
	return html;
}

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
