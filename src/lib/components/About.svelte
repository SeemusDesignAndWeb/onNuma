<script>
	export let home = null;
</script>

<section id="about" class="py-20 bg-gradient-to-b from-white to-gray-50">
	<div class="container mx-auto px-4">
		<div class="max-w-6xl mx-auto">
			<div class="grid md:grid-cols-2 gap-12 items-center">
				<div>
					{#if home?.aboutLabel}
						<div class="inline-block mb-4">
							<span class="text-primary text-sm font-semibold uppercase tracking-wider">{home.aboutLabel}</span>
						</div>
					{/if}
					{#if home?.aboutTitle}
						<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
							{@html home.aboutTitle}
						</h2>
					{/if}

					{#if home?.aboutContent}
						<div class="space-y-4 text-gray-700 leading-relaxed prose prose-lg max-w-none">
							{@html home.aboutContent}
						</div>
					{/if}
				</div>

				<div class="flex justify-center md:justify-end">
					<div class="relative w-full max-w-lg">
						<div class="absolute -inset-4 bg-primary/20 rounded-2xl transform rotate-3"></div>
						<img
							src={home?.aboutImage || 'https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066390/egcc/egcc/img-church-bg.jpg'}
							alt="About us"
							class="relative rounded-2xl shadow-2xl w-full h-auto"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

