# Rota Reminder Notifications Setup Guide

This guide explains how to set up automated email reminders for upcoming rota assignments. The system sends email notifications to contacts 3 days before their assigned rota occurrences.

## What It Does

The rota reminder system:
- Automatically finds all rota assignments for occurrences starting in 3 days (configurable)
- Sends personalized email reminders to each assigned contact
- Includes event details, date/time, location, and a link to view the rota
- Runs as a background job via a secure API endpoint

## Prerequisites

- The Hub CRM system must be installed and configured
- Resend email service must be set up and working
- Contacts must have valid email addresses
- Rotas must be created with assigned contacts

## Step 1: Configure Environment Variables

### Required Environment Variable

Add this to your `.env` file (local) and Railway environment variables (production):

```env
# Rota Reminder Cron Job Security
# Generate a secure secret token with:
# openssl rand -base64 32
ROTA_REMINDER_CRON_SECRET=your-generated-secret-token-here
```

**Generate the secret:**
```bash
openssl rand -base64 32
```

Copy the output and use it as your `ROTA_REMINDER_CRON_SECRET` value.

### Optional Environment Variable

```env
# Days ahead to send reminders (defaults to 3 if not set)
ROTA_REMINDER_DAYS_AHEAD=3
```

## Step 2: Set Up the Cron Job

You have two options for running the cron job:

### Option A: External Cron Service (Recommended)

