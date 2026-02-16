<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: csrfToken = data?.csrfToken || '';
	$: preferences = data?.preferences ?? null;
	$: formResult = $page.form;

	let subscribed = true;
	let isSubmitting = false;
	let initializedEmail = null;

	// Initialize from server data
	$: if (preferences && preferences.email !== initializedEmail) {
		subscribed = preferences.subscribed !== false;
		initializedEmail = preferences.email;
	}

	// Handle form results
	let lastProcessed = null;
	$: if (formResult && formResult !== lastProcessed) {
		lastProcessed = formResult;
		if (formResult?.success) {
			notifications.success(formResult.message || 'Preferences updated.');
			if (formResult.preferences) {
				subscribed = formResult.preferences.subscribed !== false;
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
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
	<title>Preferences – MyHUB</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-heading">Communication preferences</h1>
	<p class="my-lead">
		Choose how you'd like to hear from us. You can change these at any time.
	</p>

	{#if !preferences}
		<div class="my-alert my-alert-info">
			<p>Sign in to manage your communication preferences.</p>
		</div>
	{:else}
		<form method="POST" action="?/update" use:enhance={handleEnhance}>
			<input type="hidden" name="_csrf" value={csrfToken} />

			<!-- Newsletter subscription -->
			<div class="my-card">
				<div class="my-card-body">
					<div class="my-pref-section">
						<div class="my-pref-header">
							<div class="my-pref-icon-wrap">
								<svg class="my-pref-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
								</svg>
							</div>
							<div class="my-pref-info">
								<h2 class="my-pref-title">Newsletters &amp; updates</h2>
								<p class="my-pref-desc">
									Receive newsletters, event updates, and general communications by email to <strong>{preferences.email}</strong>.
								</p>
							</div>
						</div>
						<label class="my-toggle-wrap">
							<input
								type="checkbox"
								name="subscribed"
								bind:checked={subscribed}
								class="my-toggle-input"
							/>
							<span class="my-toggle" class:active={subscribed}></span>
							<span class="my-toggle-label">{subscribed ? 'Subscribed' : 'Unsubscribed'}</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Rota reminders (informational, managed by admin) -->
			<div class="my-card">
				<div class="my-card-body">
					<div class="my-pref-section">
						<div class="my-pref-header">
							<div class="my-pref-icon-wrap">
								<svg class="my-pref-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
								</svg>
							</div>
							<div class="my-pref-info">
								<h2 class="my-pref-title">Rota reminders</h2>
								<p class="my-pref-desc">
									Automatic email reminders when you're scheduled for an upcoming rota. These are managed by your administrator and help ensure you don't miss your turn.
								</p>
							</div>
						</div>
						<span class="my-pref-badge">Automatic</span>
					</div>
				</div>
			</div>

			<!-- Info box -->
			<div class="my-info-box">
				<svg class="my-info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<p>
					If you unsubscribe from newsletters, you'll still receive essential rota reminders so you know when you're scheduled. To change your email address, visit <a href="/myhub/profile" class="my-link">My details</a>; we'll send a link to your new address to confirm it's yours.
				</p>
			</div>

			<!-- Submit -->
			<div class="my-submit-wrap">
				<button type="submit" class="my-btn my-btn-primary" disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="my-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Saving...
					{:else}
						Save preferences
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>

<NotificationPopup />

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}
	.my-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: -0.5rem;
	}
	@media (min-width: 640px) {
		.my-heading {
			font-size: 1.75rem;
		}
	}
	.my-lead {
		font-size: 1.0625rem;
		color: #4b5563;
		line-height: 1.5;
		margin-bottom: -0.25rem;
	}
	.my-card {
		background: #fff;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		border: 1px solid #e5e7eb;
		overflow: hidden;
		margin-bottom: 20px;
	}
	.my-card-body {
		padding: 1.5rem;
	}
	@media (min-width: 640px) {
		.my-card-body {
			padding: 1.5rem 2rem;
		}
	}
	.my-pref-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	@media (min-width: 640px) {
		.my-pref-section {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
			gap: 1.5rem;
		}
	}
	.my-pref-header {
		display: flex;
		gap: 1rem;
		flex: 1;
	}
	.my-pref-icon-wrap {
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #eff6ff;
		border-radius: 0.75rem;
	}
	.my-pref-icon {
		width: 1.5rem;
		height: 1.5rem;
		color: #2563eb;
	}
	.my-pref-info {
		flex: 1;
	}
	.my-pref-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.375rem;
	}
	.my-pref-desc {
		font-size: 1rem;
		color: #6b7280;
		line-height: 1.5;
	}
	.my-pref-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.375rem 0.875rem;
		min-height: 2.25rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #059669;
		background: #ecfdf5;
		border: 1px solid #a7f3d0;
		border-radius: 2rem;
		flex-shrink: 0;
	}
	/* Toggle switch */
	.my-toggle-wrap {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		flex-shrink: 0;
		min-height: 2.75rem;
	}
	.my-toggle-input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.my-toggle {
		position: relative;
		width: 3.25rem;
		height: 2rem;
		background: #d1d5db;
		border-radius: 2rem;
		transition: background 0.2s;
		flex-shrink: 0;
	}
	.my-toggle::after {
		content: '';
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 1.625rem;
		height: 1.625rem;
		background: #fff;
		border-radius: 50%;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}
	.my-toggle.active {
		background: #2563eb;
	}
	.my-toggle.active::after {
		transform: translateX(1.25rem);
	}
	.my-toggle-input:focus-visible + .my-toggle {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
	}
	.my-toggle-label {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		min-width: 7rem;
	}
	/* Info box */
	.my-info-box {
		display: flex;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.75rem;
		font-size: 0.9375rem;
		color: #0c4a6e;
		line-height: 1.5;
		margin-bottom: 20px;
	}
	.my-info-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		margin-top: 0.125rem;
		color: #0284c7;
	}
	.my-link {
		font-weight: 600;
		color: #2563eb;
		text-decoration: underline;
	}
	.my-link:hover {
		color: #1d4ed8;
	}
	/* Submit */
	.my-submit-wrap {
		display: flex;
		justify-content: flex-start;
		margin-top: 1.5rem;
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
	.my-spinner {
		width: 1.5rem;
		height: 1.5rem;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
