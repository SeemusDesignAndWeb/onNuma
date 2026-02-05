# CRM Module Setup Guide

## Installation

1. **Install Dependencies**
   ```bash
   npm install bcryptjs ulid dompurify jsdom
   ```

2. **Set Environment Variables**
   
   Create a `.env` file (or add to your existing one) with:
   ```env
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=your_verified_email@domain.com
   APP_BASE_URL=https://yourdomain.com
   CRM_SECRET_KEY=your_base64_32_byte_key
   ```
   
   Generate `CRM_SECRET_KEY`:
   ```bash
   openssl rand -base64 32
   ```

3. **Create Initial Admin User**
   
   You'll need to create an admin user. You can do this by:
   - Creating a script to add an admin (see below)
   - Or manually creating an entry in `data/admins.ndjson`

## Quick Start Script

Create a file `scripts/create-admin.js`:

```javascript
import { createAdmin } from '../src/lib/hub/server/auth.js';

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Admin';

if (!email || !password) {
  console.error('Usage: node scripts/create-admin.js <email> <password> [name]');
  process.exit(1);
}

try {
  const admin = await createAdmin({ email, password, name });
  console.log('Admin created:', admin.id);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
```

Run: `node scripts/create-admin.js admin@example.com password123 "Admin Name"`

## File Structure

The CRM module has been installed at:
- `src/lib/hub/` - Core CRM code
- `src/routes/hub/` - CRM routes
- `src/routes/signup/rota/` - Public signup routes
- `static/docs/` - Documentation
- `src/hooks.server.js` - Hook integration

## Data Storage

Data is stored in NDJSON files under `/data`:
- The directory will be created automatically
- Files are created on first write
- All writes are atomic (queued per file)

## Access

- CRM Dashboard: `/hub`
- Login: `/hub/auth/login`
- Help: `/hub/help`

## Features Implemented

✅ Contacts management
✅ Lists management  
✅ Newsletters with Resend integration
✅ Events and occurrences
✅ Volunteer rotas
✅ Bulk rota invitations
✅ Public token-based signup
✅ HTML WYSIWYG editor
✅ CSRF protection
✅ Session management
✅ Built-in documentation

## Next Steps

1. Install dependencies
2. Set environment variables
3. Create an admin user
4. Start your SvelteKit dev server
5. Log in at `/hub/auth/login`
6. Begin using the CRM!

## Notes

- The module uses your existing Tailwind CSS configuration
- All HTML content is sanitized with DOMPurify
- Email sending requires a verified Resend domain
- Sessions expire after 7 days
- CSRF tokens are required for all form submissions

