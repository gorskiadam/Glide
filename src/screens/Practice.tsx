import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Seg } from '../components/Seg'
import { TypingArea, type TypingAreaHandle } from '../components/TypingArea'
import { loadTexts, type Category, type Lang, type TextItem } from '../content'
import { TypingEngine, type Stats } from '../engine/engine'
import { flowScore, keyIntervals } from '../engine/flow'
import { formatNumber, useT } from '../i18n'
import { buildDrill } from '../lib/coach'
import { prepareTexts } from '../lib/filters'
import { unitsFor } from '../lib/lessons'
import { paceTarget } from '../lib/pace'
import type { Recording } from '../lib/replay'
import { dayKey } from '../lib/progress'
import { collectStats, totalPresses, weakSpots, type TypingStats, type WeakSpots } from '../lib/keystats'
import { playKey, type KeySound } from '../lib/sound'
import { Deck, wordsDone } from '../lib/textgen'
import { LENGTH_OPTIONS, TIME_OPTIONS, WORD_OPTIONS, amountOf, bestWpm, useStore, type Mode, type ResultMode } from '../store'
import { Results } from './Results'
import { SPRINT_MESSAGES } from '../lib/sprint'

type Phase = 'ready' | 'running' | 'done'

interface Run {
  engine: TypingEngine
  text: string
  /** Number of words in the text (not used by timed and zen tests, which never end). */
  totalWords: number
}

interface Hud {
  /** Seconds left (timed) or words done (other modes). */
  main: number
  wpm: number
  accuracy: number
}

export interface Outcome {
  stats: Stats
  mode: ResultMode
  amount: number
  lang: Lang
  /** Best result for this setup before this test, or null on the first try. */
  previousBest: number | null
  /** Flow Score, 0 to 100. */
  flow: number
  /** Gaps between keystrokes in ms, for the Flow waveform. */
  intervals: number[]
  /** Per-key statistics of this test, for the heatmap. */
  typing: TypingStats
  /** Every key and backspace of the run, for the replay. */
  recording: Recording
}

/** What the coach found when it was asked for a drill. */
type Coach = { status: 'ok'; spots: WeakSpots } | { status: 'needData' } | { status: 'strong' }

/** Key presses the coach wants to have seen before it judges anyone. */
const COACH_MIN_PRESSES = 200
const COACH_DRILL_WORDS = 40

/** Enough text for a very fast typist (about 240 WPM) to not run out before more is added. */
const CHARS_PER_SECOND = 20
const CATEGORIES: readonly (Category | 'all')[] = ['all', 'quick', 'everyday', 'work', 'school', 'stories', 'practical', 'numbers']

