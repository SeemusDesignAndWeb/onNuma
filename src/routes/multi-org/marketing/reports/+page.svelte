<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: stats = data?.stats || {};
	$: logs = data?.logs || [];
	$: pendingQueue = data?.pendingQueue || [];
	$: userTimeline = data?.userTimeline;
	$: templatePerf = data?.templatePerf || [];
	$: sequencePerf = data?.sequencePerf || [];

	let userIdInput = '';
	let activeTab = 'overview';

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function lookupUser() {
		if (userIdInput.trim()) {
			goto(`${base}/marketing/reports?userId=${encodeURIComponent(userIdInput.trim())}`);
		}
	}

	const tabs = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'logs', label: 'Send Logs' },
		{ id: 'queue', label: 'Queue' },
		{ id: 'performance', label: 'Performance' },
		{ id: 'user', label: 'User Timeline' }
	];
</script>

<svelte:head>
	<title>Reports & Logs – Marketing – OnNuma</title>
</svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">Reports & Logs</h1>
		<p class="mt-1 text-sm text-slate-500">Email send dashboard, performance metrics, and user-level timelines.</p>
	</div>

	<!-- Tabs -->
	<div class="flex items-center gap-1 mb-6 border-b border-slate-200">
		{#each tabs as tab}
			<button
				on:click={() => activeTab = tab.id}
				class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors {activeTab === tab.id ? 'border-[#EB9486] text-[#c75a4a]' : 'border-transparent text-slate-500 hover:text-slate-700'}"
			>{tab.label}</button>
		{/each}
	</div>

	{#if activeTab === 'overview'}
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
			<div class="bg-white rounded-2xl border border-slate-200 p-5">
				<p class="text-xs font-semibold text-slate-500 uppercase mb-1">Total Sends</p>
				<p class="text-2xl font-bold text-slate-800">{stats.total ?? 0}</p>
			</div>
			<div class="bg-white rounded-2xl border border-slate-200 p-5">
				<p class="text-xs font-semibold text-slate-500 uppercase mb-1">Delivered</p>
				<p class="text-2xl font-bold text-emerald-600">{stats.sent ?? 0}</p>
			</div>
			<div class="bg-white rounded-2xl border border-slate-200 p-5">
				<p class="text-xs font-semibold text-slate-500 uppercase mb-1">Failed</p>
				<p class="text-2xl font-bold text-red-600">{stats.failed ?? 0}</p>
			</div>
		</div>
	{/if}

	{#if activeTab === 'logs'}
		<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
			{#if logs.length === 0}
				<div class="p-12 text-center text-slate-400"><p>No send logs yet.</p></div>
			{:else}
				<table class="min-w-full divide-y divide-slate-200">
					<thead>
						<tr class="bg-slate-50/80">
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Time</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Template</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Sequence</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Error</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each logs as log (log.id)}
							<tr class="hover:bg-slate-50/50 text-sm">
								<td class="px-4 py-3 text-slate-500 text-xs">{formatDate(log.sent_at)}</td>
								<td class="px-4 py-3 text-slate-700">{log.email || '—'}</td>
								<td class="px-4 py-3 text-slate-600">{log.template_name}</td>
								<td class="px-4 py-3 text-slate-500">{log.sequence_name}</td>
								<td class="px-4 py-3">
									<span class="px-2 py-0.5 rounded text-xs font-medium {log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">{log.status}</span>
								</td>
								<td class="px-4 py-3 text-xs text-red-500 max-w-xs truncate">{log.error || ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'queue'}
		<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
			{#if pendingQueue.length === 0}
				<div class="p-12 text-center text-slate-400"><p>Queue is empty.</p></div>
			{:else}
				<table class="min-w-full divide-y divide-slate-200">
					<thead>
						<tr class="bg-slate-50/80">
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Scheduled</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Template</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
							<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Attempts</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each pendingQueue as q (q.id)}
							<tr class="hover:bg-slate-50/50 text-sm">
								<td class="px-4 py-3 text-slate-500 text-xs">{formatDate(q.send_at)}</td>
								<td class="px-4 py-3 text-slate-700">{q.user_id}</td>
								<td class="px-4 py-3 text-slate-600">{q.template_name}</td>
								<td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">{q.status}</span></td>
								<td class="px-4 py-3 text-slate-500">{q.attempts || 0}/{q.max_attempts || 5}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	{#if activeTab === 'performance'}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
				<h3 class="font-semibold text-sm text-slate-700 mb-3">Per Template</h3>
				{#if templatePerf.length === 0}
					<p class="text-sm text-slate-400">No data yet.</p>
				{:else}
					<div class="space-y-2">
						{#each templatePerf as tp}
							<div class="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50">
								<span class="text-slate-700">{tp.name}</span>
								<div class="flex items-center gap-3 text-xs">
									<span class="text-emerald-600">{tp.sent} sent</span>
									<span class="text-red-500">{tp.failed} failed</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
				<h3 class="font-semibold text-sm text-slate-700 mb-3">Per Sequence</h3>
				{#if sequencePerf.length === 0}
					<p class="text-sm text-slate-400">No data yet.</p>
				{:else}
					<div class="space-y-2">
						{#each sequencePerf as sp}
							<div class="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50">
								<span class="text-slate-700">{sp.name}</span>
								<div class="flex items-center gap-3 text-xs">
									<span class="text-emerald-600">{sp.sent} sent</span>
									<span class="text-red-500">{sp.failed} failed</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if activeTab === 'user'}
		<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
			<h3 class="font-semibold text-sm text-slate-700 mb-3">User Timeline</h3>
			<div class="flex items-end gap-3 mb-4">
				<div class="flex-1">
					<label class="block text-xs font-medium text-slate-600 mb-1">Contact/User ID</label>
					<input type="text" bind:value={userIdInput} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Paste a contact ID" />
				</div>
				<button on:click={lookupUser} class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 transition-colors">Lookup</button>
			</div>
			{#if userTimeline}
				{#if userTimeline.contact}
					<div class="mb-3 p-3 bg-slate-50 rounded-lg">
						<p class="text-sm font-medium text-slate-700">{userTimeline.contact.name || '—'}</p>
						<p class="text-xs text-slate-500">{userTimeline.contact.email || '—'}</p>
					</div>
				{/if}
				{#if userTimeline.timeline.length === 0}
					<p class="text-sm text-slate-400">No marketing emails for this user.</p>
				{:else}
					<div class="relative pl-6 border-l-2 border-slate-200 space-y-3">
						{#each userTimeline.timeline as event}
							<div class="relative">
								<div class="absolute -left-[calc(1.5rem+5px)] top-1.5 w-2.5 h-2.5 rounded-full {event.type === 'sent' ? 'bg-emerald-400' : event.type === 'scheduled' ? 'bg-blue-400' : 'bg-red-400'} border-2 border-white"></div>
								<div class="text-sm">
									<span class="text-xs text-slate-400">{formatDate(event.timestamp)}</span>
									<span class="ml-2 px-2 py-0.5 rounded text-xs font-medium {event.type === 'sent' ? 'bg-emerald-100 text-emerald-800' : event.type === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}">{event.type}</span>
									<span class="ml-2 text-slate-700">{event.template_name}</span>
									{#if event.error}
										<span class="ml-2 text-xs text-red-500">{event.error}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
