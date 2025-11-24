<script lang="js">
	import { onMount, getContext } from 'svelte';
	import Contact from './Contact.svelte';

	export let page;
	export let contactInfo = {
		address: '542 Westhorne Avenue, Eltham, London, SE9 6RR',
		phone: '020 8850 1331',
		email: 'enquiries@egcc.co.uk'
	};

	let currentMessage = 0;
	let autoplayInterval = null;
	let bannerVisible = false;
	
	// Get banner visibility from context
	try {
		const bannerVisibleStore = getContext('bannerVisible');
		if (bannerVisibleStore) {
			bannerVisibleStore.subscribe(value => {
				bannerVisible = value;
			});
		}
	} catch (e) {
		// Context not available
	}

	onMount(() => {
		if (page.heroMessages && page.heroMessages.length > 0) {
			autoplayInterval = window.setInterval(() => {
				currentMessage = (currentMessage + 1) % page.heroMessages.length;
			}, 4000);
		}
		return () => {
			if (autoplayInterval) window.clearInterval(autoplayInterval);
		};
	});

	function getBackgroundClass(bg) {
		switch (bg) {
			case 'white':
				return 'bg-white';
			case 'gray-50':
				return 'bg-gray-50';
			case 'gray-100':
				return 'bg-gray-100';
			case 'gray-800':
				return 'bg-gray-800';
			case 'primary':
				return 'bg-primary';
			default:
				return 'bg-white';
		}
	}

	function getTextColorClass(textColor) {
		return textColor === 'light' ? 'text-white' : 'text-dark-gray';
	}

	function getPaddingClass(padding) {
		switch (padding) {
			case 'none':
				return '';
			case 'small':
				return 'py-10';
			case 'medium':
				return 'py-16';
			case 'large':
				return 'py-20';
			default:
				return 'py-20';
		}
	}

	function getMaxWidthClass(maxWidth) {
		switch (maxWidth) {
			case 'sm':
				return 'max-w-sm';
			case 'md':
				return 'max-w-md';
			case 'lg':
				return 'max-w-lg';
			case 'xl':
				return 'max-w-xl';
			case '2xl':
				return 'max-w-2xl';
			case '4xl':
				return 'max-w-4xl';
			case 'full':
				return 'max-w-full';
			default:
				return 'max-w-4xl';
		}
	}

	function getAlignmentClass(alignment) {
		switch (alignment) {
			case 'left':
				return 'text-left';
			case 'right':
				return 'text-right';
			case 'center':
				return 'text-center';
			default:
				return 'text-left';
		}
	}

	function renderCTA(cta) {
		if (!cta) return null;

		const buttons = Array.isArray(cta) ? cta : [cta];

		return buttons.map((button) => {
			const styleClass =
				button.style === 'secondary'
					? 'bg-gray-600 text-white'
					: button.style === 'outline'
						? 'border-2 border-primary text-primary bg-transparent'
						: 'bg-primary text-white';

			return {
				...button,
				styleClass
			};
		});
	}
</script>

