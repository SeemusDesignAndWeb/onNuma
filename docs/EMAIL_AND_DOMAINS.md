# Email links and domain configuration

All transactional and marketing emails include links (e.g. “View in My Hub”, unsubscribe, magic links, password reset). Those links must use the **correct public URL** so recipients don’t get broken or internal URLs.

## Required: `APP_BASE_URL`

In **production**, set the **canonical public URL** of the site (no trailing slash):

```env
APP_BASE_URL=https://www.onnuma.com
```

(or your main app domain, e.g. `https://yourapp.com`)

- **Reminders (schedule reminders cron)** – “View in My Hub” and logo use this when the cron is called (e.g. from Railway) so links are not tied to the cron request URL.
- **Marketing cron** – Sequence and send-queue emails use this so links work even when the cron is hit at an internal URL.
- **Contact form / resend** – Logo and site link in confirmation emails use this (no request context).
- **Any email sent without a request** or when the request origin is localhost – `getBaseUrl()` in `email.js` prefers `APP_BASE_URL` so links are still correct.

If `APP_BASE_URL` is not set in production, email links can point to `localhost` or an internal host when triggered by cron or background jobs.

## How the base URL is chosen

1. **Hub custom domain** – If the user is on an org hub (e.g. `https://hub.egcc.co.uk`), `event.locals.hubBaseUrl` is set and all links in that request’s emails use that origin.
2. **`APP_BASE_URL`** – Used when there is no hub context, or when the request origin is localhost/internal so cron/background emails still get the public URL.
3. **Request origin** – Fallback when `APP_BASE_URL` is not set (e.g. local dev).
4. **localhost** – Last fallback for local development.

## Email types and where base URL comes from

| Email type | Base URL source |
|------------|-----------------|
| Schedule reminders (cron) | `APP_BASE_URL` (preferred) or cron request URL |
| Marketing sequences / send queue (cron) | `APP_BASE_URL` (preferred) or cron request URL |
| Newsletter send (Hub UI) | Request origin; org’s `hubDomain` used when set |
| Thank-you (contribution) | Request; `hubBaseUrl` from org when set |
| Magic link (MyHub login) | Org’s hub URL or request origin |
| Password reset (Hub) | `hubBaseUrl` when set, else request origin |
| Admin welcome / verification | `hubBaseUrl` when set (org’s hub), else `APP_BASE_URL` / request |
| Member signup confirmation | Request origin / `APP_BASE_URL` |
| Contact form (resend) | `APP_BASE_URL` only (no request) |

## Cron endpoints

- **`/api/cron/schedule-reminders`** – Uses `APP_BASE_URL` for the mock event so reminder emails get the correct “View in My Hub” and logo URLs.
- **`/api/cron/marketing-emails`** – Uses `APP_BASE_URL` first for sequence evaluation and send queue.

Both are protected by secrets (`SCHEDULE_REMINDER_CRON_SECRET`, `MARKETING_CRON_SECRET`). Call them with the **public** URL in production (e.g. `https://www.onnuma.com/api/cron/schedule-reminders?secret=...`) so that even if the runner uses an internal URL, `APP_BASE_URL` still drives link generation.

## Custom hub domains

Organisations can set `hubDomain` (e.g. `hub.egcc.co.uk`). When an admin or volunteer is on that domain, emails sent in that context use `https://hub.egcc.co.uk` (or the configured domain) for links and logo. No extra env var is needed; it is read from the organisation record.
