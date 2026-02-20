<script>
	import { notifications } from '$lib/crm/stores/notifications.js';

	/** When true, use MultiOrg/OnNuma theme: Shadow Grey #272838, Light Gold #F3DE8A, Sweet Salmon #EB9486, Lavender Grey #7E7F9A */
	export let useMultiOrgTheme = false;

	$: notificationList = $notifications;

	function getIcon(type) {
		switch (type) {
			case 'success':
				return '✓';
			case 'error':
				return '✕';
			case 'warning':
				return '⚠';
			case 'info':
			default:
				return 'ℹ';
		}
	}

	function getBgColor(type) {
		if (useMultiOrgTheme) {
			switch (type) {
				case 'success': return 'bg-[#F3DE8A]';
				case 'error': return 'bg-[#EB9486]';
				case 'warning': return 'bg-[#F3DE8A]';
				case 'info':
				default: return 'bg-[#7E7F9A]';
			}
		}
		switch (type) {
			case 'success': return 'bg-green-500';
			case 'error': return 'bg-red-500';
			case 'warning': return 'bg-yellow-500';
			case 'info':
			default: return 'bg-blue-500';
		}
	}

	function getTextColor(type) {
		if (useMultiOrgTheme) {
			switch (type) {
				case 'success':
				case 'error':
				case 'warning':
					return 'text-[#272838]';
				case 'info':
				default:
					return 'text-white';
			}
		}
		switch (type) {
			case 'success': return 'text-green-800';
			case 'error': return 'text-red-800';
			case 'warning': return 'text-yellow-800';
			case 'info':
			default: return 'text-blue-800';
		}
	}

	function getIconTextColor(type) {
		if (useMultiOrgTheme) {
			return type === 'info' ? 'text-white' : 'text-[#272838]';
		}
		return 'text-white';
	}

	function getBorderColor(type) {
		if (useMultiOrgTheme) {
			switch (type) {
				case 'success':
				case 'warning': return 'border-[#F3DE8A]';
				case 'error': return 'border-[#EB9486]';
				case 'info':
				default: return 'border-[#7E7F9A]';
			}
		}
		switch (type) {
			case 'success': return 'border-green-300';
			case 'error': return 'border-red-300';
			case 'warning': return 'border-yellow-300';
			case 'info':
			default: return 'border-blue-300';
		}
	}
</script>

<div class="fixed z-50 space-y-2 max-w-md w-full left-4 right-4 top-1/2 -translate-y-1/2 md:left-auto md:right-4 md:top-4 md:translate-x-0 md:translate-y-0">
	{#each notificationList as notification (notification.id)}
		<div
			class="notification-item bg-white shadow-lg rounded-lg border-2 {getBorderColor(notification.type)} p-4 flex items-start gap-3"
			role="alert"
		>
			<div class="flex-shrink-0 w-8 h-8 rounded-full {getBgColor(notification.type)} flex items-center justify-center font-bold text-sm {getIconTextColor(notification.type)}">
				{getIcon(notification.type)}
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium {getTextColor(notification.type)}">
					{@html notification.message}
				</p>
			</div>
			<button
				on:click={() => notifications.remove(notification.id)}
				class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
				aria-label="Close notification"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>

<style>
	@keyframes slide-in-right {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes pop-in-center {
		from {
			transform: scale(0.92);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	/* Desktop: slide in from right */
	@media (min-width: 768px) {
		.notification-item {
			animation: slide-in-right 0.3s ease-out;
		}
	}

	/* Mobile: appear centrally with pop-in */
	@media (max-width: 767px) {
		.notification-item {
			animation: pop-in-center 0.25s ease-out;
		}
	}
</style>

