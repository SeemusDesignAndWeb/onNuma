/**
 * Contact form and confirmation emails – implemented with Mailgun.
 * Kept filename "resend.js" for backward compatibility; imports use this path.
 */
import { env } from '$env/dynamic/private';
import { rateLimitedSend } from '$lib/crm/server/emailRateLimiter.js';
import { sendEmail } from '$lib/server/mailgun.js';

const defaultFrom = () => env.MAILGUN_FROM_EMAIL || env.RESEND_FROM_EMAIL || '';

/**
 * Get base URL for absolute links in emails
 */
function getBaseUrl() {
	return env.APP_BASE_URL || 'http://localhost:5173';
}

/**
 * Generate email branding HTML with logo and site link
 */
function getEmailBranding() {
	const baseUrl = getBaseUrl();
	const logoUrl = `${baseUrl}/images/egcc-color.png`;
	return `
		<div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
			<a href="${baseUrl}" style="display: inline-block; text-decoration: none;">
				<img src="${logoUrl}" alt="Eltham Green Community Church" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
			</a>
		</div>
	`;
}

/**
 * Send a contact form email via Mailgun
 */
export async function sendContactEmail({
	to,
	from = defaultFrom(),
	name,
	email,
	phone,
	message,
	replyTo
}) {
	try {
		console.log('Sending contact email:', { to, from, replyTo: replyTo || email, name });
		const branding = getEmailBranding();
		await rateLimitedSend(() =>
			sendEmail({
				from,
				to: [to],
				replyTo: replyTo || email,
				subject: `New Contact Form Submission from ${name}`,
				html: `
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="utf-8">
						<meta name="viewport" content="width=device-width, initial-scale=1.0">
						<title>New Contact Form Submission</title>
					</head>
					<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
						<div style="background: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e5e7eb;">
							${branding}
							<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
								<h1 style="color: white; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
							</div>
							<div style="background: #f9fafb; padding: 30px; border-radius: 6px; border: 1px solid #e5e7eb;">
								<div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
									<h2 style="color: #2d7a32; margin-top: 0; font-size: 18px; border-bottom: 2px solid #2d7a32; padding-bottom: 10px;">Contact Information</h2>
									<table style="width: 100%; border-collapse: collapse;">
										<tr><td style="padding: 8px 0; font-weight: 600; color: #666; width: 120px;">Name:</td><td style="padding: 8px 0; color: #333;">${name}</td></tr>
										<tr><td style="padding: 8px 0; font-weight: 600; color: #666;">Email:</td><td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #2d7a32; text-decoration: none;">${email}</a></td></tr>
										${phone ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #666;">Phone:</td><td style="padding: 8px 0;"><a href="tel:${phone}" style="color: #2d7a32; text-decoration: none;">${phone}</a></td></tr>` : ''}
									</table>
								</div>
								<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
									<h2 style="color: #2d7a32; margin-top: 0; font-size: 18px; border-bottom: 2px solid #2d7a32; padding-bottom: 10px;">Message</h2>
									<div style="color: #333; white-space: pre-wrap; line-height: 1.8;">${message.replace(/\n/g, '<br>')}</div>
								</div>
								<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
									<p style="margin: 0;">This email was sent from the contact form on Eltham Green Community Church website.</p>
									<p style="margin: 5px 0 0 0;"><a href="mailto:${email}" style="color: #2d7a32; text-decoration: none;">Reply to ${name}</a></p>
								</div>
							</div>
						</div>
					</body>
					</html>
				`,
				text: `New Contact Form Submission

Contact Information:
Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ''}

Message:
${message}

---
This email was sent from the contact form on Eltham Green Community Church website.
Reply to: ${email}`.trim()
			})
		);
	} catch (error) {
		console.error('Mailgun email error:', error);
		if (error.message && error.message.includes('domain')) {
			console.error('Domain/sender may not be verified in Mailgun. Check MAILGUN_DOMAIN and sender address.');
		}
		throw error;
	}
}

/**
 * Send a confirmation email to the form submitter
 */
export async function sendConfirmationEmail({ to, from = defaultFrom(), name }) {
	const branding = getEmailBranding();
	await rateLimitedSend(() =>
		sendEmail({
			from,
			to: [to],
			subject: 'Thank you for contacting Eltham Green Community Church',
			html: `
				<!DOCTYPE html>
				<html>
				<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Thank You</title></head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e5e7eb;">
						${branding}
						<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
							<h1 style="color: white; margin: 0; font-size: 24px;">Thank You, ${name}!</h1>
						</div>
						<div style="background: #f9fafb; padding: 30px; border-radius: 6px; border: 1px solid #e5e7eb;">
							<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center;">
								<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">We've received your message and will get back to you as soon as possible.</p>
								<p style="color: #666; font-size: 14px; margin: 0;">If you have any urgent questions, please feel free to call us at <a href="tel:02088501331" style="color: #2d7a32; text-decoration: none;">020 8850 1331</a>.</p>
							</div>
							<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
								<p style="margin: 0;">Eltham Green Community Church</p>
								<p style="margin: 5px 0 0 0;">542 Westhorne Avenue, Eltham, London, SE9 6RR</p>
							</div>
						</div>
					</div>
				</body>
				</html>
			`,
			text: `Thank You, ${name}!

We've received your message and will get back to you as soon as possible.

If you have any urgent questions, please feel free to call us at 020 8850 1331.

Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR`.trim()
		})
	);
}
