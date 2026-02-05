<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	const CONTACT_REMEMBER_KEY = 'egcc_contact_remember';

	export let contactInfo = {
		address: '542 Westhorne Avenue, Eltham, London, SE9 6RR',
		phone: '020 8850 1331',
		email: 'enquiries@egcc.co.uk',
		googleMapsUrl: ''
	};

	let formData = {
		name: '',
		email: '',
		phone: '',
		message: '',
		website: '' // Honeypot field - bots will fill this, humans won't see it
	};

	let rememberMe = false;

	let contactRememberInitialized = false;

	onMount(() => {
		if (browser) {
			try {
				const stored = localStorage.getItem(CONTACT_REMEMBER_KEY);
				if (stored) {
					const { name, email } = JSON.parse(stored);
					if (name && email) {
						formData = { ...formData, name, email };
						rememberMe = true;
					}
				}
			} catch (_) {}
			contactRememberInitialized = true;
		}
	});

	function saveRememberedContact() {
		if (rememberMe && formData.name?.trim() && formData.email?.trim()) {
			try {
				localStorage.setItem(
					CONTACT_REMEMBER_KEY,
					JSON.stringify({ name: formData.name.trim(), email: formData.email.trim() })
				);
			} catch (_) {}
		} else {
			try {
				localStorage.removeItem(CONTACT_REMEMBER_KEY);
			} catch (_) {}
		}
	}

	// Persist when "remember me" is checked (and clear when unchecked), but only after mount so we don't clear before load
	$: if (browser && contactRememberInitialized) {
		saveRememberedContact();
	}

	let formStartTime = Date.now();

	let success = false;
	let error = '';
	let submitting = false;
	let fieldErrors = {};

	function validateField(field, value) {
		switch (field) {
			case 'name':
				if (!value || value.trim().length < 2) {
					return 'Name must be at least 2 characters';
				}
				return '';
			case 'email':
				const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!value || !emailPattern.test(value)) {
					return 'Please enter a valid email address';
				}
				return '';
			case 'phone':
				if (!value || value.trim().length < 5) {
					return 'Please enter a valid phone number';
				}
				return '';
			case 'message':
				if (!value || value.trim().length < 10) {
					return 'Message must be at least 10 characters';
				}
				// Require multiple words (prevent single word spam)
				const words = value.trim().split(/\s+/).filter(word => word.length > 0);
				if (words.length < 2) {
					return 'Message must contain at least 2 words';
				}
				return '';
			default:
				return '';
		}
	}

	function handleBlur(field, value) {
		const error = validateField(field, value);
		if (error) {
			fieldErrors[field] = error;
		} else {
			delete fieldErrors[field];
		}
		fieldErrors = { ...fieldErrors };
	}

	function handleInput(field, value) {
		formData[field] = value;
		if (fieldErrors[field]) {
			const error = validateField(field, value);
			if (!error) {
				delete fieldErrors[field];
				fieldErrors = { ...fieldErrors };
			}
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();
		submitting = true;
		success = false;
		error = '';

		// Honeypot check - if this field is filled, it's a bot
		if (formData.website && formData.website.trim() !== '') {
			// Silently fail - don't let bots know they were caught
			submitting = false;
			return;
		}

		// Check minimum time - humans need at least 3 seconds to fill the form
		const timeSpent = (Date.now() - formStartTime) / 1000;
		if (timeSpent < 3) {
			error = 'Please take your time filling out the form.';
			submitting = false;
			return;
		}

		const errors = {};
		// Don't validate honeypot field
		['name', 'email', 'phone', 'message'].forEach((field) => {
			const fieldError = validateField(field, formData[field]);
			if (fieldError) {
				errors[field] = fieldError;
			}
		});

		if (Object.keys(errors).length > 0) {
			fieldErrors = errors;
			submitting = false;
			return;
		}

		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: formData.name,
					email: formData.email,
					phone: formData.phone,
					message: formData.message,
					formTime: timeSpent,
					website: formData.website || undefined // Honeypot - API rejects if filled
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				success = true;
				saveRememberedContact();
				formData = { name: '', email: '', phone: '', message: '', website: '' };
				if (rememberMe) {
					try {
						const stored = localStorage.getItem(CONTACT_REMEMBER_KEY);
						if (stored) {
							const { name, email } = JSON.parse(stored);
							formData.name = name || '';
							formData.email = email || '';
						}
					} catch (_) {}
				}
				fieldErrors = {};
				formStartTime = Date.now(); // Reset timer for next submission
				setTimeout(() => {
					success = false;
				}, 5000);
			} else {
				error = result.error || 'Failed to send message. Please try again.';
			}
		} catch (err) {
			error = 'Network error. Please check your connection and try again.';
			console.error('Form submission error:', err);
		} finally {
			submitting = false;
		}
	}
</script>

