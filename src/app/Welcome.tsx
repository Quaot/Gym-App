import { Sheet } from '../components/Sheet'
import { dispatch } from '../store/store'
import { navigate } from '../lib/router'

/**
 * Shown once, on a first launch. Four lines about what the app does with your
 * numbers, because everything else it does follows from those.
 */
export const Welcome = () => {
  const dismiss = () => dispatch({ type: 'setSettings', patch: { seenWelcome: true } })

  return (
    <Sheet title="Read this first" onClose={dismiss}>
      <div className="stack welcome">
        <p>
          You log sets. The app remembers them and works out what you should
          lift next time
        </p>
        <p>
          A grey number is a suggestion, not a record. It becomes yours when
          you touch the wheel or press Complete set
        </p>
        <p>
          Warm-up sets are built for you on the barbell lift that opens a day,
          as percentages of your top set. Nothing else gets them
        </p>
        <p>
          Everything stays on this phone. Back it up from Settings, and keep
          the file somewhere else
        </p>
        <button
          className="btn-filled block"
          onClick={() => {
            dismiss()
          }}
        >
          Start
        </button>
        <button
          className="btn-gray block"
          onClick={() => {
            dismiss()
            navigate('/settings/guide')
          }}
        >
          Show me how it works
        </button>
      </div>
    </Sheet>
  )
}
