<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	let error = '';
	$: if ($page.form?.error) {
		error = $page.form.error;
	}
</script>

<svelte:head>
	<title>Sign in – OnNuma</title>
</svelte:head>

<div class="flex flex-1 min-h-0 items-center justify-center px-4 py-8">
	<div class="w-full max-w-md">
		<!-- Logo -->
		<div class="text-center mb-6">
			<img src="/images/onnuma-logo.png" alt="OnNuma" class="w-auto max-w-[200px] h-14 mx-auto object-contain" />
		</div>

		<div class="bg-white rounded-2xl shadow-xl shadow-[#7E7F9A]/10 border border-[#7E7F9A]/20 p-8">
			{#if data?.resetSuccess}
				<div class="rounded-xl bg-green-50 border border-green-200 p-3 mb-4 text-green-800 text-sm">
					Your password has been reset. You can sign in with your new password.
				</div>
			{/if}
			<form method="POST" action="?/login" use:enhance>
				<input type="hidden" name="_csrf" value={$page.data?.csrfToken || ''} />
				<div class="space-y-4">
					<div>
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
					<div>
						<label for="password" class="block text-sm font-medium text-slate-700 mb-1">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="current-password"
							required
							class="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none transition-shadow sm:text-sm"
							placeholder="••••••••"
						/>
					</div>
				</div>
				{#if error}
					<div class="mt-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
						{error}
					</div>
				{/if}
				<div class="mt-3 text-center">
					<a href="{base}/auth/forgot-password" class="text-sm font-medium text-[#c75a4a] hover:text-[#EB9486]">
						Forgot password?
					</a>
				</div>
					<button
						type="submit"
						class="mt-6 w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-semibold text-white bg-[#EB9486] hover:bg-[#e08070] focus:outline-none focus:ring-2 focus:ring-[#EB9486] focus:ring-offset-2 transition-all"
					>
						Sign in
					</button>
				</form>
		</div>
	</div>
</div>
