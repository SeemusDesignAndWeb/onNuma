<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	export let data;

	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: formResult = $page.form;
	$: error = formResult?.error ?? '';
	$: success = formResult?.success ?? false;
	$: message = formResult?.message ?? (success ? 'If an account exists for that email, we\'ve sent a password reset link. Check your inbox and spam folder.' : '');
</script>

<svelte:head>
	<title>Forgot password – OnNuma</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8f8fa] via-white to-[#F3DE8A]/30 px-4 py-12">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<img src="/assets/onnuma-logo.png" alt="OnNuma" class="w-auto max-w-[200px] h-14 mx-auto mb-4 object-contain" />
			<h1 class="text-2xl font-bold text-[#272838] tracking-tight">Forgot password</h1>
			<p class="mt-2 text-sm text-[#7E7F9A]">Reset your OnNuma admin password</p>
		</div>

		<div class="bg-white rounded-2xl shadow-xl shadow-[#7E7F9A]/10 border border-[#7E7F9A]/20 p-8">
			{#if success}
				<div class="rounded-xl bg-[#F3DE8A]/30 border border-[#F3DE8A] p-4 mb-4">
					<p class="text-[#272838] text-sm">{message}</p>
				</div>
				<a
					href="{base}/auth/login"
					class="block w-full text-center py-3 px-4 rounded-xl font-semibold text-[#c75a4a] bg-[#EB9486]/10 hover:bg-[#EB9486]/20 border border-[#EB9486]/40 transition-colors"
				>
					← Back to sign in
				</a>
			{:else}
				<form method="POST" action="?/requestReset" use:enhance={() => {
	return async ({ result, update }) => {
		await update();
	};
}}>
					{#if error}
						<div class="rounded-xl bg-red-50 border border-red-200 p-3 mb-4 text-red-700 text-sm">
							{error}
						</div>
					{/if}
					{#if message && !error}
						<div class="rounded-xl bg-[#F3DE8A]/30 border border-[#F3DE8A] p-3 mb-4 text-[#272838] text-sm">
							{message}
						</div>
					{/if}
					<div class="mb-4">
						<label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email address</label>
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							class="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none transition-shadow sm:text-sm"
							placeholder="you@example.com"
						/>
					</div>
					<button
						type="submit"
						class="w-full py-3 px-4 rounded-xl font-semibold text-white bg-[#EB9486] hover:bg-[#e08070] transition-all focus:outline-none focus:ring-2 focus:ring-[#EB9486] focus:ring-offset-2"
					>
						Send reset link
					</button>
				</form>
				<a
					href="{base}/auth/login"
					class="mt-6 block w-full text-center py-3 px-4 rounded-xl font-semibold text-[#c75a4a] bg-[#EB9486]/10 hover:bg-[#EB9486]/20 border border-[#EB9486]/40 transition-colors"
				>
					← Back to sign in
				</a>
			{/if}
		</div>
	</div>
</div>
