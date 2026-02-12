<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: contact = data?.contact;
	$: preferences = data?.preferences;
</script>

<svelte:head>
	<title>Email Preferences – OnNuma</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-[#f8f8fa] via-white to-[#F3DE8A]/20 flex items-center justify-center p-4">
	<div class="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
		<div class="text-center mb-6">
			<img src="/assets/onnuma-logo.png" alt="OnNuma" class="h-10 mx-auto mb-4" />
			<h1 class="text-xl font-bold text-slate-800">Email Preferences</h1>
		</div>

		{#if form?.success}
			<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm text-center">
				Your preferences have been updated.
			</div>
		{/if}

		{#if !contact}
			<div class="text-center text-slate-500">
				<p>We couldn't find your account. If you believe this is an error, please contact support.</p>
			</div>
		{:else}
			<div class="mb-6">
				<p class="text-sm text-slate-600">Managing preferences for: <strong>{contact.email}</strong></p>
			</div>

			<form method="POST" action="?/updatePreferences" use:enhance class="space-y-4">
				<input type="hidden" name="user_id" value={contact.id} />

				<div class="p-4 bg-slate-50 rounded-xl">
					<h2 class="text-sm font-semibold text-slate-700 mb-3">Email Categories</h2>

					<div class="space-y-3">
						<div class="flex items-start gap-3">
							<div class="mt-0.5">
								<input type="checkbox" checked disabled class="rounded border-slate-300" />
							</div>
							<div>
								<p class="text-sm font-medium text-slate-700">Essential Onboarding</p>
								<p class="text-xs text-slate-500">Required for your account setup. Cannot be disabled.</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<div class="mt-0.5">
								<input
									type="checkbox"
									name="opted_out_non_essential"
									checked={preferences?.opted_out_non_essential}
									class="rounded border-slate-300"
								/>
							</div>
							<div>
								<p class="text-sm font-medium text-slate-700">Opt out of product tips</p>
								<p class="text-xs text-slate-500">Check this box to stop receiving non-essential product education emails.</p>
							</div>
						</div>
					</div>
				</div>

				<button type="submit" class="w-full px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">
					Save Preferences
				</button>
			</form>
		{/if}
	</div>
</div>
