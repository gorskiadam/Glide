import type { Lang } from '../content'
import { useT, type MessageKey } from '../i18n'
import { FINGER_HUES, OFFSETS, ROWS, THUMB, keyPress } from '../lib/layout'

const U = 44
const GAP = 5
const STEP = U + GAP
const WIDTH = 13 * STEP - GAP

interface Box {
  id: string
  label: string
  x: number
  y: number
  w: number
}

const BOXES: Box[] = [
  ...ROWS.flatMap((row, r) =>
    Array.from(row).map((key, c) => ({ id: key, label: key, x: (OFFSETS[r] as number) * STEP + c * STEP, y: r * STEP, w: U })),
  ),
  { id: 'shift-left', label: 'Shift', x: 0, y: 3 * STEP, w: 1.25 * STEP - GAP },
  { id: 'shift-right', label: 'Shift', x: 11.25 * STEP, y: 3 * STEP, w: WIDTH - 11.25 * STEP },
  { id: ' ', label: '', x: 3.75 * STEP, y: 4 * STEP, w: 6 * STEP - GAP },
  { id: 'alt', label: 'Alt', x: 9.75 * STEP, y: 4 * STEP, w: 1.5 * STEP - GAP },
]

/** A keyboard that lights up the next key to press and names the finger for it. */
export function KeyGuide({ char, lang }: { char: string | undefined; lang: Lang }) {
  const t = useT()
  const press = char === undefined ? null : keyPress(char)
  // Shift is held by the hand that does not press the key.
  const shiftSide = press?.shift ? (press.finger <= 3 ? 'right' : 'left') : null
  const lit = new Set<string>()
  if (press) {
    lit.add(press.key)
    if (shiftSide) lit.add(`shift-${shiftSide}`)
    if (press.alt) lit.add('alt')
  }
  const hue = press ? (press.finger === THUMB ? 265 : (FINGER_HUES[press.finger] as number)) : 265

  const parts: string[] = []
  if (press && char !== undefined) {
    parts.push(t(`finger.${press.finger}` as MessageKey))
    if (shiftSide) parts.push(t(`guide.shift.${shiftSide}`))
    if (press.alt) parts.push(t('guide.alt'))
  }
  const name = char === ' ' ? t('heat.space') : (char ?? '')

  return (
    <div className="border-line bg-card/60 mt-4 rounded-2xl border p-3 sm:p-4">
      <p className="m-0 mb-2.5 flex min-h-[26px] flex-wrap items-center gap-2 text-[13.5px]">
        <span className="label">{t('guide.next')}</span>
        {press && (
          <>
            <span className="pill accent font-type">{name}</span>
            <span className="text-fg-2 font-semibold">{parts.join(', ')}</span>
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${5 * STEP - GAP}`} className="mx-auto block w-full max-w-[560px]" aria-hidden="true">
        {BOXES.map((b) => {
          const on = lit.has(b.id)
          return (
            <g key={b.id}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={U}
                rx="10"
                fill={on ? `hsl(${hue} 80% 55% / 0.55)` : 'var(--surface)'}
                stroke={on ? `hsl(${hue} 75% 45%)` : 'var(--line-2)'}
                strokeWidth={on ? 2.2 : 1.2}
              />
              <text
                x={b.x + b.w / 2}
                y={b.y + U / 2 + (b.label.length > 1 ? 4.5 : 6)}
                textAnchor="middle"
                fontSize={b.label.length > 1 ? 12 : 17}
                fontWeight="600"
                fill={on ? 'var(--fg)' : 'var(--muted)'}
                style={{ fontFamily: 'var(--font-type)' }}
              >
                {b.label.toLocaleUpperCase(lang)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
