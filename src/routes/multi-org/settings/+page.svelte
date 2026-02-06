<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: emailProvider = data?.emailProvider ?? 'resend';
	$: multiOrgAdmin = data?.multiOrgAdmin || null;

	onMount(() => {
		if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('saved') === '1') {
			notifications.success('Settings saved. Email provider updated.');
		}
	});
</script>

<svelte:head>
	<title>Settings – OnNuma</title>
</svelte:head>

<div class="max-w-2xl">
	<h1 class="text-2xl font-bold text-slate-800 mb-2">Settings</h1>
	<p class="text-sm text-slate-500 mb-8">Platform-wide options for OnNuma.</p>

	<form method="POST" action="?/save" use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'failure' && result.data?.error) {
				notifications.error(result.data.error);
			}
		};
	}}>
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Email provider</h2>
			<p class="text-sm text-slate-600">
				Choose which service sends emails (contact forms, newsletters, rota invites, password resets, etc.). Configure API keys and domain in your server environment (.env or hosting dashboard).
			</p>
			<div class="space-y-3">
				<label class="block text-sm font-medium text-slate-700">Provider</label>
				<div class="flex gap-6">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="emailProvider"
							value="resend"
							checked={emailProvider === 'resend'}
							class="rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
						/>
						<span>Resend</span>
					</label>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							name="emailProvider"
							value="mailgun"
							checked={emailProvider === 'mailgun'}
							class="rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
						/>
						<span>Mailgun</span>
					</label>
				</div>
				<p class="text-xs text-slate-500">
					Resend: set <code class="bg-slate-100 px-1 rounded">RESEND_API_KEY</code> and <code class="bg-slate-100 px-1 rounded">RESEND_FROM_EMAIL</code>. Mailgun: set <code class="bg-slate-100 px-1 rounded">MAILGUN_API_KEY</code> and <code class="bg-slate-100 px-1 rounded">MAILGUN_DOMAIN</code>.
				</p>
			</div>
			<div class="pt-2">
				<button
					type="submit"
					class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
				>
					Save settings
				</button>
			</div>
		</div>
	</form>
</div>
