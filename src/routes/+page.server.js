import { getLanding } from '$lib/server/database';

export const load = async () => {
	const landing = getLanding();
	return { landing };
};
