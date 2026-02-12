<script lang="js">
	export let contactInfo = {
		address: '542 Westhorne Avenue, Eltham, London, SE9 6DH',
		phone: '020 8850 1331',
		email: 'enquiries@egcc.co.uk'
	};

	export let serviceTimes = {
		sunday: '11:00 AM (Doors open at 10:30 AM)',
		weekday: 'Various times - see Community Groups',
		notes: ''
	};
</script>

<footer class="bg-gray-900 text-white py-12">
	<div class="container mx-auto px-4">
		<div class="grid md:grid-cols-3 gap-8 mb-8">
			<!-- Contact -->
			<div class="text-center md:text-left">
				<a href="/" class="inline-block mb-6">
					<img
						src="/assets/egcc-logo-text.png"
						alt="Eltham Green Community Church"
						class="h-12 w-auto mx-auto md:mx-0"
					/>
				</a>
				<h3 class="text-white font-semibold mb-4">Contact</h3>
				<div class="space-y-2 text-sm text-white">
					<p class="text-white">{contactInfo.address}</p>
					<p>
						<a href="tel:{contactInfo.phone}" class="text-white hover:text-gray-300">
							{contactInfo.phone}
						</a>
					</p>
					<p>
						<a href="mailto:{contactInfo.email}" class="text-white hover:text-gray-300">
							{contactInfo.email}
						</a>
					</p>
				</div>
			</div>

			<!-- Service Times -->
			<div class="text-center md:text-left">
				<h3 class="text-white font-semibold mb-4">Service Times</h3>
				<div class="space-y-2 text-sm text-white">
					{#if serviceTimes.sunday && serviceTimes.sunday.trim() !== ''}
						<div>
							<p class="text-white font-medium">Sunday</p>
							<p class="text-white">{serviceTimes.sunday}</p>
						</div>
					{/if}
					{#if serviceTimes.weekday && serviceTimes.weekday.trim() !== ''}
						<div>
							<p class="text-white font-medium">Weekday</p>
							<p class="text-white">{serviceTimes.weekday}</p>
						</div>
					{/if}
					{#if serviceTimes.notes && serviceTimes.notes.trim() !== ''}
						<div class="pt-2">
							<p class="text-xs text-white">{serviceTimes.notes}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Links -->
			<div class="text-center md:text-left">
				<h3 class="text-white font-semibold mb-4">Quick Links</h3>
				<div class="space-y-2 text-sm text-white">
					<p>
						<a href="/terms" class="text-white hover:text-gray-300">Terms &amp; Conditions</a>
					</p>
					<p>
						<a href="/privacy" class="text-white hover:text-gray-300">Privacy Policy</a>
					</p>
					<p>
						<a href="/refund-policy" class="text-white hover:text-gray-300">Refund Policy</a>
					</p>
				</div>
			</div>
		</div>

		<!-- Copyright -->
		<div class="border-t border-gray-800 pt-8 text-sm text-white">
			<div class="flex flex-col md:flex-row justify-between items-center gap-4">
				<p>&copy; {new Date().getFullYear()} Eltham Green Community Church. All rights reserved.</p>
				<div class="flex flex-wrap justify-center gap-4">
					<a href="/terms" class="text-white hover:text-gray-300">Terms &amp; Conditions</a>
					<a href="/privacy" class="text-white hover:text-gray-300">Privacy Policy</a>
					<a href="/refund-policy" class="text-white hover:text-gray-300">Refund Policy</a>
				</div>
			</div>
		</div>
	</div>
</footer>
