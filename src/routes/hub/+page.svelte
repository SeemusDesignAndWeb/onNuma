<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import { onMount } from 'svelte';
	import { hasRouteAccess } from '$lib/crm/server/permissions.js';
	
	$: admin = $page.data?.admin || null;
	$: stats = $page.data?.stats || {};
	$: latestNewsletters = $page.data?.latestNewsletters || [];
	$: latestRotas = $page.data?.latestRotas || [];
	$: latestEvents = $page.data?.latestEvents || [];
	
	// Check for access denied error in URL
	$: urlParams = new URLSearchParams($page.url.search);
	$: accessDenied = urlParams.get('error') === 'access_denied';
	
	// Check permissions for various routes
	$: canAccessContacts = admin && hasRouteAccess(admin, '/hub/contacts');
	$: canAccessLists = admin && hasRouteAccess(admin, '/hub/lists');
	$: canAccessNewsletters = admin && hasRouteAccess(admin, '/hub/emails');
	$: canAccessEvents = admin && hasRouteAccess(admin, '/hub/events');
	$: canAccessRotas = admin && hasRouteAccess(admin, '/hub/rotas');
	$: canAccessForms = admin && hasRouteAccess(admin, '/hub/forms');
	
	onMount(() => {
		// Clear error from URL after showing message
		if (accessDenied) {
			setTimeout(() => {
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.delete('error');
				window.history.replaceState({}, '', newUrl);
			}, 5000);
		}
	});
</script>

