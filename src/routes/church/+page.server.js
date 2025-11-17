import { getPage, getContactInfo } from '$lib/server/database';

export const load = async () => {
	const page = getPage('church');
	const contactInfo = getContactInfo();
	
	// Debug logging
	if (page) {
		console.log('[Church Page] Loaded page from database:', {
			id: page.id,
			title: page.title,
			hasSections: !!page.sections,
			sectionsCount: page.sections?.length || 0,
			sectionsTypes: page.sections?.map(s => s.type) || [],
			sectionsDetails: page.sections?.map(s => ({
				type: s.type,
				title: s.title,
				hasContent: !!s.content,
				contentLength: s.content?.length || 0
			})) || []
		});
		return { page, contactInfo };
	}
	
	console.warn('[Church Page] Page not found in database, using fallback');
	const fallbackPage = {
		id: 'church',
		title: 'About EGCC',
		heroTitle: 'about egcc',
		heroImage: '/images/church-bg.jpg',
		content: '',
		sections: [],
		published: true
	};
	return { page: fallbackPage, contactInfo };
};
