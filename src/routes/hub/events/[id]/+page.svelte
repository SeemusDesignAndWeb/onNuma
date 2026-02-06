<script>
    import { enhance } from '$app/forms';
    import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import FormField from '$lib/crm/components/FormField.svelte';
    import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
    import Table from '$lib/crm/components/Table.svelte';
    import MultiSelect from '$lib/crm/components/MultiSelect.svelte';
    import ImagePicker from '$lib/components/ImagePicker.svelte';
    import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
    import { notifications } from '$lib/crm/stores/notifications.js';
    import { dialog } from '$lib/crm/stores/notifications.js';
    import { EVENT_COLORS } from '$lib/crm/constants/eventColours.js';

    $: event = $page.data?.event;
    $: occurrences = $page.data?.occurrences || [];
    $: rotas = $page.data?.rotas || [];
    $: meetingPlanners = $page.data?.meetingPlanners || [];
    $: rotaSignupLink = $page.data?.rotaSignupLink || '';
    $: publicEventLink = $page.data?.publicEventLink || '';
    $: occurrenceLinks = $page.data?.occurrenceLinks || [];
    $: eventColors = $page.data?.eventColors || EVENT_COLORS;
    $: csrfToken = $page.data?.csrfToken || '';
    $: formResult = $page.form;
    $: lists = $page.data?.lists || [];
    
    let occurrenceLinkCopied = {};

    // Track last processed form result to avoid duplicate notifications
    let lastProcessedFormResult = null;

    // Show notifications from form results
    $: if (formResult && browser && formResult !== lastProcessedFormResult) {
        lastProcessedFormResult = formResult;
        if (formResult?.success) {
            if (formResult?.type !== 'createEventEmail') {
                if (formResult?.type === 'deleteSignup') {
                    notifications.success('Signup removed successfully');
                } else {
                    notifications.success('Event updated successfully');
                }
                // Reset editing mode after successful save
                setTimeout(() => {
                    editing = false;
                    // Reload page data to get updated event
                    if (browser) {
                        goto($page.url, { invalidateAll: true });
                    }
                }, 100);
            }
        } else if (formResult?.error) {
            notifications.error(formResult.error);
        }
    }

    async function handleDeleteSignup(signupId) {
        const confirmed = await dialog.confirm('Are you sure you want to remove this signup?', 'Remove Signup');
        if (confirmed) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '?/deleteSignup';
            
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
            
            const signupIdInput = document.createElement('input');
            signupIdInput.type = 'hidden';
            signupIdInput.name = 'signupId';
            signupIdInput.value = signupId;
            form.appendChild(signupIdInput);
            
            document.body.appendChild(form);
            form.submit();
        }
    }

    let editing = false;
    let description = '';
    let selectedListIds = [];
    let formData = {
        title: '',
        location: '',
        image: '',
        visibility: 'private',
        enableSignup: false,
        hideFromEmail: false,
        showDietaryRequirements: false,
        maxSpaces: '',
        color: '#9333ea'
    };
    let showImagePicker = false;
    let showOccurrences = false;
    let showMeetingPlanners = false;
    let showRotas = false;
    let showEventEmailModal = false;
    let createdEmailId = null;
    let creatingEventEmail = false;

    // Initialize form data when event is loaded (avoid hydration issues)
    $: if (event && !editing) {
        formData = {
            title: event.title || '',
            location: event.location || '',
            image: event.image || '',
            visibility: event.visibility || 'private',
            enableSignup: event.enableSignup || false,
            hideFromEmail: event.hideFromEmail || false,
            showDietaryRequirements: event.showDietaryRequirements || false,
            maxSpaces: event.maxSpaces ? event.maxSpaces.toString() : '',
            color: event.color || '#9333ea'
        };
        description = event.description || '';
        selectedListIds = Array.isArray(event.listIds) ? [...event.listIds] : [];
    }

    function handleImageSelect(imagePath) {
        formData.image = imagePath;
        showImagePicker = false;
    }

    async function handleDelete() {
        const confirmed = await dialog.confirm('Are you sure you want to delete this event? This will also delete all occurrences and rotas.', 'Delete Event');
        if (confirmed) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '?/delete';
            
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_csrf';
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
            
            document.body.appendChild(form);
            form.submit();
        }
    }

    $: occurrenceColumns = [
        { 
            key: 'startsAt', 
            label: 'Date/Time',
            render: (val, row) => {
                if (!val) return '-';
                const start = formatDateTimeUK(val);
                const end = row.endsAt ? formatDateTimeUK(row.endsAt) : '';
                return end ? `${start}<br><span class="text-gray-500 text-xs">to ${end}</span>` : start;
            }
        },
        { 
            key: 'location', 
            label: 'Location',
            render: (val) => val || '-'
        },
        { 
            key: 'signupStats', 
            label: 'Signups',
            render: (stats, row) => {
                if (!stats) return '-';
                const { signupCount, totalAttendees, availableSpots, isFull } = stats;
                const effectiveMaxSpaces = row.maxSpaces !== null && row.maxSpaces !== undefined 
                    ? row.maxSpaces 
                    : (event?.maxSpaces || null);
                
                if (!effectiveMaxSpaces) {
                    return `${signupCount} (${totalAttendees})`;
                }
                
                if (isFull) {
                    return `<span class="text-hub-red-600 font-medium">${signupCount} / ${effectiveMaxSpaces} Full</span>`;
                }
                return `${signupCount} / ${effectiveMaxSpaces}<br><span class="text-hub-green-600 text-xs">${availableSpots} left</span>`;
            }
        },
        { 
            key: 'rotaStats', 
            label: 'Rotas',
            render: (stats) => {
                if (!stats || stats.rotaCount === 0) return '-';
                const { rotaCount, totalAssigned, totalCapacity } = stats;
                if (totalCapacity === 0) return `${rotaCount}`;
                return `${rotaCount}<br><span class="text-gray-500 text-xs">${totalAssigned}/${totalCapacity}</span>`;
            }
        },
        {
            key: 'id',
            label: '',
            render: (id) => {
                const linkData = occurrenceLinks.find(l => l.occurrenceId === id);
                if (!linkData) return '-';
                const escapedLink = linkData.link.replace(/"/g, '&quot;');
                const escapedId = String(id).replace(/"/g, '&quot;');
                return `
                    <div class="flex items-center gap-1" data-occurrence-id="${escapedId}" data-occurrence-link="${escapedLink}">
                        <button 
                            type="button"
                            class="copy-occurrence-link p-1.5 rounded hover:bg-hub-blue-100 text-hub-blue-600"
                            title="Copy link"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <a 
                            href="${escapedLink}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="p-1.5 rounded hover:bg-hub-blue-100 text-hub-blue-600"
                            title="Open link"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                `;
            }
        }
    ];

    onMount(() => {
        // Handle copy button clicks
        const handleCopyClick = (e) => {
            // Check if clicking on copy button or its SVG child
            const button = e.target.closest('.copy-occurrence-link');
            if (!button) return;
            
            e.stopPropagation();
            e.preventDefault();
            
            const container = button.closest('[data-occurrence-id]');
            if (!container) return;
            
            const occurrenceId = container.getAttribute('data-occurrence-id');
            const link = container.getAttribute('data-occurrence-link');
            
            if (link && occurrenceId) {
                navigator.clipboard.writeText(link).then(() => {
                    occurrenceLinkCopied = { ...occurrenceLinkCopied, [occurrenceId]: true };
                    notifications.success('Occurrence link copied!');
                    
                    // Update button icon
                    button.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    `;
                    
                    setTimeout(() => {
                        occurrenceLinkCopied = { ...occurrenceLinkCopied, [occurrenceId]: false };
                        button.innerHTML = `
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        `;
                    }, 2000);
                }).catch((err) => {
                    console.error('Failed to copy link:', err);
                    notifications.error('Failed to copy link');
                });
            }
        };
        
        // Use capture phase to catch events early
        document.addEventListener('click', handleCopyClick, true);
        
        return () => {
            document.removeEventListener('click', handleCopyClick, true);
        };
    });

    const rotaColumns = [
        { key: 'role', label: 'Role' },
        { key: 'capacity', label: 'Capacity' },
        { 
            key: 'assignees', 
            label: 'Assigned',
            render: (val) => Array.isArray(val) ? val.length : 0
        }
    ];
</script>

{#if event}
    <div class="bg-white shadow rounded-lg p-3 sm:p-4 mb-4">
        <div class="mb-3">
            <h2 class="text-base sm:text-lg md:text-xl font-bold text-gray-900">Event Details</h2>
        </div>
        
        <!-- Buttons Panel -->
        <div class="bg-gray-50 rounded-lg p-2 mb-3">
            <div class="flex flex-nowrap justify-between items-center gap-2 overflow-x-auto">
                <!-- Left-aligned buttons -->
                <div class="flex flex-nowrap gap-2 overflow-x-auto">
                    {#if !editing && rotaSignupLink}
                        <a
                            href={rotaSignupLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Rota Signup
                        </a>
                    {/if}
                    {#if !editing && rotas.length > 0}
                        <a
                            href="/hub/events/{event.id}/export-rotas-pdf"
                            target="_blank"
                            class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export All Rotas PDF
                        </a>
                    {/if}
                    {#if !editing && publicEventLink}
                        <a
                            href={publicEventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Public View
                        </a>
                    {/if}
                    {#if !editing}
                        <form method="POST" action="?/createEventEmail" use:enhance={() => {
                            creatingEventEmail = true;
                            return async ({ result }) => {
                                creatingEventEmail = false;
                                if (result.type === 'success' && result.data?.emailId) {
                                    createdEmailId = result.data.emailId;
                                    showEventEmailModal = true;
                                } else if (result.type === 'failure' && result.data?.error) {
                                    notifications.error(result.data.error);
                                }
                            };
                        }} class="flex-shrink-0">
                            <input type="hidden" name="_csrf" value={csrfToken} />
                            <button
                                type="submit"
                                disabled={creatingEventEmail}
                                class="btn-theme-2 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 text-xs whitespace-nowrap disabled:opacity-70"
                            >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {creatingEventEmail ? 'Creating…' : 'Create email from event'}
                            </button>
                        </form>
                    {/if}
                </div>
                
                <!-- Right-aligned buttons -->
                <div class="flex flex-nowrap gap-2 overflow-x-auto">
                    <a
                        href="/hub/events/calendar"
                        class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
                    >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span>Back to Calendar</span>
                    </a>
                    {#if editing}
                        <button
                            type="submit"
                            form="event-edit-form"
                            class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            Save Changes
                        </button>
                        <button
                            type="button"
                            on:click={() => editing = false}
                            class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            Back
                        </button>
                    {:else}
                        <button
                            on:click={() => editing = true}
                            class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            Edit
                        </button>
                        <button
                            on:click={handleDelete}
                            class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700 text-xs whitespace-nowrap flex-shrink-0"
                        >
                            Delete
                        </button>
                    {/if}
                </div>
            </div>
        </div>

        {#if editing}
            <form id="event-edit-form" method="POST" action="?/update" use:enhance>
                <input type="hidden" name="_csrf" value={csrfToken} />
                <input type="hidden" name="description" value={description || ''} />
                <input type="hidden" name="image" value={formData.image || ''} />
                
                <div class="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
                    <!-- Basic Information & Signup - Narrow Column -->
                    <div class="lg:col-span-1 space-y-3">
                        <div class="bg-gray-50 rounded-lg p-3">
                            <h3 class="text-xs font-semibold text-gray-900 mb-3">Basic Information</h3>
                            <div class="space-y-3">
                                <FormField label="Title" name="title" bind:value={formData.title} required />
                                <FormField label="Location" name="location" bind:value={formData.location} />
                            </div>
                        </div>

                        <div class="bg-gray-50 rounded-lg p-3">
                            <h3 class="text-xs font-semibold text-gray-900 mb-3">Signup</h3>
                            <div class="space-y-3">
                                <div class="flex items-center">
                                    <input
                                        type="checkbox"
                                        id="enableSignup"
                                        name="enableSignup"
                                        bind:checked={formData.enableSignup}
                                        class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
                                    />
                                    <label for="enableSignup" class="ml-2 block text-xs text-gray-700">
                                        Enable signup for this event
                                    </label>
                                </div>
                                {#if formData.enableSignup}
                                    <div>
                                        <label for="maxSpaces" class="block text-xs font-medium text-gray-700 mb-1">Max spaces</label>
                                        <input
                                            id="maxSpaces"
                                            name="maxSpaces"
                                            type="number"
                                            min="1"
                                            bind:value={formData.maxSpaces}
                                            class="w-20 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-1.5 px-2 text-sm"
                                        />
                                    </div>
                                    <div class="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="showDietaryRequirements"
                                            name="showDietaryRequirements"
                                            bind:checked={formData.showDietaryRequirements}
                                            class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
                                        />
                                        <label for="showDietaryRequirements" class="ml-2 block text-xs text-gray-700">
                                            Show "Any dietary requirements?" on signup form
                                        </label>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Description & display options - Wide Column -->
                    <div class="lg:col-span-3 bg-gray-50 rounded-lg p-3 space-y-4">
                        <div>
                            <h3 class="text-xs font-semibold text-gray-900 mb-3">Description</h3>
                            <HtmlEditor bind:value={description} name="description" showImagePicker={true} />
                        </div>
                        <div class="border-t border-gray-200 pt-4">
                            <h3 class="text-xs font-semibold text-gray-900 mb-3">Display & sharing</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Image</label>
                                    {#if formData.image}
                                        <div class="mb-2 rounded border border-gray-300 overflow-hidden bg-gray-100 aspect-[2/1] min-h-[120px]">
                                            <img src={formData.image} alt="Event preview" class="w-full h-full object-cover" />
                                        </div>
                                    {/if}
                                    <button
                                        type="button"
                                        on:click={() => showImagePicker = true}
                                        class="w-full text-xs py-2 px-3 rounded-md border border-gray-500 bg-white text-gray-700 hover:bg-gray-50"
                                    >
                                        {formData.image ? 'Change image' : 'Choose image'}
                                    </button>
                                </div>
                                <div>
                                    <label for="event-visibility" class="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
                                    <select id="event-visibility" name="visibility" bind:value={formData.visibility} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
                                        <option value="private">Private (Hub Admins only)</option>
                                        <option value="internal">Internal (Church only)</option>
                                        <option value="public">Public (Everyone)</option>
                                    </select>
                                </div>
                                <div>
                                    <label for="event-color" class="block text-xs font-medium text-gray-700 mb-1">Color</label>
                                    <div class="flex items-center gap-2 mt-1">
                                        <div class="w-6 h-6 rounded border border-gray-300 flex-shrink-0" style="background-color: {formData.color};"></div>
                                        <select id="event-color" name="color" bind:value={formData.color} class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
                                            {#each eventColors as colorOption}
                                                <option value={colorOption.value}>{colorOption.label}</option>
                                            {/each}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="border-t border-gray-200 pt-4">
                                <h4 class="text-xs font-semibold text-gray-900 mb-3">Email</h4>
                                <div class="flex items-center mb-3">
                                    <input
                                        type="checkbox"
                                        id="hideFromEmail"
                                        name="hideFromEmail"
                                        bind:checked={formData.hideFromEmail}
                                        class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
                                    />
                                    <label for="hideFromEmail" class="ml-2 block text-xs text-gray-700">
                                        Hide from email
                                    </label>
                                </div>
                                <div>
                                    <MultiSelect
                                        label="Email lists"
                                        name="listIds"
                                        options={lists.map(list => ({ id: list.id, name: list.name }))}
                                        bind:selected={selectedListIds}
                                        placeholder="Select lists..."
                                    />
                                    <p class="text-xs text-gray-500 mt-1">Select lists to show this event to on an email. If no lists are selected, the event will be sent to everyone (based on visibility).</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        {:else}
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
                <!-- Basic Information & Signup - Narrow Column -->
                <div class="lg:col-span-1 space-y-3">
                    <div class="bg-gray-50 rounded-lg p-3">
                        <h3 class="text-xs font-semibold text-gray-900 mb-3">Basic Information</h3>
                        <dl class="space-y-3">
                            <div>
                                <dt class="text-xs font-medium text-gray-500 uppercase">Title</dt>
                                <dd class="mt-1 text-sm text-gray-900 font-medium">{event.title}</dd>
                            </div>
                            {#if event.location}
                                <div>
                                    <dt class="text-xs font-medium text-gray-500 uppercase">Location</dt>
                                    <dd class="mt-1 text-sm text-gray-900">{event.location}</dd>
                                </div>
                            {/if}
                        </dl>
                    </div>

                    <div class="bg-gray-50 rounded-lg p-3">
                        <h3 class="text-xs font-semibold text-gray-900 mb-3">Signup</h3>
                        <dl class="space-y-3">
                            <div>
                                <dt class="text-xs font-medium text-gray-500 uppercase">Enabled</dt>
                                <dd class="mt-1 text-sm text-gray-900">{event.enableSignup ? 'Yes' : 'No'}</dd>
                            </div>
                            {#if event.enableSignup}
                                {#if event.maxSpaces != null && event.maxSpaces !== ''}
                                    <div>
                                        <dt class="text-xs font-medium text-gray-500 uppercase">Max spaces</dt>
                                        <dd class="mt-1 text-sm text-gray-900">{event.maxSpaces}</dd>
                                    </div>
                                {/if}
                                <div>
                                    <dt class="text-xs font-medium text-gray-500 uppercase">Dietary field</dt>
                                    <dd class="mt-1 text-sm text-gray-900">{event.showDietaryRequirements ? 'Yes' : 'No'}</dd>
                                </div>
                            {/if}
                        </dl>
                    </div>
                </div>
                
                <!-- Description & display - Wide Column -->
                <div class="lg:col-span-3 bg-gray-50 rounded-lg p-3 space-y-4">
                    <div>
                        <h3 class="text-xs font-semibold text-gray-900 mb-3">Description</h3>
                        <div class="text-sm text-gray-900 prose prose-sm max-w-none">
                            {#if event.description}
                                {@html event.description}
                            {:else}
                                <p class="text-gray-400 italic">No description provided</p>
                            {/if}
                        </div>
                    </div>
                    <div class="border-t border-gray-200 pt-4">
                        <h3 class="text-xs font-semibold text-gray-900 mb-3">Display & sharing</h3>
                        <dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {#if event.image}
                                <div>
                                    <dt class="text-xs font-medium text-gray-500 uppercase">Image</dt>
                                    <dd class="mt-1">
                                        <img src={event.image} alt="Event" class="w-full max-h-28 object-cover rounded border border-gray-200" />
                                    </dd>
                                </div>
                            {/if}
                            <div>
                                <dt class="text-xs font-medium text-gray-500 uppercase">Visibility</dt>
                                <dd class="mt-1 text-sm text-gray-900 capitalize">{event.visibility || 'private'}</dd>
                            </div>
                            <div>
                                <dt class="text-xs font-medium text-gray-500 uppercase">Color</dt>
                                <dd class="mt-1 flex items-center gap-1.5">
                                    <div class="w-5 h-5 rounded border border-gray-300" style="background-color: {event.color || '#9333ea'};"></div>
                                    <span class="text-sm text-gray-600">{(() => {
                                        const colorOption = eventColors.find(c => c.value === (event.color || '#9333ea'));
                                        return colorOption ? colorOption.label : 'Purple';
                                    })()}</span>
                                </dd>
                            </div>
                        </dl>
                        <div class="border-t border-gray-200 pt-4">
                            <h4 class="text-xs font-semibold text-gray-900 mb-3">Email</h4>
                            <dl class="space-y-3">
                                <div>
                                    <dt class="text-xs font-medium text-gray-500 uppercase">Hide from email</dt>
                                    <dd class="mt-1 text-sm text-gray-900">{event.hideFromEmail ? 'Yes' : 'No'}</dd>
                                </div>
                                <div>
                                    <dt class="text-xs font-medium text-gray-500 uppercase">Email lists</dt>
                                    <dd class="mt-1 text-sm text-gray-900">
                                        {#if event.listIds && event.listIds.length > 0}
                                            <ul class="list-none space-y-1 pl-0">
                                                {#each event.listIds as listId}
                                                    {@const list = lists.find(l => l.id === listId)}
                                                    <li class="text-xs">{list ? list.name : listId}</li>
                                                {/each}
                                            </ul>
                                        {:else}
                                            <span class="text-gray-500 italic">No lists selected (sent to everyone based on visibility)</span>
                                        {/if}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </div>
            </div>
        {/if}

        {#if occurrenceLinks.length > 0}
            <div class="mt-6 space-y-3">
                <div class="flex flex-wrap gap-2">
                    <!-- Occurrence links can go here if needed -->
                </div>
            </div>
        {/if}
    </div>

    <div class="bg-white shadow rounded-lg p-3 sm:p-4 mb-4">
        <div class="flex items-center gap-2">
            <button
                type="button"
                on:click={() => (showOccurrences = !showOccurrences)}
                class="flex items-center gap-2 flex-1 min-w-0 text-left group"
                aria-expanded={showOccurrences}
            >
                <svg
                    class="w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200"
                    class:rotate-180={!showOccurrences}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
                <h3 class="text-base sm:text-lg font-bold text-gray-900 group-hover:text-gray-700">Occurrences</h3>
            </button>
            <a href="/hub/events/{event.id}/occurrences/new" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0">
                Add Occurrence
            </a>
        </div>
        
        {#if showOccurrences}
            <div transition:slide={{ duration: 200 }}>
                <div class="mt-3 pt-3 border-t border-gray-200">
                    <Table columns={occurrenceColumns} rows={occurrences} onRowClick={(row) => goto(`/hub/events/${event.id}/occurrences/${row.id}`)} />
                </div>
                
                {#if occurrences.some(occ => occ.signupStats?.signupCount > 0)}
                    <div class="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200">
                        <h4 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Event Signups</h4>
                        
                        <div class="space-y-4 sm:space-y-6">
                            {#each occurrences as occ}
                                {#if occ.signupStats?.signupCount > 0}
                                    <div class="border border-gray-200 rounded-lg p-3 sm:p-4">
                                        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                                            <div class="flex-1">
                                                <h5 class="text-xs font-medium text-gray-900">
                                                    {formatDateTimeUK(occ.startsAt)}
                                                </h5>
                                                <p class="text-xs sm:text-sm text-gray-600 mt-1">
                                                    {occ.signupStats.signupCount} {occ.signupStats.signupCount === 1 ? 'person has' : 'people have'} signed up
                                                    ({occ.signupStats.totalAttendees} total attendees including guests)
                                                </p>
                                                {#if occ.maxSpaces}
                                                    <p class="text-xs sm:text-sm text-gray-600 mt-1">
                                                        Spots: {occ.signupStats.totalAttendees} / {occ.maxSpaces}
                                                        {#if occ.signupStats.isFull}
                                                            <span class="text-hub-red-600 font-medium ml-2">(Full)</span>
                                                        {:else}
                                                            <span class="text-hub-green-600 ml-2">({occ.signupStats.availableSpots} available)</span>
                                                        {/if}
                                                    </p>
                                                {/if}
                                            </div>
                                        </div>
                                        
                                        <div class="mt-3">
                                            <h6 class="text-xs sm:text-sm font-medium text-gray-700 mb-2">Signups:</h6>
                                            <ul class="space-y-2">
                                                {#each occ.signupStats.signups as signup}
                                                    <li class="text-xs sm:text-sm text-gray-600 flex items-start justify-between gap-2">
                                                        <div class="flex items-start gap-2 flex-1 min-w-0">
                                                            <span class="w-2 h-2 bg-hub-green-500 rounded-full mt-2 flex-shrink-0"></span>
                                                            <div class="min-w-0 flex-1">
                                                                <span class="font-medium">{signup.name}</span>
                                                                <span class="text-gray-400 hidden sm:inline"> ({signup.email})</span>
                                                                <span class="text-gray-400 sm:hidden block text-xs truncate">{signup.email}</span>
                                                                {#if signup.guestCount > 0}
                                                                    <span class="text-gray-500"> - {signup.guestCount} {signup.guestCount === 1 ? 'guest' : 'guests'}</span>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                        <button
                                                            on:click={() => handleDeleteSignup(signup.id)}
                                                            class="text-hub-red-600 hover:text-hub-red-800 font-medium text-xs ml-2 flex-shrink-0"
                                                            title="Remove signup"
                                                        >
                                                            Remove
                                                        </button>
                                                    </li>
                                                {/each}
                                            </ul>
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#if meetingPlanners.length > 0}
        <div class="bg-white shadow rounded-lg p-3 sm:p-4 mb-4">
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    on:click={() => (showMeetingPlanners = !showMeetingPlanners)}
                    class="flex items-center gap-2 flex-1 min-w-0 text-left group"
                    aria-expanded={showMeetingPlanners}
                >
                    <svg
                        class="w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200"
                        class:rotate-180={!showMeetingPlanners}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                    <h3 class="text-base sm:text-lg font-bold text-gray-900 group-hover:text-gray-700">Meeting Planners</h3>
                </button>
                <a href="/hub/meeting-planners/new?eventId={event.id}" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0">
                    <span class="hidden sm:inline">New Meeting Planner</span>
                    <span class="sm:hidden">New Planner</span>
                </a>
            </div>
            
            {#if showMeetingPlanners}
                <div class="mt-3 pt-3 border-t border-gray-200 space-y-2" transition:slide={{ duration: 200 }}>
                    {#each meetingPlanners as mp}
                        <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer" on:click={() => goto(`/hub/meeting-planners/${mp.id}`)}>
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-medium text-gray-900">Meeting Planner</p>
                                    {#if mp.occurrenceId}
                                        <p class="text-sm text-gray-500">
                                            {(() => {
                                                const occ = occurrences.find(o => o.id === mp.occurrenceId);
                                                return occ ? formatDateTimeUK(occ.startsAt) : 'Specific occurrence';
                                            })()}
                                        </p>
                                    {:else}
                                        <p class="text-sm text-gray-500">All occurrences</p>
                                    {/if}
                                </div>
                                <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}

    <div class="bg-white shadow rounded-lg p-3 sm:p-4">
        <div class="flex items-center gap-2">
            <button
                type="button"
                on:click={() => (showRotas = !showRotas)}
                class="flex items-center gap-2 flex-1 min-w-0 text-left group"
                aria-expanded={showRotas}
            >
                <svg
                    class="w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200"
                    class:rotate-180={!showRotas}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
                <h3 class="text-base sm:text-lg font-bold text-gray-900 group-hover:text-gray-700">Rotas</h3>
            </button>
            <a href="/hub/rotas/new?eventId={event.id}" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0">
                Add Rota
            </a>
        </div>
        
        {#if showRotas}
            <div class="mt-3 pt-3 border-t border-gray-200" transition:slide={{ duration: 200 }}>
                <Table columns={rotaColumns} rows={rotas} onRowClick={(row) => goto(`/hub/rotas/${row.id}`)} />
            </div>
        {/if}
    </div>
{/if}

<!-- Create event email: draft or send now -->
{#if showEventEmailModal && createdEmailId}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-email-modal-title"
    >
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 id="event-email-modal-title" class="text-lg font-semibold text-gray-900 mb-3">
                Email created
            </h3>
            <p class="text-sm text-gray-600 mb-6">
                Do you want to save this as a draft in Emails, or do you want to send now?
            </p>
            <div class="flex flex-col sm:flex-row gap-3">
                <button
                    type="button"
                    on:click={() => {
                        showEventEmailModal = false;
                        createdEmailId = null;
                    }}
                    class="flex-1 btn-theme-3 px-4 py-2.5 rounded-md text-sm font-medium"
                >
                    Save as draft
                </button>
                <button
                    type="button"
                    on:click={() => {
                        const id = createdEmailId;
                        showEventEmailModal = false;
                        createdEmailId = null;
                        goto(`/hub/emails/${id}`);
                    }}
                    class="flex-1 btn-theme-2 px-4 py-2.5 rounded-md text-sm font-medium"
                >
                    Send now
                </button>
            </div>
            <button
                type="button"
                on:click={() => { showEventEmailModal = false; createdEmailId = null; }}
                class="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
            >
                Cancel
            </button>
        </div>
    </div>
{/if}

<ImagePicker open={showImagePicker} onSelect={handleImageSelect} on:close={() => (showImagePicker = false)} imagesApiUrl="/hub/api/images" />
