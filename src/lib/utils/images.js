/**
 * Image URL helpers. Images are served from /uploads/ (volume or static/uploads).
 */

/**
 * Get the full image URL.
 * @param {string} path - Image path (/uploads/...) or full URL
 * @returns {string}
 */
export function getImageUrl(path) {
	if (!path) return '';
	if (path.startsWith('http')) return path;
	if (path.startsWith('/')) return path;
	return `/uploads/${path}`;
}

/**
 * Get image URL (alias for compatibility).
 */
export function getOptimizedImageUrl(path, _options = {}) {
	return getImageUrl(path);
}

/**
 * Check if path is a local upload path.
 * @param {string} path
 * @returns {boolean}
 */
export function isUploadPath(path) {
	return !!path && path.startsWith('/uploads/');
}
