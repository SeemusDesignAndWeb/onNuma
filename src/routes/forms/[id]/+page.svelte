<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';

	$: form = $page.data?.form;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: submitted = formResult?.success === true;

	let formData = {};

	// Initialize form data from form fields
	$: if (form && form.fields) {
		const initial = {};
		for (const field of form.fields) {
			if (field.type === 'checkbox') {
				initial[field.name] = [];
			} else {
				initial[field.name] = '';
			}
		}
		formData = initial;
	}

</script>

<div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-2xl mx-auto">
		{#if submitted && formResult?.success}
			<div class="bg-white shadow rounded-lg p-8 text-center">
				<div class="text-green-600 text-5xl mb-4">✓</div>
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
				<p class="text-gray-600">Your form has been submitted successfully.</p>
			</div>
		{:else if form}
			<div class="bg-white shadow rounded-lg p-6">
				<h1 class="text-2xl font-bold text-gray-900 mb-2">{form.name}</h1>
				{#if form.description}
					<p class="text-gray-600 mb-6">{form.description}</p>
				{/if}

				{#if form.isSafeguarding}
					<div class="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
						<p class="text-sm text-yellow-800">
							<strong>🔒 Secure Form:</strong> All information submitted through this form is encrypted and stored securely.
						</p>
					</div>
				{/if}

				<form method="POST" action="?/submit" use:enhance>
					<input type="hidden" name="_csrf" value={csrfToken} />
					
					<div class="space-y-6">
						{#each form.fields as field}
							<div>
								<label for={field.name} class="block text-sm font-medium text-gray-700 mb-1">
									{field.label}
									{#if field.required}
										<span class="text-red-500">*</span>
									{/if}
								</label>
								
								{#if field.type === 'textarea'}
									<textarea
										id={field.name}
										name={field.name}
										value={formData[field.name] || ''}
										on:input={(e) => formData[field.name] = e.target.value}
										required={field.required}
										placeholder={field.placeholder || ''}
										rows="4"
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
									></textarea>
								{:else if field.type === 'select'}
									<select
										id={field.name}
										name={field.name}
										value={formData[field.name] || ''}
										on:change={(e) => formData[field.name] = e.target.value}
										required={field.required}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
									>
										<option value="">Select...</option>
										{#each field.options as option}
											<option value={option}>{option}</option>
										{/each}
									</select>
								{:else if field.type === 'checkbox'}
									<div class="mt-2 space-y-2">
										{#each field.options as option}
											<label class="flex items-center">
												<input
													type="checkbox"
													name="{field.name}[]"
													value={option}
													class="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
													checked={formData[field.name]?.includes(option)}
													on:change={(e) => {
														if (!formData[field.name]) formData[field.name] = [];
														if (e.target.checked) {
															formData[field.name] = [...formData[field.name], option];
														} else {
															formData[field.name] = formData[field.name].filter(v => v !== option);
														}
													}}
												/>
												<span class="text-sm text-gray-700">{option}</span>
											</label>
										{/each}
									</div>
								{:else if field.type === 'radio'}
									<div class="mt-2 space-y-2">
										{#each field.options as option}
											<label class="flex items-center">
												<input
													type="radio"
													name={field.name}
													value={option}
													bind:group={formData[field.name]}
													required={field.required}
													class="mr-2 text-green-600 focus:ring-green-500"
												/>
												<span class="text-sm text-gray-700">{option}</span>
											</label>
										{/each}
									</div>
								{:else}
									<input
										type={field.type}
										id={field.name}
										name={field.name}
										value={formData[field.name] || ''}
										on:input={(e) => formData[field.name] = e.target.value}
										required={field.required}
										placeholder={field.placeholder || ''}
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
									/>
								{/if}
							</div>
						{/each}
					</div>

					{#if formResult?.error}
						<div class="mt-4 p-4 bg-red-50 text-red-800 rounded-md">
							{formResult.error}
						</div>
					{/if}

					<div class="mt-6">
						<button
							type="submit"
							class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
						>
							Submit Form
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>

