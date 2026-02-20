<script>
	/** Number to display. Badge is hidden when count ≤ 0. */
	export let count = 0;
	/** Values above this are shown as "N+". */
	export let max = 99;

	$: visible = count > 0;
	$: label = count > max ? `${max}+` : String(count);
</script>

{#if visible}
	<span class="hub-notif-badge" aria-label="{count} notification{count === 1 ? '' : 's'}">{label}</span>
{/if}

<style>
	.hub-notif-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.3rem;
		border-radius: 9999px;
		background: #f59e0b;
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1;
		flex-shrink: 0;
		pointer-events: none;
	}
</style>
