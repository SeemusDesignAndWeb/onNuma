# Railway Environment & Volume Setup Prompt

Use this prompt to configure a new SvelteKit application with Railway deployment, including environment variables, Railway configuration, and persistent data storage.

## Setup Requirements

Create the following configuration files and setup for a SvelteKit application that uses:
- JSON file-based database stored in a Railway volume
- Admin authentication
- Cloudinary for image storage
- Resend for email functionality
- Node.js adapter for SvelteKit

## 1. Create `.env` File

Create a `.env` file in the project root with the following environment variables:

```env
# Database Configuration
# Local development: Use relative path
# Production (Railway): Use absolute path /data/database.json
DATABASE_PATH=./data/database.json

# Admin Authentication
# Set a secure password for admin area access
ADMIN_PASSWORD=your-secure-password-here

# Node Environment
# Set to 'production' for Railway deployment
NODE_ENV=development

# Cloudinary Configuration (for image storage)
# Get these from https://console.cloudinary.com/settings/api-keys
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Resend Email Configuration (for contact forms)
# Get API key from https://resend.com/api-keys
# Verify domain at https://resend.com/domains
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your-verified-email@yourdomain.com

# Rota Reminder Cron Job Security
# Generate with: openssl rand -base64 32
# Required for securing the rota reminder API endpoint
ROTA_REMINDER_CRON_SECRET=your-secret-token-here

# Rota Reminder Configuration (optional)
# Days ahead to send reminders (defaults to 3)
ROTA_REMINDER_DAYS_AHEAD=3

# Port (optional - Railway will set this automatically)
PORT=3000
```

### Environment Variable Notes:

- **DATABASE_PATH**: 
  - Local: `./data/database.json` (relative path)
  - Production: `/data/database.json` (absolute path for Railway volume)
  
- **ADMIN_PASSWORD**: Use a strong, unique password for admin access. This is used for authentication to the admin area.

- **NODE_ENV**: 
  - `development` for local development
  - `production` for Railway deployment

- **Cloudinary**: Required if using image uploads. Sign up at https://cloudinary.com and get your credentials.

- **Resend**: Required if using contact forms. Sign up at https://resend.com, verify your domain, and get your API key.

## 2. Create `railway.json` Configuration

Create a `railway.json` file in the project root:

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

### Railway Configuration Notes:

- **builder**: Uses Nixpacks to automatically detect and build the Node.js application
- **buildCommand**: Runs `npm run build` to build the SvelteKit application
- **startCommand**: Starts the production server using the built Node.js adapter
- **restartPolicyType**: Automatically restarts the service on failure
- **restartPolicyMaxRetries**: Maximum number of restart attempts

## 3. Create `Procfile` (Optional but Recommended)

Create a `Procfile` in the project root for Railway compatibility:

```
web: node build/index.js
```

This ensures Railway uses the correct start command.

## 4. Railway Volume Setup for `/data` Directory

### Step-by-Step Volume Configuration:

1. **Create Volume in Railway Dashboard:**
   - Go to your Railway project dashboard
   - Click "New" → "Volume"
   - Name: `data-storage` (or any descriptive name)
   - Mount Path: `/data` (must be exactly `/data`)
   - Click "Add"

2. **Attach Volume to Service:**
   - After creating the volume, attach it to your web service
   - The volume will be mounted at `/data` at runtime

3. **Update Production Environment Variables:**
   - In Railway dashboard, go to your service → Variables
   - Set `DATABASE_PATH=/data/database.json` (absolute path)
   - Set `NODE_ENV=production`
   - Set all other required environment variables (ADMIN_PASSWORD, CLOUDINARY_*, RESEND_*)

### Volume Mount Notes:

- **Mount Path**: Must be `/data` to match the production DATABASE_PATH
- **Volume Persistence**: Data stored in `/data` persists across deployments
- **Build vs Runtime**: The volume is mounted at runtime, not during build. Your database module must handle this gracefully.
- **Initial Database**: On first deployment, you may need to initialize the database file on the volume. Consider creating an initialization script or endpoint.

## 5. Database Module Configuration

Your database module should handle both local and production paths:

```javascript
// Example database.js configuration
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
			console.error('[DB] CRITICAL: Failed to read database in production:', error.message);
			throw new Error(`Database file not found at ${dbPath}. Please ensure the Railway volume is mounted and the database file exists.`);
		}
		
		// Only auto-initialize in development
		console.warn('[DB] Database file does not exist (development mode), initializing...');
		// Initialize with default structure...
	}
}
```

## 6. Package.json Scripts

Ensure your `package.json` includes these scripts:

```json
{
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"start": "node build/index.js"
	}
}
```

