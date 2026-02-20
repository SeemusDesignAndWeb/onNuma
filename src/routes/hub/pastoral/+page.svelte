<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { markNotificationSeen } from '$lib/crm/utils/markNotificationSeen.js';

	$: data = $page.data || {};
	$: flags = data.flags || [];

	onMount(() => {
		if (flags.length > 0) {
			markNotificationSeen('pastoral_concern', flags.map((f) => f.flag.id));
		}
	});
</script>

<svelte:head>
	<title>Pastoral Care | Hub</title>
</svelte:head>

<div class="mb-4">
	<h2 class="text-xl sm:text-2xl font-bold">Pastoral Care</h2>
	<p class="text-gray-600 text-sm mt-1">Volunteers who may benefit from a personal check-in. Private to coordinators and team leaders.</p>
</div>

<div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
	{#if flags.length === 0}
		<div class="px-6 py-12 text-center text-gray-500">
			<p class="text-base">No active pastoral flags.</p>
			<p class="text-sm mt-1">A flag is raised when a volunteer misses 3 or more sessions in 8 weeks. Record absences from a volunteer's profile.</p>
		</div>
	{:else}
		<ul class="divide-y divide-gray-200">
			{#each flags as { flag, contactName, contactId }}
				<li class="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50">
					<div class="min-w-0">
						<a href="/hub/contacts/{contactId}" class="font-medium text-theme-button-1 hover:underline">{contactName}</a>
						<p class="text-sm text-gray-700 mt-0.5">{flag.message}</p>
						{#if flag.pastoralNote}
							<p class="text-sm text-gray-500 mt-1 italic">Note: {flag.pastoralNote}</p>
						{/if}
						<p class="text-xs text-gray-400 mt-1">
							Raised {new Date(flag.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
						</p>
					</div>
					<a
						href="/hub/contacts/{contactId}"
						class="text-sm text-theme-button-1 hover:underline shrink-0"
					>
						View profile →
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<p class="mt-4 text-xs text-gray-400 text-center">Pastoral flags are private and never visible to volunteers. Dismiss or mark as followed up from each volunteer's profile.</p>
