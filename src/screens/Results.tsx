import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { FlowWave } from '../components/FlowWave'
import { Icon, type IconName } from '../components/Icon'
import { Keyboard } from '../components/Keyboard'
import { LineChart } from '../components/LineChart'
import { flowWave } from '../engine/flow'
import { formatNumber, useT } from '../i18n'
import { flowLevel, modeLabel } from '../lib/labels'
import { rankFor } from '../lib/rank'
import { useStore } from '../store'
import type { Outcome } from './Practice'

// The share card is rarely opened, so its code loads on first use.
const ShareCard = lazy(() => import('../components/ShareCard').then((m) => ({ default: m.ShareCard })))

interface Props {
  outcome: Outcome
  onNext: () => void
  onRetry: () => void
  /** Text of the main button. "Next test" when missing. */
  nextLabel?: string
  /** Shown above the numbers, for example the stars of a lesson. */
  extra?: ReactNode
}

export function Results({ outcome, onNext, onRetry, nextLabel, extra }: Props) {
  const [sharing, setSharing] = useState(false)
  const t = useT()
  const uiLang = useStore((s) => s.settings.uiLang)
  const nextRef = useRef<HTMLButtonElement>(null)
  const { stats, previousBest, flow } = outcome
  const isBest = previousBest !== null && stats.wpm > previousBest
  const n = (value: number, digits = 0) => formatNumber(uiLang, value, digits)
  const wave = useMemo(() => flowWave(outcome.intervals), [outcome.intervals])

  // Focus the main action so Enter starts the next test straight away.
  useEffect(() => nextRef.current?.focus(), [])

  const tiles: { icon: IconName; color: string; label: string; value: string; help: string }[] = [
    { icon: 'target', color: 'green', label: t('stat.accuracy'), value: `${n(stats.accuracy, 1)}%`, help: t('result.accuracy.help') },
    { icon: 'gauge', color: 'blue', label: t('stat.raw'), value: n(stats.rawWpm), help: t('result.raw.help') },
    { icon: 'activity', color: 'teal', label: t('stat.consistency'), value: `${n(stats.consistency)}%`, help: t('result.consistency.help') },
    { icon: 'x', color: 'rose', label: t('stat.errors'), value: n(stats.errors), help: t('result.chars.detail', { ok: n(stats.correctChars), bad: n(stats.incorrectChars) }) },
    { icon: 'clock', color: 'amber', label: t('stat.time'), value: `${n(stats.elapsedMs / 1000, 1)} s`, help: `${n(stats.typedChars)} ${t('stat.chars').toLowerCase()}` },
  ]

  return (
    <section className="glass glass-hero pop p-5 sm:p-7" aria-labelledby="result-title">
      <div className="mb-5 flex items-center gap-3">
        <span className="tile solid">
          <Icon name={isBest ? 'trophy' : 'wave'} />
        </span>
        <div className="min-w-0">
          <h2 id="result-title" className="text-[19px] font-bold">
            {t(isBest ? 'result.title.best' : 'result.title')}
          </h2>
          <p className="text-muted m-0 text-[13px]">
            {t('result.sub', { mode: modeLabel(t, outcome.mode, outcome.amount), lang: t(`lang.${outcome.lang}.short`) })}
          </p>
        </div>
        {previousBest !== null && (
          <span className={`pill ml-auto ${isBest ? 'good' : 'accent'}`}>
            {t('result.pb')}: {n(Math.max(previousBest, stats.wpm))}
          </span>
        )}
      </div>

      {/* One sentence for screen readers, announced when the results appear. */}
      <p className="sr-only" role="status">
        {t('result.summary', { wpm: n(stats.wpm), acc: n(stats.accuracy, 1) })}
      </p>

      {extra}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="border-line bg-card/70 flex flex-col justify-center rounded-2xl border p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="label">{t('stat.wpm')}</div>
            <span className="pill accent" title={t('rank.label')}>
              <span className="sr-only">{t('rank.label')}: </span>
              {t(`rank.${rankFor(stats.wpm)}`)}
            </span>
          </div>
          <div className="font-display from-accent to-sky bg-gradient-to-br bg-clip-text text-[76px] leading-none font-extrabold tracking-tight text-transparent tabular-nums">
            {n(stats.wpm)}
          </div>
          <div className="text-muted mt-1 text-[13px]">{t('result.wpm.help')}</div>
        </div>
        <div className="border-line bg-card/70 rounded-2xl border p-4">
          <div className="label mb-2">{t('result.speed')}</div>
          <LineChart
            values={stats.perSecond}
            smooth
            alt={t('result.speed.alt', {
              min: n(stats.perSecond.length ? Math.min(...stats.perSecond) : 0),
              max: n(stats.perSecond.length ? Math.max(...stats.perSecond) : 0),
            })}
          />
        </div>
      </div>

      <div className="border-line bg-card/70 mt-3 grid items-center gap-4 rounded-2xl border p-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="tile violet">
              <Icon name="wave" />
            </span>
            <h3 className="text-[16px] font-bold">{t('flow.title')}</h3>
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-display text-[44px] leading-none font-extrabold tabular-nums">{n(flow)}</span>
            <span className="pill accent">{t(flowLevel(flow))}</span>
          </div>
          <p className="text-muted m-0 mt-2 text-[13px]">{t('flow.help')}</p>
        </div>
        <FlowWave values={wave} alt={t('flow.wave.alt')} />
      </div>

      <dl className="m-0 mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="border-line bg-card/70 rounded-2xl border p-3.5">
            <dt className="text-muted text-[12px] font-semibold">
              <span className={`tile ${tile.color} mb-2`}>
                <Icon name={tile.icon} />
              </span>
              {tile.label}
            </dt>
            <dd className="m-0">
              <div className="font-display text-[22px] leading-tight font-bold tabular-nums">{tile.value}</div>
              <div className="text-muted text-[12px]">{tile.help}</div>
            </dd>
          </div>
        ))}
      </dl>

      <div className="border-line bg-card/70 mt-3 rounded-2xl border p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="tile blue">
            <Icon name="keyboard" />
          </span>
          <div>
            <h3 className="text-[16px] font-bold">{t('heat.title')}</h3>
            <p className="text-muted m-0 text-[12.5px]">{t('heat.thisTest')}</p>
          </div>
        </div>
        <Keyboard stats={outcome.typing} lang={outcome.lang} replay={outcome.recording} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button ref={nextRef} type="button" className="btn primary" onClick={onNext}>
          {nextLabel ?? t('result.next')}
          <Icon name="arrowRight" />
        </button>
        <button type="button" className="btn ghost" onClick={onRetry}>
          <Icon name="rotate" />
          {t('result.retry')}
        </button>
        <button type="button" className="btn ghost sm:ml-auto" onClick={() => setSharing(true)}>
          <Icon name="share" />
          {t('share.open')}
        </button>
      </div>
      {sharing && (
        <Suspense fallback={null}>
          <ShareCard outcome={outcome} onClose={() => setSharing(false)} />
        </Suspense>
      )}
    </section>
  )
}
