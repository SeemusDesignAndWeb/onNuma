<script>
	import CrmHtmlEditor from '$lib/crm/components/HtmlEditor.svelte';

	export let value = '';
	export let name = 'body_html';
	export let rows = 14; // retained for API compatibility
	export let blocks = [];
	export let links = [];
	export let previewEndpoint = '/multi-org/marketing/preview'; // retained for compatibility
	export let imageApiEndpoint = '/multi-org/marketing/images';
	$: void rows;
	$: void previewEndpoint;

	const staticPlaceholders = [
		{ value: '{{first_name}}', label: 'First Name' },
		{ value: '{{last_name}}', label: 'Last Name' },
		{ value: '{{full_name}}', label: 'Full Name' },
		{ value: '{{org_name}}', label: 'Organisation Name' },
		{ value: '{{login_url}}', label: 'Login URL' },
		{ value: '{{support_email}}', label: 'Support Email' },
		{ value: '{{support_url}}', label: 'Support URL' },
		{ value: '{{unsubscribe_url}}', label: 'Unsubscribe URL' },
		// Legacy aliases still supported in rendering.
		{ value: '{{firstName}}', label: 'First Name (legacy)' },
		{ value: '{{lastName}}', label: 'Last Name (legacy)' },
		{ value: '{{name}}', label: 'Full Name (legacy)' },
		{ value: '{{email}}', label: 'Email (legacy)' },
		{ value: '{{phone}}', label: 'Phone (legacy)' }
	];

	$: blockPlaceholders = (Array.isArray(blocks) ? blocks : []).map((b) => ({
		value: `{{block:${b?.key || b?.id}}}`,
		label: `Block: ${b?.title || b?.key || b?.id}`
	}));

	$: linkPlaceholders = (Array.isArray(links) ? links : []).map((l) => ({
		value: `{{link:${l?.key}}}`,
		label: `Link: ${l?.name || l?.key}`
	}));

	$: customPlaceholders = [...staticPlaceholders, ...blockPlaceholders, ...linkPlaceholders];
</script>

<CrmHtmlEditor
	bind:value
	{name}
	placeholder="Write your email content..."
	showPlaceholders={true}
	showImagePicker={true}
	{customPlaceholders}
	{imageApiEndpoint}
	showImageManagerLink={false}
/>
