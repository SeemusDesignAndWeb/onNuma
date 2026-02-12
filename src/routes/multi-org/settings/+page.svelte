<script>
	import { page } from '$app/stores';
	import { dialog } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: organisations = data?.organisations ?? [];
	$: form = $page.form;
	$: anonymisedCreated = data?.anonymisedCreated ?? null;
	$: demoEventsCreated = data?.demoEventsCreated ?? null;
	$: error = form?.error ?? null;
	$: organisationId = form?.organisationId ?? '';

	// Active section for sidebar navigation (only Demo Data now)
	let activeSection = 'demo';

	// Restore from form after validation error
	let contactCountValue = '30';
	let createContactsChecked = false;
	let createEventsChecked = false;
	$: if (form?.contactCount !== undefined) contactCountValue = String(form.contactCount);
	$: if (form && typeof form.createContacts !== 'undefined') {
		createContactsChecked = form.createContacts === true || form.createContacts === 'on';
	}
	$: if (form && typeof form.createEvents !== 'undefined') {
		createEventsChecked = form.createEvents === true || form.createEvents === 'on';
	}

	// Auto-switch to demo section if there's a demo-related error or success
	$: if (error || anonymisedCreated || demoEventsCreated) {
		activeSection = 'demo';
	}

	// Confirm modal state
	let showConfirmModal = false;
	let confirmOrgName = '';
	let confirmMessage = '';
	let confirmTypedName = '';

	function openConfirmModal(e) {
		const formEl = e.currentTarget.form;
		if (!formEl) return;
		const orgSelect = formEl.querySelector('select[name="organisationId"]');
		const orgName = (orgSelect?.selectedOptions?.[0]?.text ?? '').trim();
		if (!orgName) {
			dialog.alert('Please select an organisation first.', 'Select an organisation');
			return;
		}
		const contactsChecked = formEl.querySelector('input[name="createContacts"]')?.checked === true;
		const eventsChecked = formEl.querySelector('input[name="createEvents"]')?.checked === true;
		if (!contactsChecked && !eventsChecked) {
			dialog.alert('Please select at least one option: anonymised contacts and/or demo events.', 'Select an option');
			return;
		}
		const parts = [];
		if (contactsChecked) {
			const count = formEl.querySelector('input[name="contactCount"]')?.value?.trim() || '?';
			parts.push(`${count} anonymised contacts`);
		}
		if (eventsChecked) {
			parts.push('5 demo events (2 occurrences each, a week apart)');
		}
		confirmOrgName = orgName;
		confirmMessage = `This will permanently remove existing data for ${orgName} and create ${parts.join(' and ')}. Rotas and signups may be affected. This cannot be undone.`;
		confirmTypedName = '';
		showConfirmModal = true;
	}

	function closeConfirmModal() {
		showConfirmModal = false;
		confirmTypedName = '';
	}

	async function handleConfirmContinue() {
		if ((confirmTypedName || '').trim() !== confirmOrgName) {
			await dialog.alert('The organisation name you entered does not match. Type the exact name of the selected organisation to confirm.', 'Name does not match');
			return;
		}
		const formEl = document.getElementById('demo-data-form');
		if (formEl) {
			formEl.requestSubmit();
			closeConfirmModal();
		}
	}

	const sections = [
		{ id: 'demo', label: 'Demo Data' }
	];
</script>

<svelte:head>
	<title>Settings – OnNuma</title>
</svelte:head>

<!-- Page header -->
<div class="mb-8">
	<div class="flex items-center gap-3 mb-2">
		<div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#EB9486]/20 to-[#EB9486]/5">
			<svg class="w-5 h-5 text-[#EB9486]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
		</div>
		<div>
			<h1 class="text-2xl font-bold text-slate-800">Settings</h1>
			<p class="text-sm text-slate-500">Manage platform configuration and tools</p>
		</div>
	</div>
</div>

