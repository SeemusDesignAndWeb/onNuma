<script>
	export let columns = [];
	/** Optional: use these columns only for mobile card view (e.g. fewer columns for compact display). If not set, mobile uses `columns`. */
	export let mobileColumns = null;
	/** When true, mobile card view shows only values (no column labels like "Subject", "Status"). */
	export let mobileHideLabels = false;
	export let rows = [];
	export let onRowClick = null;
	/** Optional message when there are no rows (e.g. "No contacts yet. Add your first contact above.") */
	export let emptyMessage = 'No results';
	/** Optional: (row, index) => string of extra class names for the row (e.g. highlight) */
	export let getRowClass = null;
	$: colsForMobile = mobileColumns != null ? mobileColumns : columns;
</script>

<!-- Mobile Card View: compact row layout (columns in a row) to use less vertical space -->
<div class="block md:hidden space-y-2">
	{#each rows as row, i}
		<div 
			class="table-mobile-card bg-white shadow rounded-lg px-3 py-2.5 border border-gray-200 {onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} {getRowClass ? getRowClass(row, i) : ''}"
			role={onRowClick ? 'button' : undefined}
			tabindex={onRowClick ? '0' : undefined}
			on:click={(e) => {
				if (e.target.tagName !== 'A' && 
				    e.target.tagName !== 'BUTTON' && 
				    !e.target.closest('button') && 
				    !e.target.closest('a') &&
				    onRowClick) {
					onRowClick(row);
				}
			}}
			on:keydown={(e) => {
				if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
					e.preventDefault();
					onRowClick(row);
				}
			}}
		>
			<div class="table-mobile-card-grid" style="grid-template-columns: {colsForMobile.length === 1 ? '1fr' : '1fr ' + Array(colsForMobile.length - 1).fill('auto').join(' ')};">
				{#each colsForMobile as col}
					{#if col.label !== ''}
						<div class="table-mobile-card-cell min-w-0">
							{#if !mobileHideLabels}
								<span class="table-mobile-card-label">{col.label}</span>
							{/if}
							<span class="table-mobile-card-value">{@html col.render ? col.render(row[col.key], row) : (row[col.key] || '—')}</span>
						</div>
					{:else}
						<div class="table-mobile-card-cell table-mobile-card-cell--action min-w-0">
							<span class="table-mobile-card-value">{@html col.render ? col.render(row[col.key], row) : (row[col.key] || '')}</span>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/each}
	{#if rows.length === 0}
		<div class="text-center py-8 text-gray-500 bg-white shadow rounded-lg border border-gray-200">
			{emptyMessage}
		</div>
	{/if}
</div>

<!-- Desktop Table View -->
<div class="hidden md:block overflow-x-auto">
	<table class="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
		<thead class="bg-gray-50">
			<tr>
				{#each columns as col}
					<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider {col.label === '' ? 'w-20' : ''}">
						{col.label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody class="bg-white divide-y divide-gray-200">
		{#each rows as row, i}
			<tr 
				class="hover:bg-gray-50 {onRowClick ? 'cursor-pointer' : ''} {getRowClass ? getRowClass(row, i) : ''}"
					on:click={(e) => {
						// Don't trigger row click if clicking on a link or button
						if (e.target.tagName !== 'A' && 
						    e.target.tagName !== 'BUTTON' && 
						    !e.target.closest('button') && 
						    !e.target.closest('a') &&
						    onRowClick) {
							onRowClick(row);
						}
					}}
				>
					{#each columns as col}
						<td class="px-4 py-3 text-sm text-gray-900 {col.label === '' ? 'w-20' : ''}">
							{@html col.render ? col.render(row[col.key], row) : (row[col.key] || '')}
						</td>
					{/each}
				</tr>
			{/each}
			{#if rows.length === 0}
				<tr>
					<td colspan={columns.length} class="px-4 py-8 text-center text-gray-500 border-t border-gray-200">
						{emptyMessage}
					</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<style>
	.table-mobile-card-grid {
		display: grid;
		gap: 0.5rem 1rem;
		align-items: baseline;
	}
	.table-mobile-card-cell {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}
	.table-mobile-card-cell--action {
		align-items: flex-end;
	}
	.table-mobile-card-label {
		font-size: 0.65rem;
		font-weight: 500;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		line-height: 1.2;
	}
	.table-mobile-card-value {
		font-size: 0.8125rem;
		color: #111827;
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.table-mobile-card-value :global(span) {
		white-space: nowrap;
	}
</style>

