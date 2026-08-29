import { useRoute, switchTab } from '../lib/router'
import { useAppSelector } from '../store/store'
import { IconChart, IconClock, IconCog, IconDumbbell, IconHome } from '../components/icons'
import { RestBar } from './RestBar'
import { Home } from '../screens/Home'
import { SessionScreen } from '../screens/Session'
import { HistoryList, SessionDetail } from '../screens/History'
import { ProgramScreen, DayEditor } from '../screens/Program'
import { ProgressScreen, ExerciseDetail } from '../screens/Progress'
import { SettingsScreen } from '../screens/Settings'

const TABS = [
  { path: '/', label: 'Today', Icon: IconHome },
  { path: '/program', label: 'Program', Icon: IconDumbbell },
  { path: '/progress', label: 'Progress', Icon: IconChart },
  { path: '/history', label: 'History', Icon: IconClock },
  { path: '/settings', label: 'Settings', Icon: IconCog },
] as const

const TabBar = ({ active }: { active: string }) => (
  <nav className="tabbar">
    {TABS.map(({ path, label, Icon }) => (
      <button
        key={path}
        className={active === path ? 'active' : ''}
        onClick={() => switchTab(path)}
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
  const hasActive = useAppSelector((s) => s.activeSessionId !== null)
  const [head, param] = segments

  const screen = (() => {
    switch (head) {
      case undefined:
        return <Home />
      case 'session':
        return hasActive ? <SessionScreen /> : <Home />
      case 'history':
        return param ? <SessionDetail sessionId={param} /> : <HistoryList />
      case 'program':
        return param ? <DayEditor dayId={param} /> : <ProgramScreen />
      case 'progress':
        return param ? <ExerciseDetail exerciseId={param} /> : <ProgressScreen />
      case 'settings':
        return <SettingsScreen />
      default:
        return <Home />
    }
  })()

  return (
    <div className="app">
      {screen}
      <RestBar />
      <TabBar active={`/${head ?? ''}`} />
    </div>
  )
}
