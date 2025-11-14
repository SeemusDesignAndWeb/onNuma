import { getEvent, getContactInfo, getServiceTimes } from '$lib/server/database';
import { error } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const event = getEvent(params.id);
	
	if (!event) {
		throw error(404, 'Event not found');
	}
	
	const contactInfo = getContactInfo();
	const serviceTimes = getServiceTimes();
	
	return { event, contactInfo, serviceTimes };
};

