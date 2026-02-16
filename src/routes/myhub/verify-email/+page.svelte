<script>
	// Token verification and redirect happen in +page.server.js load.
	// This page may flash briefly before redirect.
</script>

<svelte:head>
	<title>Verifying your email – MyHUB</title>
</svelte:head>

<div class="my-page-content">
	<p class="my-muted">Verifying your email address…</p>
</div>

<style>
	.my-page-content {
		padding: 2rem 1rem;
		text-align: center;
	}
	.my-muted {
		color: #6b7280;
		font-size: 1rem;
	}
</style>
