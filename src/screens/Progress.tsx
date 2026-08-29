import { useMemo, useState } from 'react'
import { useAppSelector, dispatch } from '../store/store'
import { navigate, back } from '../lib/router'
import { Bars, CalendarHeatmap, LineChart, Scatter } from '../components/charts'
import { IconBack, IconMoon } from '../components/icons'
import {
  calendarDays, exercisesByRecency, exerciseTrend, memoized, weeklyBuckets,
} from '../lib/analytics'
import { sleepCorrelation } from '../lib/correlation'
import { sleepByNight } from '../lib/sleep'
import { finishedSessions, personalBest, est1RM, sessionVolume } from '../lib/history'
import { fmtDate, fmtWeight, uid } from '../lib/util'
import { fmtDuration } from '../lib/util'
import { sessionTimeSplit } from '../lib/timing'
import { TapeInput } from '../components/TapeInput'

const RANGES = [
  { label: 'M', days: 31 },
  { label: '6M', days: 183 },
  { label: 'Y', days: 366 },
  { label: 'All', days: Infinity },
] as const

/* ------------------------------------------------------------------ *
 *  Quick nightly sleep log
 * ------------------------------------------------------------------ */
const SleepQuickLog = () => {
  const sleep = useAppSelector((s) => s.sleep)
  const tickSound = useAppSelector((s) => s.settings.tickSound)
  const today = new Date()
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const tonight = sleepByNight(sleep).get(key) ?? null

  const recent = sleep.slice(-7)
  const avg = recent.length > 0
    ? recent.reduce((a, e) => a + e.asleepMin, 0) / recent.length
    : 7.5 * 60

  return (
    <div className="group sleep-quick">
      <div className="row" style={{ marginBottom: 2 }}>
        <IconMoon />
        <span style={{ fontWeight: 700 }}>Last night</span>
        <span className="spacer" />
        {tonight && <span className="pill sleep num">{(tonight.asleepMin / 60).toFixed(1)}h logged</span>}
      </div>
      <TapeInput
        label="Hours"
        value={tonight ? tonight.asleepMin / 60 : null}
        ghost={Math.round((avg / 60) * 4) / 4}
        min={0}
        max={14}
        step={0.25}
        majorEvery={4}
        decimal
        tickSound={tickSound}
        format={(v) => v.toFixed(2).replace(/\.?0+$/, '')}
        onCommit={(hours) =>
          dispatch({
            type: 'upsertSleep',
            entries: [{
              id: uid(), night: key,
              asleepMin: Math.round(hours * 60), inBedMin: null, source: 'manual',
            }],
          })
        }
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Overview
 * ------------------------------------------------------------------ */
export const ProgressScreen = () => {
  const sessions = useAppSelector((s) => s.sessions)
  const sleep = useAppSelector((s) => s.sleep)
  const state = useAppSelector((s) => s)
  const unit = useAppSelector((s) => s.settings.unit)
  const [monthShift, setMonthShift] = useState(0)

  const now = Date.now()
  const finished = finishedSessions(sessions)

  const monthTs = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + monthShift)
    return d.getTime()
  }, [monthShift])

  const weekly = useMemo(
    () => memoized(sessions, `weekly`, () => weeklyBuckets(sessions, 12, now)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions],
  )
  const month = useMemo(
    () => memoized(sessions, `cal:${monthShift}`, () => calendarDays(sessions, monthTs)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, monthTs],
  )
  const exercises = useMemo(
    () => memoized(sessions, 'byRecency', () => exercisesByRecency(state)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, state.catalog],
  )
  const correlation = useMemo(
    () => sleepCorrelation(sessions, sleep),
    [sessions, sleep],
  )

  // This month's headline stats.
  const monthStart = new Date(monthTs)
  const monthSessions = finished.filter((s) => {
    const d = new Date(s.finishedAt ?? s.startedAt)
    return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth()
  })
  const totalMs = monthSessions.reduce((a, s) => a + sessionTimeSplit(s).totalMs, 0)
  const monthName = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <>
      <header className="topbar">
        <h1>
          Progress
          <span className="sub">{finished.length} workouts on record</span>
        </h1>
      </header>

      <main className="main">
        <SleepQuickLog />

        <div className="section-header">Weekly volume ({unit})</div>
        <div className="group chart-card">
          <Bars
            values={weekly.map((b) => Math.round(b.volume))}
            labels={weekly.map((b, i) =>
              i % 3 === 0 ? new Date(b.weekStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '',
            )}
            format={(v) => v.toLocaleString()}
          />
        </div>

        <div className="section-header">Calendar</div>
        <div className="group chart-card">
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="btn-plain" aria-label="Previous month" onClick={() => setMonthShift((m) => m - 1)}>‹</button>
            <span className="chart-title" style={{ margin: 0, flex: 1, textAlign: 'center' }}>{monthName}</span>
            <button className="btn-plain" aria-label="Next month" disabled={monthShift >= 0}
              onClick={() => setMonthShift((m) => Math.min(0, m + 1))}>›</button>
          </div>
          <CalendarHeatmap days={month} monthTs={monthTs} />
          <div className="stat-row" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="label">Workouts</div>
              <div className="value num">{monthSessions.length}</div>
            </div>
            <div className="stat">
              <div className="label">Gym time</div>
              <div className="value num">{fmtDuration(totalMs)}</div>
            </div>
            <div className="stat">
              <div className="label">Volume</div>
              <div className="value num">
                {(monthSessions.reduce((a, s) => a + sessionVolume(s), 0) / 1000).toFixed(1)}k
                <span className="unit">{unit}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-header">Sleep × performance</div>
        <div className="group chart-card">
          {correlation.points.length >= 5 ? (
            <>
              <Scatter
                points={correlation.points.map((p) => ({
                  x: p.sleepMin / 60,
                  y: (p.performance - 1) * 100,
                  label: `${p.dayName}, ${fmtDate(p.t)}`,
                }))}
                fit={{ a: (correlation.fit.a + correlation.fit.b * 0 - 1) * 100, b: correlation.fit.b * 60 * 100 }}
                formatX={(v) => `${v.toFixed(1)}h`}
                formatY={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                xLabel="Sleep the night before (hours)"
                yLabel="vs your typical"
              />
              <CorrelationSummaryLine r={correlation.r} buckets={correlation.buckets} />
            </>
          ) : (
            <p className="t-footnote label-2" style={{ margin: '4px 4px 8px' }}>
              Log five nights before a workout to see the pattern.
            </p>
          )}
        </div>

        <div className="section-header">Exercises</div>
        {exercises.length === 0 && <div className="empty">Nothing logged yet.</div>}
        {exercises.map((e) => {
          const pb = personalBest(state, e.id)
          const bodyweight = state.catalog[e.id]?.bodyweight ?? false
          return (
            <button key={e.id} className="row-item" onClick={() => navigate(`/progress/${e.id}`)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 650 }}>{e.name}</div>
                <div className="t-footnote label-2 num">
                  last {fmtDate(e.lastAt)}
                  {pb && (bodyweight
                    ? ` · best ${pb.reps} reps`
                    : ` · best ${fmtWeight(pb.weight)}×${pb.reps} (≈${fmtWeight(Math.round(est1RM(pb, false) * 10) / 10)} ${unit})`)}
                </div>
              </div>
              <span className="chevron">›</span>
            </button>
          )
        })}
      </main>
    </>
  )
}

