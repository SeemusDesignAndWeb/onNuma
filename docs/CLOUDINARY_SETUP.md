# Cloudinary Setup Guide

This project uses Cloudinary for image storage and delivery. All images are uploaded to and served from Cloudinary.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
CLOUDINARY_CLOUD_NAME=dl8kjhwjs
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

You can find your API credentials in your [Cloudinary Dashboard](https://console.cloudinary.com/settings/api-keys).

## Migration

To migrate existing images from local storage to Cloudinary, run:

```bash
npm run migrate-images
```

This script will:
1. Upload all images from `static/images/` to Cloudinary
2. Update the database with Cloudinary URLs
3. Migrate images referenced in pages, team members, and hero slides

## Image Upload

New images uploaded through the admin panel will automatically be uploaded to Cloudinary. The image metadata stored in the database includes:
- `path`: Cloudinary secure URL
- `cloudinaryPublicId`: Cloudinary public ID (for deletion)
- `width` and `height`: Image dimensions

## Image URLs

Images are stored in the `egcc` folder on Cloudinary. URLs follow this format:
```
https://res.cloudinary.com/dl8kjhwjs/image/upload/egcc/[public-id]
```

## Image Optimization

**Automatic Optimization**: All Cloudinary images are automatically optimized with `/w_1000/f_auto/q_auto/` parameters:
- `w_1000`: Resizes images to max width of 1000px
- `f_auto`: Automatically delivers the best format (WebP, AVIF, etc.) based on browser support
- `q_auto`: Automatically optimizes quality for best file size while maintaining visual quality

This means faster load times and significant bandwidth savings without any manual configuration!

### Utility Functions

The utility functions in `src/lib/utils/images.js` provide helpers for:
- Getting optimized image URLs (automatically includes optimization parameters)
- Optimizing existing Cloudinary URLs
- Checking if a URL is from Cloudinary
- Normalizing image URLs

**Basic Usage:**
```javascript
import { getImageUrl, optimizeCloudinaryUrl } from '$lib/utils/images';

// Automatically optimizes Cloudinary URLs
const optimizedUrl = getImageUrl(imagePath);

// Or optimize an existing Cloudinary URL
const optimizedUrl = optimizeCloudinaryUrl('https://res.cloudinary.com/.../image.jpg');
```

**Advanced Usage:**
```javascript
import { getOptimizedImageUrl } from '$lib/utils/images';

// Get optimized thumbnail with custom settings
// (still includes f_auto and q_auto unless overridden)
const thumbnailUrl = getOptimizedImageUrl(imageUrl, {
  width: 300,
  height: 300,
  crop: 'fill'
  // format and quality default to 'auto' if not specified
});
```

### Svelte Component

Use the `OptimizedImage` component for automatic optimization in your Svelte templates:

```svelte
<script>
  import OptimizedImage from '$lib/components/OptimizedImage.svelte';
</script>

<OptimizedImage 
  src={image.path} 
  alt="Description" 
  class="w-full h-auto"
/>
```

This component automatically applies Cloudinary optimization parameters to any Cloudinary URL.

