<script>
	export let columns = [];
	export let rows = [];
	export let onRowClick = null;
	/** Optional message when there are no rows (e.g. "No contacts yet. Add your first contact above.") */
	export let emptyMessage = 'No results';
	/** Optional: (row, index) => string of extra class names for the row (e.g. highlight) */
	export let getRowClass = null;
</script>

<!-- Mobile Card View -->
<div class="block md:hidden space-y-3">
	{#each rows as row, i}
		<div 
			class="bg-white shadow rounded-lg p-4 border border-gray-200 {onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} {getRowClass ? getRowClass(row, i) : ''}"
			role={onRowClick ? 'button' : undefined}
			tabindex={onRowClick ? '0' : undefined}
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
			on:keydown={(e) => {
				if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
					e.preventDefault();
					onRowClick(row);
				}
			}}
		>
			{#each columns as col}
				{#if col.label !== ''}
					<div class="mb-3 last:mb-0">
						<div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
							{col.label}
						</div>
						<div class="text-sm text-gray-900">
							{@html col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
						</div>
					</div>
				{:else}
					<div class="mt-2 flex justify-end">
						<div class="text-sm text-gray-900">
							{@html col.render ? col.render(row[col.key], row) : (row[col.key] || '')}
						</div>
					</div>
				{/if}
			{/each}
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