## 7. SvelteKit Adapter Configuration

Use the Node.js adapter in `svelte.config.js`:

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

## 8. Railway Deployment Checklist

Before deploying to Railway:

- [ ] Create `.env` file with all required variables
- [ ] Create `railway.json` configuration file
- [ ] Create `Procfile` (optional but recommended)
- [ ] Ensure `package.json` has correct build and start scripts
- [ ] Configure SvelteKit to use `@sveltejs/adapter-node`
- [ ] Create Railway volume named `data-storage` mounted at `/data`
- [ ] Set all environment variables in Railway dashboard:
  - [ ] `DATABASE_PATH=/data/database.json`
  - [ ] `NODE_ENV=production`
  - [ ] `ADMIN_PASSWORD=<secure-password>`
  - [ ] `CLOUDINARY_CLOUD_NAME=<your-cloud-name>`
  - [ ] `CLOUDINARY_API_KEY=<your-api-key>`
  - [ ] `CLOUDINARY_API_SECRET=<your-api-secret>`
  - [ ] `RESEND_API_KEY=<your-resend-key>`
  - [ ] `RESEND_FROM_EMAIL=<your-verified-email>`
  - [ ] `ROTA_REMINDER_CRON_SECRET=<generated-secret-token>`
  - [ ] `ROTA_REMINDER_DAYS_AHEAD=3` (optional, defaults to 3)
- [ ] Initialize database file on volume (if needed)
- [ ] Test deployment and verify volume persistence

## 9. Database Initialization

On first deployment, you may need to initialize the database file on the Railway volume. Options:

1. **Create initialization script** that runs on startup
2. **Use an API endpoint** to initialize the database (protected by admin password)
3. **Manually create** the file using Railway's volume access features

Example initialization endpoint:

```javascript
// src/routes/api/init-database/+server.js
import { json } from '@sveltejs/kit';
import { writeFileSync, existsSync } from 'fs';

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization');
	const password = process.env.ADMIN_PASSWORD;
	
	if (!authHeader || authHeader !== `Bearer ${password}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	
	const DB_PATH = process.env.DATABASE_PATH || '/data/database.json';
	
	if (existsSync(DB_PATH)) {
		return json({ message: 'Database already exists', path: DB_PATH });
	}
	
	// Initialize with default structure
	const defaultDatabase = {
		pages: [],
		team: [],
		services: [],
		// ... other default data
	};
	
	writeFileSync(DB_PATH, JSON.stringify(defaultDatabase, null, 2), 'utf-8');
	return json({ message: 'Database initialized', path: DB_PATH });
}
```

## 10. Troubleshooting

### Database Not Found in Production
- Verify volume is mounted at `/data`
- Check `DATABASE_PATH` environment variable is set to `/data/database.json`
- Ensure database file exists on the volume
- Check Railway logs for database errors

### Volume Not Persisting Data
- Verify volume is attached to the correct service
- Check volume mount path is exactly `/data`
- Ensure writes are going to `/data/database.json` (absolute path)
- Check file permissions on the volume

### Build Failures
- Ensure `railway.json` has correct build command
- Verify `package.json` has all required dependencies
- Check that SvelteKit adapter is properly configured
- Review Railway build logs for specific errors

### Environment Variables Not Working
- Verify all variables are set in Railway dashboard (not just `.env`)
- Check variable names match exactly (case-sensitive)
- Ensure no extra spaces or quotes in variable values
- Restart service after adding new variables

### Cloudinary "Invalid Signature" on Image Upload (Railway)
If image upload fails with **Invalid Signature** and a string like `overwrite=0&public_id=egcc/...&timestamp=...`:

1. **Check credentials in Railway**  
   In Railway → your service → Variables, ensure:
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are set.
   - Values match **exactly** what’s in [Cloudinary Console → API Keys](https://console.cloudinary.com/settings/api-keys) (same account).
   - You’re using the **API Secret** (not the API Key) for `CLOUDINARY_API_SECRET`.

2. **No extra characters**  
   When pasting into Railway, avoid trailing newlines or spaces. The app trims values; if your secret was copied with a newline, re-paste it as a single line and save.

3. **Redeploy**  
   After changing any Cloudinary variable, redeploy the service so the new env is loaded.

## Summary

This setup provides:
- ✅ Persistent data storage using Railway volumes
- ✅ Environment-based configuration (dev vs production)
- ✅ Secure admin authentication
- ✅ Image storage via Cloudinary
- ✅ Email functionality via Resend
- ✅ Automatic restarts on failure
- ✅ Production-ready SvelteKit deployment

The `/data` volume ensures all admin JSON data persists across deployments, making it safe to update and redeploy your application without losing data.




