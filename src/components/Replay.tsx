import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Lang } from '../content'
import type { LogEvent } from '../engine/engine'
import { formatNumber, useT, type MessageKey } from '../i18n'
import { OFFSETS, ROWS, keyPress } from '../lib/layout'
import { analyse, gaps, playTimes, typedAt, type Recording } from '../lib/replay'
import { useStore } from '../store'
import { Icon } from './Icon'
import { Seg } from './Seg'

const U = 44
const GAP = 5
const STEP = U + GAP
const WIDTH = 15 * STEP - GAP

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
  { id: 'back', label: '⌫', x: 13 * STEP, y: 0, w: 2 * STEP - GAP },
  { id: 'shift-left', label: 'Shift', x: 0, y: 3 * STEP, w: 1.25 * STEP - GAP },
  { id: 'shift-right', label: 'Shift', x: 11.25 * STEP, y: 3 * STEP, w: WIDTH - 11.25 * STEP },
  { id: ' ', label: '', x: 3.75 * STEP, y: 4 * STEP, w: 6 * STEP - GAP },
  { id: 'alt', label: 'Alt', x: 9.75 * STEP, y: 4 * STEP, w: 1.5 * STEP - GAP },
]

type Tone = 'ok' | 'slow' | 'bad' | 'want' | 'back'
const TONE: Record<Tone, { fill: string; stroke: string }> = {
  ok: { fill: 'hsl(150 70% 45% / 0.5)', stroke: 'hsl(150 70% 38%)' },
  slow: { fill: 'hsl(40 95% 52% / 0.55)', stroke: 'hsl(36 90% 42%)' },
  bad: { fill: 'hsl(0 80% 58% / 0.6)', stroke: 'hsl(0 75% 48%)' },
  want: { fill: 'transparent', stroke: 'var(--accent)' },
  back: { fill: 'color-mix(in srgb, var(--accent) 35%, transparent)', stroke: 'var(--accent)' },
}

/** Which keys a character lights up: its key, plus Shift or right Alt when it needs one. */
function keysFor(char: string): string[] {
  const press = keyPress(char)
  if (!press) return []
  const out = [press.key]
  if (press.shift) out.push(press.finger <= 3 ? 'shift-right' : 'shift-left')
  if (press.alt) out.push('alt')
  return out
}

const SPEEDS = [1, 2, 4] as const
/** Characters of the text shown on each side of the caret. */
const WINDOW = 22

/**
 * Plays a finished run back on a keyboard, key by key and in the typist's own
 * rhythm, and lists what the run shows is worth working on.
 */
