<script>
	import { onMount } from 'svelte';

	export let podcast;
	export let autoplay = false;

	let audioElement;
	let isPlaying = false;
	let currentTime = 0;
	let duration = 0;
	let volume = 1;

	// Sync isPlaying state with actual audio element state
	function updatePlayingState() {
		if (audioElement) {
			isPlaying = !audioElement.paused;
		}
	}

	let autoplayHandled = false;

	// Handle autoplay when component mounts or podcast changes
	$: if (autoplay && audioElement && podcast?.audioUrl && !autoplayHandled) {
		autoplayHandled = true;
		// Use a small delay to ensure audio element is ready
		setTimeout(() => {
			if (audioElement) {
				audioElement.play().then(() => {
					updatePlayingState();
				}).catch(error => {
					// Autoplay was prevented by browser policy
					console.log('Autoplay prevented:', error);
					updatePlayingState();
				});
			}
		}, 100);
	}

	// Reset autoplay flag when podcast changes
	$: if (podcast?.audioUrl) {
		autoplayHandled = false;
	}

	function togglePlay() {
		if (!audioElement) return;

		// Use the actual audio element state, not our local state
		if (audioElement.paused) {
			audioElement.play().catch(error => {
				console.error('Play error:', error);
			});
		} else {
			audioElement.pause();
		}
		// State will be updated by the play/pause event handlers
	}

	function handleTimeUpdate() {
		if (audioElement) {
			currentTime = audioElement.currentTime;
			duration = audioElement.duration || 0;
		}
	}

	function handleSeek(e) {
		if (!audioElement) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const percent = x / rect.width;
		audioElement.currentTime = percent * duration;
	}

	function formatTime(seconds) {
		if (isNaN(seconds)) return '0:00';
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		
		if (hours > 0) {
			return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
		}
		return `${minutes}:${String(secs).padStart(2, '0')}`;
	}

	function handleVolumeChange(e) {
		const target = e.target;
		volume = parseFloat(target.value);
		if (audioElement) {
			audioElement.volume = volume;
		}
	}

	function handleEnded() {
		isPlaying = false;
		currentTime = 0;
	}

	// Generate consistent color for each series (using primary/10 style with different colors)
	function getSeriesColor(series) {
		if (!series) return 'bg-gray-100 text-gray-700';
		
		// Color palette - different colors for different series (using /10 opacity style)
		const colors = [
			{ bg: 'bg-blue-100', text: 'text-blue-700' },
			{ bg: 'bg-green-100', text: 'text-green-700' },
			{ bg: 'bg-purple-100', text: 'text-purple-700' },
			{ bg: 'bg-pink-100', text: 'text-pink-700' },
			{ bg: 'bg-yellow-100', text: 'text-yellow-700' },
			{ bg: 'bg-indigo-100', text: 'text-indigo-700' },
			{ bg: 'bg-red-100', text: 'text-red-700' },
			{ bg: 'bg-teal-100', text: 'text-teal-700' },
			{ bg: 'bg-orange-100', text: 'text-orange-700' },
			{ bg: 'bg-cyan-100', text: 'text-cyan-700' },
			{ bg: 'bg-primary/10', text: 'text-primary' }
		];
		
		// Simple hash function to get consistent color for same series name
		let hash = 0;
		for (let i = 0; i < series.length; i++) {
			hash = series.charCodeAt(i) + ((hash << 5) - hash);
		}
		const index = Math.abs(hash) % colors.length;
		return `${colors[index].bg} ${colors[index].text}`;
	}
</script>

<div class="bg-white rounded-lg shadow-lg p-6">
	<div class="mb-4">
		<h3 class="text-xl font-bold mb-1">{podcast.title}</h3>
		{#if podcast.description}
			<p class="text-gray-700 text-sm">{podcast.description}</p>
		{:else}
			<p class="text-gray-600 text-sm mb-2">By {podcast.speaker}</p>
		{/if}
		{#if podcast.series}
			{@const seriesColor = getSeriesColor(podcast.series)}
			<span class="inline-block mt-2 px-2 py-1 {seriesColor} text-xs rounded">
				{podcast.series}
			</span>
		{/if}
	</div>

	<audio
		bind:this={audioElement}
		src={podcast.audioUrl}
		on:timeupdate={handleTimeUpdate}
		on:loadedmetadata={handleTimeUpdate}
		on:ended={handleEnded}
		on:play={updatePlayingState}
		on:pause={updatePlayingState}
		autoplay={autoplay}
		preload="metadata"
	></audio>

	<!-- Progress Bar -->
	<div class="mb-4">
		<div
			class="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
			on:click={handleSeek}
			role="button"
			tabindex="0"
			on:keydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					handleSeek(e);
				}
			}}
		>
			<div
				class="h-full bg-primary rounded-full transition-all"
				style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
			></div>
		</div>
		<div class="flex justify-between text-xs text-gray-500 mt-1">
			<span>{formatTime(currentTime)}</span>
			<span>{formatTime(duration)}</span>
		</div>
	</div>

	<!-- Controls -->
	<div class="flex items-center gap-4">
		<button
			on:click={togglePlay}
			class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center hover:bg-opacity-90 transition-colors"
			aria-label={isPlaying ? 'Pause' : 'Play'}
		>
			{#if isPlaying}
				<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
					<path d="M6 4h2v12H6V4zm6 0h2v12h-2V4z" />
				</svg>
			{:else}
				<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
					<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
				</svg>
			{/if}
		</button>

		<div class="flex-1 flex items-center gap-2">
			<svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
				<path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
			</svg>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={volume}
				on:input={handleVolumeChange}
				class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
			/>
			<span class="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
		</div>

		<a
			href={podcast.audioUrl}
			download
			class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition-colors text-sm"
			title="Download"
		>
			<svg class="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
			</svg>
		</a>
	</div>
</div>

<style>
	input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #2d7a32;
		cursor: pointer;
	}

	input[type='range']::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #2d7a32;
		cursor: pointer;
		border: none;
	}
</style>

