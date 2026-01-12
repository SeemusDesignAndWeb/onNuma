<script>
	export let embedCode = '';
	export let title = '';
	export let description = '';

	// Extract the iframe src from the embed code if needed
	let iframeSrc = '';
	let aspectRatio = 64.86161251504213; // Default from Loom embed

	$: {
		if (embedCode) {
			// Try to extract iframe src from embed code
			const parser = new DOMParser();
			const doc = parser.parseFromString(embedCode, 'text/html');
			const iframe = doc.querySelector('iframe');
			
			if (iframe) {
				iframeSrc = iframe.getAttribute('src') || '';
				// Extract padding-bottom percentage for aspect ratio
				const wrapper = doc.querySelector('div[style*="padding-bottom"]');
				if (wrapper) {
					const style = wrapper.getAttribute('style');
					const match = style?.match(/padding-bottom:\s*([\d.]+)%/);
					if (match) {
						aspectRatio = parseFloat(match[1]);
					}
				}
			} else {
				// If no iframe found, try to extract URL directly
				const urlMatch = embedCode.match(/https:\/\/www\.loom\.com\/embed\/[\w]+/);
				if (urlMatch) {
					iframeSrc = urlMatch[0];
				}
			}
		}
	}
</script>

<div class="loom-video-container mb-6">
	{#if title}
		<h3 class="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
	{/if}
	
	{#if description}
		<p class="text-sm text-gray-600 mb-4">{description}</p>
	{/if}
	
	<div class="relative w-full" style="padding-bottom: {aspectRatio}%;">
		{#if iframeSrc}
			<iframe
				src={iframeSrc}
				frameborder="0"
				webkitallowfullscreen
				mozallowfullscreen
				allowfullscreen
				class="absolute top-0 left-0 w-full h-full rounded-lg shadow-md"
				title={title || 'Loom Video'}
			></iframe>
		{:else if embedCode}
			{@html embedCode}
		{:else}
			<div class="absolute top-0 left-0 w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
				<p class="text-gray-500">No video embed code provided</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.loom-video-container {
		max-width: 100%;
	}
	
	.loom-video-container iframe {
		border-radius: 0.5rem;
	}
</style>
