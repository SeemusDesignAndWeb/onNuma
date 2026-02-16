/**
 * Helpers for email HTML with style tags. Kept in a .js file so that Svelte
 * does not misinterpret </style> or <style> inside the component script.
 */

export function extractStyleFromHtml(html) {
	if (!html || typeof html !== 'string') return '';
	const openTag = '<style[^>]*>';
	const closeTag = '</style>';
	const re = new RegExp(openTag + '([\\s\\S]*?)' + closeTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	const matches = html.match(re);
	if (!matches || matches.length === 0) return '';
	const reOne = new RegExp(openTag + '([\\s\\S]*?)' + closeTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
	return matches
		.map((tag) => {
			const m = tag.match(reOne);
			return m ? m[1].trim() : '';
		})
		.filter(Boolean)
		.join('\n');
}

export function getBodyWithoutStyleTags(html) {
	if (!html || typeof html !== 'string') return html;
	const openTag = '<style[^>]*>';
	const closeTag = '</style>';
	const styleRe = new RegExp(openTag + '[\\s\\S]*?' + closeTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
	return html.replace(styleRe, '').trim();
}

export function buildHtmlWithStyles(bodyHtml, existingStyles) {
	if (!existingStyles) return bodyHtml;
	return `<style>\n${existingStyles}\n</style>\n${bodyHtml}`;
}
