/**
 * Stands in for `virtual:pwa-register` in the native build, where the aliasing
 * happens in `vite.config.ts`.
 *
 * The shell serves the app off its own scheme with the files already on the
 * device, so a service worker has nothing left to cache and no update to
 * fetch; registering one would only add a second, stale copy of the app in
 * front of the real one. This keeps `main` free of a platform check and keeps
 * Workbox out of the native bundle entirely.
 */
export const registerSW = (_options?: unknown) => async (_reloadPage?: boolean) => {}
