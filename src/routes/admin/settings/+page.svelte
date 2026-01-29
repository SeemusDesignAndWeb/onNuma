<script lang="js">
	import { onMount } from 'svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let params = {};

	let contact = {
		address: '',
		phone: '',
		email: '',
		googleMapsUrl: ''
	};
	let serviceTimes = {
		sunday: '',
		weekday: '',
		notes: ''
	};
	let youtubePlaylistId = '';
	let youtubeChannelId = '';
	let spotifyShowUrl = '';
	let showLatestMessagePopup = false;
	let loading = true;
	let saving = false;

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		try {
			const [contactRes, timesRes, settingsRes] = await Promise.all([
				fetch('/api/content?type=contact'),
				fetch('/api/content?type=service-times'),
				fetch('/api/content?type=settings')
			]);
			
			if (!contactRes.ok || !timesRes.ok || !settingsRes.ok) {
				throw new Error('Failed to load some settings');
			}

			contact = await contactRes.json();
			serviceTimes = await timesRes.json();
			const settings = await settingsRes.json();
			youtubePlaylistId = settings.youtubePlaylistId || '';
			youtubeChannelId = settings.youtubeChannelId || '';
			spotifyShowUrl = settings.spotifyShowUrl || '';
			showLatestMessagePopup = settings.showLatestMessagePopup || false;
		} catch (error) {
			console.error('Failed to load settings:', error);
			notifications.error('Failed to load settings');
		} finally {
			loading = false;
		}
	}

	async function saveContact() {
		saving = true;
		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'contact', data: contact })
			});

			if (response.ok) {
				notifications.success('Contact information saved successfully!');
			} else {
				throw new Error('Failed to save contact information');
			}
		} catch (error) {
			console.error('Failed to save contact:', error);
			notifications.error(error.message || 'Failed to save contact information');
		} finally {
			saving = false;
		}
	}

	async function saveTimes() {
		saving = true;
		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'service-times', data: serviceTimes })
			});

			if (response.ok) {
				notifications.success('Service times saved successfully!');
			} else {
				throw new Error('Failed to save service times');
			}
		} catch (error) {
			console.error('Failed to save service times:', error);
			notifications.error(error.message || 'Failed to save service times');
		} finally {
			saving = false;
		}
	}

	async function saveYouTubeSettings() {
		saving = true;
		try {
			// Merge with existing settings
			const currentSettingsRes = await fetch('/api/content?type=settings');
			if (!currentSettingsRes.ok) throw new Error('Failed to fetch current settings');
			
			const currentSettings = await currentSettingsRes.json();
			const mergedSettings = {
				...currentSettings,
				youtubePlaylistId: youtubePlaylistId,
				youtubeChannelId: youtubeChannelId,
				spotifyShowUrl: spotifyShowUrl,
				showLatestMessagePopup: showLatestMessagePopup
			};
			
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'settings', data: mergedSettings })
			});

			if (response.ok) {
				notifications.success('Settings saved successfully!');
			} else {
				throw new Error('Failed to save settings');
			}
		} catch (error) {
			console.error('Failed to save settings:', error);
			notifications.error(error.message || 'Failed to save settings');
		} finally {
			saving = false;
		}
	}


</script>

