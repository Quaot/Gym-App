import { useEffect, useState } from 'react'

interface Props {
  value: number | null
  onChange: (v: number | null) => void
  step?: number
  min?: number
  placeholder?: string
  ariaLabel: string
  decimal?: boolean
}

/**
 * Numeric entry with big +/- buttons. Keeps its own text state while focused so
 * typing "6." or clearing the box doesn't fight the parent's value.
 */
export const NumberField = ({
  value, onChange, step = 1, min = 0, placeholder, ariaLabel, decimal = false,
}: Props) => {
  const [text, setText] = useState(value === null ? '' : String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(value === null ? '' : String(value))
  }, [value, editing])

  const commit = (raw: string) => {
    const trimmed = raw.trim().replace(',', '.')
    if (trimmed === '') return onChange(null)
    const n = parseFloat(trimmed)
    if (!Number.isNaN(n)) onChange(Math.max(min, n))
  }

  const bump = (delta: number) => {
    const base = value ?? 0
    const next = Math.max(min, Math.round((base + delta) * 100) / 100)
    setText(String(next))
    onChange(next)
  }

  return (
    <div className="numfield">
      <button type="button" aria-label={`Decrease ${ariaLabel}`} onClick={() => bump(-step)}>−</button>
      <input
        inputMode={decimal ? 'decimal' : 'numeric'}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onFocus={(e) => { setEditing(true); e.currentTarget.select() }}
        onChange={(e) => { setText(e.target.value); commit(e.target.value) }}
        onBlur={(e) => { setEditing(false); commit(e.target.value) }}
      />
      <button type="button" aria-label={`Increase ${ariaLabel}`} onClick={() => bump(step)}>+</button>
    </div>
  )
}
