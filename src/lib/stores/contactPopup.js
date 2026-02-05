import { writable } from 'svelte/store';

/** Global store: set to true to open the contact form popup (e.g. from Navbar or landing CTA). */
export const contactPopupOpen = writable(false);
