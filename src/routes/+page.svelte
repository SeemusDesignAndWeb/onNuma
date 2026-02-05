<script>
	import { contactPopupOpen } from '$lib/stores/contactPopup.js';

	export let data;
	/** @type {Record<string, string>} */
	export let params = {};
	const landing = data?.landing || {};
	const ctaDemo = landing.ctaRequestDemoUrl || '/multi-org';
	const ctaStart = landing.ctaStartOrganisationUrl || '/multi-org/organisations/new';
	const tagline = landing.tagline || 'Organisation management that people actually use';

	// Pricing: scale by contacts (30–700), Professional max £50/month; Free up to 50
	let contacts = 30;
	const minContacts = 1;
	const maxContacts = 700;
	const freeMaxContacts = 50;
	$: freeAvailable = contacts <= freeMaxContacts;
	$: professionalPrice = Math.round(12 + (50 - 12) * (contacts - minContacts) / (maxContacts - minContacts));

	function scrollTo(id) {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>OnNuma – Organisation management that people actually use</title>
	<meta name="description" content="OnNuma is organisation management software designed around real volunteers. Simple to join. Clear to manage. Easy to communicate." />
</svelte:head>

<!-- Hero – full-screen background with overlay -->
<section class="relative min-h-[100vh] flex items-center justify-center overflow-hidden">
	<!-- Full-screen background image -->
	<div class="absolute inset-0">
		<img
			src="/images/hero-people.png"
			alt="People collaborating around a table"
			class="w-full h-full object-cover"
		/>
		<div class="absolute inset-0 bg-slate-900/55" aria-hidden="true"></div>
	</div>
	<!-- Content -->
	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center pt-20 pb-16">
		<p class="text-xs font-semibold tracking-widest text-brand-peach uppercase mb-4">
			Simplifying volunteer coordination
		</p>
		<h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight mb-6 drop-shadow-sm">
			Save time, with people who actually sign up
		</h1>
		<p class="text-xl text-white/95 max-w-2xl mx-auto mb-8">
			{tagline}
		</p>
		<a
			href="#about"
			on:click|preventDefault={() => scrollTo('about')}
			class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-brand-blue text-white hover:bg-brand-blue/90 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg transition-colors"
		>
			Read more
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
		</a>
	</div>
</section>

<!-- Stats strip – people-oriented impact -->
<section class="py-8 md:py-12 bg-slate-50 border-y border-slate-200">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
			<div>
				<p class="text-2xl md:text-3xl font-bold text-brand-blue">Less chasing</p>
				<p class="text-sm text-slate-500 mt-1">fewer last-minute gaps</p>
			</div>
			<div>
				<p class="text-2xl md:text-3xl font-bold text-brand-blue">Fewer no-shows</p>
				<p class="text-sm text-slate-500 mt-1">reminders that work</p>
			</div>
			<div>
				<p class="text-2xl md:text-3xl font-bold text-brand-blue">One place</p>
				<p class="text-sm text-slate-500 mt-1">events, rotas & contacts</p>
			</div>
			<div>
				<p class="text-2xl md:text-3xl font-bold text-brand-blue">No spreadsheets</p>
				<p class="text-sm text-slate-500 mt-1">clear and simple</p>
			</div>
		</div>
	</div>
</section>

<!-- About – How we arrived OnNuma -->
<section id="about" class="py-16 md:py-24 bg-white">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
		<h2 class="text-3xl md:text-4xl font-bold text-brand-blue mb-6">
			How we arrived OnNuma
		</h2>
		<p class="text-slate-700 text-lg leading-relaxed mb-4">
			We created OnNuma because organising volunteers had become harder than it should be. Rotas were complicated, systems felt technical, and the very people needed to keep things running were often the ones struggling to use the tools.
		</p>
		<p class="text-slate-700 text-lg leading-relaxed mb-4">
			It needed to be simple. Clear. Something that just worked.
		</p>
		<p class="text-slate-700 text-lg leading-relaxed mb-12">
			From that experience, OnNuma was created. A hub designed around people, not software.
		</p>

		<div class="pt-12 border-t border-slate-200 flex flex-col md:flex-row gap-8 md:gap-12 items-center">
			<div class="flex-shrink-0 w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden ring-4 ring-brand-blue/20 shadow-xl">
				<img
					src="/images/esme-portrait.png"
					alt="A volunteer smiling – designed for real people like Esme"
					class="w-full h-full object-cover"
				/>
			</div>
			<div class="min-w-0">
				<p class="text-xs font-semibold tracking-widest text-brand-blue uppercase mb-2">People oriented system</p>
				<h3 class="text-2xl md:text-3xl font-bold text-brand-blue mb-4">
					Designed for Esme
				</h3>
				<p class="text-slate-600 italic mb-4">
					“I just want to put my name down and know it’s done. If it takes more than a few seconds, I start to wonder if I’m doing it wrong. With OnNuma it was easy, and I can sign up with my husband in one go.”
				</p>
				<p class="text-slate-700">
					OnNuma removes friction. Name and email, choose where to help, done. No accounts. No dashboards. When signing up is easy, people actually do it.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- Why is it best OnNuma? – short stats / proof with people background -->
<section class="relative py-16 md:py-24 overflow-hidden">
	<div class="absolute inset-0">
		<img
			src="/images/volunteers-outdoor.png"
			alt="Volunteers together outdoors"
			class="w-full h-full object-cover"
		/>
		<div class="absolute inset-0 bg-slate-900/50" aria-hidden="true"></div>
	</div>
	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
		<p class="text-xs font-semibold tracking-widest text-brand-green/90 uppercase mb-2">Why?</p>
		<h2 class="text-3xl md:text-4xl font-bold text-white mb-12 drop-shadow-sm">
			Why is it best OnNuma?
		</h2>
		<div class="grid sm:grid-cols-3 gap-8">
			<div>
				<p class="text-3xl md:text-4xl font-bold text-brand-green">Easy</p>
				<p class="text-white/90 mt-1">for non-technical volunteers</p>
			</div>
			<div>
				<p class="text-3xl md:text-4xl font-bold text-brand-green">Clear</p>
				<p class="text-white/90 mt-1">overview of events and rotas</p>
			</div>
			<div>
				<p class="text-3xl md:text-4xl font-bold text-brand-green">Calm</p>
				<p class="text-white/90 mt-1">less chasing, less confusion</p>
			</div>
		</div>
	</div>
</section>

<!-- Features – card grid like MPP Dashboard / Create / Screen -->
<section id="features" class="py-16 md:py-24 bg-white">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
		<div class="text-center mb-12">
			<p class="text-xs font-semibold tracking-widest text-brand-blue uppercase mb-2">Keeping volunteering simple and effective</p>
			<h2 class="text-3xl md:text-4xl font-bold text-brand-blue mb-4">
				Everything in one clear place
			</h2>
			<p class="text-slate-600 max-w-2xl mx-auto">
				OnNuma brings contacts, events, rotas and communication together so volunteers and admins stay on the same page.
			</p>
		</div>
		<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-10">
			<div class="p-6 rounded-xl border border-slate-200 bg-white hover:border-brand-blue/30 hover:shadow-md transition-all text-center">
				<h3 class="text-lg font-bold text-brand-blue mb-2">Contacts and lists</h3>
				<p class="text-slate-600 text-sm">Keep volunteers and teams organised. Build lists and communicate with the right people.</p>
			</div>
			<div class="p-6 rounded-xl border border-slate-200 bg-white hover:border-brand-blue/30 hover:shadow-md transition-all text-center">
				<h3 class="text-lg font-bold text-brand-blue mb-2">Events and signups</h3>
				<p class="text-slate-600 text-sm">Calendar, occurrences and simple sign-up so people can join without the hassle.</p>
			</div>
			<div class="p-6 rounded-xl border border-slate-200 bg-white hover:border-brand-blue/30 hover:shadow-md transition-all text-center">
				<h3 class="text-lg font-bold text-brand-blue mb-2">Rotas that work</h3>
				<p class="text-slate-600 text-sm">Self sign-up or assign. Confirmations and reminders go out automatically.</p>
			</div>
			<div class="p-6 rounded-xl border border-slate-200 bg-white hover:border-brand-blue/30 hover:shadow-md transition-all text-center">
				<h3 class="text-lg font-bold text-brand-blue mb-2">Personalised emails</h3>
				<p class="text-slate-600 text-sm">Templates and campaigns that look like you. Send clear, on-brand communication.</p>
			</div>
		</div>
		<!-- Wide card: brand with your logo and colours -->
		<div class="w-full rounded-2xl border border-slate-200 bg-slate-50 p-8 md:p-10 text-center">
			<h3 class="text-xl font-bold text-brand-blue mb-3">Brand with your logo and colours</h3>
			<p class="text-slate-600 max-w-2xl mx-auto">
				Volunteers and sign-up pages see your organisation’s look and feel—your logo, your colours—not a generic tool. OnNuma stays in the background; your brand stays front and centre.
			</p>
		</div>
	</div>
</section>

<!-- Benefits – “What’s included” list -->
<section class="relative py-16 md:py-24 overflow-hidden">
	<div class="absolute inset-0">
		<img src="/images/community-vibrant.png" alt="Community gathering" class="w-full h-full object-cover" />
		<div class="absolute inset-0 bg-slate-900/65" aria-hidden="true"></div>
	</div>
	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-white">
		<p class="text-xs font-semibold tracking-widest text-brand-green/95 uppercase mb-2">Benefits</p>
		<h2 class="text-3xl md:text-4xl font-bold text-white mb-8">
			Unlock all these benefits
		</h2>
		<ul class="space-y-3 text-white/95">
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Easy for non-technical volunteers – no accounts to manage</li>
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Clear overview of events and rotas in one place</li>
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Less chasing and manual coordination</li>
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Better communication across teams</li>
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Low barrier to entry – simple, familiar, low cost to start</li>
			<li class="flex items-start gap-3"><span class="text-brand-green mt-0.5">✓</span> Built for churches, charities and volunteer-led organisations</li>
		</ul>
	</div>
</section>

<!-- Pricing – Free and Professional, scaled by contacts -->
<section id="pricing" class="py-16 md:py-24 bg-slate-50">
	<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
		<div class="text-center mb-10">
			<p class="text-xs font-semibold tracking-widest text-brand-blue uppercase mb-2">Pricing</p>
			<h2 class="text-3xl md:text-4xl font-bold text-brand-blue mb-4">
				Simple pricing for every organisation
			</h2>
			<p class="text-slate-600 max-w-2xl mx-auto mb-8">
				Pricing is per number of contacts. Choose your size below.
			</p>
			<!-- Contact scale -->
			<div class="max-w-md mx-auto mb-2">
				<label for="contacts-slider" class="block text-sm font-medium text-slate-700 mb-2">
					Up to <strong>{contacts}</strong> contacts
				</label>
				<input
					id="contacts-slider"
					type="range"
					min={minContacts}
					max={maxContacts}
					step="10"
					bind:value={contacts}
					class="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 accent-brand-blue"
				/>
				<div class="flex justify-between text-xs text-slate-500 mt-1">
					<span>{minContacts}</span>
					<span>{maxContacts}</span>
				</div>
			</div>
		</div>
		<div class="grid md:grid-cols-3 gap-6 lg:gap-8">
			<!-- Free – only available up to 50 contacts -->
			<div class="rounded-2xl border p-6 md:p-8 flex flex-col transition-opacity {freeAvailable ? 'bg-white border-slate-200 shadow-sm opacity-100' : 'bg-slate-100 border-slate-200 opacity-75'}">
				<h3 class="text-xl font-bold text-brand-blue mb-1">Free</h3>
				<p class="text-slate-500 text-sm mb-4">All modules except email and forms</p>
				<div class="mb-6">
					<span class="text-4xl font-bold text-slate-900">£0</span>
					<span class="text-slate-500">/month</span>
				</div>
				<p class="text-slate-600 text-sm mb-4">Up to <strong>{freeMaxContacts}</strong> contacts</p>
				<ul class="space-y-3 text-slate-700 text-sm flex-1 mb-8">
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Contact database</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Custom Lists</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Events calendar</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Rotas and sign-up links</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Email reminders</li>
				</ul>
				{#if freeAvailable}
					<a href={ctaStart} class="block w-full py-3 px-4 rounded-lg font-semibold text-center border-2 border-brand-blue text-brand-blue hover:bg-brand-blue/10 transition-colors">Get started free</a>
				{:else}
					<p class="block w-full py-3 px-4 rounded-lg font-medium text-center border-2 border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed">Free plan up to {freeMaxContacts} contacts</p>
				{/if}
			</div>
			<!-- Professional -->
			<div class="bg-white rounded-2xl border-2 border-brand-blue shadow-lg p-6 md:p-8 flex flex-col">
				<h3 class="text-xl font-bold text-brand-blue mb-1">Professional</h3>
				<p class="text-slate-500 text-sm mb-4">Everything included</p>
				<div class="mb-6">
					<span class="text-4xl font-bold text-slate-900">£{professionalPrice}</span>
					<span class="text-slate-500">/month</span>
				</div>
				<p class="text-slate-600 text-sm mb-4">Up to <strong>{contacts}</strong> contacts</p>
				<ul class="space-y-3 text-slate-700 text-sm flex-1 mb-8">
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Everything in Free</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Forms</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Email templates and campaigns</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Your branding</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Priority support</li>
				</ul>
				<a href={ctaDemo} class="block w-full py-3 px-4 rounded-lg font-semibold text-center bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors">Get Professional</a>
			</div>
			<!-- Enterprise -->
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 flex flex-col">
				<h3 class="text-xl font-bold text-brand-blue mb-1">Enterprise</h3>
				<p class="text-slate-500 text-sm mb-4">Custom solutions for larger needs</p>
				<div class="mb-6">
					<span class="text-2xl font-bold text-slate-900">Contact us</span>
				</div>
				<p class="text-slate-600 text-sm mb-4">700+ contacts or custom requirements</p>
				<ul class="space-y-3 text-slate-700 text-sm flex-1 mb-8">
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Everything in Professional</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Multiple organisations</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Dedicated support</li>
					<li class="flex items-start gap-2"><span class="text-brand-green mt-0.5">✓</span> Custom onboarding</li>
				</ul>
				<button
					type="button"
					on:click={() => contactPopupOpen.set(true)}
					class="block w-full py-3 px-4 rounded-lg font-semibold text-center border-2 border-brand-blue text-brand-blue hover:bg-brand-blue/5 transition-colors"
				>
					Contact us
				</button>
			</div>
		</div>
	</div>
</section>

<!-- Contact – CTA like MPP “Get in touch” -->
<section id="contact" class="relative py-20 md:py-28 overflow-hidden">
	<div class="absolute inset-0">
		<img src="/images/volunteering-activity.png" alt="People volunteering together" class="w-full h-full object-cover" />
		<div class="absolute inset-0 bg-slate-900/70" aria-hidden="true"></div>
		<div class="absolute inset-0 bg-brand-blue/75" aria-hidden="true"></div>
	</div>
	<div class="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl text-center text-white">
		<p class="text-xs font-semibold tracking-widest text-brand-green/95 uppercase mb-2">Contact</p>
		<h2 class="text-3xl md:text-4xl font-bold text-white mb-6 drop-shadow-sm">
			You can always get in touch
		</h2>
		<p class="text-lg text-white/95 mb-4">
			If signing up is simple, people show up. If communication is clear, organisations thrive.
		</p>
		<p class="text-lg text-white/95 mb-10">
			See how OnNuma can simplify your volunteer management.
		</p>
		<div class="flex flex-col sm:flex-row gap-4 justify-center items-center flex-wrap">
			<button
				type="button"
				on:click={() => contactPopupOpen.set(true)}
				class="inline-flex items-center justify-center px-8 py-4 rounded-lg font-semibold bg-white text-brand-blue hover:bg-brand-blue/10 transition-colors shadow-lg border-2 border-white"
			>
				Contact us
			</button>
		</div>
	</div>
</section>

<!-- Footer -->
<footer class="py-8 bg-slate-800 text-slate-300 text-center text-sm">
	<div class="container mx-auto px-4">
		<p>© {new Date().getFullYear()} OnNuma. Organisation management that people actually use.</p>
	</div>
</footer>
