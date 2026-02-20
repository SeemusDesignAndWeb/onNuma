<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { formatMyhubDate, formatMyhubTimeRange } from '$lib/crm/utils/dateFormat.js';

	export let data = {};
	$: member = data?.member ?? null;
	$: memberName = member
		? [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email
		: '';
	$: nextRota = data?.nextRota ?? null;
	$: pendingInvitations = data?.pendingInvitations ?? [];
	$: getInvolvedShifts = data?.getInvolvedShifts ?? [];
	$: pendingInterests = data?.pendingInterests ?? [];
	$: csrfToken = data?.csrfToken ?? '';
	$: formResult = $page.form;

	let confirmingCancel = false;
	let cancelNote = '';

	// Track which invitation the volunteer is responding to (for inline confirm)
	let confirmingDeclineId = null;

	// E3 — full-screen confirmation overlay
	let showConfirmOverlay = false;
	let overlayDismissed = false;

	$: if (browser && formResult?.success && formResult?.type === 'acceptInvitation' && !overlayDismissed) {
		showConfirmOverlay = true;
		overlayDismissed = true;
		setTimeout(async () => {
			showConfirmOverlay = false;
			await invalidateAll();
		}, 2500);
	}

	// Reset overlay flag when form result clears (new navigation)
	$: if (!formResult) overlayDismissed = false;
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
		</section>

		<!-- Next Up -->
		<section class="my-next-up" aria-label="Your next shift">
			{#if formResult?.success && formResult?.type === 'cannotVolunteer'}
				<div class="my-cancel-success" role="status">
					<svg class="my-cancel-success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					<p>{formResult.message}</p>
				</div>
			{:else if nextRota}
				<div class="my-next-card">
					<p class="my-next-label">Coming up next</p>
					<p class="my-next-title">{nextRota.eventTitle}</p>
					{#if nextRota.role}
						<p class="my-next-role">{nextRota.role}</p>
					{/if}
					<p class="my-next-date">{formatMyhubDate(nextRota.date)}</p>
					{#if nextRota.startTime}
						<p class="my-next-time">{formatMyhubTimeRange(nextRota.startTime, nextRota.endTime)}</p>
					{/if}
				{#if nextRota.location}
					<p class="my-next-location">
						<svg class="my-next-location-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						<a
							href="https://maps.google.com/?q={encodeURIComponent(nextRota.location)}"
							target="_blank"
							rel="noopener noreferrer"
							class="my-location-link"
						>{nextRota.location}<span class="sr-only"> (open in maps)</span></a>
					</p>
				{/if}

				{#if nextRota.shiftmates?.length > 0}
					<p class="my-next-shiftmates">
						<svg class="my-next-shiftmates-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Also on shift: {nextRota.shiftmates.join(', ')}
					</p>
				{/if}

				{#if formResult?.error}
						<p class="my-cancel-error" role="alert">{formResult.error}</p>
					{/if}

				{#if confirmingCancel}
					<div class="my-cancel-confirm">
						<p class="my-cancel-heading">No problem at all</p>
						<p class="my-cancel-confirm-text">
							Would you like to add a note for {nextRota.coordinatorFirstName || 'your organiser'}? (completely optional)
						</p>
						<form method="POST" action="?/cannotVolunteer">
							<input type="hidden" name="_csrf" value={csrfToken} />
							<input type="hidden" name="rotaId" value={nextRota.rotaId} />
							<input type="hidden" name="occurrenceId" value={nextRota.occurrenceId ?? ''} />
							<textarea
								name="note"
								bind:value={cancelNote}
								placeholder="e.g. I have a prior commitment"
								rows="3"
								class="my-cancel-note"
							></textarea>
							<div class="my-cancel-confirm-btns">
								<button type="submit" class="my-cancel-send-btn">
									Send note and cancel
								</button>
								<button type="submit" class="my-cancel-back-btn my-cancel-quiet-btn" on:click={() => (cancelNote = '')}>
									Just cancel, no message
								</button>
							</div>
						</form>
						<button type="button" class="my-cancel-undo-link" on:click={() => (confirmingCancel = false)}>
							↩ Actually, I can make it
						</button>
					</div>
				{:else}
					<button
						type="button"
						class="my-cant-make-btn"
						on:click={() => { confirmingCancel = true; cancelNote = ''; }}
					>
						I can't make this one
					</button>
				{/if}
				</div>
			{:else}
				<div class="my-next-empty">
					<p>Nothing coming up yet — we'll let you know when you're needed!</p>
				</div>
			{/if}
		</section>

		<!-- Section 2: Shifts Waiting for Your Reply -->
		{#if pendingInvitations.length > 0 || (formResult?.success && (formResult?.type === 'acceptInvitation' || formResult?.type === 'declineInvitation'))}
			<section aria-label="Shifts waiting for your reply">
				<h2 class="my-section-heading">We'd love your help</h2>

				{#if formResult?.success && (formResult?.type === 'acceptInvitation' || formResult?.type === 'declineInvitation')}
					<div class="my-invite-response-success" role="status">
						<svg class="my-cancel-success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<p>{formResult.message}</p>
					</div>
				{/if}

				{#if pendingInvitations.length > 0}
					<div class="my-invite-list">
						{#each pendingInvitations as inv (inv.id)}
							<div class="my-invite-card">
								<div class="my-invite-info">
									<p class="my-invite-title">{inv.eventTitle}</p>
									{#if inv.role}
										<p class="my-invite-role">{inv.role}</p>
									{/if}
									{#if inv.date}
										<p class="my-invite-date">{formatMyhubDate(inv.date)}</p>
										{#if inv.startTime}
											<p class="my-invite-time">{formatMyhubTimeRange(inv.startTime, inv.endTime)}</p>
										{/if}
									{:else}
										<p class="my-invite-date">Date to be confirmed</p>
									{/if}
								</div>

								{#if confirmingDeclineId === inv.id}
									<form method="POST" action="?/declineInvitation" class="my-invite-decline-confirm">
										<input type="hidden" name="_csrf" value={csrfToken} />
										<input type="hidden" name="invitationId" value={inv.id} />
										<p class="my-cancel-confirm-text">We'll let the organiser know. Are you sure?</p>
										<div class="my-cancel-confirm-btns">
											<button type="button" class="my-cancel-back-btn" on:click={() => (confirmingDeclineId = null)}>
												Go back
											</button>
											<button type="submit" class="my-cancel-send-btn">
												Yes, let them know
											</button>
										</div>
									</form>
								{:else}
									<div class="my-invite-actions">
										<form method="POST" action="?/acceptInvitation">
											<input type="hidden" name="_csrf" value={csrfToken} />
											<input type="hidden" name="invitationId" value={inv.id} />
											<button type="submit" class="my-invite-yes-btn">
												Yes, I'll be there
											</button>
										</form>
										<button
											type="button"
											class="my-invite-no-btn"
											on:click={() => (confirmingDeclineId = inv.id)}
										>
											I can't make this one
										</button>
									</div>
								{/if}

								{#if formResult?.error && (formResult?.type === 'acceptInvitation' || formResult?.type === 'declineInvitation')}
									<p class="my-cancel-error" role="alert">{formResult.error}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Section 3: Get Involved -->
		{#if getInvolvedShifts.length > 0}
			<section aria-label="Get involved">
				<h2 class="my-section-heading">Get involved</h2>
				<div class="my-involve-list">
					{#each getInvolvedShifts as shift}
						<div class="my-involve-card">
							<div class="my-involve-info">
								<p class="my-involve-title">{shift.eventTitle}</p>
								{#if shift.role}
									<p class="my-involve-role">{shift.role}</p>
								{/if}
								<p class="my-involve-date">{formatMyhubDate(shift.date)}</p>
								{#if shift.startTime}
									<p class="my-involve-time">{formatMyhubTimeRange(shift.startTime, shift.endTime)}</p>
								{/if}
							</div>
							<a href="/myhub/opportunities" class="my-involve-btn">
								Put my hand up for this
							</a>
						</div>
					{/each}
				</div>
				<p class="my-involve-more">
					<a href="/myhub/opportunities" class="my-footer-link">See all available rotas</a>
				</p>
			</section>
		{/if}

		<!-- Section 4: Expressions of Interest awaiting coordinator review -->
		{#if pendingInterests.length > 0}
			<section class="my-pending-section" aria-label="Your expressions of interest">
				<h2 class="my-section-heading">
					<svg class="w-5 h-5 inline-block mr-1 align-text-bottom" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					Awaiting confirmation
				</h2>
				<p class="my-pending-lead">You've expressed interest in the following — a coordinator will be in touch to confirm your place.</p>
				<div class="my-pending-list">
					{#each pendingInterests as interest}
						<div class="my-pending-card">
							<ul class="my-pending-slots">
								{#each interest.rotaSlots as slot}
									<li>
										<span class="my-pending-role">{slot.rotaRole}</span>
										<span class="my-pending-event"> · {slot.eventTitle}</span>
										{#if slot.occurrenceDate}
											<span class="my-pending-date"> · {formatMyhubDate(slot.occurrenceDate)}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Footer links — small and unobtrusive per spec -->
		<nav class="my-footer-links" aria-label="More options">
			<a href="/myhub/history" class="my-footer-link">View all my past shifts</a>
			<span class="my-footer-sep" aria-hidden="true">·</span>
			<a href="/myhub/preferences" class="my-footer-link">Update my preferences</a>
		</nav>
	{/if}
</div>

<!-- E3: Full-screen confirmation overlay (accept invitation) -->
{#if showConfirmOverlay && member}
	<div class="my-confirm-overlay" role="status" aria-live="assertive">
		<div class="my-confirm-overlay-inner">
			<svg class="my-confirm-check" viewBox="0 0 64 64" fill="none" aria-hidden="true">
				<circle cx="32" cy="32" r="30" stroke="currentColor" stroke-width="3" opacity="0.3"/>
				<path d="M18 33l10 10 18-18" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>
			<p class="my-confirm-heading">You're all set, {member.firstName || memberName}!</p>
			{#if formResult?.dateDisplay}
				<p class="my-confirm-sub">
					See you on {formResult.dateDisplay}{formResult?.timeDisplay ? ' at ' + formResult.timeDisplay : ''}.
					We'll send you a reminder closer to the day.
				</p>
			{:else}
				<p class="my-confirm-sub">We'll send you a reminder closer to the day.</p>
			{/if}
		</div>
	</div>
{/if}

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
		color: var(--myhub-primary);
		margin-bottom: 0.5rem;
	}
	@media (min-width: 640px) {
		.my-welcome-heading {
			font-size: 1.75rem;
		}
	}
	/* ---- Section 2: Shifts Waiting for Your Reply ---- */
	.my-invite-list {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.my-invite-card {
		background: #fff;
		border: 2px solid #fde68a;
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.my-invite-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.my-invite-title {
		font-size: 1.0625rem;
		font-weight: 700;
		color: #111827;
	}
	.my-invite-role {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-invite-date {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		margin-top: 0.25rem;
	}
	.my-invite-time {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-invite-actions {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
	@media (min-width: 480px) {
		.my-invite-actions {
			flex-direction: row;
		}
	}
	.my-invite-yes-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.875rem 1.25rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		border: none;
		background: #16a34a;
		color: #fff;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
		width: 100%;
	}
	.my-invite-yes-btn:hover {
		background: #15803d;
	}
	.my-invite-no-btn {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.875rem 1.25rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		border: 2px solid #e5e7eb;
		background: #f9fafb;
		color: #374151;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
		width: 100%;
	}
	.my-invite-no-btn:hover {
		background: #fef2f2;
		border-color: #fca5a5;
		color: #991b1b;
	}
	.my-invite-decline-confirm {
		padding: 1rem;
		background: #fef9eb;
		border: 1px solid #f5e6b8;
		border-radius: 0.75rem;
	}
	.my-invite-response-success {
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
		background: #f0fdf4;
		border: 2px solid #bbf7d0;
		border-radius: 1rem;
		padding: 1.25rem 1.5rem;
		color: #166534;
		font-size: 1.0625rem;
		font-weight: 500;
		line-height: 1.5;
		margin-bottom: 0.875rem;
	}
	/* ---- Section 3: Get Involved ---- */
	.my-section-heading {
		font-size: 1.125rem;
		font-weight: 700;
		color: #374151;
		margin-bottom: 0.875rem;
	}
	.my-involve-list {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.my-involve-card {
		background: #fff;
		border: 1px solid var(--myhub-card-border, #e2e8f0);
		border-radius: 1rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	@media (min-width: 480px) {
		.my-involve-card {
			flex-direction: row;
			align-items: center;
		}
	}
	.my-involve-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.my-involve-title {
		font-size: 1.0625rem;
		font-weight: 700;
		color: #111827;
	}
	.my-involve-role {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-involve-date {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		margin-top: 0.25rem;
	}
	.my-involve-time {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-involve-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1.25rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		background: var(--myhub-accent, #4A97D2);
		color: #fff;
		font-size: 1rem;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.my-involve-btn:hover {
		background: var(--myhub-accent-hover, #3d82b8);
		color: #fff;
	}
	.my-involve-more {
		margin-top: 0.875rem;
		text-align: center;
	}
	/* ---- Next Up section ---- */
	.my-next-up {
		display: flex;
		flex-direction: column;
	}
	/* Card for the next shift */
	.my-next-card {
		background: #fff;
		border: 2px solid var(--myhub-primary, #2563a8);
		border-radius: 1rem;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.my-next-label {
		font-size: 0.875rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--myhub-primary, #2563a8);
		margin-bottom: 0.25rem;
	}
	.my-next-title {
		font-size: 1.375rem;
		font-weight: 700;
		color: #111827;
		line-height: 1.3;
	}
	.my-next-role {
		font-size: 1rem;
		color: #6b7280;
	}
	.my-next-date {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1e293b;
		margin-top: 0.5rem;
	}
	.my-next-time {
		font-size: 1.0625rem;
		color: #374151;
	}
	.my-next-location {
		display: flex;
		align-items: flex-start;
		gap: 0.375rem;
		font-size: 1rem;
		color: #6b7280;
		margin-top: 0.125rem;
	}
	.my-location-link {
		color: var(--myhub-primary, #2563a8);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.my-location-link:hover {
		color: var(--myhub-primary-hover, #1d4d82);
	}
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.my-next-shiftmates {
		display: flex;
		align-items: flex-start;
		gap: 0.375rem;
		font-size: 1rem;
		color: #6b7280;
		margin-top: 0.125rem;
	}
	.my-next-shiftmates-icon {
		width: 1.125rem;
		height: 1.125rem;
		flex-shrink: 0;
		margin-top: 0.1rem;
	}
	.my-next-location-icon {
		width: 1.125rem;
		height: 1.125rem;
		flex-shrink: 0;
		margin-top: 0.1875rem;
	}
	/* "I can't make this one" button */
	.my-cant-make-btn {
		margin-top: 1rem;
		padding: 0.875rem 1.25rem;
		min-height: 3rem;
		width: 100%;
		border-radius: 0.75rem;
		border: 2px solid #e5e7eb;
		background: #f9fafb;
		color: #374151;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
		transition: background 0.15s, border-color 0.15s;
	}
	.my-cant-make-btn:hover {
		background: #fef2f2;
		border-color: #fca5a5;
		color: #991b1b;
	}
	/* Confirm cancel panel */
	.my-cancel-confirm {
		margin-top: 1rem;
		padding: 1.25rem;
		background: #fef9eb;
		border: 1px solid #f5e6b8;
		border-radius: 0.75rem;
	}
	.my-cancel-heading {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.375rem;
	}
	.my-cancel-confirm-text {
		font-size: 1rem;
		color: #374151;
		margin-bottom: 0.875rem;
		line-height: 1.5;
	}
	.my-cancel-note {
		width: 100%;
		min-height: 5rem;
		border-radius: 0.625rem;
		border: 1px solid #d1d5db;
		padding: 0.75rem;
		font-size: 1rem;
		font-family: inherit;
		color: #374151;
		resize: vertical;
		margin-bottom: 0.875rem;
		box-sizing: border-box;
	}
	.my-cancel-note:focus {
		outline: 2px solid var(--myhub-primary, #2563a8);
		outline-offset: 1px;
		border-color: transparent;
	}
	.my-cancel-confirm-btns {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-bottom: 0.75rem;
	}
	.my-cancel-back-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		border: 2px solid #d1d5db;
		background: #fff;
		color: #374151;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s;
	}
	.my-cancel-back-btn:hover {
		background: #f3f4f6;
	}
	.my-cancel-quiet-btn {
		background: transparent;
		border-color: #e5e7eb;
		color: #6b7280;
		font-weight: 500;
	}
	.my-cancel-quiet-btn:hover {
		background: #f9fafb;
		color: #374151;
	}
	.my-cancel-send-btn {
		flex: 1;
		padding: 0.75rem 1rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		border: none;
		background: var(--myhub-primary, #2563a8);
		color: #fff;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.my-cancel-send-btn:hover {
		background: var(--myhub-primary-hover, #1d4d82);
	}
	.my-cancel-undo-link {
		display: block;
		background: none;
		border: none;
		padding: 0;
		font-size: 0.9375rem;
		color: #6b7280;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.my-cancel-undo-link:hover {
		color: #374151;
	}
	/* E3: Full-screen confirmation overlay */
	.my-confirm-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: var(--myhub-primary, #2563a8);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		animation: my-overlay-in 0.25s ease-out;
	}
	@keyframes my-overlay-in {
		from { opacity: 0; transform: scale(0.97); }
		to   { opacity: 1; transform: scale(1); }
	}
	.my-confirm-overlay-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.25rem;
		max-width: 28rem;
	}
	.my-confirm-check {
		width: 5rem;
		height: 5rem;
		color: #ffffff;
		flex-shrink: 0;
	}
	.my-confirm-heading {
		font-size: 2rem;
		font-weight: 800;
		color: #ffffff;
		line-height: 1.2;
		margin: 0;
	}
	@media (min-width: 480px) {
		.my-confirm-heading { font-size: 2.25rem; }
	}
	.my-confirm-sub {
		font-size: 1.125rem;
		color: rgba(255, 255, 255, 0.88);
		line-height: 1.6;
		margin: 0;
	}
	/* Error message inside the card */
	.my-cancel-error {
		font-size: 0.9375rem;
		color: #991b1b;
		margin-top: 0.5rem;
	}
	/* Success state replaces the card */
	.my-cancel-success {
		display: flex;
		align-items: flex-start;
		gap: 0.875rem;
		background: #f0fdf4;
		border: 2px solid #bbf7d0;
		border-radius: 1rem;
		padding: 1.25rem 1.5rem;
		color: #166534;
		font-size: 1.0625rem;
		font-weight: 500;
		line-height: 1.5;
	}
	.my-cancel-success-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		color: #16a34a;
		margin-top: 0.125rem;
	}
	/* Empty state */
	.my-next-empty {
		background: #f8fafc;
		border: 1px dashed #cbd5e1;
		border-radius: 1rem;
		padding: 1.5rem;
		color: #64748b;
		font-size: 1.0625rem;
		text-align: center;
		line-height: 1.5;
	}
	/* Footer links */
	.my-footer-links {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 0.5rem 0.75rem;
		padding: 0.5rem 0 0.25rem;
	}
	.my-footer-link {
		font-size: 0.9375rem;
		color: #6b7280;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
	.my-footer-link:hover {
		color: var(--myhub-primary, #2563a8);
	}
	.my-footer-sep {
		color: #d1d5db;
		font-size: 0.9375rem;
	}
	/* ---- Section 4: Pending interests ---- */
	.my-pending-section { margin-bottom: 1.5rem; }
	.my-section-heading {
		font-size: 1.125rem;
		font-weight: 700;
		color: #92400e;
		margin: 0 0 0.375rem;
	}
	.my-pending-lead { font-size: 0.9375rem; color: #6b7280; margin: 0 0 1rem; line-height: 1.5; }
	.my-pending-list { display: flex; flex-direction: column; gap: 0.75rem; }
	.my-pending-card {
		background: #fffbeb;
		border: 2px solid #fde68a;
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
	}
	.my-pending-slots { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.375rem; }
	.my-pending-slots li { font-size: 1rem; line-height: 1.4; }
	.my-pending-role { font-weight: 700; color: #111827; }
	.my-pending-event { color: #374151; }
	.my-pending-date { color: #6b7280; }
	/* Alert */
	.my-alert {
		padding: 1.25rem;
		border-radius: 0.75rem;
		border: 2px solid;
		font-size: 1.0625rem;
		line-height: 1.5;
	}
	.my-alert-info {
		background: #fef9eb;
		border-color: #f5e6b8;
		color: #7c5a0a;
	}

	/* =====================
	   PRINT STYLESHEET
	   Show the Next Up card cleanly; hide interactive chrome.
	   ===================== */
	@media print {
		:global(.no-print) { display: none !important; }

		/* Hide all sections except Next Up */
		.my-welcome,
		.my-invite-list,
		.my-involve-list,
		.my-footer-links,
		.my-cant-make-btn,
		.my-cancel-confirm,
		.my-section-heading {
			display: none !important;
		}

		.my-next-card {
			border: 2pt solid #000;
			border-radius: 8pt;
			padding: 16pt 14pt;
			background: #fff !important;
			box-shadow: none !important;
		}
		.my-next-label {
			font-size: 11pt;
			color: #444 !important;
		}
		.my-next-title {
			font-size: 22pt;
			color: #000 !important;
		}
		.my-next-role {
			font-size: 13pt;
			color: #444 !important;
		}
		.my-next-date,
		.my-next-time {
			font-size: 14pt;
			color: #000 !important;
		}
		.my-next-location,
		.my-next-shiftmates {
			font-size: 12pt;
			color: #444 !important;
		}
		.my-location-link {
			color: #000 !important;
			text-decoration: none !important;
		}
	}
</style>
