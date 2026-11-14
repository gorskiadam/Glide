import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Lang } from '../content'
import { combineRuns } from '../engine/combine'
import { TypingEngine, type Keystroke, type LogEvent, type Stats } from '../engine/engine'
import { flowScore, keyIntervals } from '../engine/flow'
import { formatNumber, useT } from '../i18n'
import { collectStats, emptyStats, mergeStats } from '../lib/keystats'
import { joinRecordings } from '../lib/replay'
import { playKey, type KeySound } from '../lib/sound'
import { wordsDone } from '../lib/textgen'
import type { Outcome } from '../screens/Practice'
import { Results } from '../screens/Results'
import { bestWpm, useStore, type ResultMode } from '../store'
import { Icon } from './Icon'
import { KeyGuide } from './KeyGuide'
import { TypingArea, type TypingAreaHandle } from './TypingArea'

type Phase = 'ready' | 'running' | 'done'
interface DoneRun {
  stats: Stats
  keystrokes: Keystroke[]
  target: string[]
  log: LogEvent[]
}

interface Props {
  /** The texts to type, one after another. A change of this array starts a new session. */
  segments: readonly string[]
  lang: Lang
  mode: ResultMode
  amount: number
  /** What the big counter shows: words of the text, or which message of several. */
  counter: 'words' | 'messages'
  /** Label above the counter. "Words" or "Message" when missing. */
  counterLabel?: string
  /** Show the keyboard with the next key and finger. */
  guide?: boolean
  /** Content above the typing area; gets the number of finished segments. */
  above?: (done: number) => ReactNode
  /** Deals a new text. Without it only "Start over" is offered. */
  onNewText?: () => void
  onTypingChange: (typing: boolean) => void
  /** Called once when the session is finished, before the results show. */
  onFinish?: (outcome: Outcome) => void
  nextLabel: string
  onNext: () => void
  /** Extra content at the top of the results. */
  resultExtra?: (outcome: Outcome) => ReactNode
}

/**
 * A typing session over fixed text: lessons, the daily challenge and the message
 * sprint all run on it. It ends when the last segment is typed to the end.
 */
