<script>
	import { enhance } from '$app/forms';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: mailshots = data?.mailshots || [];
	let showArchived = false;
	$: filtered = showArchived ? mailshots : mailshots.filter((m) => m.status !== 'archived');

	const statusColors = {
		draft: 'bg-amber-100 text-amber-800',
		active: 'bg-emerald-100 text-emerald-800',
		archived: 'bg-slate-100 text-slate-600'
	};

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Mailshots – Marketing – OnNuma</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-slate-800">Mailshots</h1>
		<p class="mt-1 text-sm text-slate-500">Create, save, duplicate, and send reusable campaigns to all subscribers.</p>
	</div>
	<div class="flex items-center gap-3">
		<label class="inline-flex items-center gap-2 text-sm text-slate-600">
			<input type="checkbox" bind:checked={showArchived} class="rounded border-slate-300" />
			Show archived
		</label>
		<a href="{base}/marketing/mailshots/new" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
			New Mailshot
		</a>
	</div>
</div>

{#if filtered.length === 0}
	<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
		<p class="text-slate-600 font-medium">No mailshots yet</p>
		<p class="mt-1 text-sm text-slate-500">Create your first reusable mailshot.</p>
	</div>
{:else}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Sent</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Sends</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each filtered as shot (shot.id)}
					<tr class="hover:bg-slate-50/50 transition-colors">
						<td class="px-5 py-4 text-sm font-medium">
							<a href="{base}/marketing/mailshots/{shot.id}" class="text-cyan-700 hover:underline">{shot.name || '—'}</a>
						</td>
						<td class="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">{shot.subject || '—'}</td>
						<td class="px-5 py-4 text-sm">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusColors[shot.status] || 'bg-slate-100 text-slate-600'}">{shot.status}</span>
						</td>
						<td class="px-5 py-4 text-sm text-slate-500">{formatDate(shot.last_sent_at)}</td>
						<td class="px-5 py-4 text-sm text-slate-500">{shot.send_count || 0}</td>
						<td class="px-5 py-4 text-right text-sm">
							<div class="inline-flex items-center gap-1">
								<a href="{base}/marketing/mailshots/{shot.id}" class="p-2 rounded-lg text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="Edit">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
								</a>
								<form method="POST" action="?/duplicate" use:enhance class="inline">
									<input type="hidden" name="id" value={shot.id} />
									<button type="submit" class="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Duplicate">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
									</button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
