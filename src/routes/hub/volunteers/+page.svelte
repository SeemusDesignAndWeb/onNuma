<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: pending = $page.data?.pending || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	let lastFormResult = null;
	$: if (formResult && browser && formResult !== lastFormResult) {
		lastFormResult = formResult;
		if (formResult?.success) {
			notifications.success(formResult.message || 'Done.');
			setTimeout(() => invalidateAll(), 300);
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	function formatDate(iso) {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Pending volunteers – Hub</title>
</svelte:head>

<div class="hub-top-panel p-6 mb-6">
	<div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
		<div class="flex-1">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Pending volunteers</h2>
			<p class="mt-1 text-sm text-gray-500">People who have expressed interest via a public signup link and are awaiting your review.</p>
		</div>
	</div>

	{#if pending.length === 0}
		<div class="rounded-xl border border-gray-200 bg-gray-50 py-12 text-center">
			<svg class="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			<p class="text-gray-500 text-sm font-medium">No pending volunteers right now.</p>
			<p class="text-gray-400 text-sm mt-1">New signups will appear here for review.</p>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#each pending as p}
				<div class="rounded-xl border border-gray-200 bg-white p-5">
					<div class="flex flex-col sm:flex-row sm:items-start gap-4">
						<!-- Contact info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap mb-1">
								<span class="font-semibold text-gray-900 text-base">
									{[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown'}
								</span>
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pending</span>
							</div>
							<p class="text-sm text-gray-500 mb-1">
								<a href="mailto:{p.email}" class="hover:underline text-hub-blue-600">{p.email}</a>
								{#if p.phone}<span class="ml-3 text-gray-400">· {p.phone}</span>{/if}
							</p>
							<p class="text-xs text-gray-400">Submitted {formatDate(p.createdAt)}</p>

							<!-- Requested slots -->
							{#if p.rotaSlots && p.rotaSlots.length > 0}
								<div class="mt-3">
									<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Requested slots</p>
									<ul class="flex flex-col gap-1">
										{#each p.rotaSlots as slot}
											<li class="text-sm text-gray-700 flex items-start gap-1.5">
												<svg class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
												<span>
													<span class="font-medium">{slot.rotaRole}</span>
													<span class="text-gray-400"> · {slot.eventTitle}</span>
													{#if slot.occurrenceDate}<span class="text-gray-400"> · {formatDate(slot.occurrenceDate)}</span>{/if}
												</span>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>

						<!-- Actions -->
						<div class="flex flex-row sm:flex-col gap-2 flex-shrink-0">
							<form method="POST" action="?/approve" use:enhance>
								<input type="hidden" name="_csrf" value={csrfToken} />
								<input type="hidden" name="pendingId" value={p.id} />
								<button type="submit" class="hub-btn bg-theme-button-2 text-white whitespace-nowrap">
									<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
									Approve
								</button>
							</form>
							<form method="POST" action="?/decline" use:enhance>
								<input type="hidden" name="_csrf" value={csrfToken} />
								<input type="hidden" name="pendingId" value={p.id} />
								<button type="submit" class="hub-btn bg-hub-red-100 text-hub-red-700 hover:bg-hub-red-200 whitespace-nowrap">
									<svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
									Decline
								</button>
							</form>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<NotificationPopup />
