import { writable } from 'svelte/store';

// Notification types: 'success', 'error', 'warning', 'info'
function createNotificationStore() {
	const { subscribe, set, update } = writable([]);

	let nextId = 0;
	const store = {
		subscribe,
		show: (message, type = 'info', duration = 5000) => {
			const id = `${Date.now()}-${++nextId}`;
			const messageStr = typeof message === 'string' ? message : String(message ?? '');
			const notification = { id, message: messageStr, type, duration };
			
			update(notifications => [...notifications, notification]);
			
			// Auto-remove after duration
			if (duration > 0) {
				setTimeout(() => {
					update(notifications => notifications.filter(n => n.id !== id));
				}, duration);
			}
			
			return id;
		},
		remove: (id) => {
			update(notifications => notifications.filter(n => n.id !== id));
		},
		clear: () => set([])
	};

	// Add convenience methods
	store.success = (message, duration) => store.show(message, 'success', duration || 5000);
	store.error = (message, duration) => store.show(message, 'error', duration || 7000);
	store.warning = (message, duration) => store.show(message, 'warning', duration || 6000);
	store.info = (message, duration) => store.show(message, 'info', duration || 5000);

	return store;
}

export const notifications = createNotificationStore();

// Dialog/Confirm store
function createDialogStore() {
	const { subscribe, set } = writable(null);

	return {
		subscribe,
		confirm: (message, title = 'Confirm', options = {}) => {
			return new Promise((resolve) => {
				set({
					type: 'confirm',
					title,
					message,
					confirmText: options.confirmText || 'OK',
					cancelText: options.cancelText || 'Cancel',
					resolve
				});
			});
		},
		alert: (message, title = 'Alert', options = {}) => {
			return new Promise((resolve) => {
				set({
					type: 'alert',
					title,
					message,
					buttonText: options.buttonText || 'OK',
					resolve
				});
			});
		},
		close: () => set(null)
	};
}

export const dialog = createDialogStore();