<section id="contact" class="py-20 bg-gray-100">
	<div class="container mx-auto px-4 max-w-4xl">
		<!-- Header -->
		<div class="text-center mb-12">
			<h2 class="text-4xl font-bold text-gray-900 mb-4">Contact Us</h2>
			<p class="text-gray-600">Get in touch with us</p>
		</div>

		<div class="grid md:grid-cols-2 gap-12">
			<!-- Contact Information -->
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Get in Touch</h3>
					<div class="space-y-4">
						<div>
							<p class="text-sm text-gray-500 mb-1">Address</p>
							<p class="text-gray-900">{contactInfo.address}</p>
						</div>
						<div>
							<p class="text-sm text-gray-500 mb-1">Phone</p>
							<a href="tel:{contactInfo.phone}" class="text-gray-900 hover:text-primary">
								{contactInfo.phone}
							</a>
						</div>
						<div>
							<p class="text-sm text-gray-500 mb-1">Email</p>
							<a href="mailto:{contactInfo.email}" class="text-gray-900 hover:text-primary">
								{contactInfo.email}
							</a>
						</div>
					</div>
				</div>

				<div class="pt-6 border-t border-gray-200">
					{#if contactInfo.googleMapsUrl}
						<iframe
							src={contactInfo.googleMapsUrl}
							width="100%"
							height="200"
							style="border:0;"
							title="Eltham Green Community Church Location"
							allowfullscreen
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
							allow="geolocation"
							class="w-full rounded"
						></iframe>
					{:else}
						<iframe
							src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2486.165401148919!2d0.03745377659428357!3d51.45511957180136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47d8a9a3cf8f6109%3A0xd441aa85176eadf7!2sEltham%20Green%20Community%20Church!5e0!3m2!1sen!2suk!4v1767649840277!5m2!1sen!2suk"
							width="100%"
							height="200"
							style="border:0;"
							title="Eltham Green Community Church Location"
							allowfullscreen
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
							allow="geolocation"
							class="w-full rounded"
						></iframe>
					{/if}
				</div>
			</div>

			<!-- Contact Form -->
			<div>
				<h3 class="text-lg font-semibold text-gray-900 mb-6">Send a Message</h3>

				{#if success}
					<div class="mb-6 p-4 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
						Message sent successfully! We'll get back to you soon.
					</div>
				{/if}

				{#if error}
					<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
						{error}
					</div>
				{/if}

				<form on:submit={handleSubmit} class="space-y-4">
					<!-- Name -->
					<div>
						<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
							Name <span class="text-red-500">*</span>
						</label>
						<input
							id="name"
							type="text"
							bind:value={formData.name}
							on:blur={() => handleBlur('name', formData.name)}
							on:input={(e) => handleInput('name', e.currentTarget.value)}
							required
							class="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent {fieldErrors.name
								? 'border-red-500'
								: ''}"
						/>
						{#if fieldErrors.name}
							<p class="mt-1 text-sm text-red-600">{fieldErrors.name}</p>
						{/if}
					</div>

					<!-- Email -->
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
							Email <span class="text-red-500">*</span>
						</label>
						<input
							id="email"
							type="email"
							bind:value={formData.email}
							on:blur={() => handleBlur('email', formData.email)}
							on:input={(e) => handleInput('email', e.currentTarget.value)}
							required
							class="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent {fieldErrors.email
								? 'border-red-500'
								: ''}"
						/>
						{#if fieldErrors.email}
							<p class="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
						{/if}
					</div>

					<!-- Remember me -->
					<div class="flex items-center gap-2">
						<input
							id="remember-me"
							type="checkbox"
							bind:checked={rememberMe}
							class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
						/>
						<label for="remember-me" class="text-sm text-gray-600">
							Remember my name and email for next time
						</label>
					</div>

					<!-- Phone -->
					<div>
						<label for="phone" class="block text-sm font-medium text-gray-700 mb-1">
							Phone <span class="text-red-500">*</span>
						</label>
						<input
							id="phone"
							type="tel"
							bind:value={formData.phone}
							on:blur={() => handleBlur('phone', formData.phone)}
							on:input={(e) => handleInput('phone', e.currentTarget.value)}
							required
							class="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent {fieldErrors.phone
								? 'border-red-500'
								: ''}"
						/>
						{#if fieldErrors.phone}
							<p class="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>
						{/if}
					</div>

					<!-- Message -->
					<div>
						<label for="message" class="block text-sm font-medium text-gray-700 mb-1">
							Message <span class="text-red-500">*</span>
						</label>
						<textarea
							id="message"
							bind:value={formData.message}
							on:blur={() => handleBlur('message', formData.message)}
							on:input={(e) => handleInput('message', e.currentTarget.value)}
							rows="5"
							required
							class="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none {fieldErrors.message
								? 'border-red-500'
								: ''}"
						></textarea>
						{#if fieldErrors.message}
							<p class="mt-1 text-sm text-red-600">{fieldErrors.message}</p>
						{/if}
					</div>

					<!-- Honeypot field - hidden from users but visible to bots -->
					<div style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;" aria-hidden="true">
						<label for="website">Website (leave blank)</label>
						<input
							type="text"
							id="website"
							name="website"
							tabindex="-1"
							autocomplete="off"
							bind:value={formData.website}
						/>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={submitting}
						class="w-full bg-primary text-white px-6 py-3 rounded font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if submitting}
							Sending...
						{:else}
							Send Message
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</section>
