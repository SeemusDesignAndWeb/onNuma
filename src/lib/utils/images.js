/**
 * Image URL helpers: images are served from /images (volume or static/images).
 * No Cloudinary; paths are /images/... or full URLs for legacy data.
 */

/**
 * Get the full image URL. For /images/ paths returns as-is (same origin).
 * For legacy full URLs (e.g. Cloudinary) returns as-is so existing content still works.
 * @param {string} path - Image path (/images/...) or full URL
 * @returns {string}
 */
export function getImageUrl(path) {
	if (!path) return '';
	if (path.startsWith('http')) return path;
	if (path.startsWith('/images/')) return path;
	if (path.startsWith('/')) return path;
	return `/images/${path}`;
}

/**
 * Get image URL (alias for getImageUrl for compatibility).
 */
export function getOptimizedImageUrl(path, _options = {}) {
	return getImageUrl(path);
}

/**
 * Legacy: no longer used; kept for compatibility.
 */
export function optimizeCloudinaryUrl(url) {
	if (!url) return url;
	if (url.includes('cloudinary.com')) return url;
	return url;
}

/**
 * Check if URL is external (e.g. legacy Cloudinary).
 * @param {string} url
 * @returns {boolean}
 */
export function isCloudinaryUrl(url) {
	return !!url && (url.includes('cloudinary.com') || url.includes('res.cloudinary.com'));
}

/**
 * Check if path is a local/volume image path.
 * @param {string} path
 * @returns {boolean}
 */
export function isLocalImagePath(path) {
	return !!path && path.startsWith('/images/');
}
