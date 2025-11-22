# Build Prompt: SvelteKit 5 Site with Admin Area, Railway Volumes, Cloudinary, and Resend

## Overview

Build a SvelteKit 5 website with a password-protected admin area that stores all content in a JSON file. The site must be deployable to Railway with persistent data storage using volumes, integrate with Cloudinary for image management, and use Resend for email functionality.

**Design Integration**: The site supports incorporating existing HTML/CSS design themes (from templates, themes, or custom designs) and converting them to use TailwindCSS while maintaining the original design aesthetic. This includes extracting design tokens (colors, typography, spacing), configuring TailwindCSS to match, and converting HTML/CSS to TailwindCSS utilities.

## Core Requirements

### 1. Technology Stack

- **Framework**: SvelteKit 5 (latest version)
- **Adapter**: `@sveltejs/adapter-node` for Node.js deployment
- **Styling**: TailwindCSS (with support for importing existing HTML/CSS design themes)
- **Database**: Single JSON file (`database.json`)
- **Image Storage**: Cloudinary
- **Email Service**: Resend
- **Deployment**: Railway with persistent volumes

### 2. Design Theme Integration

The site should support incorporating existing HTML/CSS design themes (from templates, themes, or custom designs) and convert them to use TailwindCSS while maintaining the original design aesthetic.

#### 2.1 Design Analysis Process

When provided with an existing HTML/CSS design:

1. **Extract Design Tokens**:
   - Colors (primary, secondary, accent, text, background)
   - Typography (font families, sizes, weights, line heights)
   - Spacing (margins, padding, gaps)
   - Border radius values
   - Shadow styles
   - Breakpoints (responsive design points)
   - Animation/transition timings

2. **Identify Component Patterns**:
   - Buttons (primary, secondary, variants)
   - Cards/containers
   - Navigation styles
   - Form elements
   - Typography hierarchy
   - Layout patterns (grids, flex containers)

3. **Document Custom Styles**:
   - Any unique CSS classes or patterns
   - Vendor-specific styles (animations, effects)
   - Third-party CSS frameworks used

#### 2.2 TailwindCSS Configuration

Configure `tailwind.config.js` to match the design theme:

```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      // Extract and add custom colors from the design
      colors: {
        // Primary brand colors
        primary: '#4BB170', // Extract from design
        'primary-dark': '#3a8a56', // Darker variant
        'primary-light': '#6bc389', // Lighter variant
        
        // Secondary colors
        secondary: '#4A97D2', // Extract from design
        accent: '#E6A324', // Extract from design
        
        // Neutral colors
        'dark-gray': '#252525',
        'medium-gray': '#353535',
        'light-gray': '#757575',
        
        // Add any other colors found in the design
        // Use descriptive names that match the design's intent
      },
      
      // Extract typography from the design
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'], // Extract from design
        serif: ['Georgia', 'serif'], // If used
        mono: ['Courier New', 'monospace'], // If used
      },
      
      fontSize: {
        // Match exact font sizes from the design
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        // Add custom sizes found in the design
      },
      
      // Extract spacing values
      spacing: {
        // Add any custom spacing values that don't match Tailwind defaults
        // Tailwind defaults: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96
      },
      
      // Extract border radius values
      borderRadius: {
        // Add custom border radius values from the design
        'custom': '8px', // Example
      },
      
      // Extract box shadow values
      boxShadow: {
        // Add custom shadows from the design
        'custom': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      
      // Extract breakpoints (if different from Tailwind defaults)
      screens: {
        // Tailwind defaults: sm: '640px', md: '768px', lg: '1024px', xl: '1280px', 2xl: '1536px'
        // Override if the design uses different breakpoints
      },
    },
  },
  plugins: [],
};
```

#### 2.3 Converting HTML/CSS to TailwindCSS

**Process for converting existing HTML/CSS:**

1. **Analyze the HTML structure**:
   ```html
   <!-- Original HTML -->
   <div class="hero-section">
     <h1 class="hero-title">Welcome</h1>
     <p class="hero-subtitle">Subtitle text</p>
   </div>
   ```