Use a free external cron service like [cron-job.org](https://cron-job.org) or [EasyCron](https://www.easycron.com):

1. **Sign up** for a free account at your chosen cron service
2. **Create a new cron job** with these settings:
   - **URL**: `https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET_TOKEN`
   - **Schedule**: Daily at 9:00 AM (or your preferred time)
     - Cron expression: `0 9 * * *` (9 AM every day)
   - **Method**: GET or POST (both work)
   - **Timeout**: 60 seconds (should be plenty)

3. **Test the endpoint** first:
   ```bash
   curl "https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET_TOKEN"
   ```

4. **Save and activate** the cron job

**Example cron-job.org setup:**
- URL: `https://yourdomain.com/api/cron/rota-reminders?secret=abc123xyz...`
- Schedule: `0 9 * * *` (9 AM daily)
- HTTP Method: GET
- Timeout: 60 seconds

### Option B: Railway Cron (If Available)

If Railway offers cron functionality in your plan:

1. Go to your Railway project dashboard
2. Create a new **Cron** service
3. Configure:
   - **Schedule**: `0 9 * * *` (9 AM daily)
   - **Command**: `curl "https://your-domain.com/api/cron/rota-reminders?secret=$ROTA_REMINDER_CRON_SECRET"`
   - Or use Railway's HTTP cron feature if available

**Note**: Railway's cron feature availability depends on your plan. External cron services are often more reliable and easier to configure.

## Step 3: Test the Setup

### Test the Endpoint Manually

Before setting up the cron job, test that the endpoint works:

```bash
# Replace with your actual domain and secret
curl "https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "message": "Rota reminders processed for 3 days ahead",
  "results": {
    "totalContacts": 5,
    "totalAssignments": 7,
    "sent": 7,
    "failed": 0
  },
  "timestamp": "2024-01-15T09:00:00.000Z"
}
```

### Test with Different Days Ahead

You can test with a different number of days:

```bash
curl "https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET&daysAhead=1"
```

### Test Error Handling

Test that unauthorized access is blocked:

```bash
# This should return 401 Unauthorized
curl "https://your-domain.com/api/cron/rota-reminders?secret=wrong-secret"
```

## Step 4: Verify It's Working

After the cron job runs:

1. **Check the cron service logs** to see if the request was made
2. **Check your application logs** (Railway logs) for:
   ```
   [Rota Reminders API] Starting reminder job for 3 days ahead
   [Rota Reminders] Sent reminder to contact@example.com for Event Name - Role Name
   [Rota Reminders API] Reminder job completed: 5 sent, 0 failed
   ```

3. **Check recipient email inboxes** - contacts should receive reminder emails

4. **Check the API response** in your cron service logs to see the summary

## How It Works

1. **Daily Execution**: The cron job calls the API endpoint once per day
2. **Finding Assignments**: The system:
   - Loads all rotas, occurrences, events, and contacts
   - Finds occurrences starting exactly N days from now (default: 3 days)
   - Matches rotas to those occurrences
   - Identifies assigned contacts
3. **Sending Emails**: For each contact with an upcoming assignment:
   - Generates a personalized reminder email
   - Includes event details, date/time, location
   - Includes a link to view the rota signup page
   - Sends via Resend email service
4. **Error Handling**: If an email fails, it logs the error but continues processing other contacts

## Troubleshooting

### No Emails Being Sent

**Check:**
1. Are there rotas with assignments for occurrences 3 days ahead?
2. Do the assigned contacts have valid email addresses?
3. Is Resend configured correctly? (`RESEND_API_KEY` and `RESEND_FROM_EMAIL`)
4. Check application logs for errors

**Test manually:**
```bash
curl "https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET"
```

### 401 Unauthorized Error

**Problem**: The secret token doesn't match

**Solution**:
1. Verify `ROTA_REMINDER_CRON_SECRET` is set in your environment variables
2. Ensure the secret in the URL matches the environment variable exactly
3. Check for extra spaces or encoding issues in the URL

### 500 Internal Server Error

**Check application logs** for:
- Database/file access errors
- Resend API errors
- Missing environment variables

**Common issues**:
- `RESEND_API_KEY` not set or invalid
- `RESEND_FROM_EMAIL` not verified in Resend
- Data directory permissions issues

### Emails Going to Spam

**Solutions**:
1. Ensure `RESEND_FROM_EMAIL` is verified in your Resend account
2. Verify your domain in Resend (recommended for production)
3. Check Resend dashboard for delivery issues
4. Ask recipients to check spam folders and mark as "Not Spam"

### Wrong Timing

**Problem**: Reminders sent at wrong time or wrong days ahead

**Solutions**:
1. Adjust the cron schedule to run at your preferred time
2. Change `ROTA_REMINDER_DAYS_AHEAD` environment variable
3. Or use `?daysAhead=N` query parameter in the cron URL

### Cron Job Not Running

**Check**:
1. Verify the cron service is active/enabled
2. Check cron service logs for errors
3. Verify the URL is correct and accessible
4. Test the endpoint manually to ensure it works
5. Check if your cron service has usage limits (free plans may have restrictions)

## Best Practices

1. **Run Daily**: Set the cron to run once per day (e.g., 9 AM)
2. **Monitor Logs**: Check logs periodically to ensure it's working
3. **Test First**: Always test manually before setting up the cron
4. **Secure Secret**: Keep `ROTA_REMINDER_CRON_SECRET` secure and never commit it to git
5. **Verify Emails**: Periodically check that contacts are receiving reminders
6. **Adjust Timing**: Consider your timezone - 9 AM in one timezone may be different in another

## Advanced Configuration

### Custom Days Ahead

You can override the default 3 days in two ways:

1. **Environment variable** (applies to all requests):
   ```env
   ROTA_REMINDER_DAYS_AHEAD=7
   ```

2. **Query parameter** (per request):
   ```
   https://your-domain.com/api/cron/rota-reminders?secret=YOUR_SECRET&daysAhead=7
   ```

### Multiple Reminder Schedules

You can set up multiple cron jobs for different reminder schedules:

- **7 days ahead**: `?daysAhead=7` (early reminder)
- **3 days ahead**: `?daysAhead=3` (standard reminder)
- **1 day ahead**: `?daysAhead=1` (final reminder)

Just create separate cron jobs with different `daysAhead` parameters.

## Security Notes

- The endpoint is protected by the `ROTA_REMINDER_CRON_SECRET` token
- Never expose the secret token in public repositories
- Use HTTPS for the cron job URL (required in production)
- The secret should be a strong, randomly generated value (32+ characters)
- Rotate the secret periodically for enhanced security

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test the endpoint manually to isolate the issue
4. Check Resend dashboard for email delivery status
5. Review the cron service logs for request/response details

## Summary Checklist

- [ ] Generated `ROTA_REMINDER_CRON_SECRET` with `openssl rand -base64 32`
- [ ] Set `ROTA_REMINDER_CRON_SECRET` in environment variables (local and production)
- [ ] Optionally set `ROTA_REMINDER_DAYS_AHEAD` (defaults to 3)
- [ ] Tested the endpoint manually with curl
- [ ] Set up cron job with external service or Railway
- [ ] Verified cron job is running and calling the endpoint
- [ ] Checked application logs for successful execution
- [ ] Verified contacts are receiving reminder emails
- [ ] Monitored for a few days to ensure reliability

Once all items are checked, your rota reminder system is fully operational!
