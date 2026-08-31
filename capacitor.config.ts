import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The native shell. Capacitor insists on finding this at the project root,
 * but everything it generates lives under `native/`: the Xcode project in
 * `native/ios`, and the web build it wraps in `native/www`.
 */
const config: CapacitorConfig = {
  appId: 'com.gymapp.gym',
  appName: 'Gym',
  webDir: 'native/www',
  ios: {
    path: 'native/ios',
    // The bars, the tab capsule and the sheets all lay themselves out around
    // `env(safe-area-inset-*)`, so the web view is given the whole screen and
    // left to do it.
    contentInset: 'never',
    backgroundColor: '#000000',
  },
  backgroundColor: '#000000',
}

export default config