2. **Extract CSS styles**:
   ```css
   /* Original CSS */
   .hero-section {
     background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%);
     padding: 60px 20px;
     text-align: center;
   }
   .hero-title {
     color: white;
     font-size: 48px;
     font-weight: bold;
     margin-bottom: 20px;
   }
   .hero-subtitle {
     color: rgba(255, 255, 255, 0.9);
     font-size: 18px;
   }
   ```

3. **Convert to TailwindCSS classes**:
   ```svelte
   <!-- Converted Svelte component -->
   <div class="bg-gradient-to-br from-primary-dark to-primary-dark/80 py-16 px-5 text-center">
     <h1 class="text-white text-5xl font-bold mb-5">Welcome</h1>
     <p class="text-white/90 text-lg">Subtitle text</p>
   </div>
   ```

**Conversion Guidelines:**

- **Colors**: Map CSS colors to TailwindCSS color classes
  - `color: #4BB170` → `text-primary`
  - `background-color: #252525` → `bg-dark-gray`
  - `rgba(255, 255, 255, 0.9)` → `text-white/90`

- **Spacing**: Convert px/em values to Tailwind spacing scale
  - `padding: 60px 20px` → `py-16 px-5` (60px ≈ 15rem = 60/4, 20px = 5rem = 20/4)
  - `margin-bottom: 20px` → `mb-5`

- **Typography**: Use Tailwind typography utilities
  - `font-size: 48px` → `text-5xl` (or custom size if needed)
  - `font-weight: bold` → `font-bold`
  - `line-height: 1.5` → `leading-normal`

- **Layout**: Convert flexbox/grid to Tailwind utilities
  - `display: flex` → `flex`
  - `justify-content: center` → `justify-center`
  - `align-items: center` → `items-center`
  - `grid-template-columns: repeat(3, 1fr)` → `grid-cols-3`

- **Effects**: Convert CSS effects to Tailwind
  - `box-shadow: 0 2px 8px rgba(0,0,0,0.1)` → `shadow-lg` or custom shadow
  - `border-radius: 8px` → `rounded-lg`
  - `transition: all 0.3s` → `transition-all duration-300`

#### 2.4 Custom CSS Layer (app.css)

For styles that don't map well to Tailwind utilities, use Tailwind's `@layer` directive:

```css
/* src/app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* Base styles matching the design */
  body {
    @apply bg-white font-sans antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-bold;
  }

  /* Match exact typography from design */
  h1 {
    @apply text-dark-gray text-5xl leading-[50px];
  }

  h2 {
    @apply text-medium-gray text-4xl pb-2.5;
  }

  /* Add any other base styles from the design */
}

@layer components {
  /* Reusable component classes matching the design */
  .btn-primary {
    @apply bg-primary text-white px-6 py-3 rounded-lg font-semibold 
           hover:bg-primary-dark transition-colors duration-300;
  }

  .btn-secondary {
    @apply bg-secondary text-white px-6 py-3 rounded-lg font-semibold 
           hover:bg-secondary/90 transition-colors duration-300;
  }

  .card {
    @apply bg-white rounded-lg shadow-lg p-6 border border-gray-200;
  }

  .section-title {
    @apply pb-10;
  }

  /* Add other component classes from the design */
}

@layer utilities {
  /* Custom utility classes if needed */
  .text-gradient {
    @apply bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary;
  }

  /* Custom animations from the design */
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 1s ease-out;
  }
}
```

#### 2.5 Handling Complex CSS

For complex CSS that's difficult to convert:

1. **CSS-in-JS or Scoped Styles**: Use Svelte's `<style>` tag for component-specific styles
   ```svelte
   <style>
     .complex-animation {
       /* Complex CSS that's hard to convert */
       animation: custom-animation 2s infinite;
     }
   </style>
   ```

2. **Import Original CSS Files**: If the design includes CSS files, import them selectively
   ```svelte
   <script>
     import '../styles/custom-animations.css';
   </script>
   ```

3. **Tailwind Arbitrary Values**: Use Tailwind's arbitrary value syntax for one-off styles
   ```svelte
   <div class="w-[350px] h-[200px] bg-[#custom-color]">
     <!-- Exact values from design -->
   </div>
   ```

