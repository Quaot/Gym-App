import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { initStore } from './store/store'
import { attachPersistence, loadInitialState } from './store/persist'
import { isNative } from './lib/native'
import './styles.css'

// Auto-update is safe now: the session and rest deadline persist through the
// reload (store-backed, written synchronously), so an update never loses state.
// In the native build this call is a no-op: `virtual:pwa-register` is aliased
// to a stub, since the shell already ships the files.
registerSW({ immediate: true })

const store = initStore(loadInitialState())
attachPersistence(store)

// The status bar, the flush on the way to the background, and the notification
// permission: things only iOS has an opinion about.
if (isNative()) void import('./lib/nativeShell').then((m) => m.startNativeShell())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
