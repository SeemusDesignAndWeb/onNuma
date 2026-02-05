<script lang="js">
	import { onMount } from 'svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	let landing = {
		tagline: '',
		ctaRequestDemoUrl: '',
		ctaStartOrganisationUrl: '',
		heroImage: ''
	};
	let loading = true;
	let saving = false;

	onMount(async () => {
		await loadLanding();
	});

	async function loadLanding() {
		try {
			const response = await fetch('/api/content?type=landing');
			if (response.ok) {
				landing = await response.json();
			}
		} catch (error) {
			console.error('Failed to load landing:', error);
			notifications.error('Failed to load landing page settings');
		} finally {
			loading = false;
		}
	}

	async function saveLanding() {
		saving = true;
		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'landing', data: landing })
			});

			if (response.ok) {
				notifications.success('Landing page settings saved.');
			} else {
				const err = await response.json();
				notifications.error(err.error || 'Failed to save');
			}
		} catch (error) {
			console.error('Failed to save landing:', error);
			notifications.error('Failed to save');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Landing page – OnNuma Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-2xl mx-auto">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Landing page</h1>
			<p class="text-gray-600">Edit the tagline and CTA links shown on the OnNuma marketing homepage.</p>
		</div>

		{#if loading}
			<div class="text-center py-12 text-gray-500">Loading…</div>
		{:else}
			<form on:submit|preventDefault={saveLanding} class="space-y-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
				<div>
					<label for="tagline" class="block text-sm font-medium text-gray-700 mb-1">Hero tagline</label>
					<input
						id="tagline"
						type="text"
						bind:value={landing.tagline}
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
						placeholder="Organisation management that people actually use"
					/>
				</div>

				<div>
					<label for="ctaRequestDemoUrl" class="block text-sm font-medium text-gray-700 mb-1">Request a demo (URL)</label>
					<input
						id="ctaRequestDemoUrl"
						type="url"
						bind:value={landing.ctaRequestDemoUrl}
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
						placeholder="/multi-org"
					/>
				</div>

				<div>
					<label for="ctaStartOrganisationUrl" class="block text-sm font-medium text-gray-700 mb-1">Start your organisation (URL)</label>
					<input
						id="ctaStartOrganisationUrl"
						type="url"
						bind:value={landing.ctaStartOrganisationUrl}
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
						placeholder="/multi-org/organisations/new"
					/>
				</div>

				<div>
					<label for="heroImage" class="block text-sm font-medium text-gray-700 mb-1">Hero image URL (optional)</label>
					<input
						id="heroImage"
						type="text"
						bind:value={landing.heroImage}
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
						placeholder="https://…"
					/>
				</div>

				<button
					type="submit"
					disabled={saving}
					class="w-full sm:w-auto px-6 py-2.5 rounded-lg font-medium bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</form>
		{/if}
	</div>
</div>
