/**
 * Image URL helpers. Uploaded images are served from /images/.
 */

/**
 * Get the image URL.
 * @param {string} path - Image path (/images/...) or full URL
 * @returns {string}
 */
export function getImageUrl(path) {
	if (!path) return '';
	if (path.startsWith('http')) return path;
	if (path.startsWith('/')) return path;
	return `/images/${path}`;
}

/**
 * Alias for compatibility.
 */
export function getOptimizedImageUrl(path, _options = {}) {
	return getImageUrl(path);
}
