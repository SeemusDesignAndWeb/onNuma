<script>
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: token = form?.token ?? data?.token ?? '';
	$: email = form?.email ?? data?.email ?? '';
	$: error = form?.error ?? '';
	$: invalidLink = !data?.token || !data?.email;
</script>

<svelte:head>
	<title>Set new password – OnNuma</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8f8fa] via-white to-[#F3DE8A]/30 px-4 py-12">
	<div class="w-full max-w-md">
		<div class="text-center mb-8">
			<img src="/assets/onnuma-logo.png" alt="OnNuma" class="w-auto max-w-[200px] h-14 mx-auto mb-4 object-contain" />
			<h1 class="text-2xl font-bold text-[#272838] tracking-tight">Set new password</h1>
			<p class="mt-2 text-sm text-[#7E7F9A]">Choose a new password for your OnNuma account</p>
		</div>

		<div class="bg-white rounded-2xl shadow-xl shadow-[#7E7F9A]/10 border border-[#7E7F9A]/20 p-8">
			{#if invalidLink}
				<p class="text-slate-600 text-sm mb-4">
					This reset link is invalid or incomplete. Please use the link from your email or
					<a href="{base}/auth/forgot-password" class="text-[#c75a4a] font-medium hover:underline">request a new one</a>.
				</p>
				<a
					href="{base}/auth/login"
					class="block w-full text-center py-3 px-4 rounded-xl font-semibold text-[#c75a4a] bg-[#EB9486]/10 hover:bg-[#EB9486]/20 border border-[#EB9486]/40 transition-colors"
				>
					← Back to sign in
				</a>
			{:else}
				<form method="POST" action="?/reset" use:enhance>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="email" value={email} />
					{#if error}
						<div class="rounded-xl bg-red-50 border border-red-200 p-3 mb-4 text-red-700 text-sm">
							{error}
						</div>
					{/if}
					<div class="space-y-4">
						<div>
							<label for="password" class="block text-sm font-medium text-slate-700 mb-1">New password</label>
							<input
								id="password"
								name="password"
								type="password"
								autocomplete="new-password"
								required
								minlength="12"
								class="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none transition-shadow sm:text-sm"
								placeholder="At least 12 characters, with upper, lower, number and special"
							/>
							<p class="mt-1 text-xs text-slate-500">At least 12 characters, with uppercase, lowercase, number and special character.</p>
						</div>
						<div>
							<label for="confirmPassword" class="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autocomplete="new-password"
								required
								minlength="12"
								class="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none transition-shadow sm:text-sm"
								placeholder="Repeat new password"
							/>
						</div>
					</div>
					<button
						type="submit"
						class="mt-6 w-full py-3 px-4 rounded-xl font-semibold text-white bg-[#EB9486] hover:bg-[#e08070] focus:outline-none focus:ring-2 focus:ring-[#EB9486] focus:ring-offset-2"
					>
						Reset password
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
