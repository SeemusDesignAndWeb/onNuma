# Railway Volume Setup for Audio Files

## Current Situation

Your audio files are currently stored in `static/audio/uploaded/` on Railway. While this works, files in the `static/` directory may not persist across redeployments.

## Recommended: Set Up a Railway Volume

For persistent storage, you should configure a Railway volume at `/data`.

### Steps to Set Up Volume

1. **Go to Railway Dashboard**
   - Navigate to your project: https://railway.app/project/[your-project-id]

2. **Select Your Service**
   - Click on the service that runs your application

3. **Go to Volumes Tab**
   - Click on the "Volumes" tab in the service settings

4. **Create New Volume**
   - Click "New Volume" or "Add Volume"
   - Set the mount path to: `/data`
   - Choose a size (e.g., 10GB should be sufficient for audio files)
   - Click "Create"

5. **Redeploy Your Service**
   - After creating the volume, Railway will automatically redeploy your service
   - The `/data` directory will now be available

6. **Move Existing Files**
   - Once the volume is set up, run:
     ```bash
     railway run node scripts/move-audio-to-railway-volume.js
     ```
   - This will move all files from `static/audio/uploaded/` to `/data/audio/uploaded/`

## Alternative: Keep Using Static Directory

If you prefer not to set up a volume, the files in `static/audio/uploaded/` will work, but:
- ⚠️ Files may be lost on redeployments
- ⚠️ Files are part of the build/deployment process
- ✅ Simpler setup (no volume configuration needed)

## Verification

After setting up the volume, verify it works:

```bash
# Check if /data exists
railway run test -d /data && echo "Volume mounted" || echo "Volume not mounted"

# List files in the volume
railway run ls -la /data/audio/uploaded/ | head -10
```

## Notes

- The code automatically detects if `/data` exists and uses it if available
- If `/data` doesn't exist, it falls back to `static/audio/uploaded/`
- All upload scripts and API endpoints use this same detection logic

