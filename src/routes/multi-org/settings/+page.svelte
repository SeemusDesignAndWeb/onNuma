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
	$: pricingSaved = data?.pricingSaved ?? false;
	$: pricingError = form?.pricingError ?? null;
	$: pricing = data?.pricing ?? {};
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

	// Confirm modal state (organisation name input is on the popup)
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
</script>

<svelte:head>
	<title>Settings – OnNuma</title>
</svelte:head>

<div class="max-w-2xl">
	<h1 class="text-2xl font-bold text-slate-800 mb-6">Settings</h1>

	<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
		<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Create demo data</h2>
		<p class="text-sm text-slate-600">
			Choose an organisation and what to create. Existing data of the selected type will be removed and replaced.
		</p>
		{#if (anonymisedCreated !== null && anonymisedCreated > 0) || (demoEventsCreated !== null && demoEventsCreated > 0)}
			<p class="text-sm font-medium text-green-700">
				{#if anonymisedCreated > 0 && demoEventsCreated > 0}
					Created {anonymisedCreated} anonymised contact{anonymisedCreated === 1 ? '' : 's'} and {demoEventsCreated} demo event{demoEventsCreated === 1 ? '' : 's'}.
				{:else if anonymisedCreated > 0}
					Created {anonymisedCreated} anonymised contact{anonymisedCreated === 1 ? '' : 's'}.
				{:else}
					Created {demoEventsCreated} demo event{demoEventsCreated === 1 ? '' : 's'}.
				{/if}
			</p>
		{/if}
		{#if error}
			<p class="text-sm text-red-600">{error}</p>
		{/if}
		<form
			id="demo-data-form"
			method="POST"
			action="?/create"
			class="space-y-5"
		>
			<div>
				<label for="settings-org" class="block text-sm font-medium text-slate-700 mb-1">Organisation</label>
				<select
					id="settings-org"
					name="organisationId"
					required
					class="block w-full max-w-md rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				>
					<option value="">Select an organisation</option>
					{#each organisations as org}
						<option value={org.id} selected={organisationId === org.id}>
							{org.name}
						</option>
					{/each}
				</select>
			</div>

			<!-- Hidden so modal input value is submitted with form -->
			<input type="hidden" name="organisationNameConfirm" value={confirmTypedName} />

			<div class="space-y-3">
				<label class="flex items-start gap-3 cursor-pointer">
					<input
						type="checkbox"
						name="createContacts"
						value="on"
						bind:checked={createContactsChecked}
						class="mt-1 rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
					/>
					<span class="text-sm font-medium text-slate-700">Create anonymised contacts</span>
				</label>
				<div class="ml-6 flex items-center gap-2">
					<label for="contact-count" class="text-sm text-slate-600">Number:</label>
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
				<p class="ml-6 text-xs text-slate-500">Replaces all contacts with anonymised names, emails, phone numbers and addresses.</p>
			</div>

			<div>
				<label class="flex items-start gap-3 cursor-pointer">
					<input
						type="checkbox"
						name="createEvents"
						value="on"
						bind:checked={createEventsChecked}
						class="mt-1 rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
					/>
					<span class="text-sm font-medium text-slate-700">Create demo events</span>
				</label>
				<p class="ml-6 mt-1 text-xs text-slate-500">Replaces all events with 5 demo events, each with 2 occurrences a week apart.</p>
			</div>

			<button
				type="button"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
				on:click={openConfirmModal}
			>
				Create
			</button>
		</form>

		<!-- Confirm popup: message + type org name + Cancel / Continue -->
		{#if showConfirmModal}
			<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions -->
			<div
				class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-title"
				tabindex="-1"
				on:click={(e) => e.target === e.currentTarget && closeConfirmModal()}
				on:keydown={(e) => e.key === 'Escape' && closeConfirmModal()}
			>
				<div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200">
					<h3 id="confirm-title" class="text-lg font-semibold text-slate-800 mb-2">Create demo data?</h3>
					<p class="text-sm text-slate-600 mb-4 whitespace-pre-line">{confirmMessage}</p>
					<div class="mb-5">
						<label for="confirm-org-name" class="block text-sm font-medium text-slate-700 mb-1">Type the organisation name to confirm</label>
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
					<div class="flex gap-2 justify-end">
						<button
							type="button"
							on:click={closeConfirmModal}
							class="px-4 py-2 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
						>
							Cancel
						</button>
						<button
							type="button"
							on:click={handleConfirmContinue}
							class="px-4 py-2 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-colors"
						>
							Continue
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pricing Configuration -->
	<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mt-6">
		<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Professional Pricing</h2>
		<p class="text-sm text-slate-600">
			Configure pricing for the Professional plan on the landing page.
		</p>
		{#if pricingSaved}
			<p class="text-sm font-medium text-green-700">Pricing settings saved successfully.</p>
		{/if}
		{#if pricingError}
			<p class="text-sm text-red-600">{pricingError}</p>
		{/if}
		<form method="POST" action="?/savePricing" class="space-y-5">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="basePrice" class="block text-sm font-medium text-slate-700 mb-1">Base price (£)</label>
					<input
						id="basePrice"
						name="basePrice"
						type="number"
						min="0"
						max="1000"
						value={pricing.basePrice ?? 12}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
					<p class="text-xs text-slate-500 mt-1">Starting price at minimum users</p>
				</div>
				<div>
					<label for="threshold" class="block text-sm font-medium text-slate-700 mb-1">Price threshold (users)</label>
					<input
						id="threshold"
						name="threshold"
						type="number"
						min="10"
						max="10000"
						value={pricing.threshold ?? 300}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
					<p class="text-xs text-slate-500 mt-1">User count where pricing rate increases</p>
				</div>
				<div>
					<label for="pricePerTenUsers" class="block text-sm font-medium text-slate-700 mb-1">£ per 10 users (below threshold)</label>
					<input
						id="pricePerTenUsers"
						name="pricePerTenUsers"
						type="number"
						min="0"
						max="100"
						value={pricing.pricePerTenUsers ?? 1}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
					<p class="text-xs text-slate-500 mt-1">Price added per 10 users up to threshold</p>
				</div>
				<div>
					<label for="pricePerTenUsersAbove" class="block text-sm font-medium text-slate-700 mb-1">£ per 10 users (above threshold)</label>
					<input
						id="pricePerTenUsersAbove"
						name="pricePerTenUsersAbove"
						type="number"
						min="0"
						max="100"
						value={pricing.pricePerTenUsersAbove ?? 2}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
					<p class="text-xs text-slate-500 mt-1">Price added per 10 users above threshold</p>
				</div>
			</div>

			<h3 class="text-sm font-semibold text-slate-700 pt-2">Slider settings</h3>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div>
					<label for="minUsers" class="block text-sm font-medium text-slate-700 mb-1">Minimum users</label>
					<input
						id="minUsers"
						name="minUsers"
						type="number"
						min="1"
						max="1000"
						value={pricing.minUsers ?? 50}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
				</div>
				<div>
					<label for="maxUsers" class="block text-sm font-medium text-slate-700 mb-1">Maximum users</label>
					<input
						id="maxUsers"
						name="maxUsers"
						type="number"
						min="1"
						max="10000"
						value={pricing.maxUsers ?? 500}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
				</div>
				<div>
					<label for="defaultUsers" class="block text-sm font-medium text-slate-700 mb-1">Default position</label>
					<input
						id="defaultUsers"
						name="defaultUsers"
						type="number"
						min="1"
						max="10000"
						value={pricing.defaultUsers ?? 100}
						class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
				</div>
			</div>

			<button
				type="submit"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
			>
				Save pricing
			</button>
		</form>
	</div>
</div>
