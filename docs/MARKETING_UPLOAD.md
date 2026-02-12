# Upload marketing data to production

Use this when you've created or edited marketing content (sequences, templates, blocks, etc.) on localhost and want to push it to production.

## Prerequisites

- Local database has the marketing data (you use `DATA_STORE=database` and ran the app locally).
- Production app is deployed and uses the same CRM (database or file store).
- You have `ADMIN_PASSWORD` set in production (same as in your `.env` for the script).

## Steps

1. **Set production URL**

   In `.env` (or as an environment variable when running the script):

   ```bash
   PROD_URL=https://admin.onnuma.com
   ```

   Use your real production app URL (the one that serves the multi-org admin and Hub).

2. **Run the upload script**

   From the project root:

   ```bash
   node scripts/upload-marketing-to-production.js
   ```

   The script will:

   - Read all marketing collections from your **local** database (`DATABASE_URL` in `.env`).
   - POST them to `PROD_URL/api/admin/import-marketing`.
   - Production replaces its marketing collections with the uploaded data.

3. **Auth**

   Production’s `ADMIN_PASSWORD` must match the `ADMIN_PASSWORD` in the environment when you run the script. The script sends `Authorization: Bearer <ADMIN_PASSWORD>`.

## Collections uploaded

- marketing_content_blocks  
- marketing_email_templates  
- marketing_links  
- marketing_org_branding  
- marketing_send_logs  
- marketing_send_queue  
- marketing_sequence_steps  
- marketing_sequences  
- marketing_template_variables  
- marketing_template_versions  
- marketing_user_preferences  

## Troubleshooting

- **Unauthorized** – Check `ADMIN_PASSWORD` matches production.
- **No marketing records found** – Your local DB has no rows in these collections; add data via the multi-org marketing UI first.
- **Connection refused / ENOTFOUND** – Check `PROD_URL` and that the production app is reachable.
