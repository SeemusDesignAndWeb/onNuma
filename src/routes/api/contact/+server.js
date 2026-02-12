import { json } from '@sveltejs/kit';
import { getContactInfo } from '$lib/server/database';
import { sendContactEmail, sendConfirmationEmail } from '$lib/server/resend';
import { env } from '$env/dynamic/private';

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

// Check if content looks like spam
function isSpamContent(text) {
	if (!text || typeof text !== 'string') return false;
	
	// Check for random character patterns (like "NnRFwQBRLAIBqnJM")
	// Random strings typically have high character diversity and mixed case
	const randomPattern = /^[A-Za-z]{10,}$/;
	if (randomPattern.test(text.trim())) {
		const uniqueChars = new Set(text.toLowerCase().split('')).size;
		const totalChars = text.length;
		// If more than 70% of characters are unique, it's likely random
		if (uniqueChars / totalChars > 0.7) {
			return true;
		}
	}
	
	// Check for excessive capital letters (spam often has random caps)
	const capitalRatio = (text.match(/[A-Z]/g) || []).length / text.length;
	if (capitalRatio > 0.5 && text.length > 10) {
		return true;
	}
	
	// Check for suspicious patterns
	const suspiciousPatterns = [
		/^[A-Za-z]{15,}$/, // Very long random strings
		/[A-Z]{5,}/, // Multiple consecutive capitals
		/[a-z]{10,}[A-Z]{5,}/, // Mixed case patterns
	];
	
	return suspiciousPatterns.some(pattern => pattern.test(text));
}

// Rate limiting check
function checkRateLimit(ip) {
	const now = Date.now();
	const userRequests = rateLimitMap.get(ip) || [];
	
	// Remove old requests outside the window
	const recentRequests = userRequests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
	
	if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
		return false; // Rate limit exceeded
	}
	
	// Add current request
	recentRequests.push(now);
	rateLimitMap.set(ip, recentRequests);
	
	// Clean up old entries periodically (every 100 requests)
	if (rateLimitMap.size > 100) {
		for (const [key, requests] of rateLimitMap.entries()) {
			const filtered = requests.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
			if (filtered.length === 0) {
				rateLimitMap.delete(key);
			} else {
				rateLimitMap.set(key, filtered);
			}
		}
	}
	
	return true; // Within rate limit
}

export const POST = async (event) => {
	try {
		const body = await event.request.json();
		const { name, email, phone, message, formTime, website: honeypot } = body;

		// Honeypot: if filled, treat as bot - return success without sending (silent reject)
		if (honeypot != null && String(honeypot).trim() !== '') {
			return json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
		}
		
		// Get client IP for rate limiting
		let clientIp = 'unknown';
		try {
			clientIp = event.getClientAddress();
		} catch (e) {
			// Fallback to headers if getClientAddress not available
			const forwarded = event.request.headers.get('x-forwarded-for');
			clientIp = forwarded ? forwarded.split(',')[0].trim() : event.request.headers.get('x-real-ip') || 'unknown';
		}
		
		// Rate limiting check
		if (!checkRateLimit(clientIp)) {
			console.warn('Rate limit exceeded for IP:', clientIp);
			return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
		}
		
		// Check minimum form time (should be at least 3 seconds)
		if (formTime && formTime < 3) {
			console.warn('Form submitted too quickly:', formTime, 'seconds');
			return json({ error: 'Please take your time filling out the form.' }, { status: 400 });
		}

		// Validation
		if (!name || !email || !message) {
			return json({ error: 'Name, email, and message are required' }, { status: 400 });
		}

		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(email)) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}
		
		// Spam detection - check for suspicious content
		if (isSpamContent(name)) {
			console.warn('Spam detected in name field:', name);
			// Silently reject - don't let spammers know they were caught
			return json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
		}
		
		if (phone && isSpamContent(phone)) {
			console.warn('Spam detected in phone field:', phone);
			return json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
		}
		
		if (isSpamContent(message)) {
			console.warn('Spam detected in message field:', message);
			return json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
		}
		
		// Additional validation - check for reasonable content length
		if (name.length > 100 || message.length > 5000) {
			return json({ error: 'Content too long. Please keep your message concise.' }, { status: 400 });
		}
		
		// Require multiple words in message (prevent single word spam)
		const messageWords = message.trim().split(/\s+/).filter(word => word.length > 0);
		if (messageWords.length < 2) {
			console.warn('Spam detected: Message has less than 2 words');
			// Silently reject - don't let spammers know they were caught
			return json({ success: true, message: 'Thank you for your message. We will get back to you soon!' });
		}

		// Get contact email from database
		const contactInfo = getContactInfo();
		const recipientEmail = contactInfo.email || 'enquiries@egcc.co.uk';

		// Get sender email from environment (Mailgun – must be from your verified sending domain)
		let senderEmail = env.MAILGUN_FROM_EMAIL || (env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : '');
		if (!senderEmail) {
			console.warn('MAILGUN_FROM_EMAIL not set. Set it to a verified sender address for your Mailgun domain.');
		}

		// Log email configuration (without sensitive data)
		console.log('Email configuration:', {
			recipientEmail,
			senderEmail,
			hasMailgun: !!(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN)
		});

		// Send email to church
		try {
			await sendContactEmail({
				to: recipientEmail,
				from: senderEmail,
				name,
				email,
				phone,
				message,
				replyTo: email
			});

			// Send confirmation email to the submitter
			try {
				await sendConfirmationEmail({
					to: email,
					from: senderEmail,
					name
				});
			} catch (confirmationError) {
				// Log but don't fail the request if confirmation email fails
				console.error('Failed to send confirmation email:', confirmationError);
			}

			return json({
				success: true,
				message: 'Thank you for your message. We will get back to you soon!'
			});
		} catch (emailError) {
			console.error('Email sending error:', emailError);
			console.error('Error details:', {
				message: emailError.message,
				name: emailError.name,
				stack: emailError.stack,
				response: emailError.response || emailError.body
			});
			return json(
				{
					error: 'Failed to send email. Please try again or contact us directly.',
					details: process.env.NODE_ENV === 'development' ? emailError.message : undefined
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Contact form error:', error);
		return json({ error: 'Failed to send message. Please try again.' }, { status: 500 });
	}
};
