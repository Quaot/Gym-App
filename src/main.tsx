import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app/App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { initStore } from './store/store'
import { attachPersistence, loadInitialState } from './store/persist'
import './styles.css'

// Auto-update is safe now: the session and rest deadline persist through the
// reload (store-backed, written synchronously), so an update never loses state.
registerSW({ immediate: true })

const store = initStore(loadInitialState())
attachPersistence(store)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
