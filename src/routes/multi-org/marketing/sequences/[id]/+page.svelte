<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: sequence = data?.sequence || {};
	$: steps = data?.steps || [];
	$: templates = data?.templates || [];
	$: organisations = data?.organisations || [];
	$: timeline = data?.timeline || [];

	let showAddStep = false;
	let showTimeline = false;
	$: appliesTo = sequence?.applies_to || 'default';

	// Drag & drop reorder state
	let dragIdx = null;

	const statusColors = { draft: 'bg-amber-100 text-amber-800', active: 'bg-emerald-100 text-emerald-800', paused: 'bg-blue-100 text-blue-800', archived: 'bg-slate-100 text-slate-600' };

	const conditionTypes = [
		{ value: 'not_completed_onboarding_step', label: 'User has NOT completed onboarding step' },
		{ value: 'not_joined_rota', label: 'User has NOT joined any rota' },
		{ value: 'not_logged_in_since_joining', label: 'User has NOT logged in since joining' }
	];

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function formatDelay(val, unit) {
		if (!val || val === 0) return 'Immediately';
		return `${val} ${unit}${val > 1 ? '' : ''}`;
	}

	function handleDragStart(e, idx) { dragIdx = idx; e.dataTransfer.effectAllowed = 'move'; }
	function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
	async function handleDrop(e, targetIdx) {
		e.preventDefault();
		if (dragIdx === null || dragIdx === targetIdx) return;
		const newOrder = [...steps.map(s => s.id)];
		const [moved] = newOrder.splice(dragIdx, 1);
		newOrder.splice(targetIdx, 0, moved);
		dragIdx = null;

		// Submit reorder via form
		const formData = new FormData();
		formData.set('order', JSON.stringify(newOrder));
		await fetch('?/reorderSteps', { method: 'POST', body: formData });
		invalidateAll();
	}
</script>

<svelte:head>
	<title>{sequence.name || 'Edit Sequence'} – Marketing – OnNuma</title>
</svelte:head>