export function Replay({ recording, lang }: { recording: Recording; lang: Lang }) {
  const t = useT()
  const uiLang = useStore((s) => s.settings.uiLang)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const { log, target } = recording
  const total = log.length

  const times = useMemo(() => playTimes(log), [log])
  const gap = useMemo(() => gaps(log), [log])
  const found = useMemo(() => analyse(recording, lang), [recording, lang])
  /** A key counts as a hesitation when it took over twice the usual time (and at least 350 ms). */
  const slowAt = Math.max(350, found.meanGap * 2)

  const [count, setCount] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const clock = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const speedRef = useRef(speed)
  speedRef.current = speed

  const seek = useCallback(
    (to: number, play: boolean) => {
      const next = Math.max(0, Math.min(total, to))
      // The clock sits just before the next event, so playing resumes without a jump.
      clock.current = next === 0 ? -350 : (times[next - 1] as number)
      setCount(next)
      setPlaying(play && next < total)
    },
    [times, total],
  )

  // The playback clock: advances with real time, scaled by the chosen speed.
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      clock.current += (now - last) * speedRef.current
      last = now
      let next = 0
      while (next < total && (times[next] as number) <= clock.current) next++
      setCount((old) => (old === next ? old : next))
      if (next >= total) setPlaying(false)
      else frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, times, total])

  // Start by itself the first time the replay scrolls into view, unless motion is reduced.
  useEffect(() => {
    const root = rootRef.current
    if (!root || total === 0 || reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        observer.disconnect()
        seek(0, true)
      },
      { threshold: 0.6 },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [recording, total, reduceMotion, seek])

  const event: LogEvent | undefined = count > 0 ? log[count - 1] : undefined
  const screen = useMemo(() => typedAt(log, count), [log, count])
  const slow = !!event && event.kind === 'key' && event.ok && count > 1 && (gap[count - 1] as number) >= slowAt

  // Which keys are lit for the current event.
  const lit = new Map<string, Tone>()
  if (event?.kind === 'back') lit.set('back', 'back')
  else if (event) {
    if (!event.ok) for (const k of keysFor(event.expected)) lit.set(k, 'want')
    for (const k of keysFor(event.typed)) lit.set(k, event.ok ? (slow ? 'slow' : 'ok') : 'bad')
  }

  const name = (char: string) => (char === ' ' ? t('heat.space') : char)
  const n = (value: number, digits = 0) => formatNumber(uiLang, value, digits)
  let caption = t(count >= total && total > 0 ? 'replay.cap.end' : 'replay.cap.start')
  let captionTone: Tone | null = null
  if (event && count < total) {
    if (event.kind === 'back') caption = t('replay.cap.back')
    else if (!event.ok) caption = t('replay.cap.wrong', { typed: name(event.typed), expected: name(event.expected) })
    else if (slow) caption = t('replay.cap.slow', { key: name(event.typed), ms: n(gap[count - 1] as number) })
    else caption = t('replay.cap.ok', { key: name(event.typed) })
    captionTone = event.kind === 'back' ? 'back' : !event.ok ? 'bad' : slow ? 'slow' : 'ok'
  }

  // The text around the caret, coloured as it was on screen at this moment.
  const from = Math.max(0, screen.pos - WINDOW)
  const chars = target.slice(from, screen.pos + WINDOW)

  const tips = useMemo(() => {
    const out: { id: string; tone: Tone; text: string; at?: number }[] = []
    for (const c of found.confusions.slice(0, 2)) {
      const press = keyPress(c.expected)
      const finger = press && c.expected !== ' ' ? ' ' + t('tip.finger', { key: c.expected.toLocaleUpperCase(lang), finger: t(`finger.${press.finger}` as MessageKey) }) : ''
      const text = t(c.n === 1 ? 'tip.confusion.one' : 'tip.confusion.many', { typed: name(c.typed), expected: name(c.expected), n: c.n })
      out.push({ id: `c-${c.at}`, tone: 'bad', text: text + finger, at: c.at })
    }
    if (found.pause) out.push({ id: 'pause', tone: 'slow', text: t('tip.pause', { s: n(found.pause.ms / 1000, 1), word: found.pause.word }), at: found.pause.at })
    if (found.slowKeys.length > 0) {
      const avg = found.slowKeys.reduce((a, k) => a + k.ms, 0) / found.slowKeys.length
      out.push({ id: 'slow', tone: 'slow', text: t('tip.slow', { keys: found.slowKeys.map((k) => k.key.toLocaleUpperCase(lang)).join(', '), ms: n(avg), avg: n(found.meanGap) }) })
    }
    if (found.rushed) out.push({ id: 'rush', tone: 'bad', text: t('tip.rush') })
    if (found.backspaces >= 3) out.push({ id: 'back', tone: 'back', text: t('tip.back', { n: found.backspaces }) })
    if (found.errors === 0 && found.keys > 0) out.push({ id: 'clean', tone: 'ok', text: t('tip.clean') })
    if (out.length === 0) out.push({ id: 'steady', tone: 'ok', text: t('tip.steady') })
    return out
    // `name` and `n` only depend on the language.
  }, [found, lang, t, uiLang])

  return (
    <div ref={rootRef} className="replay">
      <p className="text-muted m-0 mb-3 text-[12.5px]">{t('replay.note')}</p>

      <div className="replay-text font-type" aria-hidden="true">
        {chars.map((ch, i) => {
          const index = from + i
          const typed = screen.typed[index]
          const state = typed === undefined ? 'pending' : typed === ch ? 'ok' : 'bad'
          return (
            <span key={index} className={`${state}${index === screen.pos ? ' at' : ''}`}>
              {ch}
            </span>
          )
        })}
      </div>

      <p className="replay-caption" data-tone={captionTone ?? undefined} aria-hidden="true">
        {caption}
      </p>

      <svg viewBox={`0 0 ${WIDTH} ${5 * STEP - GAP}`} className="mx-auto block w-full max-w-[640px]" role="img" aria-label={t('replay.keyboard')}>
        {BOXES.map((b) => {
          const tone = lit.get(b.id)
          const look = tone ? TONE[tone] : null
          return (
            <g key={b.id}>
              <rect x={b.x} y={b.y} width={b.w} height={U} rx="10" fill="var(--surface)" stroke="var(--line-2)" strokeWidth="1.2" />
              {look && (
                // Keyed by the event, so the same key pressed twice in a row flashes twice.
                <rect
                  key={count}
                  className="replay-flash"
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={U}
                  rx="10"
                  fill={look.fill}
                  stroke={look.stroke}
                  strokeWidth="2.4"
                  strokeDasharray={tone === 'want' ? '5 4' : undefined}
                />
              )}
              <text
                x={b.x + b.w / 2}
                y={b.y + U / 2 + (b.label.length > 1 ? 4.5 : 6)}
                textAnchor="middle"
                fontSize={b.label.length > 1 ? 12 : 17}
                fontWeight="600"
                fill={tone ? 'var(--fg)' : 'var(--muted)'}
                style={{ fontFamily: 'var(--font-type)' }}
              >
                {b.label.toLocaleUpperCase(lang)}
              </text>
            </g>
          )
        })}
      </svg>

      <ul className="replay-legend" aria-hidden="true">
        {(['ok', 'slow', 'bad', 'want'] as const).map((tone) => (
          <li key={tone}>
            <span style={{ background: TONE[tone].fill, borderColor: TONE[tone].stroke, borderStyle: tone === 'want' ? 'dashed' : 'solid' }} />
            {t(`replay.legend.${tone}`)}
          </li>
        ))}
      </ul>

      <div className="replay-controls">
        <button type="button" className="btn primary !px-3" aria-label={t(playing ? 'replay.pause' : 'replay.play')} disabled={total === 0} onClick={() => (playing ? setPlaying(false) : seek(count >= total ? 0 : count, true))}>
          <Icon name={playing ? 'pause' : 'play'} />
        </button>
        <button type="button" className="btn ghost !px-3" aria-label={t('replay.restart')} disabled={total === 0} onClick={() => seek(0, true)}>
          <Icon name="rotate" />
        </button>
        <div className="replay-scrub">
          {/* Where the mistakes and the long pause are, so they are easy to jump to. */}
          <svg viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
            {total > 0 &&
              log.map((e, i) =>
                e.kind === 'key' && !e.ok ? <rect key={i} x={(i / total) * 100} y="0" width="0.7" height="6" fill="hsl(0 78% 55%)" /> : null,
              )}
            {found.pause && total > 0 && <rect x={(found.pause.at / total) * 100} y="0" width="0.9" height="6" fill="hsl(40 95% 50%)" />}
          </svg>
          <input
            type="range"
            min={0}
            max={total}
            step={1}
            value={count}
            disabled={total === 0}
            aria-label={t('replay.position')}
            aria-valuetext={t('replay.count', { i: count, n: total })}
            onChange={(e) => seek(Number(e.target.value), false)}
          />
        </div>
        <span className="text-muted text-[12.5px] tabular-nums whitespace-nowrap">{t('replay.count', { i: count, n: total })}</span>
        <Seg<number> label={t('replay.speed')} value={speed} onChange={setSpeed} options={SPEEDS.map((s) => ({ value: s as number, label: `${s}×` }))} />
      </div>

      <h4 className="mt-5 mb-2 text-[15px] font-bold">{t('replay.tips')}</h4>
      <ul className="replay-tips">
        {tips.map((tip) => (
          <li key={tip.id} data-tone={tip.tone}>
            <span className="dot" aria-hidden="true" />
            <span className="flex-1">{tip.text}</span>
            {tip.at !== undefined && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  seek((tip.at as number) - 6, true)
                  rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                }}
              >
                <Icon name="play" />
                {t('replay.show')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
