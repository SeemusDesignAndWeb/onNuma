<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: csrfToken = data?.csrfToken || '';
	$: formResult = $page.form;

	let editing = false;
	let isSubmitting = false;
	let initializedId = null;

	let form = {
		firstName: '',
		lastName: '',
		phone: '',
		newEmail: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		county: '',
		postcode: '',
		country: 'United Kingdom'
	};

	// Initialize form when contact loads
	$: if (data.contact && data.contact.id !== initializedId) {
		const c = data.contact;
		form = {
			firstName: c.firstName || '',
			lastName: c.lastName || '',
			phone: c.phone || '',
			newEmail: '',
			addressLine1: c.addressLine1 || '',
			addressLine2: c.addressLine2 || '',
			city: c.city || '',
			county: c.county || '',
			postcode: c.postcode || '',
			country: c.country || 'United Kingdom'
		};
		initializedId = c.id;
		editing = false;
	}

	$: emailVerifyStatus = data?.emailVerifyStatus ?? null;

	// Handle form result from action
	let lastProcessed = null;
	$: if (formResult && formResult !== lastProcessed) {
		lastProcessed = formResult;
		if (formResult?.success) {
			if (formResult.emailVerificationSent) {
				notifications.success("We've sent a verification link to your new email address. Click the link to complete the change.");
			} else {
				notifications.success('Your details have been updated.');
			}
			editing = false;
			form.newEmail = '';
			// Re-initialize form from returned contact
			if (formResult.contact) {
				const c = formResult.contact;
				form = {
					firstName: c.firstName || '',
					lastName: c.lastName || '',
					phone: c.phone || '',
					newEmail: '',
					addressLine1: c.addressLine1 || '',
					addressLine2: c.addressLine2 || '',
					city: c.city || '',
					county: c.county || '',
					postcode: c.postcode || '',
					country: c.country || 'United Kingdom'
				};
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	function startEditing() {
		editing = true;
	}

	function cancelEditing() {
		// Reset to server data
		if (data.contact) {
			const c = data.contact;
			form = {
				firstName: c.firstName || '',
				lastName: c.lastName || '',
				phone: c.phone || '',
				newEmail: '',
				addressLine1: c.addressLine1 || '',
				addressLine2: c.addressLine2 || '',
				city: c.city || '',
				county: c.county || '',
				postcode: c.postcode || '',
				country: c.country || 'United Kingdom'
			};
		}
		editing = false;
	}

	function handleEnhance() {
		isSubmitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			isSubmitting = false;
		};
	}
</script>

<svelte:head>
	<title>My details – myHub</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-heading">My details</h1>
	<p class="my-lead">View and update your personal information. You can change your email address here; we'll send a verification link to confirm it's yours.</p>

	{#if emailVerifyStatus === '1'}
		<div class="my-alert my-alert-success" role="status">
			<p>Your email address has been updated. Use your new email next time you sign in.</p>
		</div>
	{/if}
	{#if emailVerifyStatus === 'expired'}
		<div class="my-alert my-alert-error" role="alert">
			<p>The verification link has expired. Please enter your new email again and we'll send a fresh link.</p>
		</div>
	{/if}
	{#if emailVerifyStatus === 'invalid' || emailVerifyStatus === 'missing'}
		<div class="my-alert my-alert-error" role="alert">
			<p>That verification link was invalid or has already been used. To change your email, enter the new address below and save.</p>
		</div>
	{/if}
	{#if emailVerifyStatus === 'error'}
		<div class="my-alert my-alert-error" role="alert">
			<p>Something went wrong. Please try again or contact your organiser.</p>
		</div>
	{/if}

	{#if !data.contact}
		<div class="my-alert my-alert-info">
			<p>Sign in to view and update your details.</p>
		</div>
	{:else}
		<div class="my-card">
			<div class="my-card-body">
				{#if !editing}
					<!-- Read-only view -->
					<div class="my-details-grid">
						<div class="my-detail">
							<span class="my-detail-label">Email</span>
							<span class="my-detail-value">{data.contact.email}</span>
						</div>
						<div class="my-detail">
							<span class="my-detail-label">First name</span>
							<span class="my-detail-value">{form.firstName || '—'}</span>
						</div>
						<div class="my-detail">
							<span class="my-detail-label">Last name</span>
							<span class="my-detail-value">{form.lastName || '—'}</span>
						</div>
						<div class="my-detail">
							<span class="my-detail-label">Phone</span>
							<span class="my-detail-value">{form.phone || '—'}</span>
						</div>
					</div>

					{#if form.addressLine1 || form.city || form.postcode}
						<div class="my-address-section">
							<span class="my-detail-label">Address</span>
							<div class="my-detail-value my-address-block">
								{#if form.addressLine1}<span>{form.addressLine1}</span>{/if}
								{#if form.addressLine2}<span>{form.addressLine2}</span>{/if}
								{#if form.city || form.county}
									<span>{[form.city, form.county].filter(Boolean).join(', ')}</span>
								{/if}
								{#if form.postcode}<span>{form.postcode}</span>{/if}
								{#if form.country && form.country !== 'United Kingdom'}<span>{form.country}</span>{/if}
							</div>
						</div>
					{:else}
						<div class="my-address-section">
							<span class="my-detail-label">Address</span>
							<span class="my-detail-value">—</span>
						</div>
					{/if}

					<div class="my-actions">
						<button type="button" class="my-btn my-btn-primary" on:click={startEditing}>
							Edit my details
						</button>
					</div>
				{:else}
					<!-- Edit form -->
					<form method="POST" action="?/update" use:enhance={handleEnhance} class="my-form">
						<input type="hidden" name="_csrf" value={csrfToken} />

						<div class="my-field">
							<label class="my-label" for="profile-email">Current email</label>
							<input
								type="email"
								id="profile-email"
								value={data.contact.email}
								disabled
								class="my-input my-input-disabled"
								aria-describedby="email-help"
							/>
						</div>
						<div class="my-field">
							<label class="my-label" for="profile-newEmail">New email address <span class="my-optional">(optional)</span></label>
							<input
								type="email"
								id="profile-newEmail"
								name="newEmail"
								bind:value={form.newEmail}
								autocomplete="email"
								class="my-input"
								placeholder="Enter new email to change it"
								aria-describedby="new-email-help"
							/>
							<p id="new-email-help" class="my-help">To change your email, enter the new address here and save. We'll send a verification link to that address; the change will apply once you click it. The new address must not already be in use.</p>
						</div>

						<div class="my-field-row">
							<div class="my-field">
								<label class="my-label" for="profile-firstName">First name</label>
								<input
									type="text"
									id="profile-firstName"
									name="firstName"
									bind:value={form.firstName}
									required
									autocomplete="given-name"
									class="my-input"
									placeholder="e.g. John"
								/>
							</div>
							<div class="my-field">
								<label class="my-label" for="profile-lastName">Last name</label>
								<input
									type="text"
									id="profile-lastName"
									name="lastName"
									bind:value={form.lastName}
									autocomplete="family-name"
									class="my-input"
									placeholder="e.g. Smith"
								/>
							</div>
						</div>

						<div class="my-field">
							<label class="my-label" for="profile-phone">Phone number</label>
							<input
								type="tel"
								id="profile-phone"
								name="phone"
								bind:value={form.phone}
								autocomplete="tel"
								class="my-input"
								placeholder="e.g. 07700 900123"
							/>
						</div>

						<div class="my-field-divider">
							<h2 class="my-heading-2">Address</h2>
						</div>

						<div class="my-field">
							<label class="my-label" for="profile-addressLine1">Address line 1</label>
							<input
								type="text"
								id="profile-addressLine1"
								name="addressLine1"
								bind:value={form.addressLine1}
								autocomplete="address-line1"
								class="my-input"
								placeholder="e.g. 10 High Street"
							/>
						</div>

						<div class="my-field">
							<label class="my-label" for="profile-addressLine2">Address line 2</label>
							<input
								type="text"
								id="profile-addressLine2"
								name="addressLine2"
								bind:value={form.addressLine2}
								autocomplete="address-line2"
								class="my-input"
							/>
						</div>

						<div class="my-field-row">
							<div class="my-field">
								<label class="my-label" for="profile-city">City / town</label>
								<input
									type="text"
									id="profile-city"
									name="city"
									bind:value={form.city}
									autocomplete="address-level2"
									class="my-input"
								/>
							</div>
							<div class="my-field">
								<label class="my-label" for="profile-county">County</label>
								<input
									type="text"
									id="profile-county"
									name="county"
									bind:value={form.county}
									class="my-input"
								/>
							</div>
						</div>

						<div class="my-field-row">
							<div class="my-field">
								<label class="my-label" for="profile-postcode">Postcode</label>
								<input
									type="text"
									id="profile-postcode"
									name="postcode"
									bind:value={form.postcode}
									autocomplete="postal-code"
									class="my-input"
									placeholder="e.g. AB1 2CD"
								/>
							</div>
							<div class="my-field">
								<label class="my-label" for="profile-country">Country</label>
								<input
									type="text"
									id="profile-country"
									name="country"
									bind:value={form.country}
									autocomplete="country-name"
									class="my-input"
								/>
							</div>
						</div>

						<div class="my-form-actions">
							<button
								type="button"
								class="my-btn my-btn-secondary"
								on:click={cancelEditing}
								disabled={isSubmitting}
							>
								Cancel
							</button>
							<button
								type="submit"
								class="my-btn my-btn-primary"
								disabled={isSubmitting || !form.firstName?.trim()}
							>
								{#if isSubmitting}
									<svg class="my-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Saving...
								{:else}
									Save changes
								{/if}
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{/if}
</div>

<NotificationPopup />

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.my-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
	}
	@media (min-width: 640px) {
		.my-heading {
			font-size: 1.75rem;
		}
	}
	.my-heading-2 {
		font-size: 1.125rem;
		font-weight: 700;
		color: #374151;
	}
	.my-lead {
		font-size: 1.0625rem;
		color: #4b5563;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
	.my-card {
		background: #fff;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}
	.my-card-body {
		padding: 1.5rem;
	}
	@media (min-width: 640px) {
		.my-card-body {
			padding: 2rem;
		}
	}
	.my-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.my-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.my-field-row {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	@media (min-width: 640px) {
		.my-field-row {
			flex-direction: row;
			gap: 1rem;
		}
		.my-field-row > .my-field {
			flex: 1;
		}
	}
	.my-field-divider {
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
	}
	.my-label {
		font-size: 1.0625rem;
		font-weight: 600;
		color: #374151;
	}
	.my-input {
		width: 100%;
		min-height: 3.25rem;
		padding: 0.75rem 1rem;
		font-size: 1.125rem;
		border: 2px solid #d1d5db;
		border-radius: 0.75rem;
		color: #111827;
		background: #fff;
	}
	.my-input::placeholder {
		color: #9ca3af;
	}
	.my-input:focus {
		outline: none;
		border-color: #4A97D2;
		box-shadow: 0 0 0 4px rgba(74, 151, 210, 0.2);
	}
	.my-input-disabled {
		background: #f3f4f6;
		color: #6b7280;
		cursor: not-allowed;
		border-color: #e5e7eb;
	}
	.my-help {
		font-size: 0.9375rem;
		color: #6b7280;
		line-height: 1.4;
	}
	.my-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3.5rem;
		padding: 0.875rem 1.5rem;
		font-size: 1.125rem;
		font-weight: 700;
		border-radius: 0.75rem;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s, background 0.2s;
	}
	.my-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.my-btn-primary {
		background: #2563eb;
		color: #fff;
	}
	.my-btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}
	.my-btn-secondary {
		background: #fff;
		color: #374151;
		border: 2px solid #d1d5db;
	}
	.my-btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
		border-color: #9ca3af;
	}
	.my-form-actions {
		display: flex;
		flex-direction: column-reverse;
		gap: 0.75rem;
		padding-top: 0.5rem;
	}
	@media (min-width: 640px) {
		.my-form-actions {
			flex-direction: row;
			justify-content: flex-end;
		}
	}
	.my-actions {
		padding-top: 1.5rem;
	}
	/* Read-only detail view */
	.my-details-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}
	@media (min-width: 640px) {
		.my-details-grid {
			grid-template-columns: 1fr 1fr;
		}
	}
	.my-detail {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.my-detail-label {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.my-detail-value {
		font-size: 1.125rem;
		color: #111827;
		word-break: break-word;
	}
	.my-address-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid #f3f4f6;
	}
	.my-address-block {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.my-alert {
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		border: 2px solid;
		font-size: 1.0625rem;
		line-height: 1.5;
	}
	.my-alert-info {
		background: #fffbeb;
		border-color: #fde68a;
		color: #92400e;
	}
	.my-alert-success {
		background: #f0fdf4;
		border-color: #bbf7d0;
		color: #166534;
	}
	.my-alert-error {
		background: #fef2f2;
		border-color: #fecaca;
		color: #991b1b;
	}
	.my-optional {
		font-weight: normal;
		color: #6b7280;
	}
	.my-spinner {
		width: 1.5rem;
		height: 1.5rem;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
