<script>
	import { page } from '$app/stores';
	import { formatDateLongUK, formatTimeUK, formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: sundays = data.sundays || [];
	$: eventSignupLinks = data.eventSignupLinks || {};
	
	// Helper function to filter rotas
	function getInternalRotas(rotas) {
		return rotas.filter(r => (r.visibility || 'public') !== 'public');
	}
	
	function getPublicRotas(rotas) {
		return rotas.filter(r => (r.visibility || 'public') === 'public');
	}
</script>

<svelte:head>
	<title>Sunday Schedule - Next 4 Weeks</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-5xl mx-auto py-4 px-3 sm:py-8 sm:px-4 lg:px-6 mt-[68px] sm:mt-[84px]">
		<div class="mb-4 sm:mb-8">
			<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Sunday Schedule</h1>
			<p class="text-sm sm:text-base text-gray-600">What's happening on Sundays for the next 4 weeks</p>
		</div>

		{#if sundays.length === 0}
			<div class="bg-white shadow rounded-lg p-6 sm:p-8 text-center">
				<svg class="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-3 sm:mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<p class="text-gray-500 text-base sm:text-lg">No Sunday events scheduled for the next 4 weeks.</p>
			</div>
		{:else}
			<div class="space-y-4 sm:space-y-6">
				{#each sundays as sunday}
					<div class="bg-white shadow rounded-lg overflow-hidden">
						<div class="p-4 sm:p-6">
							<!-- Sunday Date -->
							<h2 class="text-sm sm:text-base font-semibold text-gray-700 mb-4">
								{formatDateLongUK(sunday.dateObj)}
							</h2>
							<!-- Events for this Sunday -->
							{#if sunday.occurrences.length > 0}
								<div class="mb-4 sm:mb-6">
									<h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
										<svg class="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										Events
									</h3>
									<div class="space-y-3 sm:space-y-4">
										{#each sunday.occurrences as occ}
											{@const eventInternalRotas = getInternalRotas(sunday.rotas).filter(r => r.eventId === occ.eventId)}
											<div class="border-l-4 border-l-blue-500 bg-blue-50 rounded-r-lg p-3 sm:p-4">
												<div class="flex flex-col md:flex-row md:items-start md:gap-6">
													<!-- Event Info -->
													<div class="mb-3 md:mb-0 md:flex-shrink-0">
														<h4 class="text-base sm:text-lg font-semibold text-gray-900 mb-2">
															{occ.event.title}
														</h4>
														<div class="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
															<div class="flex items-center gap-1">
																<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
																</svg>
																<span>{formatTimeUK(occ.startsAt)}</span>
																{#if occ.endsAt}
																	<span> - {formatTimeUK(occ.endsAt)}</span>
																{/if}
															</div>
															{#if occ.location || occ.event.location}
																<div class="flex items-center gap-1">
																	<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
																	</svg>
																	<span class="break-words">{occ.location || occ.event.location}</span>
																</div>
															{/if}
														</div>
													</div>
													
													<!-- Internal Rotas for this event - 2x2 grid -->
													{#if eventInternalRotas.length > 0}
														{@const meetingLeader = eventInternalRotas.find(r => r.role.toLowerCase().includes('meeting leader') || r.role.toLowerCase().includes('leader'))}
														{@const speaker = eventInternalRotas.find(r => r.role.toLowerCase().includes('speaker'))}
														{@const callToWorship = eventInternalRotas.find(r => r.role.toLowerCase().includes('call to worship') || r.role.toLowerCase().includes('call to'))}
														{@const worshipTeam = eventInternalRotas.find(r => r.role.toLowerCase().includes('worship team') || r.role.toLowerCase().includes('worship'))}
														<div class="md:flex-1 border-t md:border-t-0 md:border-l border-gray-300 pt-3 md:pt-0 md:pl-4">
															<div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-gray-900">
																<!-- Top row: Meeting Leader, Speaker -->
																{#if meetingLeader}
																	{@const hasAssignees = meetingLeader.allAssignees && meetingLeader.allAssignees.length > 0}
																	<div>
																		<span class="font-bold">{meetingLeader.role}:</span>
																		{#if hasAssignees}
																			<span class="ml-1">{meetingLeader.allAssignees.map(a => a.name).join(', ')}</span>
																		{:else}
																			<span class="ml-1 text-gray-500 italic">TBC</span>
																		{/if}
																	</div>
																{/if}
																{#if speaker}
																	{@const hasAssignees = speaker.allAssignees && speaker.allAssignees.length > 0}
																	<div>
																		<span class="font-bold">{speaker.role}:</span>
																		{#if hasAssignees}
																			<span class="ml-1">{speaker.allAssignees.map(a => a.name).join(', ')}</span>
																		{:else}
																			<span class="ml-1 text-gray-500 italic">TBC</span>
																		{/if}
																	</div>
																{/if}
																<!-- Bottom row: Call to Worship, Worship Team -->
																{#if callToWorship}
																	{@const hasAssignees = callToWorship.allAssignees && callToWorship.allAssignees.length > 0}
																	<div>
																		<span class="font-bold">{callToWorship.role}:</span>
																		{#if hasAssignees}
																			<span class="ml-1">{callToWorship.allAssignees.map(a => a.name).join(', ')}</span>
																		{:else}
																			<span class="ml-1 text-gray-500 italic">TBC</span>
																		{/if}
																	</div>
																{/if}
																{#if worshipTeam}
																	{@const hasAssignees = worshipTeam.allAssignees && worshipTeam.allAssignees.length > 0}
																	<div>
																		<span class="font-bold">{worshipTeam.role}:</span>
																		{#if hasAssignees}
																			<span class="ml-1">{worshipTeam.allAssignees.map(a => a.name).join(', ')}</span>
																		{:else}
																			<span class="ml-1 text-gray-500 italic">TBC</span>
																		{/if}
																	</div>
																{/if}
															</div>
														</div>
													{/if}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Public Rotas for this Sunday -->
							{#if getPublicRotas(sunday.rotas).length > 0}
								<div class="mt-4 sm:mt-6">
									<h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
										<svg class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
										</svg>
										Rotas
									</h3>
									<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
										{#each getPublicRotas(sunday.rotas) as rota}
											<div class="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
													<!-- Rota Name - Most Important -->
													<h4 class="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
														<span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-500 flex-shrink-0"></span>
														<span>{rota.role}</span>
													</h4>

													<!-- Show assignees for each occurrence on this Sunday -->
													<div class="space-y-2">
														{#each sunday.occurrences as occ}
															{#if rota.eventId === occ.eventId}
																{@const assignees = rota.assigneesByOcc[occ.id] || []}
																<div class="ml-3 sm:ml-4 border-l-2 border-l-gray-300 pl-2 sm:pl-3">
																	<div class="text-xs font-medium text-gray-500 mb-1.5">
																		{assignees.length}/{rota.capacity} assigned
																	</div>
																	{#if assignees.length > 0}
																		<div class="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
																			{#each assignees as assignee}
																				<span class="inline-flex items-center px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
																					{assignee.name}
																				</span>
																			{/each}
																		</div>
																	{/if}
																	<!-- Show signup link if capacity not full -->
																	{#if assignees.length < rota.capacity && eventSignupLinks[rota.eventId]}
																		<a 
																			href={eventSignupLinks[rota.eventId]}
																			class="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
																		>
																			<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
																			</svg>
																			Sign up for this rota
																		</a>
																	{/if}
																</div>
															{/if}
														{/each}
													</div>
												</div>
											{/each}
									</div>
								</div>
							{/if}

							{#if sunday.occurrences.length === 0 && sunday.rotas.length === 0}
								<p class="text-gray-500 text-xs sm:text-sm">No events or rotas scheduled for this Sunday.</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