#### 2.6 Design Integration Checklist

- [ ] Extract all colors and add to `tailwind.config.js`
- [ ] Extract typography (fonts, sizes, weights) and configure
- [ ] Identify and convert spacing values
- [ ] Map CSS classes to Tailwind utilities
- [ ] Create reusable component classes in `@layer components`
- [ ] Handle custom animations/effects
- [ ] Test responsive breakpoints match design
- [ ] Verify hover/focus states match design
- [ ] Ensure accessibility (contrast ratios, focus states)
- [ ] Test across browsers for consistency

#### 2.7 Example: Converting a Design Template

**Step 1: Place design files in project**
```
project-root/
  ├── design-theme/          # Original design files
  │   ├── index.html
  │   ├── styles.css
  │   ├── assets/
  │   └── ...
  └── src/
      └── ...
```

**Step 2: Analyze and extract tokens**
- Review `styles.css` for colors, fonts, spacing
- Identify component patterns
- Document breakpoints

**Step 3: Configure TailwindCSS**
- Update `tailwind.config.js` with extracted values
- Add custom colors, fonts, spacing

**Step 4: Convert HTML to Svelte components**
- Break down HTML into reusable Svelte components
- Replace CSS classes with Tailwind utilities
- Use component classes for repeated patterns

**Step 5: Test and refine**
- Compare converted design with original
- Adjust Tailwind config as needed
- Ensure responsive behavior matches

#### 2.8 Best Practices

1. **Maintain Design Fidelity**: 
   - Use exact colors, fonts, and spacing from the original design
   - Don't approximate - extract precise values

2. **Create Design System**:
   - Document all design tokens in `tailwind.config.js`
   - Use semantic color names (primary, secondary) rather than generic (blue, green)

3. **Component Reusability**:
   - Create reusable component classes in `@layer components`
   - Build Svelte components for repeated patterns

4. **Responsive Design**:
   - Match breakpoints from the original design
   - Test all responsive states

5. **Performance**:
   - Prefer Tailwind utilities over custom CSS when possible
   - Use PurgeCSS (built into Tailwind) to remove unused styles

6. **Accessibility**:
   - Ensure color contrast meets WCAG standards
   - Maintain focus states from the design
   - Test with screen readers

### 3. Data Storage Architecture

#### Database Structure

All data is stored in a single JSON file with the following structure:

```json
{
  "pages": [],
  "team": [],
  "services": [],
  "heroSlides": [],
  "images": [],
  "podcasts": [],
  "communityGroups": [],
  "events": [],
  "contact": {
    "address": "...",
    "phone": "...",
    "email": "...",
    "googleMapsUrl": "..."
  },
  "serviceTimes": {
    "sunday": "...",
    "weekday": "...",
    "notes": ""
  },
  "settings": {
    "siteName": "...",
    "primaryColor": "#4BB170",
    "podcastAuthor": "...",
    "podcastEmail": "...",
    "podcastImage": "...",
    "podcastDescription": "...",
    "teamDescription": "...",
    "teamHeroTitle": "...",
    "teamHeroImage": "...",
    "youtubePlaylistId": "",
    "youtubeChannelId": "",
    "spotifyShowUrl": ""
  },
  "home": {
    "aboutLabel": "...",
    "aboutTitle": "...",
    "aboutContent": "...",
    "aboutImage": "..."
  }
}
```

#### Database Path Configuration

- **Local Development**: `./data/database.json` (relative path)
- **Production (Railway)**: `/data/database.json` (absolute path on mounted volume)

The database module must:
1. Detect if running in production (absolute path or `NODE_ENV=production`)
2. Auto-initialize with default structure only in development
3. In production, throw an error if the database file doesn't exist (volume must be mounted)
4. Create directory structure if needed (with error handling for build-time issues)

#### Database Module Pattern

