<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	
	let error = '';
	
	$: if ($page.form?.error) {
		error = $page.form.error;
	}
	
	$: message = $page.data?.message;
</script>

<div class="h-screen flex items-center justify-center bg-gray-50 px-4 sm:py-12 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8 -mt-16 sm:mt-0">
		<div class="text-center">
			<img
				src="/images/egcc-color.png"
				alt="Eltham Green Community Church"
				class="h-16 w-auto max-w-full object-contain mx-auto mb-4"
			/>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Sign in to The HUB
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				Eltham Green Community Church
			</p>
		</div>
		<form method="POST" action="?/login" use:enhance>
			<input type="hidden" name="_csrf" value={$page.data?.csrfToken || ''} />
			<div class="rounded-md shadow-sm -space-y-px">
				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-hub-green-500 focus:border-hub-green-600 focus:z-10 sm:text-sm"
						placeholder="Email address"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-hub-green-500 focus:border-hub-green-600 focus:z-10 sm:text-sm"
						placeholder="Password"
					/>
				</div>
			</div>

			{#if message}
				<div class="mt-4 p-3 rounded-md text-sm {message.type === 'success' ? 'bg-hub-green-50 text-hub-green-800 border border-hub-green-200' : 'bg-hub-red-50 text-hub-red-800 border border-hub-red-200'}">
					{message.text}
				</div>
			{/if}
			
			{#if error}
				<div class="mt-4 text-sm text-hub-red-600">{error}</div>
			{/if}

			<div class="flex items-center justify-between mt-4">
				<div class="text-sm">
					<a href="/hub/auth/forgot-password" class="font-medium text-hub-blue-600 hover:text-hub-blue-600/80">
						Forgot password?
					</a>
				</div>
			</div>

			<div class="mt-6">
				<button
					type="submit"
					class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-hub-green-600 hover:bg-hub-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hub-green-500"
				>
					Sign in
				</button>
			</div>
		</form>
	</div>
</div>

