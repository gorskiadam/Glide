import { useId } from 'react'

/**
 * The Flow waveform: typing rhythm drawn as a soft, mirrored wave. An even rhythm
 * gives a band of even height; bursts and pauses make it swell and pinch.
 */
export function FlowWave({ values, alt, height = 110 }: { values: readonly number[]; alt: string; height?: number }) {
  const id = useId()
  const W = 600
  const H = height
  const mid = H / 2
  if (values.length < 2) {
    return (
      <div className="text-muted grid place-items-center text-[13px]" style={{ height }}>
        -
      </div>
    )
  }
  const x = (i: number) => (i / (values.length - 1)) * W

  /** A closed, mirrored shape whose half-height at each point is value x scale. */
  const shape = (scale: number) => {
    const amp = (v: number) => Math.max(1.5, v * scale * (mid - 4))
    let top = `M 0 ${mid - amp(values[0] as number)}`
    for (let i = 1; i < values.length; i++) {
      const cx = (x(i - 1) + x(i)) / 2
      top += ` C ${cx} ${mid - amp(values[i - 1] as number)}, ${cx} ${mid - amp(values[i] as number)}, ${x(i)} ${mid - amp(values[i] as number)}`
    }
    let bottom = ` L ${W} ${mid + amp(values[values.length - 1] as number)}`
    for (let i = values.length - 2; i >= 0; i--) {
      const cx = (x(i + 1) + x(i)) / 2
      bottom += ` C ${cx} ${mid + amp(values[i + 1] as number)}, ${cx} ${mid + amp(values[i] as number)}, ${x(i)} ${mid + amp(values[i] as number)}`
    }
    return `${top}${bottom} Z`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label={alt}>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1="0" x2={W} y1="0" y2="0">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.55" stopColor="var(--sky)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Three layers, widest and faintest first, give the wave its glassy depth. */}
      <path d={shape(1)} fill={`url(#${id}-g)`} opacity="0.2" />
      <path d={shape(0.72)} fill={`url(#${id}-g)`} opacity="0.4" />
      <path d={shape(0.42)} fill={`url(#${id}-g)`} opacity="0.9" />
      <path d={shape(0.42)} fill={`url(#${id}-shine)`} />
    </svg>
  )
}