```javascript
// src/lib/server/database.js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

function getDbPath() {
  let finalPath;
  if (DB_PATH.startsWith('./') || DB_PATH.startsWith('../')) {
    // Relative path - resolve from project root (local development)
    finalPath = join(process.cwd(), DB_PATH);
  } else {
    // Absolute path (e.g., /data/database.json for Railway volumes)
    finalPath = DB_PATH;
  }

  // Ensure the directory exists
  const dir = dirname(finalPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    // Directory might already exist, or volume might not be mounted yet (during build)
    console.warn('[DB] Could not create directory:', error);
  }

  return finalPath;
}

export function readDatabase() {
  const dbPath = getDbPath();
  try {
    const data = readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production' || dbPath.startsWith('/');
    
    if (isProduction) {
      // In production, database must exist on the volume
      throw new Error(`Database file not found at ${dbPath}. Please ensure the Railway volume is mounted and the database file exists.`);
    }
    
    // Only auto-initialize in development
    console.warn('[DB] Database file does not exist (development mode), initializing with default structure...');
    try {
      writeDatabase(defaultDatabase);
      console.log('[DB] Successfully initialized database with default structure');
    } catch (writeError) {
      console.warn('[DB] Could not write to persistent location:', writeError);
      console.log('[DB] Returning default structure in memory (changes will not persist)');
    }

    return defaultDatabase;
  }
}

export function writeDatabase(data) {
  const dbPath = getDbPath();
  const dir = dirname(dbPath);

  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    console.warn('[DB] Directory creation warning:', error);
  }

  try {
    const jsonData = JSON.stringify(data, null, 2);
    writeFileSync(dbPath, jsonData, 'utf-8');
    console.log('[DB] Successfully wrote database to', dbPath);
  } catch (error) {
    console.error('[DB] Could not write database:', error);
    throw error;
  }
}

// CRUD operations for each data type (pages, team, services, etc.)
// Each should use readDatabase() and writeDatabase()
```

### 3. Railway Deployment Setup

#### Railway Configuration (`railway.json`)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node build/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

#### Railway Volume Setup

1. **Create Volume in Railway Dashboard**:
   - Name: `data-storage`
   - Mount Path: `/data`
   - This ensures data persists across deployments

2. **Environment Variables**:
   - `DATABASE_PATH=/data/database.json` (absolute path for production)
   - `ADMIN_PASSWORD=<secure-password>` (for admin authentication)
   - `CLOUDINARY_CLOUD_NAME=<your-cloud-name>`
   - `CLOUDINARY_API_KEY=<your-api-key>`
   - `CLOUDINARY_API_SECRET=<your-api-secret>`
   - `RESEND_API_KEY=<your-resend-key>`
   - `RESEND_FROM_EMAIL=<your-verified-email>`
   - `NODE_ENV=production`

#### Important Railway Considerations

- **Volume Mount Timing**: The volume is mounted at runtime, not during build. The database module must handle this gracefully.
- **Data Persistence**: All writes go to `/data/database.json` which persists on the volume.
- **Initial Database**: On first deployment, manually create `/data/database.json` on the volume or use a script to initialize it.

### 4. Cloudinary Integration

#### Setup

Install: `npm install cloudinary`

#### Configuration (`src/lib/server/cloudinary.js`)

```javascript
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';

function configureCloudinary() {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Cloudinary API credentials are missing.');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  return { cloudName, apiKey, apiSecret };
}

export async function uploadImage(file, filename, options = {}) {
  const config = configureCloudinary();
  
  const uploadOptions = {
    resource_type: 'image',
    folder: 'egcc', // or your folder name
    use_filename: false,
    unique_filename: true,
    ...options
  };

  // If file is a Buffer
  if (Buffer.isBuffer(file)) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(file);
    });
  }

  // Otherwise, upload from file path
  return await cloudinary.uploader.upload(file, uploadOptions);
}

export async function deleteImage(publicId) {
  configureCloudinary();
  return await cloudinary.uploader.destroy(publicId);
}
```

#### Image Upload API (`src/routes/api/images/+server.js`)

