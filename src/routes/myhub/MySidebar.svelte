<script>
	import { page } from '$app/stores';
	/** @type {{ logoPath?: string } | null} */
	export let theme = null;
	$: path = $page.url.pathname;
	$: logoPath = theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png';
</script>

<aside class="my-sidebar" role="navigation" aria-label="myHub volunteering">
	<div class="my-sidebar-inner">
		<a href="/myhub" class="my-sidebar-brand" aria-label="myHub home">
			<img src={logoPath} alt="" class="my-sidebar-logo" width="32" height="32" />
			<span class="my-sidebar-brand-text">myHub</span>
		</a>
		<nav class="my-sidebar-nav">
			<a href="/myhub" class="my-sidebar-item" class:active={path === '/myhub'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
				<span class="my-sidebar-label">Overview</span>
			</a>
			<a href="/myhub/rotas" class="my-sidebar-item" class:active={path === '/myhub/rotas'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
				</svg>
				<span class="my-sidebar-label">My rotas</span>
			</a>
			<a href="/myhub/opportunities" class="my-sidebar-item" class:active={path === '/myhub/opportunities'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				<span class="my-sidebar-label">Sign up</span>
			</a>
			<a href="/myhub/profile" class="my-sidebar-item" class:active={path === '/myhub/profile'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
				</svg>
				<span class="my-sidebar-label">My details</span>
			</a>
			<a href="/myhub/availability" class="my-sidebar-item" class:active={path === '/myhub/availability'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<span class="my-sidebar-label">Availability</span>
			</a>
			<a href="/myhub/preferences" class="my-sidebar-item" class:active={path === '/myhub/preferences'}>
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span class="my-sidebar-label">Preferences</span>
			</a>
			<a href="/myhub/logout" class="my-sidebar-item my-sidebar-logout" title="Sign out">
				<svg class="my-sidebar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
				</svg>
				<span class="my-sidebar-label">Sign out</span>
			</a>
		</nav>
	</div>
</aside>

<style>
	.my-sidebar {
		width: 14rem;
		min-height: 100vh;
		height: 100%;
		background: linear-gradient(180deg, #1e3a5f 0%, #1a1d24 100%);
		border-right: 1px solid #2d3239;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		overflow: clip;
	}
	.my-sidebar-inner {
		padding: 1.25rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-height: 0;
	}
	.my-sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		font-size: 1.125rem;
		font-weight: 700;
		color: #93c5fd;
		text-decoration: none;
		border-radius: 0.75rem;
	}
	.my-sidebar-brand:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.my-sidebar-logo {
		width: 2rem;
		height: 2rem;
		object-fit: contain;
		flex-shrink: 0;
		filter: brightness(0) invert(1);
	}
	.my-sidebar-brand-text {
		word-break: break-word;
	}
	.my-sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-height: 0;
	}
	.my-sidebar-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		color: rgba(255, 255, 255, 0.9);
		text-decoration: none;
		font-size: 1rem;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
	}
	.my-sidebar-item:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.my-sidebar-item.active {
		background: #1e40af;
		color: #fff;
	}
	.my-sidebar-item:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.5);
		outline-offset: 2px;
	}
	.my-sidebar-icon {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
		color: #fff;
	}
	.my-sidebar-label {
		word-break: break-word;
	}
	.my-sidebar-logout {
		margin-top: auto;
		color: rgba(255, 255, 255, 0.7);
	}
	.my-sidebar-logout:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
</style>