const CorrelationSummaryLine = ({ r, buckets }: {
  r: number
  buckets: { label: string; sessions: number; meanDelta: number | null }[]
}) => {
  const best = buckets.filter((b) => b.meanDelta !== null && b.sessions >= 2)
    .sort((a, b) => (b.meanDelta ?? 0) - (a.meanDelta ?? 0))[0]
  return (
    <div className="t-footnote label-2" style={{ margin: '6px 4px 2px' }}>
      <span className="num" style={{ fontWeight: 700, color: 'var(--text)' }}>r = {r.toFixed(2)}</span>
      {best && best.meanDelta !== null && best.meanDelta > 0.005 && (
        <> · after {best.label} of sleep you lift{' '}
          <b style={{ color: 'var(--accent)' }}>+{(best.meanDelta * 100).toFixed(1)}%</b> vs typical</>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 *  Per-exercise detail
 * ------------------------------------------------------------------ */
export const ExerciseDetail = ({ exerciseId }: { exerciseId: string }) => {
  const state = useAppSelector((s) => s)
  const unit = state.settings.unit
  const exercise = state.catalog[exerciseId]
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[3])

  const trend = useMemo(
    () => memoized(state.sessions, `trend:${exerciseId}`, () => exerciseTrend(state, exerciseId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.sessions, exerciseId],
  )

  const cutoff = Date.now() - range.days * 86400000
  const shown = trend.filter((p) => p.t >= cutoff)
  const bodyweight = exercise?.bodyweight ?? false
  const pb = personalBest(state, exerciseId)

  return (
    <>
      <header className="topbar">
        <button className="btn-plain" aria-label="Back" onClick={back}><IconBack /></button>
        <h1>
          {exercise?.name ?? 'Exercise'}
          <span className="sub">{trend.length} sessions logged</span>
        </h1>
      </header>

      <main className="main">
        <div className="seg" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.label} className={r.label === range.label ? 'on' : ''}
              role="tab" aria-selected={r.label === range.label}
              onClick={() => setRange(r)}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="group chart-card">
          <div className="chart-title">
            {bodyweight ? 'Best set (reps)' : `Estimated 1RM (${unit})`}
          </div>
          <LineChart
            points={shown.map((p) => ({
              t: p.t,
              value: p.score,
              emphasis: p.isPR,
              label: p.weight !== null ? `${fmtWeight(p.weight)}×${p.reps}` : `${p.reps} reps`,
            }))}
            format={(v) => (bodyweight ? `${Math.round(v)}` : fmtWeight(Math.round(v * 10) / 10))}
          />
        </div>

        {pb && (
          <div className="stat-row">
            <div className="stat">
              <div className="label">Best set</div>
              <div className="value num">
                {bodyweight ? `${pb.reps} reps` : `${fmtWeight(pb.weight)}×${pb.reps}`}
              </div>
            </div>
            {!bodyweight && (
              <div className="stat">
                <div className="label">Est. 1RM</div>
                <div className="value num">
                  {fmtWeight(Math.round(est1RM(pb, false) * 10) / 10)}
                  <span className="unit">{unit}</span>
                </div>
              </div>
            )}
            <div className="stat">
              <div className="label">PRs set</div>
              <div className="value num">{trend.filter((p) => p.isPR).length}</div>
            </div>
          </div>
        )}

        <div className="section-header">Every session</div>
        {shown.slice().reverse().map((p, i) => (
          <div key={i} className="row-item">
            <span className="t-subhead" style={{ fontWeight: 650 }}>{fmtDate(p.t)}</span>
            {p.isPR && <span className="pill accent">PR</span>}
            <span className="spacer" />
            <span className="t-subhead num">
              {p.weight !== null ? `${fmtWeight(p.weight)} ${unit} × ${p.reps}` : `${p.reps} reps`}
              <span className="label-3"> · {bodyweight ? p.score : `≈${fmtWeight(p.score)}`}</span>
            </span>
          </div>
        ))}
      </main>
    </>
  )
}
