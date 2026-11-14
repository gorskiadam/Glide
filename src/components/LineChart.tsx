import { useId } from 'react'

/** A smooth line chart with a soft fill, in the glass style. Purely visual: pass `alt` for screen readers. */
export function LineChart({
  values,
  alt,
  height = 150,
  fromZero = true,
  smooth = false,
}: {
  values: readonly number[]
  alt: string
  height?: number
  /** Start the vertical scale at zero. Turn off for values that stay in a narrow band, like accuracy. */
  fromZero?: boolean
  /** Apply a three-point moving average. */
  smooth?: boolean
}) {
  const id = useId()
  const W = 600
  const H = height
  if (values.length < 2) {
    return (
      <div className="text-muted grid place-items-center text-[13px]" style={{ height }}>
        -
      </div>
    )
  }
  const data = smooth
    ? values.map((_, i) => {
        const part = values.slice(Math.max(0, i - 1), i + 2)
        return part.reduce((a, b) => a + b, 0) / part.length
      })
    : values
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pad = (max - min) * 0.15 || max * 0.1 || 1
  const lo = fromZero ? 0 : Math.max(0, min - pad)
  const hi = max + pad
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 16)
  let line = `M ${x(0)} ${y(data[0] as number)}`
  for (let i = 1; i < data.length; i++) {
    const mid = (x(i - 1) + x(i)) / 2
    line += ` C ${mid} ${y(data[i - 1] as number)}, ${mid} ${y(data[i] as number)}, ${x(i)} ${y(data[i] as number)}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={alt}>
      <defs>
        {/* userSpaceOnUse: a perfectly flat line has no bounding-box height, which would hide a box-relative gradient. */}
        <linearGradient id={`${id}-line`} gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--sky)" />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--line-2)" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke={`url(#${id}-line)`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
