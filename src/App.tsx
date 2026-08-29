import { useRoute, navigate } from './lib/router'
import { useStore } from './store'
import { IconClock, IconCog, IconDumbbell, IconHome } from './components/icons'
import { Home } from './screens/Home'
import { SessionScreen } from './screens/SessionScreen'
import { HistoryList, SessionDetail } from './screens/History'
import { ProgramScreen, DayEditor } from './screens/Program'
import { SettingsScreen } from './screens/Settings'

const TABS = [
  { path: '/', label: 'Today', Icon: IconHome },
  { path: '/program', label: 'Program', Icon: IconDumbbell },
  { path: '/history', label: 'History', Icon: IconClock },
  { path: '/settings', label: 'Settings', Icon: IconCog },
] as const

const TabBar = ({ active }: { active: string }) => (
  <nav className="tabbar">
    {TABS.map(({ path, label, Icon }) => (
      <button
        key={path}
        className={active === path ? 'active' : ''}
        onClick={() => navigate(path)}
        aria-current={active === path ? 'page' : undefined}
      >
        <Icon />
        {label}
      </button>
    ))}
  </nav>
)

export const App = () => {
  const segments = useRoute()
  const { activeSession } = useStore()
  const [head, param] = segments

  const screen = (() => {
    switch (head) {
      case undefined:
        return <Home />
      case 'session':
        return activeSession ? <SessionScreen session={activeSession} /> : <Home />
      case 'history':
        return param ? <SessionDetail sessionId={param} /> : <HistoryList />
      case 'program':
        return param ? <DayEditor dayId={param} /> : <ProgramScreen />
      case 'settings':
        return <SettingsScreen />
      default:
        return <Home />
    }
  })()

  return (
    <div className="app">
      {screen}
      <TabBar active={`/${head ?? ''}`} />
    </div>
  )
}
