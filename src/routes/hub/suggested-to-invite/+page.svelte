<script>
	import { page } from '$app/stores';

	$: suggestedPeople = $page.data?.suggestedPeople || [];
	$: organisationName = $page.data?.organisationName || 'Organisation';
</script>

<svelte:head>
	<title>Suggested to invite – {organisationName}</title>
</svelte:head>

<div class="max-w-3xl mx-auto px-4 py-6">
	<nav class="mb-6">
		<a href="/hub" class="text-sm font-medium text-theme-button-1 hover:underline">← Back to dashboard</a>
	</nav>

	<div class="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
		<div class="px-5 py-4 border-b border-gray-100">
			<h1 class="text-xl font-semibold text-gray-900">Suggested to invite</h1>
			<p class="text-sm text-gray-500 mt-0.5">Contacts who are registered but not yet participating in any rota</p>
		</div>
		<div class="p-5">
			{#if suggestedPeople.length === 0}
				<p class="text-sm text-gray-500">Everyone in your contacts has participated recently, or you have no contacts yet.</p>
				<a href="/hub/contacts" class="inline-block mt-3 text-sm font-medium text-theme-button-1 hover:underline">View contacts</a>
			{:else}
				<ul class="space-y-3">
					{#each suggestedPeople as person}
						<li class="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
							<div class="min-w-0 flex-1">
								<p class="font-medium text-gray-900">{person.name}</p>
								{#if person.email}
									<p class="text-sm text-gray-500 truncate">{person.email}</p>
								{/if}
							</div>
							<a href="/hub/suggested-to-invite/invite/{person.id}" class="hub-btn flex-shrink-0 bg-theme-button-2 text-white">Invite</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
