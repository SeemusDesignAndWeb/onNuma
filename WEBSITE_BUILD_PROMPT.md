# Website Build Prompt for SvelteKit 5 + TailwindCSS

This prompt will guide the creation of a complete, production-ready website using SvelteKit 5 and TailwindCSS. The website will be built from scratch with full admin functionality, SEO optimization, accessibility compliance, and responsive design.

## ⚠️ CRITICAL: First Steps Before Building

**BEFORE starting the build, you MUST:**

1. **Create `.env` file with ALL required variables** (see "Creating the .env File" section)
   - This is the FIRST step - the application will not work without it
   - Copy the complete template and fill in ALL required values
   - Generate secure admin password
   - Get Cloudinary credentials
   - Get Resend API key
   - Add optional variables if using YouTube/Podcast features

2. **Complete ALL validation checks** in the "Pre-Build Validation & Bug Prevention" section
   - Code quality and build verification
   - Environment variables validation
   - Database integrity checks
   - Error handling validation
   - Security validation
   - Integration validation
   - Browser and console validation
   - Production build validation

**Failure to create the `.env` file or complete validation checks will result in bugs in production.**

## Prerequisites & Inputs Required

Before building, please provide:

### 1. **Color Palette**
Provide a primary color scheme including:
- Primary color (hex code)
- Secondary/accent colors (2-4 colors)
- Dark gray for backgrounds
- Medium gray for secondary elements
- Light gray for text/secondary content

Example format:
```
Primary: #4BB170 (Green)
Secondary Colors: #4A97D2 (Blue), #E6A324 (Yellow), #A62524 (Red)
Dark Gray: #252525
Medium Gray: #353535
Light Gray: #757575
```

### 2. **Logo SVG File**
- Provide the logo as an SVG file
- Logo should be optimized and ready to use
- Will be placed in `/static/images/logo.svg`
- Also create a color version if needed

### 3. **Content Document**
Provide a Word document or text file containing:
- **Site Name**: The full name of the organization/website
- **Site Description**: A brief description (1-2 sentences) for SEO
- **Pages Required**: List all pages needed (e.g., Home, About, Services, Team, Contact, etc.)
- **Page Content**: For each page, provide:
  - Page title
  - URL slug (e.g., "about", "services")
  - Meta description
  - Hero section content (title, subtitle, messages, buttons)
  - Main content sections
  - Any specific features needed (forms, galleries, etc.)

### 4. **Design Theme**
- Design should reflect the organization's name and purpose
- Use modern, clean design principles
- Ensure visual hierarchy and readability
- Consider the target audience

### 5. **Environment Variables** ⚠️ CRITICAL FIRST STEP

**IMPORTANT**: You MUST create a `.env` file with ALL required variables BEFORE building the application. See the "Creating the .env File" section for complete instructions.

The following environment variables will be required:
- `ADMIN_PASSWORD` - Random secure password (will be generated)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `RESEND_API_KEY` - Resend API key for email
- `DATABASE_PATH` - Path to database file (defaults to `/data/database.json` in production)
- `YOUTUBE_API_KEY` - YouTube Data API v3 key (for fetching videos)
- `YOUTUBE_CHANNEL_ID` - YouTube channel ID (optional, can use playlist instead)
- `YOUTUBE_PLAYLIST_ID` - YouTube playlist ID (optional, can use channel instead)
- `SPOTIFY_SHOW_URL` - Spotify podcast show URL (e.g., `https://open.spotify.com/show/...`)
- `PODCAST_AUTHOR` - Podcast author name (e.g., "Eltham Green Community Church")
- `PODCAST_EMAIL` - Podcast contact email (e.g., "johnawatson72@gmail.com")
- `PODCAST_IMAGE_URL` - Podcast cover image URL (e.g., "http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png")
- `PODCAST_DESCRIPTION` - Podcast description (e.g., "Latest sermons from Eltham Green Community Church")

## Technical Requirements

### Framework & Stack
- **SvelteKit 5** (latest version)
- **TailwindCSS 3.4+** for styling
- **JavaScript** (NOT TypeScript) - all files should use `.js` and `.svelte` extensions
- **Node.js** adapter for deployment
- **Vite** as the build tool

### Project Structure

```
project-root/
├── src/
│   ├── hooks.server.js          # Server hooks (loads dotenv.config())
│   ├── lib/
│   │   ├── components/          # Reusable Svelte components
│   │   │   ├── Navbar.svelte
│   │   │   ├── Footer.svelte
│   │   │   ├── Hero.svelte
│   │   │   ├── Contact.svelte
│   │   │   ├── ImagePicker.svelte
│   │   │   ├── RichTextEditor.svelte
│   │   │   ├── OptimizedImage.svelte
│   │   │   ├── VideoSection.svelte
│   │   │   ├── PodcastPlayer.svelte
│   │   │   └── ... (other components)
│   │   ├── server/
│   │   │   ├── database.js      # JSON file database operations
│   │   │   ├── auth.js          # Admin authentication
│   │   │   ├── cloudinary.js    # Cloudinary image handling
│   │   │   ├── resend.js        # Email sending via Resend
│   │   │   └── youtube.js       # YouTube API integration
│   │   └── utils/
│   ├── routes/
│   │   ├── +layout.svelte       # Root layout
│   │   ├── +page.svelte        # Home page
│   │   ├── +page.server.js     # Home page server load
│   │   ├── admin/              # Admin routes (protected)
│   │   │   ├── login/
│   │   │   ├── pages/
│   │   │   ├── team/
│   │   │   ├── services/
│   │   │   ├── settings/
│   │   │   └── ...
│   │   ├── api/                # API routes
│   │   │   ├── contact/
│   │   │   ├── upload/
│   │   │   ├── podcast-feed/   # RSS feed for podcasts
│   │   │   └── ...
│   │   ├── media/              # YouTube videos page
│   │   ├── audio/              # Podcasts page
│   │   └── [page-slugs]/       # Dynamic pages
│   ├── app.css                 # Global styles
│   └── app.html                # HTML template
├── static/
│   ├── images/                 # Static images
│   │   └── logo.svg
│   └── favicon.png
├── data/                       # Database file (local dev)
│   └── database.json
├── scripts/                    # Utility scripts
├── package.json
├── svelte.config.js
├── tailwind.config.js
├── vite.config.js
├── postcss.config.js
├── railway.json               # Railway deployment config
└── .env.example               # Example environment variables
```

## Core Features to Implement

