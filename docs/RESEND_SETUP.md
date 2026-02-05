# Resend Email Setup Guide

This project uses [Resend](https://resend.com) for sending emails from the contact form.

## Environment Variables

Add the following to your `.env` file:

```env
RESEND_API_KEY=re_C88Tpi9d_5uF8M4U2R8r4NbyTwjHBVZ6A
RESEND_FROM_EMAIL=onboarding@resend.dev
```

**Note:** The API key is already configured in the code as a fallback, but it's recommended to use environment variables for security.

## Domain Verification

For production use, you should:

1. **Verify your domain** in Resend Dashboard:
   - Go to [Resend Dashboard](https://resend.com/domains)
   - Add your domain (e.g., `egcc.co.uk`)
   - Add the required DNS records
   - Wait for verification

2. **Update the sender email**:
   - Once your domain is verified, update `RESEND_FROM_EMAIL` in your `.env` file
   - Use an email from your verified domain (e.g., `noreply@egcc.co.uk` or `contact@egcc.co.uk`)

## How It Works

When someone submits the contact form:

1. **Email to Church**: An email is sent to the church's contact email (from database) with:
   - Sender's name, email, phone (if provided)
   - The message content
   - Reply-to set to the sender's email

2. **Confirmation Email**: An automatic confirmation email is sent to the form submitter

## Email Templates

The emails use HTML templates with:
- Professional styling
- Church branding colors
- Responsive design
- Plain text fallback

## Testing

In development, emails will be sent using the default Resend sender (`onboarding@resend.dev`). Make sure to check your spam folder if emails don't arrive.

## Production Checklist

- [ ] Verify your domain in Resend
- [ ] Set `RESEND_FROM_EMAIL` to a verified email address
- [ ] Test the contact form
- [ ] Check that both notification and confirmation emails are received
- [ ] Monitor Resend dashboard for delivery issues

## Troubleshooting

- **Emails not sending**: Check Resend dashboard for error messages
- **Emails going to spam**: Verify your domain and set up SPF/DKIM records
- **API errors**: Verify your API key is correct and has proper permissions

