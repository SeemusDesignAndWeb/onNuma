# Restore Production Database to Railway

The database file needs to be restored to the Railway volume at `/data/database.json`.

## Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and link your project**:
   ```bash
   railway login
   railway link
   ```

3. **Copy the restored database to Railway**:
   ```bash
   # First, restore the database locally from git
   git show fc4b61b:data/database.json > data/database.json
   
   # Then copy it to Railway volume
   railway run cp ./data/database.json /data/database.json
   ```

## Option 2: Using Railway Shell

1. Go to Railway Dashboard → Your Service → Deployments → Latest deployment
2. Click "Shell" to open a terminal
3. Run these commands:
   ```bash
   # Create the database file with content from git
   # You'll need to paste the JSON content or use a different method
   ```

## Option 3: Manual Upload via Railway Dashboard

1. **Restore the database locally**:
   ```bash
   git show fc4b61b:data/database.json > data/database.json
   ```

2. **Go to Railway Dashboard**:
   - Navigate to your service
   - Go to the Volume section
   - Upload `data/database.json` to the volume at `/data/database.json`

## Option 4: Create Database File via Railway Shell

1. Open Railway Shell (Dashboard → Service → Shell)
2. Create the file:
   ```bash
   mkdir -p /data
   touch /data/database.json
   ```
3. Then use Railway's file editor or upload the content

## Important Notes

- The database file from commit `fc4b61b` contains the last known good state
- After restoring, verify the file exists: `railway run ls -la /data/`
- The application should automatically pick up the database after restoration
- Make sure the volume is properly mounted at `/data`

## Verify Database Restored

After restoring, check the logs to confirm:
```bash
railway logs
```

You should see successful database reads instead of "ENOENT" errors.

