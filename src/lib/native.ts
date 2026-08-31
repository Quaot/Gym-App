/**
 * Whether the app is running inside its native iOS shell rather than in a
 * browser.
 *
 * The shell injects a `Capacitor` global before any of our code runs, so this
 * is a synchronous question with a synchronous answer, and nothing here has
 * to import the bridge. That matters: the web build stays exactly as light as
 * it was, and every native module is reached through a dynamic import that a
 * browser never evaluates.
 */

type Bridge = { isNativePlatform?: () => boolean }

export const isNative = (): boolean => {
  try {
    return (globalThis as { Capacitor?: Bridge }).Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}
