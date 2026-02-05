<script>
	import { createEventDispatcher, onMount } from 'svelte';

	export let open = false;

	const dispatch = createEventDispatcher();

	let name = '';
	let email = '';
	let phone = '';
	let message = '';
	/** Honeypot - hidden from users, bots fill it; if set, we don't submit */
	let website = '';
	let submitting = false;
	let success = false;
	let error = '';
	let openedAt = 0;

	function close() {
		if (submitting) return;
		dispatch('close');
		// Reset after animation
		setTimeout(() => {
			name = '';
			email = '';
			phone = '';
			message = '';
			website = '';
			success = false;
			error = '';
		}, 200);
	}


	$: if (open && openedAt === 0) {
		openedAt = Date.now();
	}
	$: if (!open) {
		openedAt = 0;
	}

	async function handleSubmit(e) {
		e.preventDefault();
		if (submitting) return;
		// Honeypot: if filled, treat as bot - silently abort (don't submit, don't show error)
		if (website && String(website).trim() !== '') {
			return;
		}
		error = '';
		submitting = true;
		const formTime = Math.floor((Date.now() - openedAt) / 1000);

		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, phone: phone || undefined, message, formTime, website: website || undefined })
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				error = data.error || 'Something went wrong. Please try again.';
				submitting = false;
				return;
			}
			success = true;
			setTimeout(() => close(), 2500);
		} catch (err) {
			error = 'Could not send. Please try again.';
		} finally {
			submitting = false;
		}
	}

	// Close on Escape when open
	function handleKeydown(e) {
		if (open && e.key === 'Escape') close();
	}
	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="contact-popup-title"
	>
		<button
			type="button"
			class="absolute inset-0 cursor-default z-0"
			aria-label="Close overlay"
			on:click={close}
		/>
		<div
			class="relative z-10 bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
			role="document"
		>
			<div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200">
				<h2 id="contact-popup-title" class="text-xl font-bold text-brand-blue">Contact us</h2>
				<button
					type="button"
					class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
					aria-label="Close"
					on:click={close}
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
				</button>
			</div>

			{#if success}
				<div class="px-6 py-10 text-center">
					<p class="text-brand-green font-semibold text-lg">Thank you for your message.</p>
					<p class="text-slate-600 mt-2">We'll get back to you soon.</p>
				</div>
			{:else}
				<form on:submit={handleSubmit} class="p-6 space-y-4">
					<div>
						<label for="contact-name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
						<input
							id="contact-name"
							type="text"
							bind:value={name}
							required
							class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue"
							placeholder="Your name"
						/>
					</div>
					<div>
						<label for="contact-email" class="block text-sm font-medium text-slate-700 mb-1">Email *</label>
						<input
							id="contact-email"
							type="email"
							bind:value={email}
							required
							class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue"
							placeholder="you@example.com"
						/>
					</div>
					<div>
						<label for="contact-phone" class="block text-sm font-medium text-slate-700 mb-1">Phone</label>
						<input
							id="contact-phone"
							type="tel"
							bind:value={phone}
							class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue"
							placeholder="Optional"
						/>
					</div>
					<!-- Honeypot: hidden from users, bots fill it -->
					<div class="absolute -left-[9999px] opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true">
						<label for="contact-website">Website</label>
						<input
							id="contact-website"
							type="text"
							tabindex="-1"
							autocomplete="off"
							bind:value={website}
						/>
					</div>
					<div>
						<label for="contact-message" class="block text-sm font-medium text-slate-700 mb-1">Message *</label>
						<textarea
							id="contact-message"
							bind:value={message}
							required
							rows="4"
							class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-blue/50 focus:border-brand-blue resize-none"
							placeholder="How can we help?"
						></textarea>
					</div>
					{#if error}
						<p class="text-sm text-red-600">{error}</p>
					{/if}
					<div class="flex gap-3 pt-2">
						<button
							type="button"
							class="flex-1 py-2.5 px-4 rounded-lg font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
							on:click={close}
							disabled={submitting}
						>
							Cancel
						</button>
						<button
							type="submit"
							class="flex-1 py-2.5 px-4 rounded-lg font-semibold bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={submitting}
						>
							{submitting ? 'Sending…' : 'Send'}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