### 1. Database System
- **File-based JSON database** stored at `/data/database.json` in production
- **Local development**: `./data/database.json` (relative path)
- **Production**: `/data/database.json` (absolute path on Railway volume)
- Database structure should include:
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
      "primaryColor": "#...",
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
    },
    "beliefs": {
      "heroTitle": "What we believe",
      "heroSubtitle": "...",
      "heroBackgroundImage": "...",
      "introTitle": "...",
      "introContent": "...",
      "sections": [
        {
          "title": "...",
          "content": "..."
        }
      ],
      "closingContent": "..."
    }
  }
  ```

- Database module (`src/lib/server/database.js`) must:
  - Auto-initialize with default structure ONLY in development
  - In production, throw error if database file doesn't exist (volume must be mounted)
  - Create directory structure if needed
  - Provide CRUD operations for all data types
  - **CRITICAL**: Include sample/initial data in default database structure:
    - At least 2-3 sample team members
    - At least 2-3 sample community groups
    - At least 2-3 sample events
    - At least 2-3 sample hero slides
    - At least 2-3 sample services/activities
    - This ensures the site has content to display on first build
    - Sample data should use placeholder images from Unsplash
    - Sample data should be realistic and demonstrate all fields

### 2. Admin Panel

#### Authentication & Access
- **Authentication**: Cookie-based session authentication
- **Login page**: `/admin/login`
- **Protected routes**: All `/admin/*` routes require authentication
- **Admin password**: Generate a random secure password and set in `.env` file
- **Session duration**: 7 days
- **Session management**: Secure HTTP-only cookies, same-site strict

#### Admin Features Overview
- Pages management (create, edit, delete pages)
- Team members management
- Services/activities management
- Events management
- Community groups management
- Hero slides management
- Image library management
- Podcast management (if applicable)
- Settings management
- Contact form submissions view

#### Required Admin Components & Functionality

**1. Rich Text Editor (HTML Editor) - Quill Integration**

**Component**: `src/lib/components/RichTextEditor.svelte`

**Features Required**:
- **Quill.js integration** (v2.0.3+) with Snow theme
- **Full toolbar** with:
  - Headings (H1-H6)
  - Text formatting: Bold, Italic, Underline, Strikethrough
  - Lists: Ordered, Bullet
  - Text alignment: Left, Center, Right, Justify
  - Text color and background color
  - Subscript and Superscript
  - Indentation controls
  - Links (with URL input)
  - Image insertion (integrated with ImagePicker)
  - Clean formatting button
- **Image insertion**: Clicking image button opens ImagePicker modal
- **Link insertion**: Clicking link button opens URL input dialog
- **HTML output**: Editor outputs clean HTML that can be stored in database
- **Two-way binding**: Supports `bind:value` for Svelte reactivity
- **Placeholder text**: Configurable placeholder
- **Customizable height**: Accepts height prop (default: 300px)
- **Content updates**: Updates parent component when content changes
- **Initial content loading**: Loads existing HTML content when editing

**Implementation Requirements**:
```javascript
// RichTextEditor.svelte must:
- Dynamically import Quill only on client side (browser check)
- Import Quill CSS (quill/dist/quill.snow.css)
- Handle image button click → open ImagePicker
- Handle link button click → prompt for URL
- Emit HTML content changes to parent
- Support loading existing HTML content
- Clean HTML output (no extra wrapper divs)
```

**Usage Example**:
```svelte
<script>
  import RichTextEditor from '$lib/components/RichTextEditor.svelte';
  let content = '<p>Initial content</p>';
</script>

<RichTextEditor bind:value={content} height="400px" placeholder="Enter page content..." />
```

**2. Image Upload & Picker Component**

**Component**: `src/lib/components/ImagePicker.svelte`

**Features Required**:
- **Cloudinary integration** for image uploads
- **Upload functionality**:
  - Drag and drop file upload
  - Click to browse file selection
  - Support for: JPG, PNG, GIF, WebP formats
  - File size validation (max 10MB recommended)
  - Image preview before upload
  - Upload progress indicator
  - Error handling for failed uploads
- **Image library display**:
  - Grid view of all uploaded images
  - Thumbnail previews
  - Image metadata display (filename, size, dimensions)
  - Search/filter functionality
  - Pagination for large image libraries
- **Image selection**:
  - Click to select image
  - Selected image highlighted
  - Returns Cloudinary URL to parent component
  - Can select from existing library or upload new
- **Modal interface**:
  - Opens as modal overlay
  - Close button (X) or click outside to close
  - Responsive design (mobile-friendly)
- **Cloudinary optimization**:
  - Automatic image optimization
  - Responsive image URLs
  - Format conversion (auto WebP when supported)

**API Endpoint Required**: `/api/upload`
- Accepts multipart/form-data
- Uploads to Cloudinary
- Returns image URL and metadata
- Stores image info in database (`database.images`)

**Implementation Requirements**:
```javascript
// ImagePicker.svelte must:
- Show upload form (drag-drop + file input)
- Display image library from database.images
- Handle file upload to /api/upload
- Show upload progress
- Update image library after upload
- Emit selected image URL to parent
- Close modal on selection or cancel
```

**Usage Example**:
```svelte
<script>
  import ImagePicker from '$lib/components/ImagePicker.svelte';
  let showImagePicker = false;
  let selectedImage = '';
  
  function handleImageSelect(url) {
    selectedImage = url;
    showImagePicker = false;
  }
</script>

{#if showImagePicker}
  <ImagePicker on:select={handleImageSelect} on:close={() => showImagePicker = false} />
{/if}
```

**3. File Upload Component (for Audio/Documents)**

**Component**: `src/lib/components/FileUpload.svelte` (if needed for podcasts/audio)

**Features Required** (if implementing podcast uploads):
- **File upload** for audio files (MP3, M4A, WAV)
- **Progress indicator** for large file uploads
- **File validation** (type, size)
- **Storage**: Upload to Cloudinary or static files
- **Database storage**: Store file URL and metadata

**4. Form Components**

**Required Form Fields**:
- **Text inputs**: Standard text, email, tel, URL inputs
- **Textarea**: Multi-line text (with character count if needed)
- **Date picker**: For events (date selection)
- **Time picker**: For events (time selection)
- **Checkbox**: For boolean fields (featured, published, etc.)
- **Select dropdown**: For categories, types, etc.
- **Color picker**: For settings (primary color selection)
- **Number input**: For order/priority fields
- **File input**: Integrated with ImagePicker/FileUpload

**5. Admin Page Components**

**Each admin page must include**:

**List/Table View**:
- Display all items in sortable table or grid
- Columns: Title, Status, Date, Actions
- Search/filter functionality
- Pagination (if many items)
- "Add New" button
- Edit/Delete actions for each item

**Form View**:
- Create/Edit form with all required fields
- Form validation (required fields, format validation)
- Save button (with loading state)
- Cancel button
- Delete button (with confirmation)
- Success/error messages
- Auto-save draft (optional but recommended)

**6. Admin Layout Components**

**Required**:
- **Admin Navbar**: Navigation between admin sections
- **Admin Sidebar**: Quick links to all admin pages
- **Breadcrumbs**: Show current location in admin
- **User info**: Display logged-in status, logout button
- **Notifications**: Success/error message display

**7. API Endpoints Required**

**Content Management**:
- `GET /api/content?type=[type]` - Get content by type
- `POST /api/content` - Save content (create/update)
- `DELETE /api/content?type=[type]&id=[id]` - Delete content

**File Upload**:
- `POST /api/upload` - Upload image/file
  - Accepts: multipart/form-data
  - Returns: `{ url, filename, size, width, height }`
  - Stores in Cloudinary
  - Adds to database.images

**Image Management**:
- `GET /api/images` - Get all images from database
- `DELETE /api/images?id=[id]` - Delete image (from Cloudinary and database)

**8. Admin UI/UX Requirements**

**Design**:
- Clean, professional admin interface
- Consistent styling across all admin pages
- Responsive design (works on tablet)
- Loading states for all async operations
- Success/error feedback for all actions
- Confirmation dialogs for destructive actions

**User Experience**:
- Auto-save drafts (prevent data loss)
- Form validation before submit
- Clear error messages
- Undo functionality (if possible)
- Keyboard shortcuts (Save: Ctrl+S)
- Quick actions (duplicate, preview)

**9. Admin Pages Implementation Checklist**

For each admin page (`/admin/[section]`), implement:

- [ ] List view showing all items
- [ ] Create new item form
- [ ] Edit existing item form
- [ ] Delete functionality with confirmation
- [ ] Rich text editor for content fields
- [ ] Image picker for image fields
- [ ] Form validation
- [ ] Save to database
- [ ] Success/error notifications
- [ ] Loading states
- [ ] Responsive design

**10. Specific Admin Pages Requirements**

**Pages Admin (`/admin/pages`)**:
- [ ] Rich text editor for page content
- [ ] Section builder (add/remove/reorder sections)
- [ ] Hero section editor (title, subtitle, image, buttons, overlay)
- [ ] Meta description editor
- [ ] URL slug editor (with validation)
- [ ] Image picker for hero images
- [ ] Preview button (optional)

**Team Admin (`/admin/team`)**:
- [ ] Image picker for team member photos
- [ ] Text fields: name, role, bio, email
- [ ] Rich text editor for bio (optional)
- [ ] Image upload/crop functionality

**Services/Activities Admin (`/admin/services`, `/admin/activities`)**:
- [ ] Image picker for service images
- [ ] Text fields: name, description, time, link
- [ ] Rich text editor for descriptions
- [ ] Order/priority field (number input)

**Events Admin (`/admin/events`)**:
- [ ] Date picker for event date
- [ ] Time picker for event time
- [ ] Image picker for event images
- [ ] Rich text editor for description
- [ ] Location field
- [ ] Featured checkbox
- [ ] Published checkbox

**Hero Slides Admin (`/admin/hero-slides`)**:
- [ ] Image picker for slide images
- [ ] Text fields: title, subtitle
- [ ] Button editor (text, link, style)
- [ ] Order/reorder functionality (drag-drop)
- [ ] Preview carousel

**Settings Admin (`/admin/settings`)**:
- [ ] Site name input
- [ ] Color picker for primary color
- [ ] Rich text editor for descriptions
- [ ] Image picker for logo/images
- [ ] YouTube settings (channel ID, playlist ID)
- [ ] Podcast settings (Spotify URL, author, email, image)
- [ ] Contact info editor
- [ ] Service times editor

**Image Library Admin (`/admin/images`)**:
- [ ] Grid view of all images
- [ ] Upload new images
- [ ] Delete images
- [ ] Search/filter images
- [ ] Image details (filename, size, dimensions, URL)
- [ ] Copy URL to clipboard

**Podcasts Admin (`/admin/podcasts`)** (if applicable):
- [ ] Audio file upload
- [ ] Text fields: title, description, speaker
- [ ] Date picker for published date
- [ ] Duration input
- [ ] Category/Series selector
- [ ] Audio player preview

**CRITICAL: Database-Driven Content Principle**
- **ALL front-end content MUST be stored in the database**
- **NO hardcoded content** in components or pages
- **Every piece of text, image, or data** displayed on the front end should come from the database
- This ensures that admin changes immediately reflect on the front end
- Components should receive all data via props from `+page.server.js` load functions
- Examples of what MUST be in database:
  - Page titles, descriptions, hero content
  - Navigation menu items
  - Footer content (address, phone, email, service times)
  - About section content
  - Service/activity descriptions
  - Team member information
  - Hero slide content
  - Settings (site name, colors, etc.)
  - Contact information
  - Any text labels or messages

### 3. Image Handling
- **Cloudinary integration** for image uploads and optimization
- **Image picker component** for selecting/uploading images in admin
- **Optimized image component** that uses Cloudinary transformations
- **Placeholder images**: Use Unsplash images as placeholders during development
  - **CRITICAL**: Use ONLY these specific, tested Unsplash URLs (do NOT use search terms or random IDs)
  - **Hero/Home Page Images**:
    - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80` (church building exterior)
    - `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&h=900&fit=crop&q=80` (community gathering)
    - `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80` (worship service)
  - **About/Church Page Images**:
    - `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&q=80` (team meeting)
    - `https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&h=900&fit=crop&q=80` (church interior)
    - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80` (community building)
  - **Team Page Images**:
    - `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&q=80` (team collaboration)
    - `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&h=900&fit=crop&q=80` (leadership meeting)
  - **Activities/Events Images**:
    - `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&h=900&fit=crop&q=80` (group activities)
    - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80` (community event)
  - **Media/Audio Page Images**:
    - `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1600&h=900&fit=crop&q=80` (audio equipment)
    - `https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop&q=80` (microphone/podcast)
  - **Contact Page Images**:
    - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80` (church location)
  - **IMPORTANT**: Always use these exact URLs with `w=1600&h=900&fit=crop&q=80` parameters
  - Replace with actual images later via admin panel
  - Never use `source.unsplash.com` or search-based URLs as they are unreliable

### 4. Email Functionality
- **Resend integration** for sending emails
- **Contact form** that sends emails via Resend
- **Email templates**: HTML and plain text versions
- **Confirmation emails**: Auto-send to form submitter

### 5. YouTube Integration
- **YouTube Data API v3** integration for fetching videos
- **Video display page** (`/media`) showing videos from channel or playlist
- **Video modal** for playing videos in a lightbox
- **Support for both channel ID and playlist ID**:
  - If channel ID is provided, fetches all videos from channel
  - If playlist ID is provided, fetches videos from specific playlist
  - Channel ID takes precedence if both are provided
- **Video information** includes:
  - Title, description, thumbnail
  - Published date, view count, duration
  - Embed URL for modal playback
- **Example EGCC settings**:
  - `YOUTUBE_API_KEY`: YouTube Data API v3 key
  - `YOUTUBE_CHANNEL_ID`: (optional) Channel ID
  - `YOUTUBE_PLAYLIST_ID`: (optional) Playlist ID

### 6. Podcast Integration
- **Podcast management** via admin panel
- **Podcast display page** (`/audio`) showing all podcasts
- **RSS feed generation** at `/api/podcast-feed` for podcast directories
- **Spotify integration** - podcasts link to Spotify show
- **Podcast player component** for audio playback
- **Podcast metadata** includes:
  - Title, description, speaker, duration
  - Published date, category, series
  - Audio URL, file size
- **RSS feed features**:
  - iTunes-compatible RSS feed
  - Includes all podcast metadata
  - Proper enclosure tags for audio files
- **Example EGCC settings**:
  - `SPOTIFY_SHOW_URL`: `https://open.spotify.com/show/7aczNe2FL8GCTxpaqM9WF1?si=9bab49974d2e48bc`
  - `PODCAST_AUTHOR`: `Eltham Green Community Church`
  - `PODCAST_EMAIL`: `johnawatson72@gmail.com`
  - `PODCAST_IMAGE_URL`: `http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png`
  - `PODCAST_DESCRIPTION`: `Latest sermons from Eltham Green Community Church`

### 7. SEO Implementation
- **Meta tags** on every page:
  - `<title>` tag with page-specific titles
  - `<meta name="description">` for each page
  - Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
  - Twitter Card tags
  - Canonical URLs
- **Structured data** (JSON-LD):
  - Organization schema
  - LocalBusiness schema (if applicable)
  - BreadcrumbList schema
  - Article schema for blog posts (if applicable)
- **Sitemap**: Generate sitemap.xml dynamically
- **Robots.txt**: Proper robots.txt file
- **Semantic HTML**: Use proper HTML5 semantic elements
- **Alt text**: All images must have descriptive alt text

### 8. Accessibility (WCAG 2.1 AA Compliance)
- **Semantic HTML**: Use proper heading hierarchy (h1, h2, h3, etc.)
- **ARIA labels**: Add ARIA labels where needed
- **Keyboard navigation**: All interactive elements must be keyboard accessible
- **Focus indicators**: Visible focus states on all focusable elements
- **Color contrast**: Ensure minimum contrast ratios (4.5:1 for text, 3:1 for UI components)
- **Alt text**: All images have descriptive alt text
- **Form labels**: All form inputs have associated labels
- **Skip links**: Add skip to main content link
- **Screen reader support**: Test with screen readers
- **Language attribute**: Set `lang` attribute on `<html>` tag
- **ARIA landmarks**: Use semantic HTML5 landmarks (header, nav, main, footer)

### 9. Responsive Design
- **Mobile-first approach**: Design for mobile, then enhance for larger screens
- **Breakpoints**: Use Tailwind's default breakpoints:
  - `sm`: 640px
  - `md`: 768px
  - `lg`: 1024px
  - `xl`: 1280px
  - `2xl`: 1536px
- **Touch-friendly**: Buttons and interactive elements minimum 44x44px
- **Responsive images**: Use responsive image techniques
- **Mobile menu**: Hamburger menu for mobile navigation
- **Test on**: iPhone, Android, iPad, Desktop (Chrome, Firefox, Safari)

### 10. Performance Optimization
- **Image optimization**: Use Cloudinary for automatic image optimization
- **Code splitting**: Leverage SvelteKit's automatic code splitting
- **Lazy loading**: Lazy load images below the fold
- **Font optimization**: Use font-display: swap for web fonts
- **Minification**: Production builds should be minified
- **CSS purging**: Tailwind should purge unused styles

## Implementation Details

### Package.json Dependencies

```json
{
  "name": "[site-name]-website",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node build/index.js"
  },
  "dependencies": {
    "cloudinary": "^2.8.0",
    "dotenv": "^17.2.3",
    "quill": "^2.0.3",
    "resend": "^6.4.2"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5.4.0",
    "@sveltejs/kit": "^2.0.0",
    "@sveltejs/vite-plugin-svelte": "^3.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "svelte": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.0.0"
  },
  "overrides": {
    "cookie": "^0.7.0",
    "esbuild": "^0.25.0"
  }
}
```

### Svelte Config

```javascript
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
	}
};

export default config;
```

### Tailwind Config

```javascript
/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Montserrat', 'sans-serif'] // Or chosen font
			},
			colors: {
				primary: '#[PRIMARY_COLOR]',
				'primary-dark': '[DARKER_SHADE]',
				'brand-[name]': '#[COLOR]',
				// Add all provided colors
				'dark-gray': '#252525',
				'medium-gray': '#353535',
				'light-gray': '#757575'
			}
		}
	},
	plugins: []
};
```

### Railway.json

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

### Environment Variables Template (.env.example)

**CRITICAL**: Create a `.env.example` file in the project root with this template. This file should be committed to git as a reference. Then create a `.env` file (which should NOT be committed) with your actual values.

**File: `.env.example`** (Template - commit to git)

```env
# ============================================
# ENVIRONMENT VARIABLES TEMPLATE
# ============================================
# Copy this file to .env and fill in your actual values
# DO NOT commit .env to git (only commit .env.example)

# ============================================
# REQUIRED VARIABLES (Must be filled in)
# ============================================

# Admin Authentication
# Generate a secure random password (see instructions below)
ADMIN_PASSWORD=CHANGE_THIS_TO_SECURE_PASSWORD

# Database Path
# Local development: ./data/database.json
# Production: /data/database.json
DATABASE_PATH=./data/database.json

# Cloudinary Configuration
# Get these from: https://cloudinary.com/console
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Resend Email Service
# Get API key from: https://resend.com/api-keys
RESEND_API_KEY=your-resend-api-key

# ============================================
# OPTIONAL VARIABLES (Only if using features)
# ============================================

# YouTube Integration (Optional)
# Get API key from: https://console.cloud.google.com/
# Enable YouTube Data API v3 in your Google Cloud project
YOUTUBE_API_KEY=your-youtube-data-api-v3-key
YOUTUBE_CHANNEL_ID=your-youtube-channel-id
YOUTUBE_PLAYLIST_ID=your-youtube-playlist-id

# Podcast Integration (Optional)
# Spotify show URL (get from your Spotify podcast show page)
SPOTIFY_SHOW_URL=https://open.spotify.com/show/your-show-id
PODCAST_AUTHOR=Your Organization Name
PODCAST_EMAIL=your-podcast-email@example.com
PODCAST_IMAGE_URL=https://your-domain.com/podcast-image.png
PODCAST_DESCRIPTION=Your podcast description

# ============================================
# NODE ENVIRONMENT
# ============================================
# Set to 'development' for local dev, 'production' for deployment
NODE_ENV=development
```

**Important Notes**: 
- **REQUIRED variables** must be filled in for the application to work:
  - `ADMIN_PASSWORD` - Generate a random secure password (minimum 16 characters, mix of uppercase, lowercase, numbers, and symbols)
  - `CLOUDINARY_*` - Required for image uploads
  - `RESEND_API_KEY` - Required for contact form emails
  - `DATABASE_PATH` - Required for database storage
- **OPTIONAL variables** can be left empty if not using those features:
  - YouTube variables (only if using YouTube integration)
  - Podcast variables (only if using podcasts)
- YouTube: Provide either `YOUTUBE_CHANNEL_ID` or `YOUTUBE_PLAYLIST_ID` (channel ID takes precedence if both are provided)
- Podcast: Update the example values with your own podcast details

### Creating the .env File

**CRITICAL FIRST STEP**: The `.env` file MUST be created before running the application. Without it, the application will not function correctly.

**Step 1: Create `.env` file in project root**

Create a new file named `.env` (with the leading dot) in the root directory of your project. This file should be in the same directory as `package.json`.

**Method 1: Manual Creation**
```bash
# In your terminal, from project root:
touch .env
# Then open .env in your text editor and add all variables
```

**Method 2: Copy from Template**
```bash
# In your terminal, from project root:
cp .env.example .env
# Then edit .env with your actual values
```

**Step 2: Add ALL Required Environment Variables**

Copy the complete `.env` template below and fill in ALL values with your actual credentials:

**Step 3: Generate Admin Password**

Generate a secure random password for `ADMIN_PASSWORD`. You can use one of these methods:

**Option A: Using Node.js (recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option B: Using OpenSSL**
```bash
openssl rand -base64 32
```

**Option C: Using an online password generator**
- Use a password generator that creates passwords with:
  - Minimum 16 characters
  - Mix of uppercase (A-Z)
  - Mix of lowercase (a-z)
  - Numbers (0-9)
  - Special symbols (!@#$%^&*)

**Step 2: Complete .env File Template**

**CRITICAL**: Copy this ENTIRE template into your `.env` file and replace ALL placeholder values with your actual credentials. Do NOT leave any variables empty if they are marked as required.

```env
# ============================================
# REQUIRED ENVIRONMENT VARIABLES
# ============================================
# Copy this entire section and fill in ALL values

# Admin Authentication (REQUIRED)
# Generate a secure random password (see Step 3 below)
ADMIN_PASSWORD=YourGeneratedSecurePassword123!@#

# Database (REQUIRED)
# Local development: use relative path
# Production: use absolute path /data/database.json
DATABASE_PATH=./data/database.json

# Cloudinary (REQUIRED - get from https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Resend (REQUIRED - get from https://resend.com/api-keys)
RESEND_API_KEY=re_your_resend_api_key_here

# ============================================
# OPTIONAL ENVIRONMENT VARIABLES
# ============================================
# Only include these if you're using the features

# YouTube Integration (OPTIONAL - only if using YouTube videos)
# Get API key from: https://console.cloud.google.com/
# Enable YouTube Data API v3 in your Google Cloud project
YOUTUBE_API_KEY=your-youtube-data-api-v3-key
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxx
YOUTUBE_PLAYLIST_ID=PLxxxxxxxxxxxxxxxxxxxxx

# Podcast Integration (OPTIONAL - only if using podcasts)
# Spotify show URL (get from your Spotify podcast show page)
SPOTIFY_SHOW_URL=https://open.spotify.com/show/7aczNe2FL8GCTxpaqM9WF1?si=9bab49974d2e48bc
PODCAST_AUTHOR=Eltham Green Community Church
PODCAST_EMAIL=johnawatson72@gmail.com
PODCAST_IMAGE_URL=http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png
PODCAST_DESCRIPTION=Latest sermons from Eltham Green Community Church

# ============================================
# NODE ENVIRONMENT
# ============================================
# Set to 'development' for local dev, 'production' for deployment
NODE_ENV=development
```

**Important Notes**:
- **REQUIRED variables** must be filled in for the application to work
- **OPTIONAL variables** can be left empty if you're not using those features
- Never commit `.env` to git (it should be in `.gitignore`)
- Keep `.env.example` in git as a template (with placeholder values)

**Step 5: Create hooks.server.js to load environment variables**

**CRITICAL**: Create `src/hooks.server.js` file to ensure environment variables are loaded on the server side:

```javascript
// src/hooks.server.js
import dotenv from 'dotenv';
import { dev } from '$app/environment';

// Load .env file in development
if (dev) {
	dotenv.config();
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// Environment variables are now available via $env/dynamic/private
	return resolve(event);
}
```

**Why this is needed**: 
- SvelteKit may not automatically load `.env` files in all scenarios
- This ensures `dotenv.config()` runs before any server code executes
- Environment variables will be available in all server-side code

**Accessing environment variables in server code**:

```javascript
// In your server files (e.g., src/lib/server/auth.js, database.js, etc.):
import { env } from '$env/dynamic/private';

// Example:
const adminPassword = env.ADMIN_PASSWORD;
const dbPath = env.DATABASE_PATH || './data/database.json';
```

**Step 6: Important Notes**

1. **Never commit `.env` to git**: Ensure `.env` is in your `.gitignore` file:
   ```
   .env
   .env.local
   .env.*.local
   ```

2. **Keep `.env.example` in git**: This serves as a template for other developers (without sensitive values)

3. **Local vs Production**:
   - **Local development**: Use `DATABASE_PATH=./data/database.json` and `NODE_ENV=development`
   - **Production (Railway)**: Set `DATABASE_PATH=/data/database.json` and `NODE_ENV=production` in Railway's environment variables

4. **Required vs Optional**:
   - **Required**: `ADMIN_PASSWORD`, `CLOUDINARY_*`, `RESEND_API_KEY`, `DATABASE_PATH`
   - **Optional**: YouTube and Podcast variables (only if using those features)

5. **Testing**: After creating `.env`, test that environment variables are loaded:
   ```bash
   npm run dev
   # Check console for any missing environment variable warnings
   ```

**Step 7: Verify .env file is working**

Create a test script to verify your environment variables are loaded:

```javascript
// test-env.js (temporary file, delete after testing)
import dotenv from 'dotenv';
dotenv.config();

console.log('Environment variables loaded:');
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? '✓ Set' : '✗ Missing');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '✗ Missing');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✓ Set' : '✗ Missing');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✓ Set' : '✗ Missing');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Missing');
console.log('DATABASE_PATH:', process.env.DATABASE_PATH || '✗ Missing');
console.log('NODE_ENV:', process.env.NODE_ENV || '✗ Missing');
```

Run: `node test-env.js`

**Quick Reference: Complete .env File Template**

For easy copying, here's the complete `.env` file template with all variables:

```env
# ============================================
# COPY THIS ENTIRE TEMPLATE TO YOUR .env FILE
# ============================================
# Replace ALL placeholder values with your actual credentials

# REQUIRED - Admin Authentication
ADMIN_PASSWORD=GENERATE_SECURE_PASSWORD_HERE

# REQUIRED - Database Path
DATABASE_PATH=./data/database.json

# REQUIRED - Cloudinary (get from https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# REQUIRED - Resend (get from https://resend.com/api-keys)
RESEND_API_KEY=re_your_resend_api_key

# OPTIONAL - YouTube (only if using YouTube videos)
YOUTUBE_API_KEY=your-youtube-api-key
YOUTUBE_CHANNEL_ID=your-channel-id
YOUTUBE_PLAYLIST_ID=your-playlist-id

# OPTIONAL - Podcast (only if using podcasts)
SPOTIFY_SHOW_URL=https://open.spotify.com/show/your-show-id
PODCAST_AUTHOR=Your Organization Name
PODCAST_EMAIL=your-email@example.com
PODCAST_IMAGE_URL=https://your-domain.com/podcast-image.png
PODCAST_DESCRIPTION=Your podcast description

# REQUIRED - Node Environment
NODE_ENV=development
```

**Checklist for .env File Creation**:
- [ ] `.env` file created in project root
- [ ] `ADMIN_PASSWORD` generated and added (16+ characters)
- [ ] `CLOUDINARY_CLOUD_NAME` added
- [ ] `CLOUDINARY_API_KEY` added
- [ ] `CLOUDINARY_API_SECRET` added
- [ ] `RESEND_API_KEY` added
- [ ] `DATABASE_PATH` set to `./data/database.json` (for local dev)
- [ ] `NODE_ENV` set to `development` (for local dev)
- [ ] Optional variables added if using YouTube/Podcast features
- [ ] `.env` added to `.gitignore`
- [ ] `.env.example` created (template for git)
- [ ] Test script confirms all variables load correctly

## Component Structure

### Key Components to Build

1. **Navbar.svelte**
   - Responsive navigation
   - Mobile hamburger menu
   - Logo integration
   - Active link highlighting
   - Smooth scroll for anchor links

2. **Footer.svelte**
   - Contact information
   - Social media links (if applicable)
   - Copyright information
   - Service times
   - Links to important pages

3. **Hero.svelte**
   - Full-width hero section
   - Image background with overlay
   - Rotating messages (if applicable)
   - Call-to-action buttons
   - Responsive design

4. **Contact.svelte**
   - Contact form
   - Form validation
   - Email sending via Resend
   - Google Maps integration (if applicable)
   - Contact information display

5. **RichTextEditor.svelte** ⚠️ **REQUIRED ADMIN COMPONENT**
   - Quill.js integration (v2.0.3+) with Snow theme
   - Full toolbar: headings, formatting, lists, colors, alignment, links, images
   - Image insertion via ImagePicker integration
   - Link insertion with URL dialog
   - HTML output for database storage
   - Two-way binding support (`bind:value`)
   - Configurable height and placeholder
   - **MUST be included in all admin forms that need rich text editing**

6. **ImagePicker.svelte** ⚠️ **REQUIRED ADMIN COMPONENT**
   - Cloudinary image upload integration
   - Drag-and-drop file upload
   - Image library display (grid view with thumbnails)
   - Image selection functionality
   - Upload progress indicator
   - Search/filter images
   - Modal interface
   - Returns Cloudinary URL to parent component
   - **MUST be included in all admin forms that need image selection**

7. **FileUpload.svelte** (if podcasts/audio needed)
   - Audio file upload (MP3, M4A, WAV)
   - File validation and progress
   - Storage integration

7. **OptimizedImage.svelte**
   - Cloudinary image optimization
   - Responsive image loading
   - Lazy loading
   - Placeholder support

8. **VideoSection.svelte**
   - Display grid of YouTube videos
   - Video thumbnail cards
   - Video modal/lightbox for playback
   - Pagination support
   - Responsive grid layout

9. **PodcastPlayer.svelte**
   - Audio player for podcasts
   - Play/pause controls
   - Progress bar
   - Duration display
   - Spotify link integration

## Page Structure

### Home Page (`/`)
- Hero section with slides
- About section
- Services/features section
- Call-to-action sections
- Contact section preview

### Dynamic Pages
- Each page from the content document should be created
- Pages should be editable via admin panel
- Pages should support:
  - Hero section (title, subtitle, messages, buttons, image, overlay)
  - Multiple content sections (text, columns, images, etc.)
  - SEO meta tags
  - Structured data

### Admin Pages
- `/admin/login` - Login page
- `/admin/pages` - Pages management
- `/admin/team` - Team members management
- `/admin/services` - Services management
- `/admin/hero-slides` - Hero slides management
- `/admin/images` - Image library
- `/admin/podcasts` - Podcast management
- `/admin/settings` - Site settings (includes YouTube and podcast configuration)

### Media Pages
- `/media` - YouTube videos page (displays videos from channel or playlist)
- `/audio` - Podcasts page (displays all podcasts with player)

### API Routes

**Content Management**:
- `/api/content` - Content CRUD operations
  - `GET /api/content?type=[type]` - Get content by type (pages, team, services, etc.)
  - `POST /api/content` - Create or update content
    - Body: `{ type: 'page'|'team'|'service'|'event'|..., data: {...} }`
  - `DELETE /api/content?type=[type]&id=[id]` - Delete content

**Public Endpoints**:
- `/api/team` - Public team API endpoint
  - `GET /api/team?limit=[number]` - Get all team members (public, no auth required)
  - Returns: `{ team: [...] }`
  - Sorts by `order` field
  - Optional `limit` query parameter

- `/api/beliefs` - Beliefs page content
  - `GET /api/beliefs` - Get beliefs content (public, no auth required)
  - `POST /api/beliefs` - Update beliefs content (requires authentication)

**File Upload**:
- `/api/upload` - Image/file upload endpoint (Cloudinary)
  - Method: POST
  - Content-Type: multipart/form-data
  - Accepts: image files (JPG, PNG, GIF, WebP)
  - Returns: `{ url: string, filename: string, size: number, width: number, height: number }`
  - Uploads to Cloudinary
  - Stores metadata in `database.images`
  - Requires authentication

**Image Management**:
- `/api/images` - Image library management
  - `GET /api/images` - Get all images from database
  - `DELETE /api/images?id=[id]` - Delete image (from Cloudinary and database)
  - Requires authentication

**Contact**:
- `/api/contact` - Contact form submission endpoint
  - Method: POST
  - Body: `{ name, email, phone, message }`
  - Sends email via Resend
  - Returns success/error response

**Podcast Feed**:
- `/api/podcast-feed` - RSS feed for podcasts (iTunes-compatible)
  - Method: GET
  - Returns: RSS XML feed
  - Public endpoint (no authentication)

**Authentication** (if needed):
- `/api/auth/login` - Admin login endpoint
  - Method: POST
  - Body: `{ password: string }`
  - Sets session cookie
  - Returns success/error

- `/api/auth/logout` - Admin logout endpoint
  - Method: POST
  - Clears session cookie

## Database Operations

### CRUD Functions Needed

For each data type (pages, team, services, etc.), create:
- `get[Type]()` - Get all items
- `get[Type](id)` - Get single item by ID
- `save[Type](item)` - Create or update item
- `delete[Type](id)` - Delete item

### Database-Driven Content Architecture

**CRITICAL REQUIREMENT**: All front-end content must be database-driven. Follow these patterns:

**1. Page Components Pattern**:
```javascript
// src/routes/+page.server.js
import { getHeroSlides, getServices, getHome, getContactInfo } from '$lib/server/database';

export const load = async () => {
	return {
		heroSlides: getHeroSlides(),
		services: getServices(),
		home: getHome(), // All home page content
		contactInfo: getContactInfo()
	};
};
```

```svelte
<!-- src/routes/+page.svelte -->
<script>
	export let data; // All data comes from +page.server.js
</script>

<!-- Use data from database, never hardcode -->
<h1>{data.home.aboutTitle}</h1>
<p>{@html data.home.aboutContent}</p>
```

**2. Component Props Pattern**:
```svelte
<!-- src/lib/components/Footer.svelte -->
<script>
	export let contactInfo; // From database
	export let serviceTimes; // From database
	export let settings; // From database
</script>

<!-- All content from props, never hardcoded -->
<address>{contactInfo.address}</address>
<p>{serviceTimes.sunday}</p>
```

**3. Navigation Pattern**:
```javascript
// Load navigation items from database
const navItems = getPages().filter(p => p.showInNav);
```

**4. Settings Pattern**:
```javascript
// All site-wide settings from database
const settings = getSettings();
const siteName = settings.siteName; // Never hardcode
const primaryColor = settings.primaryColor; // From database
```

**5. Checklist for Database-Driven Content**:
- [ ] No hardcoded text in components (use props/data)
- [ ] No hardcoded images (use database image URLs)
- [ ] Navigation menu items from database
- [ ] Footer content from database
- [ ] Page titles and meta descriptions from database
- [ ] Hero content from database
- [ ] Service/activity descriptions from database
- [ ] Team member info from database
- [ ] Contact information from database
- [ ] Settings (colors, site name) from database
- [ ] All labels and messages editable via admin

**6. Admin Changes Reflection**:
- When admin updates content, it should immediately appear on front end
- No need to rebuild or redeploy for content changes
- All CRUD operations update the database file
- Front-end pages read from database on each request
- Changes are live immediately after saving in admin panel

### Database Path Logic

```javascript
const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

function getDbPath() {
	let finalPath;
	if (DB_PATH.startsWith('./') || DB_PATH.startsWith('../')) {
		// Relative path - local development
		finalPath = join(process.cwd(), DB_PATH);
	} else {
		// Absolute path - production (Railway volume)
		finalPath = DB_PATH;
	}
	
	// Ensure directory exists
	const dir = dirname(finalPath);
	mkdirSync(dir, { recursive: true });
	
	return finalPath;
}
```

### Default Database Initialization with Sample Data

**CRITICAL**: The default database structure MUST include sample data for teams, community groups, and events. This ensures the site has content to display on first build and demonstrates all functionality.

**Required Sample Data**:

1. **Team Members** (minimum 2-3 sample entries):
```javascript
team: [
  {
    id: 'team-1',
    name: 'John Smith',
    role: 'Lead Pastor',
    bio: 'John has been serving as Lead Pastor for over 10 years...',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
    email: 'john@example.com',
    order: 1
  },
  {
    id: 'team-2',
    name: 'Jane Doe',
    role: 'Worship Leader',
    bio: 'Jane leads our worship team with passion and dedication...',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80',
    email: 'jane@example.com',
    order: 2
  }
  // Add at least one more team member
]
```

2. **Community Groups** (minimum 2-3 sample entries):
```javascript
communityGroups: [
  {
    id: 'group-1',
    name: 'Sunday Morning Bible Study',
    description: 'Join us every Sunday morning for an in-depth study of God\'s Word...',
    day: 'Sunday',
    time: '9:00 AM',
    location: 'Main Hall',
    contact: 'biblestudy@example.com',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=600&fit=crop&q=80',
    order: 1
  },
  {
    id: 'group-2',
    name: 'Youth Group',
    description: 'A vibrant community for teenagers to grow in faith and friendship...',
    day: 'Friday',
    time: '7:00 PM',
    location: 'Youth Room',
    contact: 'youth@example.com',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80',
    order: 2
  }
  // Add at least one more community group
]
```

3. **Events** (minimum 2-3 sample entries):
```javascript
events: [
  {
    id: 'event-1',
    title: 'Community Picnic',
    description: 'Join us for a fun-filled community picnic in the park...',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    time: '12:00 PM',
    location: 'Community Park',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop&q=80',
    featured: true,
    published: true,
    order: 1
  },
  {
    id: 'event-2',
    title: 'Worship Night',
    description: 'An evening of worship, prayer, and fellowship...',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days from now
    time: '7:00 PM',
    location: 'Main Sanctuary',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop&q=80',
    featured: false,
    published: true,
    order: 2
  }
  // Add at least one more event
]
```

4. **Hero Slides** (minimum 2-3 sample entries):
```javascript
heroSlides: [
  {
    id: 'slide-1',
    title: 'Welcome to Our Community',
    subtitle: 'Join us this Sunday',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80',
    buttonText: 'Learn More',
    buttonLink: '/im-new',
    order: 1
  },
  {
    id: 'slide-2',
    title: 'Growing Together in Faith',
    subtitle: 'Discover what we believe',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80',
    buttonText: 'Our Beliefs',
    buttonLink: '/about/beliefs',
    order: 2
  }
  // Add at least one more hero slide
]
```

5. **Services/Activities** (minimum 2-3 sample entries):
```javascript
services: [
  {
    id: 'service-1',
    name: 'Sunday Worship',
    description: 'Join us every Sunday for inspiring worship and teaching...',
    time: '11:00 AM',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop&q=80',
    order: 1
  },
  {
    id: 'service-2',
    name: 'Children\'s Ministry',
    description: 'Engaging programs for children of all ages...',
    time: '11:00 AM',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80',
    order: 2
  }
  // Add at least one more service
]
```

**Implementation in `src/lib/server/database.js`**:

```javascript
const defaultDatabase = {
  pages: [],
  team: [
    // Include sample team members as shown above
  ],
  services: [
    // Include sample services as shown above
  ],
  heroSlides: [
    // Include sample hero slides as shown above
  ],
  images: [],
  podcasts: [],
  communityGroups: [
    // Include sample community groups as shown above
  ],
  events: [
    // Include sample events as shown above
  ],
  contact: {
    address: '123 Main Street, City, State 12345',
    phone: '(555) 123-4567',
    email: 'info@example.com',
    googleMapsUrl: 'https://maps.google.com/...'
  },
  serviceTimes: {
    sunday: '11:00 AM',
    weekday: 'Various times - see Community Groups',
    notes: ''
  },
  settings: {
    siteName: '[Site Name]',
    primaryColor: '#4BB170',
    // ... other settings
  },
  home: {
    aboutLabel: 'Our Story',
    aboutTitle: 'Welcome to [Site Name]',
    aboutContent: '<p>Welcome to our community...</p>',
    aboutImage: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80'
  },
  beliefs: {
    // ... beliefs structure
  }
};
```

**Important Notes**:
- All sample data should use valid Unsplash image URLs (use the provided URLs)
- Sample data should be realistic and demonstrate all available fields
- IDs should be unique (use format: `team-1`, `group-1`, `event-1`, etc.)
- Dates should be future dates (for events)
- All required fields should be populated
- Sample data can be edited/deleted via admin panel after build

### Default Unsplash Images for Initial Database

When initializing the database with default structure, use these specific Unsplash URLs:

```javascript
const defaultImages = {
	heroImage: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80',
	aboutImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&q=80',
	teamHeroImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&h=900&fit=crop&q=80',
	mediaHeroImage: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1600&h=900&fit=crop&q=80',
	audioHeroImage: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop&q=80',
	contactHeroImage: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80'
};
```

**IMPORTANT**: These are real, tested Unsplash URLs. Do NOT use search terms or random photo IDs.

## YouTube & Podcast Server Implementation

### YouTube Server Module (`src/lib/server/youtube.js`)

Create a YouTube API integration module with the following functions:

```javascript
// Functions to implement:
- getChannelVideos(channelId, maxResults) - Fetch videos from a channel
- getChannelInfo(channelId) - Get channel information
- getPlaylistVideos(playlistId, maxResults) - Fetch videos from a playlist
- getPlaylistInfo(playlistId) - Get playlist information
- parseDuration(isoDuration) - Parse ISO 8601 duration format
```

**Key Features**:
- Uses YouTube Data API v3
- Reads `YOUTUBE_API_KEY` from environment variables
- Supports both channel ID and playlist ID
- Returns video objects with: id, title, description, thumbnail, publishedAt, duration, viewCount, url, embedUrl
- Handles errors gracefully with user-friendly messages

**Example Usage**:
```javascript
import { getChannelVideos, getPlaylistVideos } from '$lib/server/youtube';

// Fetch from channel
const videos = await getChannelVideos('UC...', 50);

// Or fetch from playlist
const videos = await getPlaylistVideos('PL...', 50);
```

### Podcast RSS Feed API (`src/routes/api/podcast-feed/+server.js`)

Create an RSS feed endpoint that:
- Generates iTunes-compatible RSS feed
- Includes all podcast metadata
- Properly formats dates (RFC 822 format)
- Includes enclosure tags for audio files
- Supports both relative and absolute audio URLs
- Uses settings from database for feed metadata

**Feed Structure**:
- Channel metadata from settings (title, description, author, email, image)
- Each podcast as an RSS item with:
  - Title, description, author, email
  - Published date
  - Duration
  - Audio enclosure (URL, length, type)
  - Category and iTunes categories
  - GUID for uniqueness

**Example EGCC Feed Settings**:
- Title: Site name from settings
- Description: Podcast description from settings
- Author: Podcast author from settings
- Email: Podcast email from settings
- Image: Podcast image URL from settings

## SEO Implementation Checklist

- [ ] Unique `<title>` tag on every page
- [ ] Meta description on every page
- [ ] Open Graph tags (og:title, og:description, og:image, og:url)
- [ ] Twitter Card tags
- [ ] Canonical URLs
- [ ] Structured data (JSON-LD) for Organization
- [ ] Structured data for LocalBusiness (if applicable)
- [ ] Breadcrumb structured data
- [ ] Sitemap.xml generation
- [ ] Robots.txt file
- [ ] Semantic HTML5 elements
- [ ] Proper heading hierarchy
- [ ] Alt text on all images

## Accessibility Checklist

- [ ] Semantic HTML5 elements (header, nav, main, footer, article, section)
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] ARIA labels where needed
- [ ] Keyboard navigation for all interactive elements
- [ ] Visible focus indicators
- [ ] Color contrast meets WCAG AA standards (4.5:1 for text, 3:1 for UI)
- [ ] Alt text on all images
- [ ] Form labels for all inputs
- [ ] Skip to main content link
- [ ] Language attribute on html tag
- [ ] ARIA landmarks
- [ ] Screen reader testing

## Responsive Design Checklist

- [ ] Mobile-first CSS approach
- [ ] Responsive navigation (hamburger menu on mobile)
- [ ] Touch-friendly buttons (minimum 44x44px)
- [ ] Responsive images
- [ ] Responsive typography
- [ ] Tested on multiple devices
- [ ] No horizontal scrolling on mobile
- [ ] Readable text sizes on mobile

## Deployment Setup

### Railway Configuration

1. **Volume Setup**:
   - Create a volume named `data` in Railway
   - Mount it at `/data`
   - The database file will be stored at `/data/database.json`

2. **Environment Variables**:
   - Set all required environment variables in Railway dashboard
   - `ADMIN_PASSWORD` should be set to the generated random password
   - `DATABASE_PATH` should be `/data/database.json`

3. **Build & Deploy**:
   - Railway will automatically build using `npm run build`
   - Start command: `node build/index.js`
   - Ensure Node.js version is compatible (check package.json engines if needed)

## Pre-Build Validation & Bug Prevention

**CRITICAL**: Before considering the build complete, perform ALL of these validation checks to minimize bugs:

### 1. Code Quality & Build Verification

**Build Checks**:
- [ ] `npm run build` completes without errors
- [ ] `npm run preview` starts successfully
- [ ] No TypeScript errors (even though using JavaScript)
- [ ] No ESLint errors (if ESLint is configured)
- [ ] No console warnings during build
- [ ] All imports resolve correctly
- [ ] No missing dependencies
- [ ] Production build size is reasonable (< 5MB for initial load)

**Code Validation**:
- [ ] All JavaScript files use `.js` extension (not `.ts`)
- [ ] All Svelte files use `.svelte` extension
- [ ] No unused imports
- [ ] No undefined variables
- [ ] All functions are properly exported/imported
- [ ] No circular dependencies

**File Structure Validation**:
- [ ] `hooks.server.js` exists and loads `dotenv.config()`
- [ ] All required components exist in `src/lib/components/`
- [ ] All required server modules exist in `src/lib/server/`
- [ ] All API routes exist in `src/routes/api/`
- [ ] All admin pages exist in `src/routes/admin/`
- [ ] `.env.example` file exists
- [ ] `.gitignore` includes `.env`

### 2. Environment Variables Validation

**File Existence Check**:
- [ ] `.env` file exists in project root (same directory as `package.json`)
- [ ] `.env.example` file exists (template for reference)
- [ ] `.env` is listed in `.gitignore` (not committed to git)
- [ ] `.env.example` is NOT in `.gitignore` (should be committed)

**Required Variables Check**:
- [ ] `ADMIN_PASSWORD` is set and secure (16+ characters)
- [ ] `ADMIN_PASSWORD` is not a placeholder (not "CHANGE_THIS" or "your-password")
- [ ] `CLOUDINARY_CLOUD_NAME` is set and not placeholder
- [ ] `CLOUDINARY_API_KEY` is set and not placeholder
- [ ] `CLOUDINARY_API_SECRET` is set and not placeholder
- [ ] `RESEND_API_KEY` is set and not placeholder
- [ ] `DATABASE_PATH` is set correctly (`./data/database.json` for dev, `/data/database.json` for prod)
- [ ] `NODE_ENV` is set (development/production)

**Optional Variables Check** (if features are used):
- [ ] `YOUTUBE_API_KEY` is set (if YouTube integration used)
- [ ] `YOUTUBE_CHANNEL_ID` or `YOUTUBE_PLAYLIST_ID` is set (if YouTube used)
- [ ] `SPOTIFY_SHOW_URL` is set (if podcasts used)
- [ ] `PODCAST_*` variables are set (if podcasts used)

**Environment Variable Loading**:
- [ ] `hooks.server.js` properly loads environment variables
- [ ] Environment variables accessible in server code via `$env/dynamic/private`
- [ ] No "undefined" values in production
- [ ] Test script confirms all required variables are loaded

### 3. Database Integrity Checks

**Database Structure Validation**:
- [ ] Database file exists at correct path
- [ ] Database JSON is valid (no syntax errors)
- [ ] All required top-level keys exist:
  - [ ] `pages`, `team`, `services`, `heroSlides`, `images`
  - [ ] `podcasts`, `communityGroups`, `events` (if applicable)
  - [ ] `contact`, `serviceTimes`, `settings`, `home`
  - [ ] `beliefs` (if beliefs page implemented)
- [ ] Default database structure initializes correctly in development
- [ ] **Sample data exists in default database**:
  - [ ] At least 2-3 sample team members in `team` array
  - [ ] At least 2-3 sample community groups in `communityGroups` array
  - [ ] At least 2-3 sample events in `events` array
  - [ ] At least 2-3 sample hero slides in `heroSlides` array
  - [ ] At least 2-3 sample services in `services` array
- [ ] Database read/write operations work without errors
- [ ] Sample data displays correctly on front-end pages

**Database Function Validation**:
- [ ] All CRUD functions exist for each data type
- [ ] `get[Type]()` functions return correct data
- [ ] `save[Type]()` functions write to database correctly
- [ ] `delete[Type]()` functions remove data correctly
- [ ] Database path resolution works (relative in dev, absolute in production)
- [ ] Database directory is created if it doesn't exist

**Data Validation**:
- [ ] No null/undefined values break front-end rendering
- [ ] Empty arrays handled gracefully
- [ ] Missing optional fields don't cause errors
- [ ] Date fields are properly formatted
- [ ] Image URLs are valid (not broken)

### 4. Error Handling Validation

**Server-Side Error Handling**:
- [ ] All API endpoints have try-catch blocks
- [ ] Error responses return proper HTTP status codes
- [ ] Error messages are user-friendly (not exposing internals)
- [ ] Database errors are caught and handled
- [ ] File upload errors are caught and handled
- [ ] External API errors (Cloudinary, Resend, YouTube) are handled

**Client-Side Error Handling**:
- [ ] Form validation prevents invalid submissions
- [ ] Network errors show user-friendly messages
- [ ] Missing data doesn't crash components
- [ ] Image loading errors show fallbacks
- [ ] RichTextEditor handles empty content
- [ ] ImagePicker handles upload failures

**Edge Cases**:
- [ ] Empty database (no data) doesn't crash site
- [ ] Missing environment variables show clear errors
- [ ] Invalid JSON in database is handled
- [ ] Very long content doesn't break layout
- [ ] Special characters in content don't break rendering
- [ ] Empty arrays/objects are handled in loops

### 5. Console & Browser Validation

**Console Error Checks**:
- [ ] No JavaScript errors in browser console
- [ ] No 404 errors for missing assets
- [ ] No CORS errors
- [ ] No network errors (except intentional)
- [ ] No React/Svelte warnings
- [ ] No hydration mismatches (if applicable)

**Browser Compatibility**:
- [ ] Site works in Chrome (latest)
- [ ] Site works in Firefox (latest)
- [ ] Site works in Safari (latest)
- [ ] Site works in Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

**Performance Checks**:
- [ ] Page load time < 3 seconds on 3G
- [ ] No layout shift (CLS)
- [ ] Images lazy load correctly
- [ ] No memory leaks (check with DevTools)
- [ ] Bundle size is optimized

### 6. Security Validation

**Authentication Security**:
- [ ] Admin password is not hardcoded
- [ ] Session cookies are HTTP-only
- [ ] Session cookies are secure in production
- [ ] Session expiration works correctly
- [ ] Protected routes require authentication
- [ ] Logout clears session properly

**Input Validation**:
- [ ] All user inputs are sanitized
- [ ] SQL injection not possible (using JSON database)
- [ ] XSS prevention (HTML content sanitized)
- [ ] File uploads validate file types
- [ ] File uploads validate file sizes
- [ ] URL slugs are sanitized

**API Security**:
- [ ] Admin endpoints require authentication
- [ ] Public endpoints don't expose sensitive data
- [ ] CORS is configured correctly
- [ ] Rate limiting considered (if needed)

### 7. Integration Validation

**Component Integration**:
- [ ] RichTextEditor integrates with ImagePicker
- [ ] ImagePicker integrates with Cloudinary
- [ ] All components receive correct props
- [ ] Components handle missing props gracefully
- [ ] Event handlers work correctly
- [ ] Two-way binding works correctly

**API Integration**:
- [ ] Cloudinary uploads work
- [ ] Resend emails send successfully
- [ ] YouTube API fetches videos (if configured)
- [ ] Database operations complete successfully
- [ ] All API endpoints return correct data formats

**Page Integration**:
- [ ] All pages load data from `+page.server.js`
- [ ] Data flows correctly from server to client
- [ ] Navigation between pages works
- [ ] Page state persists correctly
- [ ] Forms submit and save correctly

### 8. Form Validation Checks

**All Admin Forms**:
- [ ] Required fields are marked and validated
- [ ] Email fields validate email format
- [ ] URL fields validate URL format
- [ ] Date fields validate date format
- [ ] Number fields validate number format
- [ ] File uploads validate file type and size
- [ ] Form submission shows loading state
- [ ] Success messages display correctly
- [ ] Error messages display correctly
- [ ] Form resets after successful submission (if needed)

**Contact Form**:
- [ ] All fields validate correctly
- [ ] Email sends successfully
- [ ] Confirmation email sends (if implemented)
- [ ] Form prevents spam (if implemented)
- [ ] Form clears after submission

### 9. Image & Media Validation

**Image Handling**:
- [ ] All images load without 404 errors
- [ ] Image URLs are valid (test each one)
- [ ] Cloudinary URLs are properly formatted
- [ ] Image optimization works (responsive sizes)
- [ ] Alt text is present on all images
- [ ] Lazy loading works correctly
- [ ] Image picker displays all uploaded images
- [ ] Image upload progress shows correctly

**Media Integration**:
- [ ] YouTube videos embed correctly (if configured)
- [ ] Video modal/lightbox works
- [ ] Podcast audio plays (if implemented)
- [ ] Spotify links work (if configured)

### 10. Database-Driven Content Validation

**Content Source Checks**:
- [ ] NO hardcoded text in components
- [ ] NO hardcoded images in components
- [ ] All content comes from database
- [ ] All content is editable via admin
- [ ] Admin changes reflect on front-end immediately
- [ ] Default content exists in database

**Sample Data Display Checks**:
- [ ] Team page (`/team`) displays sample team members
- [ ] Community groups page displays sample groups
- [ ] Events appear on home page (if featured) or events page
- [ ] Hero slides display on home page carousel
- [ ] Services display on home page services section
- [ ] All sample data images load correctly
- [ ] All sample data has valid, complete information
- [ ] No empty arrays cause layout issues

**Content Structure Checks**:
- [ ] All pages have required fields
- [ ] All team members have required fields
- [ ] All services have required fields
- [ ] All events have required fields (if applicable)
- [ ] Settings object has all required fields

### 11. Route & Navigation Validation

**Route Checks**:
- [ ] All routes are accessible
- [ ] 404 page exists for invalid routes
- [ ] Route parameters work correctly
- [ ] Query parameters work correctly
- [ ] Redirects work correctly

**Navigation Checks**:
- [ ] Navigation menu displays correctly
- [ ] Active page is highlighted
- [ ] Mobile menu works
- [ ] Footer links work
- [ ] Breadcrumbs work (if implemented)

### 12. Production Build Validation

**Build Artifacts**:
- [ ] `build/` directory is created
- [ ] `build/client/` contains front-end assets
- [ ] `build/server/` contains server code
- [ ] `build/index.js` exists and is executable
- [ ] No source maps in production (or properly configured)

**Production Environment**:
- [ ] `NODE_ENV=production` is set
- [ ] Database path is absolute (`/data/database.json`)
- [ ] Environment variables are set in Railway/deployment platform
- [ ] Volume is mounted correctly (if using Railway)
- [ ] Application starts with `node build/index.js`

### 13. Automated Validation Script

Create a validation script to run before deployment:

```javascript
// scripts/validate-build.js
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load .env file if it exists
if (existsSync('.env')) {
  dotenv.config();
}

const errors = [];
const warnings = [];

// Check .env file exists
function checkEnvFile() {
  const envPath = '.env';
  if (!existsSync(envPath)) {
    errors.push(`.env file not found! Create .env file in project root with all required variables.`);
    errors.push(`See "Creating the .env File" section in the prompt for instructions.`);
    return false;
  }
  return true;
}

// Check environment variables
function checkEnvVars() {
  if (!checkEnvFile()) {
    return; // Don't check variables if .env file doesn't exist
  }
  
  const required = ['ADMIN_PASSWORD', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY'];
  required.forEach(key => {
    if (!process.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
      errors.push(`Add ${key} to your .env file.`);
    } else if (process.env[key].includes('your-') || process.env[key].includes('CHANGE_THIS')) {
      errors.push(`Environment variable ${key} appears to be a placeholder. Replace with actual value.`);
    }
  });
  
  // Check for placeholder values
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 16) {
    warnings.push(`ADMIN_PASSWORD should be at least 16 characters for security.`);
  }
}

// Check database structure
function checkDatabase() {
  const dbPath = process.env.DATABASE_PATH || './data/database.json';
  if (!existsSync(dbPath)) {
    warnings.push(`Database file not found at ${dbPath} (will be created on first run)`);
    return;
  }
  
  try {
    const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
    const requiredKeys = ['pages', 'team', 'services', 'heroSlides', 'images', 'contact', 'serviceTimes', 'settings', 'home'];
    requiredKeys.forEach(key => {
      if (!(key in db)) {
        errors.push(`Missing required database key: ${key}`);
      }
    });
    
    // Check for sample data
    if (Array.isArray(db.team) && db.team.length < 2) {
      warnings.push(`Database has fewer than 2 team members. Consider adding sample team data.`);
    }
    if (Array.isArray(db.communityGroups) && db.communityGroups.length < 2) {
      warnings.push(`Database has fewer than 2 community groups. Consider adding sample group data.`);
    }
    if (Array.isArray(db.events) && db.events.length < 2) {
      warnings.push(`Database has fewer than 2 events. Consider adding sample event data.`);
    }
    if (Array.isArray(db.heroSlides) && db.heroSlides.length < 2) {
      warnings.push(`Database has fewer than 2 hero slides. Consider adding sample slide data.`);
    }
    if (Array.isArray(db.services) && db.services.length < 2) {
      warnings.push(`Database has fewer than 2 services. Consider adding sample service data.`);
    }
  } catch (e) {
    errors.push(`Invalid JSON in database file: ${e.message}`);
  }
}

// Check required files
function checkFiles() {
  const requiredFiles = [
    'src/hooks.server.js',
    'src/lib/components/RichTextEditor.svelte',
    'src/lib/components/ImagePicker.svelte',
    'src/lib/server/database.js',
    'src/lib/server/auth.js',
    'src/lib/server/cloudinary.js',
    'src/lib/server/resend.js',
    '.env.example'
  ];
  
  requiredFiles.forEach(file => {
    if (!existsSync(file)) {
      errors.push(`Missing required file: ${file}`);
    }
  });
}

// Run all checks (order matters - check .env file first)
checkEnvFile(); // This will show error if .env doesn't exist
checkEnvVars(); // This checks variables (only if .env exists)
checkDatabase();
checkFiles();

// Report results
if (errors.length > 0) {
  console.error('❌ Validation Errors:');
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('⚠️  Validation Warnings:');
  warnings.forEach(w => console.warn(`  - ${w}`));
}

console.log('✅ All validation checks passed!');
```

**Add to package.json**:
```json
{
  "scripts": {
    "validate": "node scripts/validate-build.js",
    "prebuild": "npm run validate",
    "check": "npm run validate && npm run build && npm run preview"
  }
}
```

**Usage**:
- Run `npm run validate` to check for errors before building
- Run `npm run check` to validate, build, and preview in one command
- The `prebuild` hook will automatically run validation before `npm run build`

**Note**: The validation script should be created in `scripts/validate-build.js` and should check:
- Environment variables are set
- Database structure is valid
- Required files exist
- No critical errors in configuration

### 14. Final Pre-Deployment Checklist

Before deploying, verify:
- [ ] All validation checks above pass
- [ ] `npm run build` succeeds
- [ ] `npm run preview` works locally
- [ ] All tests from "Testing Routines" section pass
- [ ] No console errors in browser
- [ ] All links work
- [ ] All admin functionality works
- [ ] All images load correctly
- [ ] Database persists data correctly
- [ ] Environment variables are set in production
- [ ] Production build starts successfully

## Testing Routines

### Comprehensive Testing Checklist

After passing all pre-build validations, perform these detailed test routines:

### 1. Link Testing - Check All Links Work

**Front-End Navigation Links**:
- [ ] Home page link (`/`) loads correctly
- [ ] All navigation menu links work (test each menu item)
- [ ] Footer links work (contact, social media, etc.)
- [ ] Internal page links (e.g., `/about`, `/services`, `/team`) load correctly
- [ ] External links open in correct tab/window (check `target="_blank"` where applicable)
- [ ] Anchor links (e.g., `#contact`, `#about`) scroll correctly
- [ ] Hero section call-to-action buttons link correctly
- [ ] All "Read More" or "Learn More" links work
- [ ] Breadcrumb links (if implemented) work correctly
- [ ] No broken links (404 errors)
- [ ] No console errors when clicking links

**API Endpoints**:
- [ ] `/api/contact` endpoint responds correctly
- [ ] `/api/upload` endpoint works (if implemented)
- [ ] `/api/podcast-feed` generates valid RSS feed
- [ ] All API endpoints return proper error messages for invalid requests

**Media Links**:
- [ ] YouTube video links work (if configured)
- [ ] Spotify podcast links work (if configured)
- [ ] Social media links (if present) open correctly

**Test Method**:
```javascript
// Create a test script to check all links
// test-links.js (run manually or automate)
const pages = ['/', '/about', '/services', '/team', '/contact', '/media', '/audio'];
// Test each page loads without errors
// Check all `<a>` tags have valid `href` attributes
// Verify no broken links return 404
```

### 2. Admin Functionality Testing - Check All Admin Links Work

**Admin Authentication**:
- [ ] Admin login page (`/admin/login`) loads correctly
- [ ] Login with correct password succeeds
- [ ] Login with incorrect password shows error
- [ ] Session persists after login (refresh page, still logged in)
- [ ] Logout works correctly
- [ ] Protected admin routes redirect to login when not authenticated
- [ ] Session expires after 7 days (or configured duration)

**Admin Pages - Navigation**:
- [ ] `/admin` redirects to login or dashboard
- [ ] `/admin/pages` loads and displays pages list
- [ ] `/admin/team` loads and displays team members
- [ ] `/admin/services` loads and displays services
- [ ] `/admin/hero-slides` loads and displays hero slides
- [ ] `/admin/images` loads and displays image library
- [ ] `/admin/podcasts` loads and displays podcasts (if applicable)
- [ ] `/admin/events` loads and displays events (if applicable)
- [ ] `/admin/community-groups` loads and displays groups (if applicable)
- [ ] `/admin/settings` loads and displays settings
- [ ] All admin navigation links work correctly

**Admin CRUD Operations - Pages**:
- [ ] **Create**: Can create new page via `/admin/pages`
  - [ ] Form validates required fields (title, slug)
  - [ ] Page slug is URL-friendly (no spaces, special chars)
  - [ ] New page appears in pages list after creation
  - [ ] New page is accessible at its URL (`/[slug]`)
  - [ ] Page data is saved to database
- [ ] **Read**: Can view existing pages
  - [ ] Page list displays all pages
  - [ ] Can click to edit/view individual page
  - [ ] Page data loads correctly in edit form
- [ ] **Update**: Can edit existing pages
  - [ ] Can modify page title, content, hero section
  - [ ] Can add/edit sections (text, columns, images)
  - [ ] Can update hero image, overlay, buttons
  - [ ] Changes save successfully
  - [ ] Changes appear on front-end immediately after save
  - [ ] Database is updated with new values
- [ ] **Delete**: Can delete pages
  - [ ] Delete confirmation works
  - [ ] Page is removed from database
  - [ ] Page URL returns 404 after deletion

**Admin CRUD Operations - Team**:
- [ ] **Create**: Can add new team member
  - [ ] Form includes: name, role, bio, image, email (optional)
  - [ ] Image upload works (Cloudinary integration)
  - [ ] New team member appears in team list
  - [ ] Team member appears on `/team` page
  - [ ] Data is stored in database (`database.team` array)
- [ ] **Read**: Can view team members
  - [ ] Team list displays all members
  - [ ] Can edit individual team member
- [ ] **Update**: Can edit team member details
  - [ ] Can change name, role, bio, image
  - [ ] Changes save to database
  - [ ] Changes reflect on front-end immediately
- [ ] **Delete**: Can remove team member
  - [ ] Team member removed from database
  - [ ] Team member removed from `/team` page

**Admin CRUD Operations - Services/Activities**:
- [ ] **Create**: Can add new service/activity
  - [ ] Form includes: name, description, time, image, order
  - [ ] Image upload works
  - [ ] New service appears in list
  - [ ] Service appears on front-end (home page services section)
  - [ ] Data stored in database (`database.services` or `database.activities`)
- [ ] **Read**: Can view all services/activities
- [ ] **Update**: Can edit service/activity
  - [ ] Changes save to database
  - [ ] Changes reflect on front-end
- [ ] **Delete**: Can remove service/activity
  - [ ] Removed from database
  - [ ] Removed from front-end display

**Admin CRUD Operations - Events**:
- [ ] **Create**: Can add new event
  - [ ] Form includes: title, description, date, time, location, image
  - [ ] Date picker works correctly
  - [ ] Event appears in events list
  - [ ] Event appears on front-end (if featured)
  - [ ] Data stored in database (`database.events`)
- [ ] **Read**: Can view all events
- [ ] **Update**: Can edit event details
  - [ ] Can mark event as featured
  - [ ] Can publish/unpublish event
  - [ ] Changes save to database
- [ ] **Delete**: Can remove event
  - [ ] Event removed from database
  - [ ] Event removed from front-end

**Admin CRUD Operations - Hero Slides**:
- [ ] **Create**: Can add new hero slide
  - [ ] Form includes: title, subtitle, image, button text/link, order
  - [ ] Image upload works
  - [ ] Slide appears in slides list
  - [ ] Slide appears on home page hero section
  - [ ] Data stored in database (`database.heroSlides`)
- [ ] **Read**: Can view all hero slides
- [ ] **Update**: Can edit slide (reorder, modify content)
  - [ ] Can change slide order
  - [ ] Changes save to database
- [ ] **Delete**: Can remove slide
  - [ ] Slide removed from database
  - [ ] Slide removed from hero carousel

**Admin Settings**:
- [ ] Can update site name
  - [ ] Change saves to database (`database.settings.siteName`)
  - [ ] Site name updates in page titles, footer
- [ ] Can update primary color
  - [ ] Color picker works
  - [ ] Color saves to database (`database.settings.primaryColor`)
  - [ ] Color updates in CSS/Tailwind config
- [ ] Can update contact information
  - [ ] Address, phone, email save to database
  - [ ] Contact info updates on front-end
- [ ] Can update service times
  - [ ] Sunday/weekday times save to database
  - [ ] Service times update in footer
- [ ] Can update YouTube settings (if applicable)
  - [ ] Channel ID/Playlist ID save to database
  - [ ] Videos load correctly after update
- [ ] Can update podcast settings (if applicable)
  - [ ] Spotify URL, author, email save to database
  - [ ] Podcast feed updates correctly

**Database Verification**:
- [ ] After each CRUD operation, verify database file is updated
- [ ] Check `data/database.json` (or `/data/database.json` in production) contains changes
- [ ] Database structure is maintained (no corruption)
- [ ] JSON is valid after each write operation

**Test Method**:
```javascript
// Create admin test script
// test-admin.js
// 1. Login to admin
// 2. Test each CRUD operation
// 3. Verify database file after each operation
// 4. Check front-end reflects changes
```

### 3. Image URL Testing - Check Images Work and Are Stored in Database

**Image Upload Testing**:
- [ ] Can upload image via admin image picker
- [ ] Image uploads to Cloudinary successfully
- [ ] Image URL is returned after upload
- [ ] Image appears in image library (`/admin/images`)
- [ ] Image metadata (filename, size, URL) is stored in database (`database.images`)
- [ ] Can upload multiple image formats (JPG, PNG, WebP)
- [ ] Large images are optimized/resized by Cloudinary
- [ ] Image upload shows progress indicator
- [ ] Upload errors are handled gracefully

**Image Storage Verification**:
- [ ] All images used on pages are stored in database
  - [ ] Hero images stored in `database.heroSlides[].image`
  - [ ] Page hero images stored in `database.pages[].heroImage`
  - [ ] Team member images stored in `database.team[].image`
  - [ ] Service images stored in `database.services[].image`
  - [ ] Event images stored in `database.events[].image`
  - [ ] Image library entries in `database.images[]`
- [ ] No hardcoded image URLs in components
- [ ] All image references come from database

**Image URL Validation**:
- [ ] All image URLs in database are valid (not broken)
- [ ] Cloudinary URLs are properly formatted
- [ ] Unsplash placeholder URLs work correctly
- [ ] Images load on front-end pages
- [ ] Images display correctly (no 404 errors)
- [ ] Images are optimized (Cloudinary transformations work)
- [ ] Responsive images work (different sizes for mobile/desktop)
- [ ] Lazy loading works (images below fold load on scroll)
- [ ] Image alt text is present (accessibility)

**Image Display Testing**:
- [ ] Hero section images display correctly
- [ ] Team member photos display on `/team` page
- [ ] Service images display on home page
- [ ] Event images display correctly
- [ ] Page hero images display on individual pages
- [ ] Image picker shows thumbnails correctly
- [ ] Optimized images load faster than originals

**Database Image Structure Verification**:
```javascript
// Verify database structure for images
// Check database.json contains:
{
  "images": [
    {
      "id": "...",
      "url": "https://res.cloudinary.com/...",
      "filename": "...",
      "size": 12345,
      "uploadedAt": "..."
    }
  ],
  "pages": [
    {
      "heroImage": "https://res.cloudinary.com/..." // URL from database
    }
  ],
  "team": [
    {
      "image": "https://res.cloudinary.com/..." // URL from database
    }
  ]
  // ... etc
}
```

**Test Method**:
```javascript
// Create image test script
// test-images.js
// 1. Upload test image
// 2. Verify URL returned
// 3. Check database.images contains entry
// 4. Use image in page/team/service
// 5. Verify image URL stored in respective database field
// 6. Check image loads on front-end
// 7. Verify no broken image URLs
```

**Automated Image URL Checker**:
```javascript
// Check all image URLs in database are accessible
async function testImageUrls() {
  const db = readDatabase();
  const imageUrls = [
    ...db.images.map(img => img.url),
    ...db.pages.map(p => p.heroImage).filter(Boolean),
    ...db.team.map(t => t.image).filter(Boolean),
    ...db.services.map(s => s.image).filter(Boolean),
    ...db.events.map(e => e.image).filter(Boolean),
    ...db.heroSlides.map(s => s.image).filter(Boolean)
  ];
  
  for (const url of imageUrls) {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      console.error(`Broken image URL: ${url}`);
    }
  }
}
```

### General Testing

- [ ] All pages load correctly
- [ ] **Sample data displays correctly**:
  - [ ] Home page shows hero slides
  - [ ] Home page shows featured events (if any)
  - [ ] Home page shows services
  - [ ] Team page shows team members
  - [ ] Community groups page shows groups
  - [ ] Events page shows events (if applicable)
- [ ] Responsive design on mobile/tablet/desktop
- [ ] SEO meta tags are present
- [ ] Accessibility features work
- [ ] Database persists data correctly
- [ ] Production build works
- [ ] No console errors
- [ ] No broken functionality
- [ ] No empty pages (all pages have content to display)

## Additional Notes

1. **Unsplash Placeholders**: Use ONLY these specific, tested Unsplash URLs:
   - **CRITICAL**: Do NOT use search terms, random IDs, or `source.unsplash.com` URLs
   - **Use ONLY these exact URLs** (tested and verified to work):
   
   **Hero/Home Page**:
   - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80`
   - `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&h=900&fit=crop&q=80`
   - `https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80`
   
   **About/Church Page**:
   - `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&q=80`
   - `https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&h=900&fit=crop&q=80`
   
   **Team Page**:
   - `https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&h=900&fit=crop&q=80`
   - `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&h=900&fit=crop&q=80`
   
   **Activities/Events**:
   - `https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&h=900&fit=crop&q=80`
   
   **Media/Audio**:
   - `https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=1600&h=900&fit=crop&q=80`
   - `https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&h=900&fit=crop&q=80`
   
   **Contact**:
   - `https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1600&h=900&fit=crop&q=80`
   
   - **Required parameters**: Always include `w=1600&h=900&fit=crop&q=80` for consistent sizing and quality
   - **Never modify the photo ID**: Use the exact photo ID shown above
   - Replace with actual images via admin panel later

2. **Error Handling**: Implement proper error handling:
   - 404 pages for missing routes
   - Error boundaries for component errors
   - User-friendly error messages

3. **Loading States**: Add loading states for:
   - Image uploads
   - Form submissions
   - Data fetching

4. **Security**:
   - Sanitize user inputs
   - Validate form data
   - Protect admin routes
   - Use HTTPS in production
   - Secure cookie settings

5. **Performance**:
   - Optimize images via Cloudinary
   - Lazy load images
   - Code splitting
   - Minimize bundle size

6. **YouTube Setup**:
   - Get YouTube Data API v3 key from Google Cloud Console
   - Enable YouTube Data API v3 for your project
   - Add API key to environment variables
   - Provide either channel ID or playlist ID (channel takes precedence)
   - Test video fetching in development before deploying

7. **Podcast Setup**:
   - Configure Spotify show URL in environment variables
   - Set podcast metadata (author, email, description, image URL)
   - Podcast RSS feed will be available at `/api/podcast-feed`
   - Submit RSS feed URL to podcast directories (Apple Podcasts, Spotify, etc.)
   - Ensure audio files are accessible via URL (hosted on your server or CDN)

## Admin Functionality Requirements Summary

**CRITICAL**: The following admin functionality MUST be fully implemented in the build:

### Required Components
- ✅ **RichTextEditor.svelte** - Quill-based HTML editor (MUST be included)
  - Full toolbar with formatting, links, images, lists, colors, alignment
  - Image insertion via ImagePicker integration
  - HTML output for database storage
  - Two-way binding support
  
- ✅ **ImagePicker.svelte** - Cloudinary image upload/picker (MUST be included)
  - Drag-and-drop file upload
  - Image library display with thumbnails
  - Upload progress indicator
  - Search/filter functionality
  - Returns Cloudinary URL to parent component
  
- ✅ **FileUpload.svelte** - File upload component (if podcasts/audio needed)
  - Audio file upload support
  - File validation and progress

### Required API Endpoints
- ✅ `/api/upload` - Image upload endpoint (MUST be implemented)
  - Accepts multipart/form-data
  - Uploads to Cloudinary
  - Stores metadata in database.images
  - Returns image URL and metadata
  
- ✅ `/api/content` - Content CRUD operations (MUST be implemented)
  - GET, POST, DELETE methods
  - Handles all content types (pages, team, services, events, etc.)
  
- ✅ `/api/images` - Image library management (MUST be implemented)
  - Get all images
  - Delete images from Cloudinary and database

### Required Admin Pages (All Must Include RichTextEditor and ImagePicker Where Needed)
- ✅ `/admin/login` - Authentication
- ✅ `/admin/pages` - Pages management (RichTextEditor + ImagePicker REQUIRED)
- ✅ `/admin/team` - Team management (ImagePicker REQUIRED)
- ✅ `/admin/services` - Services management (RichTextEditor + ImagePicker REQUIRED)
- ✅ `/admin/activities` - Activities management (RichTextEditor + ImagePicker REQUIRED)
- ✅ `/admin/events` - Events management (RichTextEditor + ImagePicker REQUIRED)
- ✅ `/admin/hero-slides` - Hero slides management (ImagePicker REQUIRED)
- ✅ `/admin/images` - Image library (upload functionality REQUIRED)
- ✅ `/admin/settings` - Site settings (RichTextEditor + ImagePicker REQUIRED)
- ✅ `/admin/podcasts` - Podcast management (FileUpload REQUIRED if applicable)
- ✅ `/admin/beliefs` - Beliefs page management (RichTextEditor + ImagePicker REQUIRED)

### Verification Checklist
Before considering the build complete, verify:
- [ ] All admin pages have RichTextEditor where content editing is needed
- [ ] All admin pages have ImagePicker where image selection is needed
- [ ] Image upload functionality works (`/api/upload` endpoint functional)
- [ ] Images are stored in Cloudinary AND database
- [ ] Rich text content saves as HTML in database
- [ ] All CRUD operations work (Create, Read, Update, Delete)
- [ ] Form validation works on all admin forms
- [ ] Success/error messages display correctly
- [ ] Admin changes reflect immediately on front-end
- [ ] No hardcoded content - everything editable via admin

## Additional Features: Team API Endpoint and Beliefs Page

### 1. Public Team API Endpoint

**Purpose**: Allow front-end pages to fetch team members without authentication.

**Problem**: Front-end pages (e.g., `/about`) need to display team members, but only admin-protected endpoints exist. A public endpoint is required.

**Solution**: Create a public API endpoint at `/api/team` that:
- Returns all team members from the database
- Sorts team members by their `order` field (if available)
- Supports an optional `limit` query parameter
- Does NOT require authentication (public access)

**Implementation**:

**File: `src/routes/api/team/+server.js`**

```javascript
import { json } from '@sveltejs/kit';
import { getTeam } from '$lib/server/database.js';

export async function GET({ url }) {
	try {
		const limit = parseInt(url.searchParams.get('limit') || '0');
		let team = getTeam();
		
		// Sort by order if available
		team = team.sort((a, b) => {
			const orderA = a.order || 999;
			const orderB = b.order || 999;
			return orderA - orderB;
		});
		
		if (limit > 0) {
			team = team.slice(0, limit);
		}
		
		return json({ team });
	} catch (error) {
		console.error('Error fetching team:', error);
		return json({ error: 'Failed to fetch team' }, { status: 500 });
	}
}
```

**Testing**:
- [ ] Verify that `/api/team` returns team members without requiring authentication
- [ ] Verify that team members are sorted by the `order` field
- [ ] Verify that the `limit` query parameter works (e.g., `/api/team?limit=2`)

### 2. Beliefs Page Implementation

**Overview**: Create a complete "What We Believe" page at `/about/beliefs` that displays the church's statement of faith. The page should be fully database-driven and editable through the admin panel.

**Database Structure**:

Add a `beliefs` object to the database with the following structure:

```json
{
  "beliefs": {
    "heroTitle": "What we believe",
    "heroSubtitle": "We hold to core Christian beliefs that shape who we are and how we live.",
    "heroBackgroundImage": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80",
    "introTitle": "Our statement of faith",
    "introContent": "At [Site Name], we hold to historic Christian beliefs that have been shared by followers of Jesus for centuries. These beliefs are not just ideas we agree with, but truths that shape how we live, how we relate to God, and how we serve our community.",
    "sections": [
      {
        "title": "God",
        "content": "We believe in one God who exists eternally in three persons: Father, Son, and Holy Spirit. God is the creator of all things, all-powerful, all-knowing, and perfectly loving. He is holy, just, and merciful."
      },
      {
        "title": "Jesus Christ",
        "content": "We believe that Jesus Christ is fully God and fully human. He was born of a virgin, lived a sinless life, died on the cross to pay the penalty for our sins, and rose again from the dead. He ascended to heaven and will return one day to judge the living and the dead."
      },
      {
        "title": "The Holy Spirit",
        "content": "We believe the Holy Spirit is God, equal with the Father and the Son. The Spirit convicts people of sin, gives new life to those who trust in Jesus, lives in believers, and empowers them to live godly lives and serve others."
      },
      {
        "title": "The Bible",
        "content": "We believe the Bible is God's word, written by human authors under the inspiration of the Holy Spirit. It is completely trustworthy, without error in its original form, and is our final authority for faith and life."
      },
      {
        "title": "Humanity",
        "content": "We believe that all people are created in the image of God and have inherent dignity and worth. However, because of sin, all people are separated from God and need salvation. No one can save themselves through good works or religious practices."
      },
      {
        "title": "Salvation",
        "content": "We believe that salvation is a free gift from God, received by grace through faith in Jesus Christ alone. When we trust in Jesus, we are forgiven, declared righteous before God, and given new life. This new life begins now and continues forever in heaven."
      },
      {
        "title": "The Church",
        "content": "We believe the church is the body of Christ, made up of all true believers in Jesus. The church exists to worship God, grow in faith, care for one another, and share the good news of Jesus with the world. We practice baptism and communion as Jesus commanded."
      },
      {
        "title": "The Future",
        "content": "We believe that Jesus will return visibly and personally to earth. There will be a final judgment where all people will be judged. Those who have trusted in Jesus will spend eternity with God in heaven. Those who have rejected Jesus will be separated from God forever."
      }
    ],
    "closingContent": "These beliefs are not just theological statements—they shape how we live, how we love, and how we serve. If you have questions about what we believe, we'd love to talk with you. Please feel free to contact us or join us on a Sunday."
  }
}
```

**Database Functions**:

**File: `src/lib/server/database.js`**

Add the `beliefs` object to the `defaultDatabase` structure:

```javascript
const defaultDatabase = {
  // ... existing structure
  beliefs: {
    heroTitle: "What we believe",
    heroSubtitle: "We hold to core Christian beliefs that shape who we are and how we live.",
    heroBackgroundImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop&q=80",
    introTitle: "Our statement of faith",
    introContent: "At [Site Name], we hold to historic Christian beliefs...",
    sections: [
      // ... all 8 sections as shown above
    ],
    closingContent: "These beliefs are not just theological statements..."
  }
};
```

Add getter and update functions:

```javascript
export function getBeliefs() {
	const db = readDatabase();
	return db.beliefs || defaultDatabase.beliefs;
}

export function saveBeliefs(beliefs) {
	const db = readDatabase();
	db.beliefs = { ...db.beliefs, ...beliefs };
	writeDatabase(db);
	return db.beliefs;
}
```

**Front-End Page**:

**File: `src/routes/about/beliefs/+page.server.js`**

```javascript
import { getSettings, getBeliefs } from '$lib/server/database.js';

export async function load() {
	return {
		settings: getSettings(),
		beliefs: getBeliefs()
	};
}
```

**File: `src/routes/about/beliefs/+page.svelte`**

Create a page that:
- Uses the `Hero` component for the hero section (or custom hero)
- Displays the introduction section (if `introTitle` or `introContent` exists)
- Renders each belief section in a card layout
- Displays closing content with a contact link
- Handles multi-paragraph content by splitting on newlines
- Uses proper SEO meta tags

**Key Features**:
- Hero section with title, subtitle, and background image
- Introduction section with title and content (supports multiple paragraphs)
- Belief sections displayed as cards in a vertical list
- Each section has a title and content (supports multiple paragraphs)
- Closing content section with contact button
- Responsive design using TailwindCSS
- Proper semantic HTML structure

**Example Structure**:
```svelte
<script>
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { getContactInfo } from '$lib/server/database.js';
	
	export let data;
</script>

<svelte:head>
	<title>{data.beliefs.heroTitle} - {data.settings.siteName}</title>
	<meta name="description" content={data.beliefs.heroSubtitle} />
</svelte:head>

<Navbar />

<!-- Hero Section -->
<section class="relative h-[50vh] overflow-hidden" style="background-image: url('{data.beliefs.heroBackgroundImage}');">
	<!-- Hero content -->
</section>

<!-- Introduction Section -->
{#if data.beliefs.introTitle || data.beliefs.introContent}
	<section class="py-20 bg-white">
		<!-- Introduction content -->
	</section>
{/if}

<!-- Belief Sections -->
<section class="py-20 bg-gray-50">
	<div class="container mx-auto px-4">
		{#each data.beliefs.sections as section}
			<div class="bg-white rounded-lg shadow-md p-6 mb-6">
				<h2 class="text-2xl font-bold mb-4">{section.title}</h2>
				<div class="prose max-w-none">
					{@html section.content.split('\n').map(p => `<p>${p}</p>`).join('')}
				</div>
			</div>
		{/each}
	</div>
</section>

<!-- Closing Content -->
{#if data.beliefs.closingContent}
	<section class="py-20 bg-white">
		<!-- Closing content with contact link -->
	</section>
{/if}

<Footer />
```

**API Endpoint**:

**File: `src/routes/api/beliefs/+server.js`**

```javascript
import { json } from '@sveltejs/kit';
import { getBeliefs, saveBeliefs } from '$lib/server/database.js';
import { requireAuth } from '$lib/server/auth.js';

export async function GET() {
	try {
		const beliefs = getBeliefs();
		return json({ beliefs });
	} catch (error) {
		console.error('Error fetching beliefs:', error);
		return json({ error: 'Failed to fetch beliefs' }, { status: 500 });
	}
}

export async function POST(event) {
	requireAuth(event);
	
	try {
		const data = await event.request.json();
		const beliefs = saveBeliefs(data);
		return json({ beliefs });
	} catch (error) {
		console.error('Error updating beliefs:', error);
		return json({ error: 'Failed to update beliefs' }, { status: 500 });
	}
}
```

**Admin Interface**:

**File: `src/routes/admin/beliefs/+page.server.js`**

```javascript
import { getBeliefs } from '$lib/server/database.js';

export async function load() {
	return {
		beliefs: getBeliefs()
	};
}
```

**File: `src/routes/admin/beliefs/+page.svelte`**

Create an admin form that allows editing:
- Hero section (title, subtitle, background image using ImagePicker)
- Introduction section (title and content using RichTextEditor)
- Belief sections (dynamic list with add/remove functionality)
  - Each section has title and content fields (RichTextEditor for content)
  - Ability to add new sections
  - Ability to remove sections
  - Ability to reorder sections (drag-drop or up/down buttons)
- Closing content (RichTextEditor)

**Form Features**:
- Uses `ImagePicker` component for hero background image
- Uses `RichTextEditor` component for all content fields
- Save button that calls `/api/beliefs` POST endpoint
- Success/error messaging
- Cancel button that returns to pages list
- Proper form validation
- Loading states during save

**Add to Admin Navigation**:

**File: `src/routes/admin/pages/+page.svelte`**

Add a link to the beliefs page in the pages list:

```svelte
<a href="/admin/beliefs" class="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
	<h3 class="text-lg font-semibold text-primary mb-2">Beliefs Page</h3>
	<p class="text-sm text-medium-gray">Edit content for the What We Believe page</p>
</a>
```

**Testing Checklist**:

1. **Database**:
   - [ ] Verify `beliefs` object is added to `defaultDatabase`
   - [ ] Verify `getBeliefs()` and `saveBeliefs()` functions work
   - [ ] Verify beliefs data is in `data/database.json`

2. **Front-End Page**:
   - [ ] Visit `/about/beliefs` and verify page loads
   - [ ] Verify hero section displays correctly
   - [ ] Verify introduction section displays (if content exists)
   - [ ] Verify all belief sections display as cards
   - [ ] Verify closing content displays with contact button
   - [ ] Verify page is responsive on mobile/tablet/desktop
   - [ ] Verify SEO meta tags are present

3. **API Endpoint**:
   - [ ] Verify `/api/beliefs` GET returns beliefs data (public access)
   - [ ] Verify `/api/beliefs` POST requires authentication
   - [ ] Verify POST updates beliefs in database

4. **Admin Interface**:
   - [ ] Verify link appears in `/admin/pages` or admin navigation
   - [ ] Verify admin page loads at `/admin/beliefs`
   - [ ] Verify all form fields are present and editable
   - [ ] Verify ImagePicker works for hero background
   - [ ] Verify RichTextEditor works for content fields
   - [ ] Verify add/remove section buttons work
   - [ ] Verify reorder sections works (if implemented)
   - [ ] Verify save functionality works
   - [ ] Verify success/error messages display
   - [ ] Verify changes reflect on front-end page after saving

5. **Integration**:
   - [ ] Verify About page link to `/about/beliefs` works (if present)
   - [ ] Verify beliefs page is accessible from navigation (if added)

**Summary**:

This feature adds:
1. A public team API endpoint (`/api/team`) for front-end team member display
2. A complete beliefs page (`/about/beliefs`) with:
   - Front-end display page
   - Admin editing interface
   - Database structure
   - API endpoints (GET public, POST protected)
   - Full CRUD capabilities

All content is database-driven and editable through the admin panel, following the same patterns established for other content pages.

## Master Pre-Build Validation Checklist

**CRITICAL**: Run through ALL of these checks before considering the build complete. This checklist combines all validation requirements:

### Phase 1: Code & Build Validation
- [ ] `npm run build` completes without errors
- [ ] `npm run preview` starts successfully
- [ ] All required files exist (hooks.server.js, components, server modules)
- [ ] No console errors during build
- [ ] All imports resolve correctly
- [ ] No missing dependencies

### Phase 2: Environment & Configuration
- [ ] All required environment variables are set
- [ ] `.env.example` file exists
- [ ] `.gitignore` includes `.env`
- [ ] `hooks.server.js` loads `dotenv.config()`
- [ ] Environment variables accessible in server code

### Phase 3: Database Validation
- [ ] Database file structure is valid JSON
- [ ] All required database keys exist
- [ ] **Sample data exists in default database**:
  - [ ] At least 2-3 team members
  - [ ] At least 2-3 community groups
  - [ ] At least 2-3 events
  - [ ] At least 2-3 hero slides
  - [ ] At least 2-3 services
- [ ] Database CRUD functions work correctly
- [ ] Database path resolution works (dev vs production)
- [ ] Default database initializes correctly
- [ ] Sample data displays correctly on front-end pages

### Phase 4: Error Handling
- [ ] All API endpoints have error handling
- [ ] Form validation works on all forms
- [ ] Edge cases handled (empty data, missing fields)
- [ ] User-friendly error messages
- [ ] No crashes on invalid input

### Phase 5: Security
- [ ] Admin authentication works
- [ ] Protected routes require auth
- [ ] Input sanitization in place
- [ ] File upload validation
- [ ] Session security (HTTP-only, secure cookies)

### Phase 6: Functionality
- [ ] All links work (front-end and admin)
- [ ] All admin CRUD operations work
- [ ] Image uploads work
- [ ] RichTextEditor works
- [ ] ImagePicker works
- [ ] Contact form sends emails
- [ ] Database persists all changes

### Phase 7: Content Validation
- [ ] NO hardcoded content in components
- [ ] All content from database
- [ ] Admin changes reflect on front-end
- [ ] All images load correctly
- [ ] All image URLs are valid

### Phase 8: Browser & Performance
- [ ] No console errors in browser
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] Responsive on mobile/tablet/desktop
- [ ] Page load time acceptable
- [ ] Images lazy load correctly

### Phase 9: Integration
- [ ] Components integrate correctly
- [ ] API endpoints work
- [ ] External services work (Cloudinary, Resend, YouTube)
- [ ] Navigation works correctly
- [ ] Forms submit correctly

### Phase 10: Production Readiness
- [ ] Production build succeeds
- [ ] `node build/index.js` starts successfully
- [ ] Environment variables set for production
- [ ] Database path set for production
- [ ] Volume mounted (if using Railway)

**Validation Script**: Run `npm run validate` (if implemented) before final build.

## Final Steps

1. **Create `.env` file FIRST** (CRITICAL - Do this before anything else):
   - Follow the detailed instructions in the "Creating the .env File" section above
   - **Copy the complete .env template** from that section
   - **Fill in ALL required variables**:
     - [ ] `ADMIN_PASSWORD` - Generate secure random password (see instructions)
     - [ ] `DATABASE_PATH` - Set to `./data/database.json` for local dev
     - [ ] `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
     - [ ] `CLOUDINARY_API_KEY` - Your Cloudinary API key
     - [ ] `CLOUDINARY_API_SECRET` - Your Cloudinary API secret
     - [ ] `RESEND_API_KEY` - Your Resend API key
   - **Fill in optional variables** (if using features):
     - [ ] `YOUTUBE_API_KEY` - If using YouTube integration
     - [ ] `YOUTUBE_CHANNEL_ID` or `YOUTUBE_PLAYLIST_ID` - If using YouTube
     - [ ] `SPOTIFY_SHOW_URL` - If using podcasts
     - [ ] `PODCAST_*` variables - If using podcasts
   - **Set `NODE_ENV=development`** for local development
   - **Verify `.env` file is in project root** (same directory as `package.json`)
   - **Verify `.env` is in `.gitignore`** (never commit this file)

2. **Create `.env.example`**: Copy `.env` structure but replace sensitive values with placeholders
   - This file should be committed to git
   - Serves as a template for other developers

3. **Verify `.gitignore`**: Ensure `.env` is listed in `.gitignore` to prevent committing secrets

4. **Run Pre-Build Validation**: Complete ALL checks in "Pre-Build Validation & Bug Prevention" section
   - Run validation script: `npm run validate` (if implemented)
   - Fix any errors or warnings
   - Verify all required files exist
   - Verify all environment variables are set

5. **Initialize database**: Run the application to auto-create database structure (development mode)
   - Verify database structure is correct
   - Verify default content exists
   - **CRITICAL**: Verify sample data exists:
     - [ ] At least 2-3 team members in database
     - [ ] At least 2-3 community groups in database
     - [ ] At least 2-3 events in database
     - [ ] At least 2-3 hero slides in database
     - [ ] At least 2-3 services in database
   - Verify sample data displays on front-end pages:
     - [ ] Team page shows team members
     - [ ] Community groups page shows groups
     - [ ] Events appear on home page (if featured)
     - [ ] Hero slides display on home page
     - [ ] Services display on home page

6. **Test locally**: 
   - Start development server: `npm run dev`
   - Complete ALL tests from "Testing Routines" section
   - Test admin login with generated password
   - Verify all environment variables are loaded correctly
   - Test image uploads, contact form, etc.
   - Check browser console for errors
   - Test all admin CRUD operations
   - Verify all links work

7. **Build for production**:
   - Run `npm run build`
   - Verify build completes without errors
   - Test production build locally: `npm run preview`
   - Verify all functionality works in preview mode

8. **Deploy to Railway**:
   - Set all environment variables in Railway dashboard
   - Mount `/data` volume
   - Set `DATABASE_PATH=/data/database.json` in Railway environment variables
   - Set `NODE_ENV=production`
   - Deploy and monitor build logs

9. **Verify production**: 
   - Check that site loads correctly
   - Test admin login
   - Verify database persists data on volume
   - Test all functionality in production
   - Run through all testing routines again in production
   - Check production console for errors
   - Verify all external integrations work (Cloudinary, Resend, YouTube)

---

**This prompt should be used with Cursor AI to generate the complete website from scratch. Provide all the required inputs (colors, logo, content document) and the AI will create all necessary files and implement all features.**


