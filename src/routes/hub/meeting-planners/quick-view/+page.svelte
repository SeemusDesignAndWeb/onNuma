<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	$: data = $page.data || {};
	$: meetingPlanners = data.meetingPlanners || [];
	$: otherRotaRoles = data.otherRotaRoles || [];
	$: sundayPlannersLabel = data.sundayPlannersLabel ?? 'Meeting Planners';
	$: singularLabel = sundayPlannersLabel.endsWith('s') ? sundayPlannersLabel.slice(0, -1) : sundayPlannersLabel;

	let isFullscreen = false;
	let tableContainer;
	let resizeHandle = null;
	let startX = 0;
	let startWidth = 0;
	let currentColumn = null;

	function formatDateWithOrdinal(date) {
		if (!date) return 'All occurrences';
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return '';
		
		const day = d.getDate();
		const month = d.toLocaleDateString('en-GB', { month: 'long' });
		const year = d.getFullYear();
		
		// Add ordinal suffix
		const getOrdinal = (n) => {
			const s = ['th', 'st', 'nd', 'rd'];
			const v = n % 100;
			return n + (s[(v - 20) % 10] || s[v] || s[0]);
		};
		
		return `${getOrdinal(day)} ${month} ${year}`;
	}

	function formatContactList(contacts) {
		if (!contacts || contacts.length === 0) return '-';
		return contacts.join(', ');
	}

	function formatNotes(notes) {
		if (!notes) return '-';
		// Strip HTML tags using regex (works on both server and client)
		const text = notes.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
		// Truncate if too long
		if (text.length > 100) {
			return text.substring(0, 100) + '...';
		}
		return text || '-';
	}

	function toggleFullscreen() {
		if (!isFullscreen) {
			// Enter fullscreen
			if (tableContainer.requestFullscreen) {
				tableContainer.requestFullscreen();
			} else if (tableContainer.webkitRequestFullscreen) {
				tableContainer.webkitRequestFullscreen();
			} else if (tableContainer.msRequestFullscreen) {
				tableContainer.msRequestFullscreen();
			}
		} else {
			// Exit fullscreen
			if (document.exitFullscreen) {
				document.exitFullscreen();
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen();
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen();
			}
		}
	}

	function handleMouseDown(e, column) {
		e.preventDefault();
		resizeHandle = e.target;
		currentColumn = column;
		startX = e.pageX;
		startWidth = column.offsetWidth;
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleMouseMove(e) {
		if (!resizeHandle || !currentColumn) return;
		
		const width = startWidth + (e.pageX - startX);
		if (width > 50) { // Minimum width
			currentColumn.style.width = width + 'px';
			currentColumn.style.minWidth = width + 'px';
		}
	}

	function handleMouseUp() {
		resizeHandle = null;
		currentColumn = null;
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	onMount(() => {
		// Listen for fullscreen changes
		const handleFullscreenChange = () => {
			isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
		};
		
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('msfullscreenchange', handleFullscreenChange);
		
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('msfullscreenchange', handleFullscreenChange);
		};
	});

	// Calculate total columns: Event, Date, Call to Worship, Meeting Leader, Speaker, Speaker Topic, Worship, Communion, other rotas, Notes
	$: totalColumns = 8 + otherRotaRoles.length + 1;
</script>

<div class="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
	<h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{sundayPlannersLabel} - Quick View</h2>
	<div class="flex flex-wrap gap-2">
		<button 
			on:click={toggleFullscreen}
			class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5 text-xs sm:text-sm"
			title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
		>
			{#if isFullscreen}
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
				<span class="hidden sm:inline">Exit Fullscreen</span>
				<span class="sm:hidden">Exit</span>
			{:else}
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
				</svg>
				<span class="hidden sm:inline">Fullscreen</span>
				<span class="sm:hidden">Full</span>
			{/if}
		</button>
		<a href="/hub/meeting-planners" class="bg-white border-2 border-hub-blue-500 text-hub-blue-600 hover:bg-hub-blue-50 px-2.5 py-1.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
			Back to List
		</a>
		<a href="/hub/meeting-planners/new" class="bg-hub-green-600 hover:bg-hub-green-700 text-white px-2.5 py-1.5 rounded-md text-xs sm:text-sm whitespace-nowrap">
			<span class="hidden sm:inline">New {singularLabel}</span>
			<span class="sm:hidden">New</span>
		</a>
	</div>
</div>

<!-- Mobile Card View -->
<div class="block md:hidden space-y-3">
	{#each meetingPlanners as mp}
		<div 
			class="bg-white shadow rounded-lg p-3 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
			on:click={() => goto(`/hub/meeting-planners/${mp.id}`)}
			role="button"
			tabindex="0"
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					goto(`/hub/meeting-planners/${mp.id}`);
				}
			}}
		>
			<div class="mb-2 pb-2 border-b border-gray-200">
				<div class="font-semibold text-sm text-gray-900 mb-1">{mp.eventName}</div>
				<div class="text-sm text-gray-600">{formatDateWithOrdinal(mp.occurrenceDate)}</div>
			</div>
			<div class="space-y-2 text-xs">
				<div>
					<span class="font-medium text-gray-700">Call to Worship:</span>
					<span class="ml-1 text-gray-600">{formatContactList(mp.callToWorship)}</span>
				</div>
				<div>
					<span class="font-medium text-gray-700">Meeting Leader:</span>
					<span class="ml-1 text-gray-600">{formatContactList(mp.meetingLeader)}</span>
				</div>
				<div>
					<span class="font-medium text-gray-700">Speaker:</span>
					<span class="ml-1 text-gray-600">{formatContactList(mp.speaker)}</span>
				</div>
				{#if mp.speakerTopic}
					<div>
						<span class="font-medium text-gray-700">Speaker Topic:</span>
						<span class="ml-1 text-gray-600">{mp.speakerTopic}</span>
					</div>
				{/if}
				<div>
					<span class="font-medium text-gray-700">Worship:</span>
					<span class="ml-1 text-gray-600">{formatContactList(mp.worshipLeader)}</span>
				</div>
				<div>
					<span class="font-medium text-gray-700">Communion:</span>
					<span class="ml-1 text-gray-600">{mp.communionHappening ? '✓ Yes' : 'No'}</span>
				</div>
				{#each otherRotaRoles as role}
					{#if mp.otherRotas[role] && mp.otherRotas[role].length > 0}
						<div>
							<span class="font-medium text-gray-700">{role}:</span>
							<span class="ml-1 text-gray-600">{formatContactList(mp.otherRotas[role])}</span>
						</div>
					{/if}
				{/each}
				{#if formatNotes(mp.notes) !== '-'}
					<div>
						<span class="font-medium text-gray-700">Notes:</span>
						<span class="ml-1 text-gray-600">{formatNotes(mp.notes)}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="bg-white shadow rounded-lg p-6 text-center text-gray-500">
			No meeting planners found
		</div>
	{/each}
</div>

<!-- Desktop Table View -->
<div bind:this={tableContainer} class="hidden md:block bg-white shadow rounded-lg overflow-hidden">
	<div class="overflow-x-auto overflow-y-auto" style="max-height: calc(100vh - 200px);">
		<table class="min-w-full divide-y divide-gray-200 border-collapse table-fixed">
			<thead class="bg-gray-50 sticky top-0 z-20">
				<tr>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 sticky left-0 bg-gray-50 z-30 resizable-header" style="width: 200px; min-width: 150px;">
						<div class="flex items-center justify-between">
							<span>Event Name</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 150px; min-width: 120px;">
						<div class="flex items-center justify-between">
							<span>Date</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 150px; min-width: 120px;">
						<div class="flex items-center justify-between">
							<span>Call to Worship</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 180px; min-width: 150px;">
						<div class="flex items-center justify-between">
							<span>Meeting Leader</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 180px; min-width: 150px;">
						<div class="flex items-center justify-between">
							<span>Speaker</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 200px; min-width: 150px;">
						<div class="flex items-center justify-between">
							<span>Speaker Topic</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 250px; min-width: 200px;">
						<div class="flex items-center justify-between">
							<span>Worship</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 100px; min-width: 80px;">
						<div class="flex items-center justify-between">
							<span>Communion</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
					{#each otherRotaRoles as role}
						<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 200px; min-width: 150px;">
							<div class="flex items-center justify-between">
								<span>{role}</span>
								<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
							</div>
						</th>
					{/each}
					<th class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border border-gray-300 resizable-header" style="width: 300px; min-width: 200px;">
						<div class="flex items-center justify-between">
							<span>Notes</span>
							<div class="resize-handle" on:mousedown={(e) => handleMouseDown(e, e.currentTarget.closest('th'))}></div>
						</div>
					</th>
				</tr>
			</thead>
			<tbody class="bg-white divide-y divide-gray-200">
				{#each meetingPlanners as mp}
					<tr class="hover:bg-gray-50 cursor-pointer" on:click={() => goto(`/hub/meeting-planners/${mp.id}`)}>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-900 border border-gray-300 sticky left-0 bg-white z-10 font-medium" style="width: 200px; min-width: 150px;">
							{mp.eventName}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300 whitespace-nowrap" style="width: 150px; min-width: 120px;">
							{formatDateWithOrdinal(mp.occurrenceDate)}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 150px; min-width: 120px;">
							{formatContactList(mp.callToWorship)}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 180px; min-width: 150px;">
							{formatContactList(mp.meetingLeader)}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 180px; min-width: 150px;">
							{formatContactList(mp.speaker)}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 200px; min-width: 150px;">
							{mp.speakerTopic || '-'}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 250px; min-width: 200px;">
							{formatContactList(mp.worshipLeader)}
						</td>
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300 text-center" style="width: 100px; min-width: 80px;">
							{mp.communionHappening ? '✓' : '-'}
						</td>
						{#each otherRotaRoles as role}
							<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 200px; min-width: 150px;">
								{formatContactList(mp.otherRotas[role] || [])}
							</td>
						{/each}
						<td class="px-3 sm:px-[18px] py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border border-gray-300" style="width: 300px; min-width: 200px;">
							{formatNotes(mp.notes)}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan={totalColumns} class="px-3 sm:px-4 py-6 sm:py-8 text-center text-gray-500 border border-gray-300">
							No meeting planners found
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	/* Excel-like styling */
	table {
		border-collapse: collapse;
		table-layout: fixed;
	}
	
	th, td {
		border: 1px solid #d1d5db;
		position: relative;
	}
	
	/* Sticky first column for better navigation */
	th:first-child,
	td:first-child {
		position: sticky;
		left: 0;
		z-index: 10;
		background: white;
		box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
	}
	
	thead th:first-child {
		z-index: 30;
		background: #f9fafb;
	}
	
	/* Resizable columns */
	.resizable-header {
		position: relative;
	}
	
	.resize-handle {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		cursor: col-resize;
		background: transparent;
		z-index: 1;
	}
	
	.resize-handle:hover {
		background: #3b82f6;
	}
	
	/* Row hover effect */
	tbody tr:hover {
		background-color: #f3f4f6;
	}
	
	/* Fullscreen mode */
	:global([data-fullscreen]) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9999;
		background: white;
		padding: 1rem;
		overflow: auto;
	}
	
	/* Better scrolling */
	.overflow-x-auto {
		scrollbar-width: thin;
		scrollbar-color: #cbd5e1 #f1f5f9;
	}
	
	.overflow-x-auto::-webkit-scrollbar {
		height: 8px;
		width: 8px;
	}
	
	.overflow-x-auto::-webkit-scrollbar-track {
		background: #f1f5f9;
	}
	
	.overflow-x-auto::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 4px;
	}
	
	.overflow-x-auto::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
	
	/* Sticky header */
	thead {
		position: sticky;
		top: 0;
		z-index: 20;
	}
	
	/* Better text wrapping for long content */
	td {
		word-wrap: break-word;
		overflow-wrap: break-word;
	}
	
	/* Improve readability */
	tbody td {
		vertical-align: top;
	}
	
	/* Mobile responsive table padding */
	@media (max-width: 768px) {
		tbody td {
			padding: 0.5rem 0.75rem;
		}
	}
	
	@media (min-width: 769px) {
		tbody td {
			padding: 0.75rem 1rem;
		}
	}
</style>
