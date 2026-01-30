<script>
	import { dialog } from '$lib/crm/stores/notifications.js';
	
	$: dialogData = $dialog;
	
	async function handleConfirm() {
		if (dialogData?.resolve) {
			dialogData.resolve(true);
		}
		dialog.close();
	}
	
	async function handleCancel() {
		if (dialogData?.resolve) {
			dialogData.resolve(false);
		}
		dialog.close();
	}
	
	async function handleClose() {
		if (dialogData?.resolve) {
			if (dialogData.type === 'alert') {
				dialogData.resolve(true);
			} else {
				dialogData.resolve(false);
			}
		}
		dialog.close();
	}
</script>

{#if dialogData}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
		on:click={handleClose}
		on:keydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
	>
		<!-- Dialog Box -->
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in"
			on:click|stopPropagation
		>
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0">
					{#if dialogData.type === 'confirm'}
						<div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
							<svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
						</div>
					{:else}
						<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					<h3 id="dialog-title" class="text-lg font-semibold text-gray-900 mb-2">
						{dialogData.title}
					</h3>
					<p class="text-sm text-gray-600 mb-4 whitespace-pre-line">
						{dialogData.message}
					</p>
					<div class="flex gap-2 justify-end">
						{#if dialogData.type === 'confirm'}
							<button
								on:click={handleCancel}
								class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium"
							>
								{dialogData.cancelText}
							</button>
							<button
								on:click={handleConfirm}
								class="px-4 py-2 bg-brand-green text-white rounded-md hover:bg-primary-dark transition-colors font-medium"
							>
								{dialogData.confirmText}
							</button>
						{:else}
							<button
								on:click={handleClose}
								class="px-4 py-2 bg-brand-green text-white rounded-md hover:bg-primary-dark transition-colors font-medium"
							>
								{dialogData.buttonText}
							</button>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes scale-in {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	
	.animate-scale-in {
		animation: scale-in 0.2s ease-out;
	}
</style>


