import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';

/**
 * Configure Cloudinary with current environment variables
 * Called on each upload to ensure we have the latest config
 */
function configureCloudinary() {
	const cloudName = env.CLOUDINARY_CLOUD_NAME || 'dl8kjhwjs';
	const apiKey = env.CLOUDINARY_API_KEY;
	const apiSecret = env.CLOUDINARY_API_SECRET;

	if (!apiKey || !apiSecret) {
		throw new Error('Cloudinary API credentials are missing. Please set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables.');
	}

	// Configure Cloudinary (SHA-256 required for signature validation on most accounts)
	cloudinary.config({
		cloud_name: cloudName,
		api_key: apiKey,
		api_secret: apiSecret,
		signature_algorithm: 'sha256'
	});

	return { cloudName, apiKey, apiSecret };
}

/**
 * Upload an image to Cloudinary
 * @param {Buffer|string} file - File buffer or file path
 * @param {string} filename - Original filename
 * @param {object} options - Additional upload options
 * @returns {Promise<object>} Cloudinary upload result
 */
export async function uploadImage(file, filename, options = {}) {
	try {
		// Reconfigure Cloudinary on each upload to ensure we have latest env vars
		const config = configureCloudinary();

		// Start with a clean options object, explicitly excluding problematic parameters
		// Remove any invalid parameters from the start
		const {
			filename_override,
			folder: folderOption,
			...cleanOptions
		} = options;

		// Build upload options with only valid Cloudinary parameters
		const uploadOptions = {
			resource_type: 'image',
			overwrite: false,
			...cleanOptions
		};

		// If public_id is provided and includes folder path, don't set folder separately
		if (uploadOptions.public_id && uploadOptions.public_id.includes('/')) {
			// public_id already includes folder path, ensure folder is not set
			// Explicitly remove it in case it was in cleanOptions
			delete uploadOptions.folder;
			// Also remove filename-related options when using explicit public_id
			delete uploadOptions.use_filename;
			delete uploadOptions.unique_filename;
		} else if (!uploadOptions.public_id) {
			// No public_id provided, use folder option
			uploadOptions.folder = 'egcc';
			uploadOptions.use_filename = false;
			uploadOptions.unique_filename = true;
		}

		// Ensure filename_override is never included (it's not a valid Cloudinary parameter)
		delete uploadOptions.filename_override;

		// Final cleanup - remove any remaining invalid parameters
		// Create a whitelist of valid Cloudinary upload parameters
		const validParams = [
			'resource_type', 'public_id', 'folder', 'overwrite', 'use_filename', 
			'unique_filename', 'invalidate', 'tags', 'context', 'allowed_formats',
			'format', 'transformation', 'eager', 'eager_async', 'eager_notification_url',
			'type', 'access_mode', 'discard_original_filename', 'notification_url',
			'eager_transformation', 'moderation', 'raw_convert', 'ocr', 'categorization',
			'detection', 'similarity_search', 'auto_tagging', 'background_removal',
			'upload_preset', 'phash', 'return_delete_token', 'async', 'callback'
		];

		// Filter out any parameters not in the whitelist
		const finalOptions = {};
		for (const key of Object.keys(uploadOptions)) {
			if (validParams.includes(key) || key.startsWith('_')) {
				finalOptions[key] = uploadOptions[key];
			} else {
				console.warn(`Removing invalid Cloudinary parameter: ${key}`);
			}
		}

		// Log configuration (without exposing secrets)
		console.log('Cloudinary upload config:', {
			cloudName: config.cloudName,
			hasApiKey: !!config.apiKey,
			hasApiSecret: !!config.apiSecret,
			apiKeyLength: config.apiKey?.length || 0,
			apiSecretLength: config.apiSecret?.length || 0,
			uploadOptions: JSON.stringify(finalOptions, null, 2)
		});

		// If file is a Buffer, upload from buffer
		if (Buffer.isBuffer(file)) {
			return new Promise((resolve, reject) => {
				const uploadStream = cloudinary.uploader.upload_stream(
					finalOptions,
					(error, result) => {
						if (error) {
							console.error('Cloudinary upload stream error:', error);
							console.error('Final upload options:', JSON.stringify(finalOptions, null, 2));
							console.error('Config check:', {
								cloudName: config.cloudName,
								apiKeyPrefix: config.apiKey?.substring(0, 4) + '...',
								apiSecretPrefix: config.apiSecret?.substring(0, 4) + '...'
							});
							reject(error);
						} else {
							resolve(result);
						}
					}
				);
				uploadStream.end(file);
			});
		}

		// Otherwise, upload from file path
		const result = await cloudinary.uploader.upload(file, finalOptions);
		return result;
	} catch (error) {
		console.error('Cloudinary upload error:', error);
		console.error('Error details:', {
			message: error.message,
			hasApiSecret: !!env.CLOUDINARY_API_SECRET,
			hasApiKey: !!env.CLOUDINARY_API_KEY,
			cloudName: env.CLOUDINARY_CLOUD_NAME || 'dl8kjhwjs'
		});
		throw error;
	}
}

