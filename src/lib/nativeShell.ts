/**
 * Everything the app has to say to iOS at startup, and nothing it says to a
 * browser.
 *
 * Called once from `main`, behind `isNative`, so a browser never loads a line
 * of it. Each step is independent and best effort: the shell coming up with a
 * light status bar is a blemish, not a reason to fail to start.
 */

import { getStore } from '../store/store'
import { persistAll } from '../store/persist'
import { refreshNotificationPermission } from './notify'

export const startNativeShell = (): void => {
  // The bars and the tab capsule already lay themselves out around the safe
  // area, so the web view is told to take the whole screen and the status bar
  // is told to draw light on the app's black.
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) =>
      Promise.all([
        StatusBar.setOverlaysWebView({ overlay: true }),
        StatusBar.setStyle({ style: Style.Dark }),
      ]),
    )
    .catch(() => undefined)

  // iOS freezes JavaScript on the way out and can kill the app while it is
  // away without running another line, so the last write has to happen on the
  // way down. `visibilitychange` covers this too; going twice costs one
  // synchronous write and covers the case where it does not fire.
  void import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) persistAll(getStore().getState())
      }),
    )
    .catch(() => undefined)

  // Permission can be revoked in Settings while the app is closed, and the
  // rest alert asks about it synchronously when a timer starts.
  void refreshNotificationPermission()
}
