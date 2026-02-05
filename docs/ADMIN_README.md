# Admin Area Documentation

## Overview

The admin area allows you to manage all content on the EGCC website through a web interface. All data is stored in JSON files that persist across deployments using Railway volumes.

## Setup

### Local Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Set your admin password in `.env`:
   ```
   ADMIN_PASSWORD=your-secure-password-here
   DATABASE_PATH=./data/database.json
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Access the admin area at: `http://localhost:5173/admin/login`

### Railway Deployment

1. **Create a Railway Volume:**
   - Go to your Railway project
   - Click "New" → "Volume"
   - Name: `data-storage`
   - Mount Path: `/data`
   - Click "Add"

2. **Set Environment Variables:**
   - `ADMIN_PASSWORD`: Set a secure password for admin access
   - `DATABASE_PATH`: `/data/database.json`

3. **Deploy:**
   - Push your code to GitHub
   - Railway will automatically deploy

## Accessing the Admin Area

1. Navigate to `/admin/login`
2. Enter your admin password
3. You'll be redirected to the admin dashboard

## Features

### Pages Management (`/admin/pages`)
- Create, edit, and delete page content
- Manage page titles, content, hero images, and meta descriptions
- Pages are identified by their ID (URL slug)

### Team Management (`/admin/team`)
- Add, edit, and remove team members
- Set names, roles, images, quotes, and social media links

### Testimonials (`/admin/testimonials`)
- Manage testimonials displayed on the website
- Add names, roles, content, and images

### Services (`/admin/services`)
- Manage services and programs
- Update descriptions, images, and icons

### Hero Slides (`/admin/hero-slides`)
- Manage homepage hero slider content
- Control slide titles, subtitles, CTAs, and images

### Settings (`/admin/settings`)
- Update contact information (address, phone, email)
- Manage service times and notes

## Data Storage

All data is stored in `/data/database.json` (or `./data/database.json` locally).

The database structure:
```json
{
  "pages": [],
  "team": [],
  "testimonials": [],
  "services": [],
  "heroSlides": [],
  "contact": { ... },
  "serviceTimes": { ... },
  "settings": { ... }
}
```

### Railway Volume Persistence

- Data persists across deployments when using Railway volumes
- The default `data/database.json` in git serves as a seed/backup
- On first deployment, the system automatically copies the git version to the volume
- All changes are saved to the volume path (`/data/database.json`)

## Security

- Admin area requires password authentication
- Sessions expire after 7 days
- All admin routes are protected
- Use a strong password in production

## API Endpoints

The admin area uses these API endpoints:

- `GET /api/content?type={type}&id={id}` - Fetch content
- `POST /api/content` - Save content
- `DELETE /api/content?type={type}&id={id}` - Delete content

All endpoints require authentication.

## Troubleshooting

### Can't access admin area
- Check that `ADMIN_PASSWORD` is set correctly
- Clear cookies and try again
- Check browser console for errors

### Changes not persisting
- Verify Railway volume is mounted at `/data`
- Check `DATABASE_PATH` environment variable
- Check Railway logs for database errors

### Database not initializing
- Ensure `data/database.json` exists in git
- Check file permissions on Railway volume
- Review Railway logs for initialization messages

