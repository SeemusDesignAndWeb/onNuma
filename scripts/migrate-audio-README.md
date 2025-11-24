# Audio Migration Script

This script downloads all existing MP3 files from the external host (`http://www.egcc.co.uk/company/egcc/audio/`) and migrates them to the Railway volume at `/data/audio/uploaded/`.

## What it does:

1. Reads all podcasts from the database
2. Finds podcasts with external audio URLs
3. Downloads each MP3 file to `/data/audio/uploaded/`
4. Updates the database with new local paths (`/audio/uploaded/filename.mp3`)
5. Skips files that already exist locally

## Usage:

### Local Testing (downloads to `static/audio/uploaded/`):
```bash
node scripts/migrate-audio-to-railway.js
```

### Production (downloads to Railway volume at `/data/audio/uploaded/`):
```bash
railway run node scripts/migrate-audio-to-railway.js
```

## Environment Variables:

- `DATABASE_PATH` - Path to database file (default: `./data/database.json`)
- `AUDIO_UPLOAD_DIR` - Directory to save audio files (default: `/data/audio/uploaded` in production, `static/audio/uploaded` locally)

## Notes:

- The script will skip files that already exist locally
- If a download fails, it will continue with the next file
- The database is automatically updated with new paths
- Make sure you have write permissions to the upload directory
- On Railway, ensure the volume is mounted at `/data`

## After Migration:

1. Verify files are in `/data/audio/uploaded/` on Railway
2. Check that database paths are updated to `/audio/uploaded/...`
3. Test that audio files play correctly on the website
4. The old external URLs will no longer be used

