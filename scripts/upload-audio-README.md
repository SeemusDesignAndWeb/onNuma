# Upload Audio Files to Railway

This script allows you to upload manually downloaded MP3 files to the Railway volume and automatically update the database.

## Prerequisites

1. Download MP3 files from your server to your local machine
2. Have Railway CLI installed and authenticated

## Usage

### Single File Upload

**Local testing** (uploads to `static/audio/uploaded/`):
```bash
node scripts/upload-audio-to-railway.js /path/to/file.mp3
```

**Production** (uploads to Railway volume at `/data/audio/uploaded/`):
```bash
railway run node scripts/upload-audio-to-railway.js /path/to/file.mp3
```

### Upload with Custom Filename

If you want to specify the filename that will be used (useful for matching database entries):
```bash
railway run node scripts/upload-audio-to-railway.js /path/to/file.mp3 --filename "20251012_JohnWatson_Nehemiah4.mp3"
```

### Upload Multiple Files from Directory

Upload all MP3 files from a directory:
```bash
railway run node scripts/upload-audio-to-railway.js /path/to/directory
```

## What It Does

1. ✅ Copies the file to `/data/audio/uploaded/` (or `static/audio/uploaded/` locally)
2. ✅ Automatically finds the matching podcast in the database by filename
3. ✅ Updates the database with the new local path (`/audio/uploaded/filename.mp3`)
4. ✅ Updates file size information

## Example Workflow

1. **Download files from server:**
   ```bash
   # Download all MP3s from your server
   scp user@server:/path/to/audio/*.mp3 ./downloaded-audio/
   ```

2. **Upload to Railway:**
   ```bash
   railway run node scripts/upload-audio-to-railway.js ./downloaded-audio/
   ```

3. **Verify:**
   - Check files are in `/data/audio/uploaded/` on Railway
   - Check database paths are updated
   - Test audio playback on website

## Notes

- The script tries to match files to podcasts in the database by filename
- If no match is found, the file is still uploaded but the database won't be updated automatically
- You can manually update the database later if needed
- Files are copied (not moved), so your original files remain intact
- The script handles both single files and directories

## Troubleshooting

**File not found:**
- Make sure the file path is correct
- Use absolute paths if relative paths don't work

**Database not updated:**
- Check that the filename matches what's in the database
- Use `--filename` flag to specify the exact filename from the database
- You may need to manually update the database entry

**Permission errors:**
- Make sure you have write permissions to the upload directory
- On Railway, ensure the volume is mounted at `/data`

