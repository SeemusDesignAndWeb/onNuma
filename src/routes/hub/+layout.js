/**
 * Hub Layout Configuration
 * 
 * The Hub uses a hybrid SSR/SPA approach:
 * - SSR is enabled for fast initial page load and auth checks
 * - After initial load, data is cached in Svelte stores
 * - Subsequent navigation uses client-side routing with cached store data
 * - Pages prefer store data over server data when available
 * 
 * This provides the best of both worlds:
 * - Fast first paint (SSR)
 * - Instant navigation after load (SPA-like)
 */

// Keep SSR enabled for initial load and auth, but pages will use stores when available
export const ssr = true;

// Ensure client-side hydration
export const csr = true;

// Don't prerender Hub pages (they're dynamic/authenticated)
export const prerender = false;
