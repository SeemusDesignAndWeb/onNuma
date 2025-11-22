# Updating Production Database

The local database has been cleaned (duplicates removed). To update the production database on Railway:

## Option 1: Using Railway CLI (Recommended)

1. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```

2. Login and link your project:
   ```bash
   railway login
   railway link
   ```

3. Copy the local database to Railway:
   ```bash
   railway run cp ./data/database.json /data/database.json
   ```

## Option 2: Manual Upload via Railway Dashboard

1. Go to your Railway project dashboard
2. Navigate to the Volume (should be named `data-storage`)
3. Download the current `/data/database.json` as a backup
4. Upload your local `data/database.json` file to replace it

## Option 3: Using Railway Shell

1. Open Railway dashboard → Your service → Deployments → Latest deployment
2. Click "Shell" to open a terminal
3. Run:
   ```bash
   # The database is at /data/database.json
   # You can edit it directly or copy from a backup
   ```

## Option 4: Deploy Script (Run on Railway)

You can also create a one-time deployment script that runs on Railway to sync the database. The cleaned database structure is now in the codebase, and Railway will use the volume-stored database.

**Note:** The database file (`data/database.json`) is intentionally not in git (it's in `.gitignore`) because it's stored in Railway volumes for persistence.

