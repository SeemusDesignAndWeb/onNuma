# Mailgun Email Setup (Alternative to Resend)

You can use **Mailgun** instead of Resend for sending emails by setting `EMAIL_PROVIDER=mailgun` and configuring Mailgun credentials.

## Environment Variables

Add to your `.env`:

```env
# Use Mailgun for sending email
EMAIL_PROVIDER=mailgun

# Mailgun (required when EMAIL_PROVIDER=mailgun)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com

# Optional: use EU region (default is US)
# MAILGUN_EU=true

# Sender address (shared; also used when provider is Resend)
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

- **MAILGUN_API_KEY**: From [Mailgun Dashboard](https://app.mailgun.com/app/account/security) → API Keys.
- **MAILGUN_DOMAIN**: Your sending domain (e.g. `mg.yourdomain.com` or a sandbox like `sandboxXXX.mailgun.org` for testing).
- **MAILGUN_EU**: Set to `true` or `1` if your Mailgun account is in the EU region.

## Resend (default)

To use Resend, omit `EMAIL_PROVIDER` or set:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

See [RESEND_SETUP.md](./RESEND_SETUP.md) for Resend-specific setup.

## Behaviour

- **EMAIL_PROVIDER**: `resend` (default) or `mailgun`.
- Contact form, confirmation emails, CRM newsletters, rota invites, and all other app emails use the chosen provider.
- The same interface is used internally; only the backend (Resend vs Mailgun) changes.

## Troubleshooting

- **MAILGUN_API_KEY is not set**: Set it when using `EMAIL_PROVIDER=mailgun`.
- **MAILGUN_DOMAIN is not set**: Use your verified Mailgun domain or sandbox domain.
- **FormData required**: Mailgun adapter needs Node 18+ (global `FormData`).