```javascript
import { json } from '@sveltejs/kit';
import { uploadImage, deleteImage } from '$lib/server/cloudinary';
import { saveImage, deleteImage as deleteImageFromDb, getImages } from '$lib/server/database';
import { requireAuth } from '$lib/server/auth';
import { randomUUID } from 'crypto';

export const GET = async ({ cookies }) => {
  requireAuth({ cookies });
  const images = getImages();
  return json(images);
};

export const POST = async ({ request, cookies }) => {
  requireAuth({ cookies });

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || !file.type.startsWith('image/')) {
    return json({ error: 'Invalid file' }, { status: 400 });
  }

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Cloudinary
  const uploadResult = await uploadImage(buffer, file.name, {
    public_id: `egcc/${randomUUID()}`
  });

  // Save metadata to database
  const imageMetadata = {
    id: randomUUID(),
    filename: uploadResult.public_id.split('/').pop(),
    originalName: file.name,
    path: uploadResult.secure_url,
    cloudinaryPublicId: uploadResult.public_id,
    size: file.size,
    mimeType: file.type,
    width: uploadResult.width,
    height: uploadResult.height,
    uploadedAt: new Date().toISOString()
  };

  saveImage(imageMetadata);
  return json({ success: true, image: imageMetadata });
};

export const DELETE = async ({ url, cookies }) => {
  requireAuth({ cookies });
  const id = url.searchParams.get('id');
  
  const image = getImages().find(img => img.id === id);
  if (!image) {
    return json({ error: 'Image not found' }, { status: 404 });
  }

  // Delete from Cloudinary
  if (image.cloudinaryPublicId) {
    await deleteImage(image.cloudinaryPublicId);
  }

  // Delete from database
  deleteImageFromDb(id);
  return json({ success: true });
};
```

#### Image Optimization Utilities

Create utility functions for optimizing Cloudinary URLs:

```javascript
// src/lib/utils/images.js
export function optimizeCloudinaryUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;
  
  // Check if already a Cloudinary URL
  if (!url.includes('res.cloudinary.com')) return url;
  
  // Extract transformation parameters
  const { width = 1000, quality = 'auto', format = 'auto' } = options;
  
  // Build optimized URL
  const parts = url.split('/upload/');
  if (parts.length !== 2) return url;
  
  const transformations = `w_${width},f_${format},q_${quality}`;
  return `${parts[0]}/upload/${transformations}/${parts[1]}`;
}
```

### 5. Resend Integration

#### Setup

Install: `npm install resend`

#### Configuration (`src/lib/server/resend.js`)

```javascript
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendContactEmail({
  to,
  from = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  name,
  email,
  phone,
  message,
  replyTo
}) {
  try {
    const result = await resend.emails.send({
      from: from,
      to: [to],
      replyTo: replyTo || email,
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
        </body>
        </html>
      `,
      text: `
        New Contact Form Submission from ${name}
        
        Email: ${email}
        ${phone ? `Phone: ${phone}` : ''}
        
        Message:
        ${message}
      `
    });
    
    return result;
  } catch (error) {
    console.error('Resend email error:', error);
    throw error;
  }
}

