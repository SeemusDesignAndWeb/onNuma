<script>
	export let data = {};
	$: member = data?.member ?? null;
	$: memberName = member
		? [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email
		: '';
</script>

<svelte:head>
	<title>My volunteering – Overview</title>
</svelte:head>

<div class="my-page-content">
	{#if !member}
		<div class="my-alert my-alert-info">
			<p>
				<strong>Sign in to see your volunteering.</strong> Use the link you received by email, or ask your organiser for access.
			</p>
		</div>
	{:else}
		<!-- Welcome -->
		<section class="my-welcome">
			<h1 class="my-welcome-heading">Hello, {member.firstName || memberName}</h1>
			<p class="my-welcome-sub">Welcome to your volunteering portal. Here you can manage your rotas, update your details, and let us know when you're available.</p>
		</section>

		<!-- Quick links -->
		<section class="my-quicklinks">
			<a href="/my/rotas" class="my-quicklink">
				<div class="my-ql-icon my-ql-icon-blue">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
				</div>
				<div class="my-ql-text">
					<span class="my-ql-title">My rotas</span>
					<span class="my-ql-desc">See what you're signed up for</span>
				</div>
				<svg class="my-ql-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>

			<a href="/my/opportunities" class="my-quicklink">
				<div class="my-ql-icon my-ql-icon-green">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
				</div>
				<div class="my-ql-text">
					<span class="my-ql-title">Sign up</span>
					<span class="my-ql-desc">Volunteer for upcoming rotas</span>
				</div>
				<svg class="my-ql-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>

			<a href="/my/profile" class="my-quicklink">
				<div class="my-ql-icon my-ql-icon-purple">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
				</div>
				<div class="my-ql-text">
					<span class="my-ql-title">My details</span>
					<span class="my-ql-desc">Update your name, phone, and address</span>
				</div>
				<svg class="my-ql-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>

			<a href="/my/availability" class="my-quicklink">
				<div class="my-ql-icon my-ql-icon-amber">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				</div>
				<div class="my-ql-text">
					<span class="my-ql-title">Availability</span>
					<span class="my-ql-desc">Set when you're away or unavailable</span>
				</div>
				<svg class="my-ql-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>

			<a href="/my/preferences" class="my-quicklink">
				<div class="my-ql-icon my-ql-icon-slate">
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</div>
				<div class="my-ql-text">
					<span class="my-ql-title">Preferences</span>
					<span class="my-ql-desc">Newsletter and communication settings</span>
				</div>
				<svg class="my-ql-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
		</section>
	{/if}
</div>

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	/* Welcome */
	.my-welcome {
		margin-bottom: 0.25rem;
	}
	.my-welcome-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
	}
	@media (min-width: 640px) {
		.my-welcome-heading {
			font-size: 1.75rem;
		}
	}
	.my-welcome-sub {
		font-size: 1.0625rem;
		color: #4b5563;
		line-height: 1.5;
	}
	/* Quick links */
	.my-quicklinks {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.my-quicklink {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.06);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.15s, box-shadow 0.15s;
		min-height: 4rem;
	}
	.my-quicklink:hover {
		border-color: #93c5fd;
		box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
	}
	.my-quicklink:focus-visible {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
	}
	.my-ql-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.75rem;
		flex-shrink: 0;
	}
	.my-ql-icon-blue {
		background: #eff6ff;
		color: #2563eb;
	}
	.my-ql-icon-green {
		background: #ecfdf5;
		color: #059669;
	}
	.my-ql-icon-purple {
		background: #f5f3ff;
		color: #7c3aed;
	}
	.my-ql-icon-amber {
		background: #fffbeb;
		color: #d97706;
	}
	.my-ql-icon-slate {
		background: #f1f5f9;
		color: #475569;
	}
	.my-ql-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.my-ql-title {
		font-size: 1.0625rem;
		font-weight: 700;
		color: #111827;
	}
	.my-ql-desc {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-ql-arrow {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		color: #9ca3af;
	}
	/* Alert */
	.my-alert {
		padding: 1.25rem;
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
</style>
