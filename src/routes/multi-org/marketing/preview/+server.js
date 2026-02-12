import { json } from '@sveltejs/kit';
import { insertContentBlocks, resolveLinks, renderTemplate } from '$lib/crm/server/marketing.js';

/**
 * POST /multi-org/marketing/preview
 * Accepts raw HTML and returns it with content blocks and links resolved.
 * Used by the HtmlEditor component for live preview.
 */
export async function POST({ request, locals }) {
	if (!locals.multiOrgAdmin) {
		return json({ error: 'Unauthorised' }, { status: 401 });
	}

	const { html, organisationId } = await request.json();
	if (typeof html !== 'string') {
		return json({ error: 'html field required' }, { status: 400 });
	}

	try {
		// 1. Resolve content blocks
		let resolved = await insertContentBlocks(html, true);

		// 2. Resolve link references
		const linkValues = await resolveLinks(organisationId || null);
		const placeholderData = {};
		for (const [key, url] of Object.entries(linkValues)) {
			placeholderData[`link:${key}`] = url;
		}

		// 3. Replace link placeholders only (keep user/org ones as-is for preview)
		resolved = renderTemplate(resolved, placeholderData);

		return json({ html: resolved });
	} catch (err) {
		console.error('Preview resolve error:', err);
		return json({ error: err.message }, { status: 500 });
	}
}
