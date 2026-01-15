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
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Create Weekly Newsletter Template</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/emails/templates" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
				Cancel
			</a>
			<button type="submit" form="weekly-template-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
				<span class="hidden sm:inline">Create Weekly Newsletter Template</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<div class="mb-6 p-4 bg-hub-blue-50 border border-hub-blue-200 rounded-md">
		<h3 class="text-lg font-semibold text-hub-blue-900 mb-2">About This Template</h3>
		<p class="text-sm text-hub-blue-800 mb-3">
			This will create a pre-configured weekly newsletter template that includes:
		</p>
		<ul class="text-sm text-hub-blue-800 list-disc list-inside space-y-1 mb-3">
			<li>Upcoming events (public events in the next 7 days)</li>
			<li>Personal rotas (rotas assigned to the contact in the next 14 days)</li>
			<li>Professional styling and layout</li>
			<li>All personalization placeholders ({{firstName}}, {{name}}, etc.)</li>
		</ul>
		<p class="text-sm text-hub-blue-800">
			The template uses <code class="bg-hub-blue-100 px-1 rounded">{{upcomingEvents}}</code> and <code class="bg-hub-blue-100 px-1 rounded">{{rotaLinks}}</code> placeholders that will be automatically populated when sending newsletters.
		</p>
	</div>

	<form id="weekly-template-form" method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
	</form>
</div>