export function Session(props: Props) {
  const { segments, lang, mode, amount, counter, guide, onTypingChange } = props
  const t = useT()
  const settings = useStore((s) => s.settings)
  const addResult = useStore((s) => s.addResult)
  const addTyping = useStore((s) => s.addTyping)
  const { strict, stopOnError, sound, soundPack, uiLang } = settings

  const [engine, setEngine] = useState<TypingEngine | null>(null)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('ready')
  const [pos, setPos] = useState(0)
  const [hud, setHud] = useState({ wpm: 0, accuracy: 100 })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const runs = useRef<DoneRun[]>([])
  const areaRef = useRef<TypingAreaHandle>(null)
  const phaseRef = useRef<Phase>('ready')
  phaseRef.current = phase
  const propsRef = useRef(props)
  propsRef.current = props

  const reset = useCallback(() => {
    runs.current = []
    setIndex(0)
    setPos(0)
    setEngine(segments.length > 0 ? new TypingEngine(segments[0] as string, { strict, stopOnError }) : null)
    phaseRef.current = 'ready'
    setPhase('ready')
    setOutcome(null)
    setHud({ wpm: 0, accuracy: 100 })
  }, [segments, strict, stopOnError])

  useEffect(reset, [reset])
  useEffect(() => {
    if (engine && phase !== 'done') areaRef.current?.focus()
  }, [engine, phase])
  useEffect(() => {
    onTypingChange(phase === 'running')
    return () => onTypingChange(false)
  }, [phase, onTypingChange])

  const finishAll = useCallback(() => {
    const done = runs.current
    const stats = combineRuns(done)
    const intervals = done.flatMap((run) => keyIntervals(run.keystrokes.map((k) => k.t)))
    const flow = flowScore(intervals)
    const typing = done.reduce((all, run) => mergeStats(all, collectStats(run.keystrokes, lang)), emptyStats())
    const result: Outcome = {
      stats,
      mode,
      amount,
      lang,
      previousBest: bestWpm(useStore.getState().history, mode, amount, lang),
      flow,
      intervals,
      typing,
      recording: joinRecordings(done.map((run) => ({ target: run.target, log: run.log, elapsedMs: run.stats.elapsedMs }))),
    }
    addTyping(lang, typing)
    addResult({
      id: crypto.randomUUID(),
      at: Date.now(),
      mode,
      amount,
      lang,
      wpm: stats.wpm,
      rawWpm: stats.rawWpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      flow,
      errors: stats.errors,
      elapsedMs: stats.elapsedMs,
      correctChars: stats.correctChars,
      incorrectChars: stats.incorrectChars,
    })
    propsRef.current.onFinish?.(result)
    setOutcome(result)
    phaseRef.current = 'done'
    setPhase('done')
  }, [mode, amount, lang, addResult, addTyping])

  const onInput = useCallback(() => {
    if (!engine || phaseRef.current === 'done') return
    if (phaseRef.current === 'ready' && engine.started) {
      phaseRef.current = 'running'
      setPhase('running')
    }
    setPos(engine.pos)
    if (!engine.complete) return
    engine.finish()
    runs.current.push({ stats: engine.stats(performance.now()), keystrokes: engine.keystrokes, target: engine.target.slice(), log: engine.log })
    const next = segments[index + 1]
    if (next === undefined) finishAll()
    else {
      setIndex(index + 1)
      setPos(0)
      setEngine(new TypingEngine(next, { strict, stopOnError }))
    }
  }, [engine, segments, index, strict, stopOnError, finishAll])

  const onKey = useMemo(() => (sound ? (kind: KeySound) => playKey(soundPack, kind) : undefined), [sound, soundPack])

  // Live numbers, a few times a second, over everything typed in this session so far.
  useEffect(() => {
    if (phase !== 'running' || !engine) return
    const tick = () => {
      const now = performance.now()
      const all = [...runs.current]
      if (engine.started && !engine.finished) all.push({ stats: engine.stats(now), keystrokes: engine.keystrokes, target: engine.target, log: engine.log })
      const s = combineRuns(all)
      setHud({ wpm: s.wpm * Math.min(1, s.elapsedMs / 1000), accuracy: s.accuracy })
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [phase, engine])

  // Typing anywhere on the page puts the focus back in the typing area.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'done' || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.activeElement === document.body && e.key.length === 1) areaRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (phase === 'done' && outcome) {
    return (
      <Results outcome={outcome} onNext={props.onNext} onRetry={reset} nextLabel={props.nextLabel} extra={props.resultExtra?.(outcome)} />
    )
  }

  const total = engine ? engine.target.join('').split(' ').length : 0
  const main = counter === 'messages' ? `${Math.min(index + 1, segments.length)}/${segments.length}` : `${engine ? wordsDone(engine.target, pos) : 0}/${total}`

  return (
    <section className="glass glass-hero rise p-5 sm:p-7" aria-label={t('nav.practice')}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="label">{props.counterLabel ?? t(counter === 'messages' ? 'session.message' : 'practice.words')}</div>
          <div className="font-display text-accent-text text-[34px] leading-none font-extrabold tabular-nums">{main}</div>
        </div>
        {settings.showLiveWpm && (
          <div className="flex gap-5 text-right" aria-hidden={phase !== 'running'}>
            <div>
              <div className="label">{t('stat.wpm')}</div>
              <div className="font-display text-[22px] leading-tight font-bold tabular-nums">{formatNumber(uiLang, hud.wpm)}</div>
            </div>
            <div>
              <div className="label">{t('stat.accuracy')}</div>
              <div className="font-display text-[22px] leading-tight font-bold tabular-nums">{formatNumber(uiLang, hud.accuracy)}%</div>
            </div>
          </div>
        )}
      </div>

      {props.above?.(index)}

      {engine ? (
        <TypingArea
          ref={areaRef}
          engine={engine}
          onInput={onInput}
          onEscape={reset}
          onKey={onKey}
          caret={settings.caret}
          smoothCaret={settings.smoothCaret}
          fontSize={settings.fontSize}
          font={settings.font}
          label={t('practice.typingArea')}
          blurHint={t('practice.focus')}
        />
      ) : (
        <div className="text-muted grid min-h-[132px] place-items-center text-center">{t('practice.loading')}</div>
      )}

      {guide && engine && <KeyGuide char={engine.target[pos]} lang={lang} />}

      <div className="fade-on-type mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {props.onNewText && (
            <button type="button" className="btn soft" onClick={props.onNewText}>
              <Icon name="rotate" />
              {t('practice.restart')}
            </button>
          )}
          <button type="button" className={`btn ${props.onNewText ? 'ghost' : 'soft'}`} onClick={reset}>
            {!props.onNewText && <Icon name="rotate" />}
            {t('session.restart')}
          </button>
        </div>
        <div className="text-muted hidden text-[13px] sm:block">
          <kbd className="border-line-2 bg-card text-fg-2 rounded-md border px-1.5 py-0.5 font-[inherit] text-[12px] font-semibold">Esc</kbd>{' '}
          {t('practice.hint.reset')}
        </div>
      </div>
    </section>
  )
}
