import { Screen } from '../app/Screen'
import { BackButton } from '../app/BackButton'

/**
 * How the app works, in the order you meet it.
 *
 * Written because nothing in a workout tracker is self evident: a grey number
 * could be a suggestion or a leftover, a warm-up could be prescribed or
 * invented, and a rep range could be a target or a rule. Every answer lives
 * here, and every screen links back to it.
 */

interface Entry {
  q: string
  a: string[]
}

const SECTIONS: { title: string; entries: Entry[] }[] = [
  {
    title: 'A workout, start to finish',
    entries: [
      {
        q: 'Starting',
        a: [
          'Today shows the next day in your rotation and a Start button',
          'You can start any other day instead by tapping it in the list below',
          'The day opens with its own warm-up note: some cardio, then the mobility work for that day',
        ],
      },
      {
        q: 'Doing a set',
        a: [
          'One set is open at a time, and it is the one with the wheels under it',
          'Set the weight and the reps, then press Complete set',
          'The row collapses, the next set opens, and the rest timer starts on its own',
          'Tap any collapsed row to go back and change it',
        ],
      },
      {
        q: 'Finishing',
        a: [
          'Finish is in the top right and shows you what the workout came to before you save',
          'Rows you never completed are dropped, so an unfinished set costs you nothing',
          'Cancel, in the top left, throws the whole workout away and asks first',
        ],
      },
    ],
  },
  {
    title: 'The numbers it fills in',
    entries: [
      {
        q: 'Grey numbers are suggestions',
        a: [
          'A grey weight or rep count is what the app would log if you pressed Complete set right now',
          'It is a suggestion, not a record, and it becomes yours the moment you touch the wheel or press the button',
        ],
      },
      {
        q: 'Filling them in',
        a: [
          'Two taps anywhere quiet on an exercise writes every suggestion it has into its sets',
          'Fill all, at the top of the workout, does the same for every exercise at once',
          'The same thing sits in the ⋯ menu of each exercise, which also says where the numbers came from',
          'None of them touch a set you have already logged',
        ],
      },
      {
        q: 'Where a suggestion comes from',
        a: [
          'Your last session on that exact movement, whichever day it appeared on',
          'Hold Why on any working set to read the reasoning in one sentence',
        ],
      },
    ],
  },
  {
    title: 'Warm-up sets',
    entries: [
      {
        q: 'Which lifts get them',
        a: [
          'Only the lift that opens a day, and only when it loads a barbell',
          'That is where a cold first set can hurt you: a squat, a deadlift, a bench or an incline press',
          'Everything later in the day is done on a body that is already warm, so it gets none',
        ],
      },
      {
        q: 'How they are worked out',
        a: [
          'They are percentages of the weight you are about to work with: 50%, 70%, 85% and 90%',
          'Each one is rounded down to something the plates can actually make, and any that lands at or above your working weight is dropped',
          'Change your top set and the whole ramp moves with it',
        ],
      },
      {
        q: 'What they do not affect',
        a: [
          'Warm-ups never count toward your records or your volume',
          'Edit one by hand and the ramp stops following, because then it is yours',
          'Tap the Warm-up pill to turn a row into a working set, or the other way round',
        ],
      },
    ],
  },
  {
    title: 'Getting stronger',
    entries: [
      {
        q: 'The rep range',
        a: [
          'Every exercise shows something like 3 × 8-10: three sets, aiming for eight to ten reps',
          'Hold the weight until every set reaches the top of that range, then the weight goes up',
        ],
      },
      {
        q: 'When the weight goes up',
        a: [
          'The app measures what the smallest jump costs as a share of the load',
          'On a heavy barbell lift that jump is small, so it takes it and expects a rep or two fewer',
          'On a light dumbbell the same jump is a third of the load, so it widens the rep range instead until the jump fits',
        ],
      },
      {
        q: 'When it goes wrong',
        a: [
          'Miss the range and the weight holds rather than climbing anyway',
          'Take a jump that lands short and it reverts to the weight before it',
          'Three sessions stuck and it offers a 10% drop to build back from',
        ],
      },
    ],
  },
  {
    title: 'Everything else',
    entries: [
      {
        q: 'The bar drawing',
        a: [
          'Under a barbell set you see the loaded bar and what to hang on each side',
          'Set your bar weight in Settings if it is not a standard one',
        ],
      },
      {
        q: 'Records',
        a: [
          'A PR badge appears the moment a set beats your best estimated one rep max for that movement',
          'Your first session on a movement is a baseline, not a record',
        ],
      },
      {
        q: 'Rest',
        a: [
          'The timer floats over every screen, survives leaving the app, and counts past zero rather than stopping',
          'Each exercise carries its own rest time, and you can add 30 sec or stop it at any point',
        ],
      },
      {
        q: 'Your data',
        a: [
          'Everything is stored on this device and nothing is uploaded',
          'Export a backup from Settings, and keep it somewhere that is not this phone',
        ],
      },
    ],
  },
]

export const GuideScreen = () => (
  <Screen id="settings/guide" title="How this works" leading={<BackButton />}>
    <p className="t-subhead label-2 guide-intro">
      Everything the app decides for you, and why. Nothing here is a setting,
      so you can read it once and forget it
    </p>

    {SECTIONS.map((section) => (
      <div key={section.title}>
        <div className="section-header">{section.title}</div>
        <div className="group">
          {section.entries.map((entry) => (
            <div className="row-item guide-entry" key={entry.q}>
              <div className="guide-q">{entry.q}</div>
              <ul className="guide-a">
                {entry.a.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ))}
  </Screen>
)