<div class="flex flex-col lg:flex-row gap-8">
	<!-- Sidebar navigation -->
	<nav class="lg:w-56 flex-shrink-0">
		<div class="lg:sticky lg:top-24 space-y-1">
			{#each sections as section}
				<button
					type="button"
					on:click={() => activeSection = section.id}
					class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all {activeSection === section.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'}"
				>
					{section.label}
				</button>
			{/each}
		</div>
	</nav>

	<!-- Content area -->
	<div class="flex-1 min-w-0 max-w-3xl">
		<!-- Demo Data Section -->
		{#if activeSection === 'demo'}
			<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
				<!-- Section header -->
				<div class="px-6 sm:px-8 pt-6 sm:pt-8 pb-5 border-b border-slate-100">
					<div>
						<h2 class="text-lg font-semibold text-slate-800">Demo Data</h2>
						<p class="text-sm text-slate-500 mt-0.5">Generate anonymised contacts and demo events for testing. Existing data of the selected type will be replaced.</p>
					</div>
				</div>

				<div class="px-6 sm:px-8 py-6 sm:py-8">
					{#if (anonymisedCreated !== null && anonymisedCreated > 0) || (demoEventsCreated !== null && demoEventsCreated > 0)}
						<div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-100 mb-6">
							<svg class="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<p class="text-sm font-medium text-emerald-700">
								{#if anonymisedCreated > 0 && demoEventsCreated > 0}
									Created {anonymisedCreated} anonymised contact{anonymisedCreated === 1 ? '' : 's'} and {demoEventsCreated} demo event{demoEventsCreated === 1 ? '' : 's'}.
								{:else if anonymisedCreated > 0}
									Created {anonymisedCreated} anonymised contact{anonymisedCreated === 1 ? '' : 's'}.
								{:else}
									Created {demoEventsCreated} demo event{demoEventsCreated === 1 ? '' : 's'}.
								{/if}
							</p>
						</div>
					{/if}
					{#if error}
						<div class="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100 mb-6">
							<svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<p class="text-sm text-red-600">{error}</p>
						</div>
					{/if}

					<form
						id="demo-data-form"
						method="POST"
						action="?/create"
						class="space-y-6"
					>
						<!-- Organisation selector -->
						<div>
							<label for="settings-org" class="block text-sm font-medium text-slate-700 mb-1.5">Organisation</label>
							<select
								id="settings-org"
								name="organisationId"
								required
								class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
							>
								<option value="">Select an organisation</option>
								{#each organisations as org}
									<option value={org.id} selected={organisationId === org.id}>
										{org.name}
									</option>
								{/each}
							</select>
						</div>

						<input type="hidden" name="organisationNameConfirm" value={confirmTypedName} />

						<!-- What to generate -->
						<div>
							<h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">What to generate</h3>

							<div class="space-y-4">
								<!-- Contacts option -->
								<div class="rounded-xl border border-slate-200 p-4 transition-colors {createContactsChecked ? 'bg-[#EB9486]/[0.03] border-[#EB9486]/30' : 'hover:bg-slate-50/50'}">
									<label class="flex items-start gap-3 cursor-pointer">
										<input
											type="checkbox"
											name="createContacts"
											value="on"
											bind:checked={createContactsChecked}
											class="mt-0.5 rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
										/>
										<div class="flex-1 min-w-0">
											<span class="text-sm font-medium text-slate-800">Anonymised contacts</span>
											<p class="text-xs text-slate-500 mt-0.5">Replaces all contacts with anonymised names, emails, phone numbers and addresses.</p>
										</div>
									</label>
									{#if createContactsChecked}
										<div class="mt-3 ml-6 flex items-center gap-2">
											<label for="contact-count" class="text-sm text-slate-600 whitespace-nowrap">How many:</label>
											<input
												id="contact-count"
												name="contactCount"
												type="number"
												min="1"
												max="1000"
												bind:value={contactCountValue}
												placeholder="30"
												class="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-900 focus:border-[#EB9486] focus:ring-1 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
											/>
										</div>
									{/if}
								</div>

								<!-- Events option -->
								<div class="rounded-xl border border-slate-200 p-4 transition-colors {createEventsChecked ? 'bg-[#EB9486]/[0.03] border-[#EB9486]/30' : 'hover:bg-slate-50/50'}">
									<label class="flex items-start gap-3 cursor-pointer">
										<input
											type="checkbox"
											name="createEvents"
											value="on"
											bind:checked={createEventsChecked}
											class="mt-0.5 rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
										/>
										<div class="flex-1 min-w-0">
											<span class="text-sm font-medium text-slate-800">Demo events</span>
											<p class="text-xs text-slate-500 mt-0.5">Replaces all events with 5 demo events, each with 2 occurrences a week apart.</p>
										</div>
									</label>
								</div>
							</div>
						</div>

						<!-- Warning callout -->
						<div class="flex gap-3 px-4 py-3 rounded-xl bg-amber-50/80 border border-amber-100">
							<svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<p class="text-xs text-amber-700">This action is destructive and cannot be undone. Existing data of the selected type will be permanently removed and replaced.</p>
						</div>

						<div class="flex items-center justify-end pt-2">
							<button
								type="button"
								class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] shadow-sm hover:shadow transition-all"
								on:click={openConfirmModal}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
								</svg>
								Generate data
							</button>
						</div>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Confirm modal -->
{#if showConfirmModal}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="confirm-title"
		tabindex="-1"
		on:click={(e) => e.target === e.currentTarget && closeConfirmModal()}
		on:keydown={(e) => e.key === 'Escape' && closeConfirmModal()}
	>
		<div class="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
			<div class="px-6 pt-6 pb-4">
				<div class="flex items-center gap-3 mb-3">
					<div class="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
						<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
					</div>
					<h3 id="confirm-title" class="text-lg font-semibold text-slate-800">Create demo data?</h3>
				</div>
				<p class="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{confirmMessage}</p>
			</div>
			<div class="px-6 pb-6">
				<label for="confirm-org-name" class="block text-sm font-medium text-slate-700 mb-1.5">Type the organisation name to confirm</label>
				<input
					id="confirm-org-name"
					type="text"
					bind:value={confirmTypedName}
					placeholder="Enter the exact organisation name"
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					autocomplete="off"
					on:keydown={(e) => e.key === 'Enter' && handleConfirmContinue()}
				/>
			</div>
			<div class="flex gap-2 justify-end px-6 py-4 bg-slate-50/80 border-t border-slate-100">
				<button
					type="button"
					on:click={closeConfirmModal}
					class="px-4 py-2 rounded-xl font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={handleConfirmContinue}
					class="px-4 py-2 rounded-xl font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
				>
					Continue
				</button>
			</div>
		</div>
	</div>
{/if}
