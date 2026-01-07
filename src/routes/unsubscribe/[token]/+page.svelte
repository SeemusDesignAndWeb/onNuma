<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: contact = data.contact;
	$: error = data.error;
	$: formResult = $page.form;

	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success(formResult.message || 'You have been successfully unsubscribed.');
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}
</script>

<svelte:head>
	<title>Unsubscribe - Eltham Green Community Church</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div class="bg-white shadow-lg rounded-lg p-8">
			{#if error}
				<div class="text-center">
					<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
						<svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</div>
					<h2 class="text-2xl font-bold text-gray-900 mb-2">Unsubscribe Error</h2>
					<p class="text-gray-600 mb-6">{error}</p>
					<a href="/" class="text-brand-blue hover:text-brand-blue/80 font-medium">
						Return to Home
					</a>
				</div>
			{:else if formResult?.success}
				<div class="text-center">
					<div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
						<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h2 class="text-2xl font-bold text-gray-900 mb-2">Unsubscribed Successfully</h2>
					<p class="text-gray-600 mb-6">
						{formResult.message || 'You have been successfully unsubscribed from our newsletter.'}
					</p>
					{#if contact}
						<p class="text-sm text-gray-500 mb-6">
							{contact.email} will no longer receive newsletter emails.
						</p>
					{/if}
					<a href="/" class="inline-block bg-brand-blue text-white px-6 py-2 rounded-md hover:bg-opacity-90 transition-all font-medium">
						Return to Home
					</a>
				</div>
			{:else if contact}
				<div class="text-center">
					<h2 class="text-2xl font-bold text-gray-900 mb-4">Unsubscribe from Newsletter</h2>
					<p class="text-gray-600 mb-6">
						{#if contact.firstName || contact.lastName}
							{contact.firstName} {contact.lastName}
						{/if}
						<br />
						<span class="text-sm text-gray-500">{contact.email}</span>
					</p>
					{#if contact.subscribed === false}
						<div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
							<p class="text-sm text-yellow-800">
								You are already unsubscribed from our newsletter.
							</p>
						</div>
					{:else}
						<p class="text-gray-600 mb-6">
							Are you sure you want to unsubscribe from our newsletter? You will no longer receive updates about events, services, and church news.
						</p>
						<form method="POST" action="?/unsubscribe" use:enhance>
							<button
								type="submit"
								class="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-all font-medium"
							>
								Unsubscribe
							</button>
						</form>
					{/if}
					<div class="mt-6">
						<a href="/" class="text-sm text-gray-500 hover:text-gray-700">
							Return to Home
						</a>
					</div>
				</div>
			{:else}
				<div class="text-center">
					<p class="text-gray-600">Loading...</p>
				</div>
			{/if}
		</div>
	</div>
</div>

