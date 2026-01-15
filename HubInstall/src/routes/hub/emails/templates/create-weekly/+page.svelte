<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}
</script>

<div class="bg-white shadow rounded-lg p-6">
	<h2 class="text-2xl font-bold text-gray-900 mb-6">Create Weekly Email Template</h2>

	<div class="mb-6 p-4 bg-hub-blue-50 border border-hub-blue-200 rounded-md">
		<h3 class="text-lg font-semibold text-hub-blue-900 mb-2">About This Template</h3>
		<p class="text-sm text-hub-blue-800 mb-3">
			This will create a pre-configured weekly email template that includes:
		</p>
		<ul class="text-sm text-hub-blue-800 list-disc list-inside space-y-1 mb-3">
			<li>Upcoming events (public events in the next 7 days)</li>
			<li>Personal rotas (rotas assigned to the contact in the next 7 days)</li>
			<li>Professional styling and layout</li>
			<li>All personalization placeholders ({{firstName}}, {{name}}, etc.)</li>
		</ul>
		<p class="text-sm text-hub-blue-800">
			The template uses <code class="bg-hub-blue-100 px-1 rounded">{{upcomingEvents}}</code> and <code class="bg-hub-blue-100 px-1 rounded">{{rotaLinks}}</code> placeholders that will be automatically populated when sending emails.
		</p>
	</div>

	<form method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		
		<div class="flex gap-2">
			<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
				Create Weekly Email Template
			</button>
			<a href="/hub/emails/templates" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
				Cancel
			</a>
		</div>
	</form>
</div>