export function Practice({ onTypingChange }: { onTypingChange: (typing: boolean) => void }) {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const history = useStore((s) => s.history)
  const update = useStore((s) => s.update)
  const addResult = useStore((s) => s.addResult)
  const addTyping = useStore((s) => s.addTyping)
  const lessonsDone = useStore((s) => s.lessons)
  const dailyScores = useStore((s) => s.daily)
  const { mode, seconds, words, passageLength, category, contentLang, uiLang } = settings
  const { punctuation, numbers, capitals, strict, stopOnError, sound, soundPack } = settings
  const amount = amountOf(settings)
  const endless = mode === 'time' || mode === 'zen'

  const [texts, setTexts] = useState<TextItem[] | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [hud, setHud] = useState<Hud>({ main: 0, wpm: 0, accuracy: 100 })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [coach, setCoach] = useState<Coach | null>(null)
  const areaRef = useRef<TypingAreaHandle>(null)
  const phaseRef = useRef<Phase>('ready')
  phaseRef.current = phase

  useEffect(() => {
    let alive = true
    setTexts(null)
    void loadTexts(contentLang).then((loaded) => alive && setTexts(loaded))
    return () => {
      alive = false
    }
  }, [contentLang])

  // The texts for the chosen type, with the punctuation / numbers / capitals settings applied.
  const prepared = useMemo(
    () => (texts ? prepareTexts(texts, category, { punctuation, numbers, capitals }, contentLang) : null),
    [texts, category, punctuation, numbers, capitals, contentLang],
  )
  const deck = useMemo(() => {
    if (!prepared || prepared.length === 0) return null
    if (mode !== 'passage') return new Deck(prepared)
    // Passage mode deals whole texts of the chosen length, or any length if there are none.
    const sized = prepared.filter((item) => item.length === passageLength)
    return new Deck(sized.length > 0 ? sized : prepared)
  }, [prepared, mode, passageLength])

  /** Starts a fresh test. Pass `sameText` to repeat a text instead of dealing a new one. */
  const begin = useCallback(
    (sameText?: string) => {
      if (!deck) {
        setRun(null)
        return
      }
      let text = sameText
      if (mode !== 'coach') setCoach(null)
      else if (text === undefined) {
        // Read the statistics directly, not through a hook, so that saving a result
        // does not restart the test that is showing its results.
        const stats = useStore.getState().typing[contentLang]
        const spots = weakSpots(stats)
        const drill = buildDrill(prepared ?? [], spots, COACH_DRILL_WORDS, contentLang)
        if (totalPresses(stats) < COACH_MIN_PRESSES || !drill) {
          setCoach({ status: totalPresses(stats) < COACH_MIN_PRESSES ? 'needData' : 'strong' })
          setRun(null)
          return
        }
        setCoach({ status: 'ok', spots })
        text = drill
      }
      if (text === undefined) {
        if (mode === 'time') text = deck.chars(Math.min(seconds * CHARS_PER_SECOND, 600))
        else if (mode === 'words') text = deck.words(words)
        else if (mode === 'passage') text = deck.next()
        else text = deck.chars(300)
      }
      setRun({ engine: new TypingEngine(text, { strict, stopOnError }), text, totalWords: text.split(' ').length })
      setPhase('ready')
      setOutcome(null)
      setHud({ main: mode === 'time' ? seconds : 0, wpm: 0, accuracy: 100 })
    },
    [deck, prepared, contentLang, mode, seconds, words, strict, stopOnError],
  )

  useEffect(() => begin(), [begin])
  useEffect(() => {
    if (run && phase === 'ready') areaRef.current?.focus()
  }, [run, phase])
  useEffect(() => {
    onTypingChange(phase === 'running')
    return () => onTypingChange(false)
  }, [phase, onTypingChange])

  const finish = useCallback(() => {
    if (!run || phaseRef.current === 'done' || !run.engine.started) return
    const { engine } = run
    engine.finish(mode === 'time' ? seconds * 1000 : undefined)
    const stats = engine.stats(performance.now())
    const intervals = keyIntervals(engine.keystrokes.map((k) => k.t))
    const flow = flowScore(intervals)
    const typing = collectStats(engine.keystrokes, contentLang)
    setOutcome({ stats, mode, amount, lang: contentLang, previousBest: bestWpm(history, mode, amount, contentLang), flow, intervals, typing, recording: { target: engine.target.slice(), log: engine.log } })
    addTyping(contentLang, typing)
    addResult({
      id: crypto.randomUUID(),
      at: Date.now(),
      mode,
      amount,
      lang: contentLang,
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
    phaseRef.current = 'done'
    setPhase('done')
  }, [run, mode, seconds, amount, contentLang, history, addResult, addTyping])

  const onInput = useCallback(() => {
    if (!run) return
    if (phaseRef.current === 'ready' && run.engine.started) {
      phaseRef.current = 'running'
      setPhase('running')
    }
    if (!endless && run.engine.complete) finish()
  }, [run, endless, finish])

  // Esc starts the same text over. In zen mode, where nothing else ends the session, it finishes it.
  const onEscape = useCallback(() => {
    if (!run) return
    if (mode === 'zen' && run.engine.started) finish()
    else begin(run.text)
  }, [run, mode, finish, begin])

  const onKey = useMemo(() => (sound ? (kind: KeySound) => playKey(soundPack, kind) : undefined), [sound, soundPack])

  // While a test runs, refresh the live numbers a few times a second and watch the clock.
  useEffect(() => {
    if (phase !== 'running' || !run) return
    const { engine } = run
    const tick = () => {
      const now = performance.now()
      const elapsed = engine.elapsed(now)
      if (mode === 'time' && elapsed >= seconds * 1000) return finish()
      const s = engine.stats(now)
      setHud({
        main: mode === 'time' ? Math.ceil((seconds * 1000 - elapsed) / 1000) : wordsDone(engine.target, engine.pos),
        // In the first second a couple of keys would show as thousands of WPM, so ease in.
        wpm: s.wpm * Math.min(1, elapsed / 1000),
        accuracy: s.accuracy,
      })
    }
    tick()
    const id = window.setInterval(tick, 100)
    return () => window.clearInterval(id)
  }, [phase, run, mode, seconds, finish])

  // Typing anywhere on the page puts the focus back in the typing area.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phaseRef.current === 'done' || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.activeElement === document.body && e.key.length === 1) areaRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const getMore = useMemo(() => (endless && deck ? () => deck.chars(200) : undefined), [endless, deck])
  const best = bestWpm(history, mode, amount, contentLang)
  // Zen has no pace to keep, and the coach drills are slow on purpose.
  const pace = mode === 'zen' || mode === 'coach' ? null : paceTarget(settings, history, mode, amount, contentLang)
  const lessons = unitsFor(contentLang).flatMap((u) => u.lessons)
  const todayScore = dailyScores[`${dayKey(Date.now())}:${contentLang}`]
  const hudMain = mode === 'time' ? String(hud.main) : mode === 'zen' ? String(hud.main) : `${hud.main}/${run?.totalWords ?? 0}`

  return (
    <div className="flex flex-col gap-4">
      <header className="fade-on-type flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[27px] font-extrabold">{t('practice.title')}</h1>
          <p className="text-muted m-0 mt-1">{t('practice.sub')}</p>
        </div>
        {best !== null && (
          <span className="pill accent">
            <Icon name="trophy" />
            {t('practice.best', { n: formatNumber(uiLang, best) })}
          </span>
        )}
      </header>

      <div className="fade-on-type flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Seg<Mode>
            label={t('practice.mode')}
            value={mode}
            onChange={(v) => update({ mode: v })}
            options={[
              { value: 'time', label: [<Icon key="i" name="clock" />, t('practice.mode.time')] },
              { value: 'words', label: [<Icon key="i" name="type" />, t('practice.mode.words')] },
              { value: 'passage', label: [<Icon key="i" name="book" />, t('practice.mode.passage')] },
              { value: 'zen', label: [<Icon key="i" name="wave" />, t('practice.mode.zen')] },
              { value: 'coach', label: [<Icon key="i" name="coach" />, t('practice.mode.coach')] },
            ]}
          />
          {mode === 'time' && (
            <Seg
              label={t('practice.amount')}
              value={seconds}
              onChange={(v) => update({ seconds: v })}
              options={TIME_OPTIONS.map((n) => ({ value: n as number, label: t('practice.seconds', { n }) }))}
            />
          )}
          {mode === 'words' && (
            <Seg
              label={t('practice.amount')}
              value={words}
              onChange={(v) => update({ words: v })}
              options={WORD_OPTIONS.map((n) => ({ value: n as number, label: String(n) }))}
            />
          )}
          {mode === 'passage' && (
            <Seg
              label={t('practice.amount')}
              value={passageLength}
              onChange={(v) => update({ passageLength: v })}
              options={LENGTH_OPTIONS.map((l) => ({ value: l, label: t(`length.${l}`) }))}
            />
          )}
          <div className="ml-auto">
            <Seg<Lang>
              label={t('practice.language')}
              value={contentLang}
              onChange={(v) => update({ contentLang: v })}
              options={[
                { value: 'en', label: [<Icon key="i" name="globe" />, 'EN'], ariaLabel: t('lang.en') },
                { value: 'pl', label: 'PL', ariaLabel: t('lang.pl') },
              ]}
            />
          </div>
        </div>
        <div className="chips" role="radiogroup" aria-label={t('practice.category')}>
          {CATEGORIES.map((c) => (
            <button key={c} type="button" role="radio" className="chip" aria-checked={category === c} onClick={() => update({ category: c })}>
              {t(`cat.${c}`)}
            </button>
          ))}
        </div>
      </div>

      {phase === 'done' && outcome ? (
        <Results outcome={outcome} onNext={() => begin()} onRetry={() => begin(run?.text)} />
      ) : (
        <section className="glass glass-hero rise p-5 sm:p-7" aria-label={t('nav.practice')}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="label">{mode === 'time' ? t('practice.timeLeft') : t('practice.words')}</div>
              <div className="font-display text-accent-text text-[34px] leading-none font-extrabold tabular-nums">{hudMain}</div>
            </div>
            {mode === 'zen' ? (
              <p className="text-muted m-0 max-w-[260px] text-right text-[13px]">{t('practice.zen.hint')}</p>
            ) : (
              settings.showLiveWpm && (
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
              )
            )}
          </div>

          {mode === 'coach' && coach?.status === 'ok' && (
            <div className="fade-on-type mb-3 flex flex-wrap items-center gap-1.5">
              <span className="label mr-1">{t('coach.targets')}</span>
              {[...coach.spots.keys, ...coach.spots.bigrams].map((spot) => (
                <span key={spot} className="pill accent font-type">
                  {spot}
                </span>
              ))}
            </div>
          )}

          {run ? (
            <TypingArea
              ref={areaRef}
              engine={run.engine}
              onInput={onInput}
              onEscape={onEscape}
              getMore={getMore}
              onKey={onKey}
              caret={settings.caret}
              smoothCaret={settings.smoothCaret}
              fontSize={settings.fontSize}
              font={settings.font}
              label={t('practice.typingArea')}
              blurHint={t('practice.focus')}
              paceWpm={pace}
            />
          ) : (
            <div className="text-muted grid min-h-[132px] place-items-center text-center">
              {coach?.status === 'needData'
                ? t('coach.needData', { lang: t(`lang.${contentLang}.short`) })
                : coach?.status === 'strong'
                  ? t('coach.strong')
                  : prepared && prepared.length === 0
                    ? t('practice.empty')
                    : t('practice.loading')}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="fade-on-type flex flex-wrap items-center gap-2">
              <button type="button" className="btn soft" onClick={() => begin()}>
                <Icon name="rotate" />
                {t('practice.restart')}
              </button>
              {pace !== null && (
                <span className="pill">
                  <span className="pace-dot" aria-hidden="true" />
                  {t('practice.pace', { n: formatNumber(uiLang, pace) })}
                </span>
              )}
            </div>
            {/* In zen mode the way out stays visible while typing. */}
            {mode === 'zen' && phase === 'running' && (
              <button type="button" className="btn ghost" onClick={finish}>
                {t('practice.finish')}
              </button>
            )}
            <div className="fade-on-type text-muted hidden flex-wrap gap-x-4 gap-y-1 text-[13px] sm:flex">
              <span>
                <Kbd>Tab</Kbd> + <Kbd>Enter</Kbd> {t('practice.hint.restart')}
              </span>
              <span>
                <Kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'}</Kbd> + <Kbd>K</Kbd> {t('palette.open').toLocaleLowerCase(uiLang)}
              </span>
              <span>
                <Kbd>Esc</Kbd> {mode === 'zen' ? t('practice.hint.finish') : t('practice.hint.reset')}
              </span>
            </div>
          </div>
        </section>
      )}

      <nav className="fade-on-type grid gap-3 sm:grid-cols-2" aria-label={t('home.more')}>
        <a className="glass more-card" href="#/lessons">
          <span className="tile violet">
            <Icon name="steps" />
          </span>
          <span>
            <strong>{t('nav.lessons')}</strong>
            <small>{t('home.lessons.sub', { done: lessons.filter((l) => (lessonsDone[l.id]?.stars ?? 0) > 0).length, total: lessons.length })}</small>
          </span>
        </a>
        <a className="glass more-card" href="#/daily">
          <span className={`tile ${todayScore ? 'green' : 'amber'}`}>
            <Icon name={todayScore ? 'check' : 'calendar'} />
          </span>
          <span>
            <strong>{t('daily.title')}</strong>
            <small>{todayScore ? t('home.daily.done', { n: formatNumber(uiLang, todayScore.wpm) }) : t('home.daily.todo')}</small>
          </span>
        </a>
        <a className="glass more-card" href="#/warmup">
          <span className="tile rose">
            <Icon name="flame" />
          </span>
          <span>
            <strong>{t('warmup.title')}</strong>
            <small>{t('home.warmup.sub')}</small>
          </span>
        </a>
        <a className="glass more-card" href="#/sprint">
          <span className="tile blue">
            <Icon name="message" />
          </span>
          <span>
            <strong>{t('sprint.title')}</strong>
            <small>{t('home.sprint.sub', { n: SPRINT_MESSAGES })}</small>
          </span>
        </a>
      </nav>
    </div>
  )
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="border-line-2 bg-card text-fg-2 rounded-md border px-1.5 py-0.5 font-[inherit] text-[12px] font-semibold">
      {children}
    </kbd>
  )
}