/**
 * Delete an image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<object>} Deletion result
 */
export async function deleteImage(publicId) {
	try {
		// Extract public_id from URL if full URL is provided
		const id = publicId.includes('/') 
			? publicId.split('/').pop().split('.')[0] 
			: publicId;
		
		const result = await cloudinary.uploader.destroy(id);
		return result;
	} catch (error) {
		console.error('Cloudinary delete error:', error);
		throw error;
	}
}

/**
 * Get Cloudinary URL for an image
 * Automatically applies optimisation parameters (w_1000/f_auto/q_auto) unless overridden
 * @param {string} publicId - Cloudinary public ID
 * @param {object} options - Transformation options
 * @returns {string} Cloudinary URL with optimisation
 */
export function getImageUrl(publicId, options = {}) {
	if (!publicId) return '';
	
	// If it's already a full URL, return it (will be optimized by client-side utils)
	if (publicId.startsWith('http')) {
		return publicId;
	}

	// Extract public_id from URL if full URL is provided
	const id = publicId.includes('/') 
		? publicId.split('/').pop().split('.')[0] 
		: publicId;

	const cloudName = env.CLOUDINARY_CLOUD_NAME || 'dl8kjhwjs';
	
	// Build transformations with default optimizations
	const transformations = [];
	
	// Default optimizations (unless overridden)
	if (!options.width) transformations.push('w_1000');
	else transformations.push(`w_${options.width}`);
	
	if (!options.format) transformations.push('f_auto');
	else transformations.push(`f_${options.format}`);
	
	if (!options.quality) transformations.push('q_auto');
	else transformations.push(`q_${options.quality}`);
	
	// Add any other transformation options
	Object.entries(options).forEach(([k, v]) => {
		if (k !== 'width' && k !== 'format' && k !== 'quality' && v !== undefined) {
			transformations.push(`${k}_${v}`);
		}
	});

	const transformStr = transformations.length > 0 ? `/${transformations.join(',')}` : '';

	return `https://res.cloudinary.com/${cloudName}/image/upload${transformStr}/${id}`;
}

/**
 * Check if a URL is a Cloudinary URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
export function isCloudinaryUrl(url) {
	return url && (url.includes('cloudinary.com') || url.includes('res.cloudinary.com'));
}

/**
 * Convert local image path to Cloudinary URL if needed
 * @param {string} path - Local path or Cloudinary URL
 * @returns {string} Cloudinary URL or original path
 */
export function normalizeImageUrl(path) {
	if (!path) return '';
	
	// If already Cloudinary URL, return as is
	if (isCloudinaryUrl(path)) {
		return path;
	}

	// If it's a local path starting with /images/, we'll need to handle migration
	// For now, return as is - migration script will handle conversion
	return path;
}

