import type { ReactNode } from 'react'

export interface SegOption<T> {
  value: T
  label: ReactNode
  /** Used when the visible label is not enough for a screen reader. */
  ariaLabel?: string
}

/** Segmented control: a radio group where exactly one option is selected. */
export function Seg<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly SegOption<T>[]
  onChange: (value: T) => void
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.ariaLabel}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