<svelte:head>
	<title>Settings - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Settings</h1>

	<div class="grid md:grid-cols-2 gap-8">
		<!-- Contact Information -->
		<div class="bg-white p-6 rounded-lg shadow">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold">Contact Information</h2>
				<button
					on:click={saveContact}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Contact Info'}
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="contact-address" class="block text-sm font-medium mb-1">Address</label>
					<textarea
						id="contact-address"
						bind:value={contact.address}
						rows="3"
						class="w-full px-3 py-2 border rounded"
					></textarea>
				</div>
				<div>
					<label for="contact-phone" class="block text-sm font-medium mb-1">Phone</label>
					<input
						id="contact-phone"
						type="text"
						bind:value={contact.phone}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label for="contact-email" class="block text-sm font-medium mb-1">Email</label>
					<input
						id="contact-email"
						type="email"
						bind:value={contact.email}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label for="contact-googlemaps" class="block text-sm font-medium mb-1">Google Maps URL</label>
					<input
						id="contact-googlemaps"
						type="text"
						bind:value={contact.googleMapsUrl}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<button
					on:click={saveContact}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Contact Info'}
				</button>
			</div>
		</div>

		<!-- Service Times -->
		<div class="bg-white p-6 rounded-lg shadow">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold">Service Times</h2>
				<button
					on:click={saveTimes}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Service Times'}
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="service-times-sunday" class="block text-sm font-medium mb-1">Sunday Service</label>
					<input
						id="service-times-sunday"
						type="text"
						bind:value={serviceTimes.sunday}
						class="w-full px-3 py-2 border rounded"
						placeholder="11:00 AM (Doors open at 10:30 AM)"
					/>
				</div>
				<div>
					<label for="service-times-weekday" class="block text-sm font-medium mb-1">Weekday Services</label>
					<input
						id="service-times-weekday"
						type="text"
						bind:value={serviceTimes.weekday}
						class="w-full px-3 py-2 border rounded"
						placeholder="Various times - see Community Groups"
					/>
				</div>
				<div>
					<label for="service-times-notes" class="block text-sm font-medium mb-1">Notes</label>
					<textarea
						id="service-times-notes"
						bind:value={serviceTimes.notes}
						rows="3"
						class="w-full px-3 py-2 border rounded"
						placeholder="During August we start with prayer instead of refreshments"
					></textarea>
				</div>
				<button
					on:click={saveTimes}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Service Times'}
				</button>
			</div>
		</div>
	</div>

	<!-- Spotify Settings -->
	<div class="mt-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-2xl font-bold">Spotify Podcast Settings</h2>
					<p class="text-sm text-gray-600 mt-1">
						Configure the Spotify show URL for the audio/sermons page. All podcast links will redirect to this Spotify show.
					</p>
				</div>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Spotify Settings'}
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="spotify-show-url" class="block text-sm font-medium mb-1">Spotify Show URL</label>
					<input
						id="spotify-show-url"
						type="text"
						bind:value={spotifyShowUrl}
						class="w-full px-3 py-2 border rounded"
						placeholder="https://open.spotify.com/show/..."
					/>
					<p class="text-xs text-gray-500 mt-1">
						Enter the full Spotify show URL (e.g., <strong>https://open.spotify.com/show/7aczNe2FL8GCTxpaqM9WF1?si=...</strong>)
					</p>
				</div>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Spotify Settings'}
				</button>
			</div>
		</div>
	</div>

	<!-- Popup Settings -->
	<div class="mt-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-2xl font-bold">Popup Settings</h2>
					<p class="text-sm text-gray-600 mt-1">
						Control which popups appear on the front page. <strong>Latest Message Popup takes priority over Event Highlight Banner.</strong>
					</p>
				</div>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Popup Settings'}
				</button>
			</div>
			<div class="space-y-4">
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={showLatestMessagePopup} class="rounded" />
					<span class="text-sm font-medium">Show Latest Message Popup</span>
				</label>
				<p class="text-xs text-gray-500 ml-6">
					Displays the latest YouTube video recorded in the last 5 days. <strong>When enabled, this will override the Event Highlight Banner.</strong> The Event Highlight Banner is controlled in the Events section by checking the "Highlight" checkbox on individual events.
				</p>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save Popup Settings'}
				</button>
			</div>
		</div>
	</div>

	<!-- YouTube Settings -->
	<div class="mt-8">
		<div class="bg-white p-6 rounded-lg shadow">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h2 class="text-2xl font-bold">YouTube Video Settings</h2>
					<p class="text-sm text-gray-600 mt-1">
						Configure YouTube playlist to display videos on the online page.
					</p>
				</div>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save YouTube Settings'}
				</button>
			</div>
			<div class="space-y-4">
				<div>
					<label for="youtube-channel-id" class="block text-sm font-medium mb-1">YouTube Channel ID</label>
					<input
						id="youtube-channel-id"
						type="text"
						bind:value={youtubeChannelId}
						class="w-full px-3 py-2 border rounded"
						placeholder="UCqRV8s8Vzza9zScNpQz8CTw"
					/>
					<p class="text-xs text-gray-500 mt-1">
						Enter the YouTube channel ID (e.g., <strong>UCqRV8s8Vzza9zScNpQz8CTw</strong>). This will show all videos from the channel.
					</p>
				</div>
				<div>
					<label for="youtube-playlist-id" class="block text-sm font-medium mb-1">YouTube Playlist ID (Optional)</label>
					<input
						id="youtube-playlist-id"
						type="text"
						bind:value={youtubePlaylistId}
						class="w-full px-3 py-2 border rounded"
						placeholder="PLxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
					/>
					<p class="text-xs text-gray-500 mt-1">
						Alternatively, enter a specific playlist ID. You can find this in the playlist URL: youtube.com/playlist?list=<strong>PLAYLIST_ID</strong>
					</p>
					<p class="text-xs text-gray-400 mt-1">
						Note: Channel ID takes priority over playlist ID if both are set.
					</p>
				</div>
				<button
					on:click={saveYouTubeSettings}
					disabled={saving}
					class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save YouTube Settings'}
				</button>
			</div>
		</div>
	</div>
</div>