<!-- Access Denied Message -->
{#if accessDenied}
	<div class="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
		<div class="flex">
			<div class="flex-shrink-0">
				<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
				</svg>
			</div>
			<div class="ml-3">
				<p class="text-sm text-red-700">
					<strong>Access Denied:</strong> You do not have permission to access that page. Please contact a super admin if you need access.
				</p>
			</div>
		</div>
	</div>
{/if}

<!-- Overview Cards with Quick Actions -->
{#if !accessDenied}
	<div class="flex justify-between items-center mb-4">
		<h2 class="text-xl font-bold text-gray-900">Overview</h2>
		<p class="text-sm text-gray-600"><strong>Emails sent today:</strong> {stats.emailsSentToday || 0}</p>
	</div>
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6 mb-8">
		<!-- Contacts -->
		{#if canAccessContacts}
			<div class="flex flex-col gap-2">
		<a href="/hub/contacts/new" class="bg-hub-blue-50 border-2 border-hub-blue-200 rounded-md p-2 hover:border-hub-blue-400 hover:bg-hub-blue-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-blue-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-blue-700">Contact</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-blue-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Contacts</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.contacts || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/contacts" class="font-medium text-hub-blue-600 hover:text-hub-blue-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}

		<!-- Lists -->
		{#if canAccessLists}
			<div class="flex flex-col gap-2">
		<a href="/hub/lists/new" class="bg-hub-blue-50 border-2 border-hub-blue-200 rounded-md p-2 hover:border-hub-blue-400 hover:bg-hub-blue-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-blue-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-blue-700">List</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-blue-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Lists</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.lists || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/lists" class="font-medium text-hub-blue-600 hover:text-hub-blue-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}

		<!-- Emails -->
		{#if canAccessNewsletters}
			<div class="flex flex-col gap-2">
		<a href="/hub/emails/new" class="bg-hub-green-50 border-2 border-hub-green-200 rounded-md p-2 hover:border-hub-green-400 hover:bg-hub-green-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-green-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-green-700">Email</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-green-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Emails</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.newsletters || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/emails" class="font-medium text-hub-green-600 hover:text-hub-green-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}

		<!-- Events -->
		{#if canAccessEvents}
			<div class="flex flex-col gap-2">
		<a href="/hub/events/new" class="bg-hub-blue-50 border-2 border-hub-blue-200 rounded-md p-2 hover:border-hub-blue-400 hover:bg-hub-blue-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-blue-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-blue-700">Event</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-blue-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Events</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.events || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/events" class="font-medium text-hub-blue-600 hover:text-hub-blue-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}

		<!-- Rotas -->
		{#if canAccessRotas}
			<div class="flex flex-col gap-2">
		<a href="/hub/rotas/new" class="bg-hub-yellow-50 border-2 border-hub-yellow-200 rounded-md p-2 hover:border-hub-yellow-400 hover:bg-hub-yellow-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-yellow-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-yellow-700">Rota</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-yellow-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Rotas</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.rotas || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/rotas" class="font-medium text-hub-yellow-600 hover:text-hub-yellow-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}

		<!-- Forms -->
		{#if canAccessForms}
			<div class="flex flex-col gap-2">
		<a href="/hub/forms/new" class="bg-hub-red-50 border-2 border-hub-red-200 rounded-md p-2 hover:border-hub-red-400 hover:bg-hub-red-100 transition-all text-center group flex items-center justify-center gap-1">
			<span class="text-lg font-bold text-hub-red-600 group-hover:scale-110 transition-transform">+</span>
			<span class="text-xs font-medium text-hub-red-700">Form</span>
		</a>
		<div class="bg-white overflow-hidden shadow rounded-lg border-l-4 border-hub-red-500">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-hub-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 truncate">Forms</dt>
							<dd class="text-lg font-medium text-gray-900">{stats.forms || 0}</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 px-5 py-3">
				<div class="text-sm">
					<a href="/hub/forms" class="font-medium text-hub-red-600 hover:text-hub-red-800">View all</a>
				</div>
			</div>
			</div>
		</div>
		{/if}
	</div>

	<!-- Recent Items -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Latest Emails -->
		{#if canAccessNewsletters}
			<div class="bg-white shadow rounded-lg p-6 border-t-4 border-hub-green-500">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900">Latest Emails</h3>
					<a href="/hub/emails" class="text-sm text-hub-green-600 hover:text-hub-green-800 font-medium">View all</a>
				</div>
				{#if latestNewsletters.length === 0}
					<p class="text-sm text-gray-500">No emails yet</p>
				{:else}
					<ul class="space-y-3">
						{#each latestNewsletters as newsletter}
							<li class="border-b border-gray-200 pb-3 last:border-0 last:pb-0">
								<a 
									href="/hub/emails/{newsletter.id}" 
									class="block hover:text-hub-green-600 transition-colors"
								>
									<div class="flex justify-between items-start">
										<div class="flex-1">
											<div class="font-medium text-gray-900">{newsletter.subject || 'Untitled'}</div>
											<div class="text-xs text-gray-500 mt-1">
												{formatDateUK(newsletter.updatedAt || newsletter.createdAt || Date.now())}
											</div>
										</div>
										<span class="ml-2 text-xs px-2.5 py-1.5 rounded-full {newsletter.status === 'sent' ? 'bg-hub-green-100 text-hub-green-800' : 'bg-gray-100 text-gray-800'}">
											{newsletter.status || 'draft'}
										</span>
									</div>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

	<!-- Latest Rotas -->
	{#if canAccessRotas}
		<div class="bg-white shadow rounded-lg p-6 border-t-4 border-hub-yellow-500">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Recently Edited Rotas</h3>
				<a href="/hub/rotas" class="text-sm text-hub-yellow-600 hover:text-hub-yellow-800 font-medium">View all</a>
			</div>
			{#if latestRotas.length === 0}
				<p class="text-sm text-gray-500">No rotas yet</p>
			{:else}
				<ul class="space-y-3">
					{#each latestRotas as rota}
						<li class="border-b border-gray-200 pb-3 last:border-0 last:pb-0">
							<a 
								href="/hub/rotas/{rota.id}" 
								class="block hover:text-hub-green-600 transition-colors"
							>
								<div class="flex justify-between items-start">
									<div class="flex-1">
										<div class="font-medium text-gray-900">{rota.role || 'Untitled'}</div>
										<div class="text-xs text-gray-500 mt-1">
											{rota.eventTitle || 'Unknown Event'} • {Array.isArray(rota.assignees) ? rota.assignees.length : 0} assigned
										</div>
										<div class="text-xs text-gray-400 mt-1">
											{formatDateUK(rota.updatedAt || rota.createdAt || Date.now())}
										</div>
									</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<!-- Latest Events -->
	{#if canAccessEvents}
		<div class="bg-white shadow rounded-lg p-6 border-t-4 border-hub-blue-500">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Recently Edited Events</h3>
				<a href="/hub/events" class="text-sm text-hub-blue-600 hover:text-hub-blue-800 font-medium">View all</a>
			</div>
			{#if latestEvents.length === 0}
				<p class="text-sm text-gray-500">No events yet</p>
			{:else}
				<ul class="space-y-3">
					{#each latestEvents as event}
						<li class="border-b border-gray-200 pb-3 last:border-0 last:pb-0">
							<a 
								href="/hub/events/{event.id}" 
								class="block hover:text-hub-blue-600 transition-colors"
							>
								<div class="flex justify-between items-start">
									<div class="flex-1">
										<div class="font-medium text-gray-900">{event.title || 'Untitled'}</div>
										{#if event.location}
											<div class="text-xs text-gray-500 mt-1">
												{event.location}
											</div>
										{/if}
										<div class="text-xs text-gray-400 mt-1">
											{formatDateUK(event.updatedAt || event.createdAt || Date.now())}
										</div>
									</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
{/if}