export async function sendConfirmationEmail({ to, from, name }) {
  return await resend.emails.send({
    from: from,
    to: [to],
    subject: 'Thank you for contacting us',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: sans-serif;">
        <h2>Thank you, ${name}!</h2>
        <p>We've received your message and will get back to you soon.</p>
      </body>
      </html>
    `
  });
}
```

#### Contact Form API (`src/routes/api/contact/+server.js`)

```javascript
import { json } from '@sveltejs/kit';
import { getContactInfo } from '$lib/server/database';
import { sendContactEmail, sendConfirmationEmail } from '$lib/server/resend';
import { env } from '$env/dynamic/private';

export const POST = async ({ request }) => {
  try {
    const { name, email, phone, message } = await request.json();

    // Validation
    if (!name || !email || !message) {
      return json({ error: 'Name, email, and message are required' }, { status: 400 });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Get contact email from database
    const contactInfo = getContactInfo();
    const recipientEmail = contactInfo.email;

    // Get sender email from environment
    const senderEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    // Send email to site owner
    await sendContactEmail({
      to: recipientEmail,
      from: senderEmail,
      name,
      email,
      phone,
      message
    });

    // Send confirmation email to user
    await sendConfirmationEmail({
      to: email,
      from: senderEmail,
      name
    });

    return json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return json({ error: 'Failed to send message' }, { status: 500 });
  }
};
```

### 6. Admin Area Authentication

#### Authentication Module (`src/lib/server/auth.js`)

```javascript
import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const ADMIN_SESSION_KEY = 'admin_session';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function isAuthenticated(cookies) {
  const session = cookies.get(ADMIN_SESSION_KEY);
  if (!session) return false;

  try {
    const { timestamp, hash } = JSON.parse(session);
    const now = Date.now();

    // Check if session expired
    if (now - timestamp > SESSION_DURATION) {
      cookies.delete(ADMIN_SESSION_KEY, { path: '/' });
      return false;
    }

    // Verify hash matches password
    const adminPassword = env.ADMIN_PASSWORD || 'admin';
    const expectedHash = hashPassword(adminPassword);
    return hash === expectedHash;
  } catch {
    return false;
  }
}

export function createSession(cookies, password) {
  const adminPassword = env.ADMIN_PASSWORD || 'admin';
  if (password !== adminPassword) {
    return false;
  }

  const hash = hashPassword(password);
  const session = JSON.stringify({
    timestamp: Date.now(),
    hash
  });

  cookies.set(ADMIN_SESSION_KEY, session, {
    path: '/',
    maxAge: SESSION_DURATION / 1000,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  return true;
}

export function destroySession(cookies) {
  cookies.delete(ADMIN_SESSION_KEY, { path: '/' });
}

export function requireAuth(event) {
  if (!isAuthenticated(event.cookies)) {
    throw redirect(302, '/admin/login');
  }
}

function hashPassword(password) {
  // Simple hash function (in production, consider using bcrypt)
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString();
}
```

#### Admin Layout Protection (`src/routes/admin/+layout.server.js`)

```javascript
import { redirect } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/server/auth';

export const load = async ({ cookies, url }) => {
  // Allow access to login page without authentication
  if (url.pathname === '/admin/login') {
    return {};
  }

  // Require authentication for all other admin pages
  if (!isAuthenticated(cookies)) {
    throw redirect(302, '/admin/login');
  }

  return {};
};
```

#### Login API (`src/routes/admin/login/+server.js`)

```javascript
import { json } from '@sveltejs/kit';
import { createSession } from '$lib/server/auth';

export const POST = async ({ request, cookies }) => {
  const { password } = await request.json();

  if (createSession(cookies, password)) {
    return json({ success: true });
  } else {
    return json({ error: 'Invalid password' }, { status: 401 });
  }
};
```

### 7. Admin Content API

#### Content API (`src/routes/api/content/+server.js`)

```javascript
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import {
  getPages, savePage, deletePage,
  getTeam, saveTeamMember, deleteTeamMember,
  getServices, saveService, deleteService,
  getSettings, saveSettings,
  getContactInfo, saveContactInfo,
  // ... other CRUD functions
} from '$lib/server/database';

export const GET = async ({ url, cookies }) => {
  requireAuth({ cookies });
  
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  switch (type) {
    case 'pages':
      return json(getPages());
    case 'page':
      return json(getPages().find(p => p.id === id));
    case 'team':
      return json(getTeam());
    case 'teamMember':
      return json(getTeam().find(t => t.id === id));
    case 'services':
      return json(getServices());
    case 'settings':
      return json(getSettings());
    case 'contact':
      return json(getContactInfo());
    // ... other types
    default:
      return json({ error: 'Invalid type' }, { status: 400 });
  }
};

export const POST = async ({ request, cookies }) => {
  requireAuth({ cookies });
  
  const { type, data } = await request.json();

  switch (type) {
    case 'page':
      savePage(data);
      return json({ success: true });
    case 'teamMember':
      saveTeamMember(data);
      return json({ success: true });
    case 'service':
      saveService(data);
      return json({ success: true });
    case 'settings':
      saveSettings(data);
      return json({ success: true });
    case 'contact':
      saveContactInfo(data);
      return json({ success: true });
    // ... other types
    default:
      return json({ error: 'Invalid type' }, { status: 400 });
  }
};

export const DELETE = async ({ url, cookies }) => {
  requireAuth({ cookies });
  
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');

  switch (type) {
    case 'page':
      deletePage(id);
      return json({ success: true });
    case 'teamMember':
      deleteTeamMember(id);
      return json({ success: true });
    case 'service':
      deleteService(id);
      return json({ success: true });
    // ... other types
    default:
      return json({ error: 'Invalid type' }, { status: 400 });
  }
};
```

### 8. Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build/index.js"
  },
  "dependencies": {
    "@sveltejs/adapter-node": "^5.4.0",
    "@sveltejs/kit": "^2.0.0",
    "cloudinary": "^2.8.0",
    "resend": "^6.4.2",
    "svelte": "^4.0.0"
  }
}
```

### 9. Environment Variables

#### Local Development (`.env`)

```env
DATABASE_PATH=./data/database.json
ADMIN_PASSWORD=your-secure-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

#### Production (Railway)

```env
DATABASE_PATH=/data/database.json
ADMIN_PASSWORD=<strong-production-password>
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
RESEND_API_KEY=<your-resend-key>
RESEND_FROM_EMAIL=<your-verified-email>
NODE_ENV=production
```

### 10. Key Implementation Details

#### Data Persistence Strategy

1. **Development**: Database auto-initializes if missing, writes to `./data/database.json`
2. **Production**: Database must exist on Railway volume at `/data/database.json`
3. **Volume Mounting**: Handle gracefully when volume isn't mounted during build
4. **Error Handling**: Clear error messages if database file missing in production

#### Admin Area Features

- Password-protected login page (`/admin/login`)
- Session-based authentication (7-day expiration)
- Protected routes using layout server load function
- CRUD operations for all content types
- Image picker component for selecting Cloudinary images
- Rich text editor for content editing

#### Image Management

- Upload images to Cloudinary via admin panel
- Store image metadata in database JSON
- Delete images from both Cloudinary and database
- Image optimization utilities for Cloudinary URLs
- Image picker component for selecting uploaded images

#### Email Functionality

- Contact form sends email to site owner via Resend
- Confirmation email sent to form submitter
- HTML and plain text email templates
- Error handling for domain verification issues

### 11. Deployment Checklist

- [ ] **Design Integration** (if applicable):
  - [ ] Extract design tokens from HTML/CSS theme
  - [ ] Configure TailwindCSS with extracted colors, fonts, spacing
  - [ ] Convert HTML/CSS to TailwindCSS utilities
  - [ ] Create reusable component classes
  - [ ] Test design fidelity matches original
- [ ] Create Railway project
- [ ] Create Railway volume (`data-storage`, mount at `/data`)
- [ ] Set all environment variables in Railway
- [ ] Initialize database file on volume (or use initialization script)
- [ ] Verify Cloudinary credentials
- [ ] Verify Resend domain (or use `onboarding@resend.dev` for testing)
- [ ] Deploy to Railway
- [ ] Test admin login
- [ ] Test data persistence (create content, redeploy, verify data remains)
- [ ] Test image uploads
- [ ] Test contact form emails

### 12. Important Notes

- **Railway Volumes**: Data persists across deployments when stored on volumes
- **Build vs Runtime**: Volumes are mounted at runtime, not during build
- **Database Initialization**: In production, database must exist before first read
- **Error Messages**: Provide clear error messages for missing database in production
- **Security**: Use strong admin password, secure cookies in production
- **Cloudinary**: All images stored in Cloudinary, not in git or static files
- **Resend**: Domain verification required for production email sending
- **Design Integration**: Extract exact design tokens (colors, fonts, spacing) from HTML/CSS themes and configure TailwindCSS to match. Use Tailwind utilities where possible, custom CSS layers for complex styles, and arbitrary values for one-off design elements.

This architecture ensures:
- ✅ Data persists across Railway deployments
- ✅ No database overwrites on deployment
- ✅ Scalable image storage with Cloudinary
- ✅ Reliable email delivery with Resend
- ✅ Secure admin area with session management
- ✅ Simple JSON-based data storage
- ✅ Seamless integration of existing HTML/CSS design themes with TailwindCSS
- ✅ Design fidelity maintained through precise token extraction and configuration

