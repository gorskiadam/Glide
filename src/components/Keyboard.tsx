import { useMemo, useState } from 'react'
import type { Lang } from '../content'
import { formatNumber, useT } from '../i18n'
import { avgMs, errorRate, overallMs, type Agg, type TypingStats } from '../lib/keystats'
import { FINGERS, FINGER_HUES, OFFSETS, POLISH, ROWS, SHIFTED } from '../lib/layout'
import type { Recording } from '../lib/replay'
import { useStore } from '../store'
import { Replay } from './Replay'
import { Seg } from './Seg'

type View = 'replay' | 'speed' | 'accuracy' | 'fingers'

const U = 44
const GAP = 5
const STEP = U + GAP

function sum(stats: TypingStats, chars: string[]): Agg {
  const out: Agg = { n: 0, err: 0, ms: 0, timed: 0 }
  for (const c of chars) {
    const a = stats.keys[c]
    if (!a) continue
    out.n += a.n
    out.err += a.err
    out.ms += a.ms
    out.timed += a.timed
  }
  return out
}

/** Green (150) for good through amber to red (0) for bad; `t` runs from 0 (good) to 1 (bad). */
const heat = (t: number) => 150 - 150 * Math.max(0, Math.min(1, t))

interface KeyBox {
  label: string
  x: number
  y: number
  w: number
  agg: Agg
  finger: number | null
}

/** An on-screen keyboard coloured by how fast and how accurately each key is typed. */
interface Props {
  stats: TypingStats
  lang: Lang
  /** A finished run to play back. Adds the Replay view and opens on it. */
  replay?: Recording
}

export function Keyboard({ stats, lang, replay }: Props) {
  const t = useT()
  const uiLang = useStore((s) => s.settings.uiLang)
  const [view, setView] = useState<View>(replay ? 'replay' : 'speed')

  const keys = useMemo(() => {
    const out: KeyBox[] = []
    ROWS.forEach((row, r) => {
      Array.from(row).forEach((key, c) => {
        const chars = [key, ...Object.keys(SHIFTED).filter((s) => SHIFTED[s] === key)]
        out.push({ label: key, x: (OFFSETS[r] as number) * STEP + c * STEP, y: r * STEP, w: U, agg: sum(stats, chars), finger: Number((FINGERS[r] as string)[c]) })
      })
    })
    out.push({ label: ' ', x: 3.75 * STEP, y: 4 * STEP, w: 6 * STEP - GAP, agg: sum(stats, [' ']), finger: null })
    if (lang === 'pl') {
      // Polish letters are typed with AltGr, so they get their own row.
      Array.from(POLISH).forEach((key, c) => {
        out.push({ label: key, x: 2 * STEP + c * STEP, y: 5 * STEP + 6, w: U, agg: sum(stats, [key]), finger: null })
      })
    }
    return out
  }, [stats, lang])

  const base = overallMs(stats.keys)
  const width = 13 * STEP - GAP
  const height = (lang === 'pl' ? 6 : 5) * STEP - GAP + (lang === 'pl' ? 6 : 0)

  const colour = (k: KeyBox): { fill: string; stroke: string } => {
    const tint = (hue: number) => ({ fill: `hsl(${hue} 78% 50% / 0.3)`, stroke: `hsl(${hue} 70% 45% / 0.65)` })
    const none = { fill: 'var(--surface)', stroke: 'var(--line-2)' }
    if (view === 'fingers') return k.finger === null ? none : tint(FINGER_HUES[k.finger] as number)
    if (k.agg.n === 0) return none
    if (view === 'accuracy') return tint(heat(errorRate(k.agg) / 0.15))
    const ms = avgMs(k.agg)
    if (ms === null || base === null || base <= 0) return none
    // 25% faster than average is fully green, 65% slower is fully red.
    return tint(heat((ms / base - 0.75) / 0.9))
  }

  const describe = (k: KeyBox) => {
    const name = k.label === ' ' ? t('heat.space') : k.label.toLocaleUpperCase(lang)
    const ms = avgMs(k.agg)
    if (k.agg.n === 0) return t('heat.key.none', { key: name })
    return t('heat.key', {
      key: name,
      ms: ms === null ? '-' : formatNumber(uiLang, ms),
      acc: formatNumber(uiLang, (1 - errorRate(k.agg)) * 100),
      n: formatNumber(uiLang, k.agg.n),
    })
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Seg<View>
          label={t('heat.view')}
          value={view}
          onChange={setView}
          options={[
            ...(replay ? [{ value: 'replay' as View, label: t('heat.replay') }] : []),
            { value: 'speed', label: t('heat.speed') },
            { value: 'accuracy', label: t('heat.accuracy') },
            { value: 'fingers', label: t('heat.fingers') },
          ]}
        />
        {view === 'replay' ? null : view === 'fingers' ? (
          <span className="text-muted text-[12.5px]">{t('heat.fingers.help')}</span>
        ) : (
          <span className="text-muted flex items-center gap-2 text-[12.5px]">
            {t(view === 'speed' ? 'heat.legend.fast' : 'heat.legend.clean')}
            <span className="heat-scale" aria-hidden="true" />
            {t(view === 'speed' ? 'heat.legend.slow' : 'heat.legend.errors')}
          </span>
        )}
      </div>
      {view === 'replay' && replay ? (
        <Replay recording={replay} lang={lang} />
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block w-full max-w-[640px]" role="img" aria-label={t('heat.title')}>
          {keys.map((k) => {
            const c = colour(k)
            return (
              <g key={`${k.label}-${k.y}`}>
                <title>{describe(k)}</title>
                <rect x={k.x} y={k.y} width={k.w} height={U} rx="10" fill={c.fill} stroke={c.stroke} strokeWidth="1.2" />
                <rect x={k.x + 1} y={k.y + 1} width={k.w - 2} height={U / 2} rx="9" fill="var(--glass-hi)" opacity="0.35" />
                <text x={k.x + k.w / 2} y={k.y + U / 2 + 6} textAnchor="middle" fontSize="17" fontWeight="600" fill="var(--fg)" style={{ fontFamily: 'var(--font-type)' }}>
                  {k.label === ' ' ? '' : k.label.toLocaleUpperCase(lang)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
