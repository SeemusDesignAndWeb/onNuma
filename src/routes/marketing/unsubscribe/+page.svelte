<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	export let data;
	$: contact = data?.contact;
	$: error = data?.error;
	$: token = data?.token || '';
	$: result = $page.form;
</script>

<svelte:head>
	<title>Unsubscribe – OnNuma</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-[#f8f8fa] via-white to-[#F3DE8A]/20 flex items-center justify-center p-4">
	<div class="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
		<div class="text-center mb-6">
			<img src="/assets/onnuma-logo.png" alt="OnNuma" class="h-10 mx-auto mb-4" />
			<h1 class="text-xl font-bold text-slate-800">Unsubscribe</h1>
		</div>

		{#if error}
			<div class="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-sm text-center">
				{error}
			</div>
		{:else if result?.success || contact?.subscribed === false}
			<div class="p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm text-center">
				{result?.message || 'You have been unsubscribed from marketing emails.'}
			</div>
			<div class="mt-4 text-center text-xs text-slate-500">
				{contact?.email}
			</div>
		{:else if contact}
			<p class="text-sm text-slate-600 text-center mb-5">
				Stop marketing emails for <strong>{contact.email}</strong>?
			</p>
			<form method="POST" action="?/unsubscribe" use:enhance class="space-y-3">
				<input type="hidden" name="user_id" value={contact.id} />
				{#if token}
					<input type="hidden" name="token" value={token} />
				{/if}
				<button type="submit" class="w-full px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all">
					Unsubscribe me
				</button>
			</form>
		{/if}
	</div>
</div>
