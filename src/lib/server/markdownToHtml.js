function slugify(text) {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Converts markdown to safe HTML (headings, bold, italic, links, lists, paragraphs).
 * @param {string} md - Markdown string
 * @returns {string} HTML string
 */
export function markdownToHtml(md) {
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

	// Paragraphs
	const paragraphLines = html.split('\n');
	const paragraphProcessed = [];

	for (let i = 0; i < paragraphLines.length; i++) {
		const line = paragraphLines[i];
		const trimmed = line.trim();

		if (trimmed === '') {
			paragraphProcessed.push('');
		} else if (trimmed.startsWith('<h') || trimmed.startsWith('</h')) {
			paragraphProcessed.push(line);
		} else if (
			trimmed.startsWith('<ul>') ||
			trimmed.startsWith('</ul>') ||
			trimmed.startsWith('<ol>') ||
			trimmed.startsWith('</ol>') ||
			trimmed.startsWith('<li>') ||
			trimmed.startsWith('</li>')
		) {
			paragraphProcessed.push(line);
		} else if (trimmed.startsWith('<strong>')) {
			paragraphProcessed.push(`<p>${line}</p>`);
		} else if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
			paragraphProcessed.push(line);
		} else {
			paragraphProcessed.push(`<p>${line}</p>`);
		}
	}

	html = paragraphProcessed.join('\n');

	html = html.replace(/<p><\/p>/g, '');
	html = html.replace(/<p>(<h[1-6][^>]*>)/g, '$1');
	html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
	html = html.replace(/<p>(<ul[^>]*>)/g, '$1');
	html = html.replace(/(<\/ul>)<\/p>/g, '$1');
	html = html.replace(/<p>(<ol[^>]*>)/g, '$1');
	html = html.replace(/(<\/ol>)<\/p>/g, '$1');
	html = html.replace(/<p>(<li[^>]*>)/g, '$1');
	html = html.replace(/(<\/li>)<\/p>/g, '$1');
	html = html.replace(/<p>(<(?!strong|p|h[1-6]|ul|ol|li)[a-zA-Z][^>]*>)/g, '$1');
	html = html.replace(/(<\/(?!strong|p|h[1-6]|ul|ol|li)[a-zA-Z][^>]*>)<\/p>/g, '$1');

	return html;
}
