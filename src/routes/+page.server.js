import { getHeroSlides, getContactInfo, getServiceTimes, getEvents, getServices, getHome } from '$lib/server/database';

export const load = async () => {
	const heroSlides = getHeroSlides();
	const contactInfo = getContactInfo();
	const serviceTimes = getServiceTimes();
	const allEvents = getEvents();
	const services = getServices().sort((a, b) => (a.order || 0) - (b.order || 0));
	// Get featured events that are published, sorted by date
	const featuredEvents = allEvents
		.filter(e => e.featured && e.published)
		.sort((a, b) => {
			const dateA = new Date(a.date || '9999-12-31');
			const dateB = new Date(b.date || '9999-12-31');
			return dateA.getTime() - dateB.getTime();
		});
	// For hero sidebar, show up to 3
	const heroEvents = featuredEvents.slice(0, 3);
	const home = getHome();
	return {
		heroSlides: heroSlides.length > 0 ? heroSlides : null,
		contactInfo,
		serviceTimes,
		services,
		featuredEvents: featuredEvents.length > 0 ? featuredEvents : [],
		heroEvents: heroEvents.length > 0 ? heroEvents : null,
		home
	};
};