<!-- Hero Section -->
{#if page.heroImage}
	<section
		id="hero"
		class="relative h-[35vh] overflow-hidden transition-all duration-300"
		class:mt-[5px]={bannerVisible}
		style="background-image: url('{page.heroImage}'); background-size: cover; background-position: center;"
	>
		<div
			class="absolute inset-0 bg-black"
			style="opacity: {(page.heroOverlay || 40) / 100};"
		></div>
		<div class="relative h-full flex items-end pb-16">
			<div class="container mx-auto px-4">
				<div class="max-w-2xl">
					{#if page.heroTitle}
						<h1 class="text-white text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
							{@html page.heroTitle}
						</h1>
					{/if}
					{#if page.heroSubtitle}
						<p class="text-white text-lg md:text-xl animate-fade-in">{page.heroSubtitle}</p>
					{/if}
					{#if page.heroMessages && page.heroMessages.length > 0}
						<div class="relative h-12 mb-4">
							{#each page.heroMessages as msg, index}
								<div
									class="absolute inset-0 transition-opacity duration-1000"
									class:opacity-0={currentMessage !== index}
									class:opacity-100={currentMessage === index}
								>
									<h4 class="text-white text-lg animate-fade-in">{msg}</h4>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Page Sections -->
{#if page.sections}
	{#each page.sections as section}
		{@const bgClass = getBackgroundClass(section.backgroundColor)}
		{@const textClass = getTextColorClass(section.textColor)}
		{@const paddingClass = getPaddingClass(section.padding)}
		{@const maxWidthClass = getMaxWidthClass(section.maxWidth)}
		{@const alignmentClass = getAlignmentClass(section.alignment)}

		{#if section.type === 'contact'}
			{#if section.showForm}
				<Contact contactInfo={contactInfo} />
			{/if}
		{:else}
			<section class="{bgClass} {paddingClass} {textClass}">
				<div class="container mx-auto px-4">
					<div class="{maxWidthClass} mx-auto {alignmentClass} space-y-6">
					{#if section.type === 'text'}
						{#if section.title}
							<h2 class="text-4xl font-bold mb-8">{@html section.title}</h2>
						{/if}
						{#if section.content}
							<div class="prose prose-lg mx-auto text-light-gray">{@html section.content}</div>
						{/if}
						{#if section.cta}
							<div class="mt-8 {alignmentClass === 'text-center' ? 'text-center' : ''}">
								{#each renderCTA(section.cta) as button}
									<a
										href={button.link}
										target={button.target || '_self'}
										class="inline-block {button.styleClass} px-8 py-3 rounded hover:bg-opacity-90 transition-colors mr-4 mb-4"
									>
										{button.text}
									</a>
								{/each}
							</div>
						{/if}

					{:else if section.type === 'welcome'}
						<div class="grid md:grid-cols-3 gap-12 items-center">
							{#if section.image}
								<div class="md:col-span-1 flex justify-center">
									<img
										src={section.image}
										alt={section.imageAlt || section.title || 'Welcome'}
										class="w-full {section.imageWidth ? section.imageWidth : 'max-w-xs'} h-auto rounded-lg"
									/>
								</div>
							{/if}
							<div class="md:col-span-2">
								{#if section.title}
									<h2 class="text-4xl font-bold mb-6">{@html section.title}</h2>
								{/if}
								{#if section.content}
									<div class="space-y-4 text-light-gray leading-relaxed">{@html section.content}</div>
								{/if}
								{#if section.signature}
									<div class="mt-6">
										<img
											src={section.signature}
											alt="Signature"
											class="h-16 w-auto"
										/>
									</div>
								{/if}
							</div>
						</div>

					{:else if section.type === 'columns'}
						{@const colCount = section.columnCount || (section.columns?.length || 3)}
						{@const gridClass =
							colCount === 2
								? 'md:grid-cols-2'
								: colCount === 4
									? 'md:grid-cols-4'
									: 'md:grid-cols-3'}
						<div class="grid {gridClass} gap-8">
							{#if section.columns}
								{#each section.columns as column}
									<div>
										{#if column.title}
											<h2 class="text-2xl font-bold text-primary mb-6">{@html column.title}</h2>
										{/if}
										{#if column.content}
											<div class="space-y-4">{@html column.content}</div>
										{/if}
									</div>
								{/each}
							{/if}
						</div>

					{:else if section.type === 'image'}
						{@const imagePos = section.imagePosition || 'left'}
						{@const isLeft = imagePos === 'left'}
						{@const isRight = imagePos === 'right'}
						{@const isCenter = imagePos === 'center'}
						{@const isTop = imagePos === 'top'}
						{@const isBottom = imagePos === 'bottom'}

						{#if isCenter || isTop || isBottom}
							<div class="space-y-8">
								{#if section.image && (isTop || isCenter)}
									<div class="flex justify-center">
										<img
											src={section.image}
											alt={section.imageAlt || section.title || 'Image'}
											class="{section.imageWidth || 'w-full'} h-auto rounded-lg"
										/>
									</div>
								{/if}
								{#if section.title}
									<h3 class="text-2xl font-bold mb-4">{@html section.title}</h3>
								{/if}
								{#if section.content}
									<div class="text-light-gray leading-relaxed">{@html section.content}</div>
								{/if}
								{#if section.image && isBottom}
									<div class="flex justify-center">
										<img
											src={section.image}
											alt={section.imageAlt || section.title || 'Image'}
											class="{section.imageWidth || 'w-full'} h-auto rounded-lg"
										/>
									</div>
								{/if}
							</div>
						{:else}
							<div class="flex flex-col {isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} gap-6 items-center">
								{#if section.image}
									<div class="flex-shrink-0">
										<img
											src={section.image}
											alt={section.imageAlt || section.title || 'Image'}
											class="{section.imageWidth || 'w-48'} h-auto"
										/>
									</div>
								{/if}
								<div class="flex-1">
									{#if section.title}
										<h3 class="text-2xl font-bold mb-4">{@html section.title}</h3>
									{/if}
									{#if section.content}
										<div class="text-light-gray leading-relaxed">{@html section.content}</div>
									{/if}
								</div>
							</div>
						{/if}

					{:else if section.type === 'cta'}
						<div class="text-center">
							{#if section.title}
								<h2 class="text-4xl font-bold mb-8">{@html section.title}</h2>
							{/if}
							{#if section.content}
								<div class="mb-8">{@html section.content}</div>
							{/if}
							{#if section.cta}
								{#each renderCTA(section.cta) as button}
									<a
										href={button.link}
										target={button.target || '_self'}
										class="inline-block {button.styleClass} px-8 py-3 rounded hover:bg-opacity-90 transition-colors mr-4 mb-4"
									>
										{button.text}
									</a>
								{/each}
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</section>
		{/if}
	{/each}
{/if}

