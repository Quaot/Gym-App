import { Sheet } from './Sheet'
import { howToFor } from '../lib/howTo'
import type { SessionExercise } from '../types'

/**
 * What this movement is and how to do it, one tap from the workout. The four
 * things a person actually needs before their first set, and nothing else.
 */
export const HowToSheet = ({
  exercise, onClose,
}: { exercise: SessionExercise; onClose: () => void }) => {
  const how = howToFor(exercise.exerciseId)

  return (
    <Sheet title={exercise.name} onClose={onClose}>
      {how ? (
        <div className="howto">
          <div className="howto-part">
            <div className="howto-label">Set up</div>
            <p>{how.setup}</p>
          </div>
          <div className="howto-part">
            <div className="howto-label">The rep</div>
            <p>{how.execution}</p>
          </div>
          <div className="howto-part warn">
            <div className="howto-label">Do not</div>
            <p>{how.mistake}</p>
          </div>
          <div className="howto-part">
            <div className="howto-label">Why it is here</div>
            <p>{how.why}</p>
          </div>
          {exercise.notes && (
            <div className="howto-part">
              <div className="howto-label">On this day</div>
              <p>{exercise.notes}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="t-subhead label-2">
          You added this one yourself, so there is nothing written about it
          {exercise.notes ? `. Your note says: ${exercise.notes}` : ''}
        </p>
      )}
    </Sheet>
  )
}