<div class="max-w-4xl">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<a href="{base}/marketing/sequences" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to sequences</a>
			<h1 class="text-2xl font-bold text-slate-800 mt-2">{sequence.name || 'Edit Sequence'}</h1>
			<div class="flex items-center gap-2 mt-1">
				<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusColors[sequence.status] || 'bg-slate-100 text-slate-600'}">{sequence.status}</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<form method="POST" action="?/duplicate" use:enhance>
				<button type="submit" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Duplicate</button>
			</form>
			<button on:click={() => showTimeline = !showTimeline} class="px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">Timeline Preview</button>
		</div>
	</div>

	{#if form?.success}
		<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Saved successfully.</div>
	{/if}
	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	<!-- Status actions -->
	<div class="mb-4 flex items-center gap-2">
		{#if sequence.status === 'draft' || sequence.status === 'paused'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="active" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600">Activate</button>
			</form>
		{/if}
		{#if sequence.status === 'active'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="paused" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200">Pause</button>
			</form>
		{/if}
		{#if sequence.status !== 'archived'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="archived" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">Archive</button>
			</form>
		{/if}
	</div>

	<!-- Timeline preview -->
	{#if showTimeline}
		<div class="mb-6 bg-blue-50 rounded-2xl border border-blue-200 p-5">
			<h3 class="font-semibold text-sm text-blue-800 mb-3">Timeline Preview (if user joins now)</h3>
			{#if timeline.length === 0}
				<p class="text-sm text-blue-600">No steps to preview.</p>
			{:else}
				<div class="relative pl-6 border-l-2 border-blue-300 space-y-4">
					{#each timeline as step, i}
						<div class="relative">
							<div class="absolute -left-[calc(1.5rem+5px)] top-1 w-3 h-3 rounded-full bg-blue-400 border-2 border-blue-50"></div>
							<div class="bg-white rounded-lg p-3 shadow-sm">
								<div class="flex items-center gap-2">
									<span class="text-xs font-semibold text-blue-600">Step {i + 1}</span>
									<span class="text-xs text-slate-400">{formatDelay(step.delay_value, step.delay_unit)} after join</span>
								</div>
								<p class="text-sm font-medium text-slate-800 mt-1">{step.template?.name || 'No template selected'}</p>
								<p class="text-xs text-slate-400 mt-0.5">Sends at: {formatDate(step.previewSendAt)}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Sequence details form -->
	<form method="POST" action="?/saveSequence" use:enhance={() => { return async ({ update }) => { await update(); invalidateAll(); }; }} class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5 mb-6">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
				<input type="text" name="name" id="name" required value={sequence.name || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400" />
			</div>
			<div>
				<label for="applies_to" class="block text-sm font-medium text-slate-700 mb-1">Applies To</label>
				<select name="applies_to" id="applies_to" bind:value={appliesTo} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400">
					<option value="default">Default (all orgs)</option>
					<option value="organisation">Specific org</option>
					<option value="org_group">Org group</option>
				</select>
			</div>
		</div>
		{#if appliesTo === 'organisation'}
			<div>
				<label for="organisation_id" class="block text-sm font-medium text-slate-700 mb-1">Organisation</label>
				<select name="organisation_id" id="organisation_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="">— Select —</option>
					{#each organisations as org}
						<option value={org.id} selected={org.id === sequence.organisation_id}>{org.name}</option>
					{/each}
				</select>
			</div>
		{/if}
		{#if appliesTo === 'org_group'}
			<div>
				<label for="org_group" class="block text-sm font-medium text-slate-700 mb-1">Group</label>
				<input type="text" name="org_group" id="org_group" value={sequence.org_group || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</div>
		{/if}
		<div>
			<label for="description" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
			<textarea name="description" id="description" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{sequence.description || ''}</textarea>
		</div>
		<div class="flex justify-end">
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all">Save Details</button>
		</div>
	</form>

	<!-- Steps -->
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-slate-800">Steps</h2>
			<button on:click={() => showAddStep = !showAddStep} class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
				Add Step
			</button>
		</div>

		<p class="text-xs text-slate-400 mb-4">Drag steps to reorder. Delay is measured from when the user joined the org.</p>

		{#if steps.length === 0}
			<div class="text-center py-8 text-slate-400">
				<p class="text-sm">No steps yet. Add your first step above.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each steps as step, i (step.id)}
					<div
						class="bg-slate-50 rounded-xl border border-slate-200 p-4 cursor-move"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, i)}
						on:dragover={handleDragOver}
						on:drop={(e) => handleDrop(e, i)}
						role="listitem"
					>
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-start gap-3 flex-1">
								<div class="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">{i + 1}</div>
								<div class="flex-1 min-w-0">
									<form method="POST" action="?/updateStep" use:enhance={() => { return async ({ update }) => { await update(); invalidateAll(); }; }} class="space-y-3">
										<input type="hidden" name="step_id" value={step.id} />
										<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
											<div>
												<label class="block text-xs font-medium text-slate-600 mb-1">Template</label>
												<select name="email_template_id" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
													<option value="">— Select —</option>
													{#each templates as tmpl}
														<option value={tmpl.id} selected={tmpl.id === step.email_template_id}>{tmpl.name}</option>
													{/each}
												</select>
											</div>
											<div>
												<label class="block text-xs font-medium text-slate-600 mb-1">Delay</label>
												<input type="number" name="delay_value" min="0" value={step.delay_value || 0} class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
											</div>
											<div>
												<label class="block text-xs font-medium text-slate-600 mb-1">Unit</label>
												<select name="delay_unit" class="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
													{#each ['minutes', 'hours', 'days', 'weeks'] as u}
														<option value={u} selected={u === step.delay_unit}>{u}</option>
													{/each}
												</select>
											</div>
										</div>
										{#if step.conditions?.length}
											<div class="text-xs text-slate-500">
												Conditions: {step.conditions.map(c => c.type.replace(/_/g, ' ')).join(', ')}
											</div>
										{/if}
										<div class="flex items-center gap-2">
											<button type="submit" class="px-3 py-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors">Save Step</button>
										</div>
									</form>
								</div>
							</div>
							<form method="POST" action="?/removeStep" use:enhance={() => { return async ({ update }) => { await update(); invalidateAll(); }; }} class="flex-shrink-0">
								<input type="hidden" name="step_id" value={step.id} />
								<button type="submit" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove step">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Add step form -->
		{#if showAddStep}
			<div class="mt-4 bg-emerald-50 rounded-xl border border-emerald-200 p-4">
				<h3 class="font-semibold text-sm text-emerald-800 mb-3">Add New Step</h3>
				<form method="POST" action="?/addStep" use:enhance={() => { return async ({ update }) => { showAddStep = false; await update(); invalidateAll(); }; }} class="space-y-3">
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<label class="block text-xs font-medium text-emerald-700 mb-1">Template</label>
							<select name="email_template_id" class="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm">
								<option value="">— Select —</option>
								{#each templates as tmpl}
									<option value={tmpl.id}>{tmpl.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-xs font-medium text-emerald-700 mb-1">Send After (delay)</label>
							<input type="number" name="delay_value" min="0" value="0" class="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm" />
						</div>
						<div>
							<label class="block text-xs font-medium text-emerald-700 mb-1">Unit</label>
							<select name="delay_unit" class="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm">
								<option value="minutes">minutes</option>
								<option value="hours">hours</option>
								<option value="days" selected>days</option>
								<option value="weeks">weeks</option>
							</select>
						</div>
					</div>
					<div>
						<label class="block text-xs font-medium text-emerald-700 mb-1">Conditions (optional)</label>
						<select name="cond_type" class="w-full rounded-lg border border-emerald-300 px-2 py-1.5 text-sm">
							<option value="">— No condition —</option>
							{#each conditionTypes as ct}
								<option value={ct.value}>{ct.label}</option>
							{/each}
						</select>
						<input type="hidden" name="cond_value" value="" />
					</div>
					<div class="flex items-center gap-2">
						<button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">Add Step</button>
						<button type="button" on:click={() => showAddStep = false} class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>
