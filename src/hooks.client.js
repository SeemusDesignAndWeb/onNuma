/**
 * Client-side hooks. Handle errors like failed chunk loading after deployment.
 */

/** @type {import('@sveltejs/kit').HandleClientError} */
export function handleError({ error, message }) {
	// If a chunk fails to load (usually after deployment), reload the page
	if (error instanceof TypeError && error.message?.includes('dynamically imported module')) {
		console.warn('Chunk loading failed, reloading page...', error.message);
		window.location.reload();
		return;
	}

	console.error('Client error:', message, error);
}
