import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Keyboard } from '../components/Keyboard'
import { LineChart } from '../components/LineChart'
import { Seg } from '../components/Seg'
import type { Lang } from '../content'
import { formatNumber, useT } from '../i18n'
import { avgMs, errorRate, rankWeak, type WeakItem } from '../lib/keystats'
import { durationLabel, modeLabel } from '../lib/labels'
import { average, personalBests, practicedToday, streak } from '../lib/progress'
import { isDrill, GOAL_OPTIONS, useStore } from '../store'

type Metric = 'wpm' | 'accuracy' | 'flow'
const CHART_TESTS = 50
const RING = 2 * Math.PI * 42

export function Progress() {
  const t = useT()
  const history = useStore((s) => s.history)
  const typing = useStore((s) => s.typing)
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.update)
  const { uiLang } = settings
  const [metric, setMetric] = useState<Metric>('wpm')
  const [lang, setLang] = useState<Lang>(settings.contentLang)
  const n = (value: number, digits = 0) => formatNumber(uiLang, value, digits)

  const now = Date.now()
  const todayMs = practicedToday(history, now)
  const goalMs = settings.dailyGoal * 60000
  const goalShare = Math.min(1, todayMs / goalMs)
  const minutesLeft = Math.max(0, Math.ceil((goalMs - todayMs) / 60000))

  // Lesson and warm-up drills are not real text, so their speed stays out of the averages and the chart.
  const scored = useMemo(() => history.filter((r) => !isDrill(r.mode)), [history])
  const recent = scored.slice(-10)
  const bests = useMemo(() => personalBests(history), [history])
  const series = useMemo(() => {
    const last = scored.slice(-CHART_TESTS)
    if (metric === 'flow') return last.flatMap((r) => (r.flow === undefined ? [] : [r.flow]))
    return last.map((r) => r[metric])
  }, [scored, metric])
  const metricLabel = t(metric === 'wpm' ? 'stat.wpm' : metric === 'accuracy' ? 'stat.accuracy' : 'stat.flow')

  const stats = typing[lang]
  const weakKeys = useMemo(() => rankWeak(stats.keys, 8).filter((w) => w.score > 0.05).slice(0, 5), [stats])
  const weakPairs = useMemo(() => rankWeak(stats.bigrams, 4).filter((w) => w.score > 0.05).slice(0, 5), [stats])

  const header = (
    <header>
      <h1 className="text-[27px] font-extrabold">{t('progress.title')}</h1>
      <p className="text-muted m-0 mt-1">{t('progress.sub')}</p>
    </header>
  )

  if (history.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <section className="glass rise flex flex-col items-center gap-4 px-6 py-12 text-center">
          <span className="tile solid !h-12 !w-12 !rounded-2xl">
            <Icon name="chart" />
          </span>
          <p className="m-0 max-w-[340px] font-semibold">{t('progress.empty')}</p>
          <a className="btn primary no-underline" href="#/">
            {t('progress.start')}
            <Icon name="arrowRight" />
          </a>
        </section>
      </div>
    )
  }

  const tiles: { icon: IconName; color: string; label: string; value: string; help: string }[] = [
    { icon: 'flame', color: 'amber', label: t('progress.streak'), value: n(streak(history, now)), help: '' },
    { icon: 'trophy', color: 'violet', label: t('progress.best'), value: n(Math.max(0, ...scored.map((r) => r.wpm))), help: t('progress.allTime') },
    { icon: 'zap', color: 'blue', label: t('progress.avg'), value: n(average(recent.map((r) => r.wpm))), help: t('progress.last10') },
    { icon: 'target', color: 'green', label: t('progress.avgAcc'), value: `${n(average(recent.map((r) => r.accuracy)), 1)}%`, help: t('progress.last10') },
    { icon: 'check', color: 'teal', label: t('progress.tests'), value: n(history.length), help: t('progress.allTime') },
    { icon: 'clock', color: 'rose', label: t('progress.time'), value: durationLabel(t, history.reduce((a, r) => a + r.elapsedMs, 0)), help: t('progress.allTime') },
  ]

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <section className="glass glass-hero rise flex flex-col items-center gap-3 p-5 text-center" aria-labelledby="goal-title">
          <h2 id="goal-title" className="label self-start">
            {t('progress.goal')}
          </h2>
          <div className="relative h-[132px] w-[132px]">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
              <defs>
                <linearGradient id="ring-g" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" />
                  <stop offset="1" stopColor="var(--sky)" />
                </linearGradient>
              </defs>
              <circle className="ring-track" cx="50" cy="50" r="42" fill="none" strokeWidth="9" />
              <circle
                className="ring-value"
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#ring-g)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - goalShare)}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <div className="font-display text-[28px] leading-none font-extrabold tabular-nums">{n(goalShare * 100)}%</div>
                <div className="text-muted mt-1 text-[12px] font-semibold">
                  {t('progress.goal.value', { done: n(Math.floor(todayMs / 60000)), goal: settings.dailyGoal })}
                </div>
              </div>
            </div>
          </div>
          <p className="m-0 text-[13.5px] font-semibold" role="status">
            {goalShare >= 1 ? t('progress.goal.done') : t('progress.goal.left', { n: minutesLeft })}
          </p>
          <span className="label">{t('progress.goal.set')}</span>
          <Seg
            label={t('progress.goal.set')}
            value={settings.dailyGoal}
            onChange={(v) => update({ dailyGoal: v })}
            options={GOAL_OPTIONS.map((g) => ({ value: g as number, label: String(g), ariaLabel: t('time.min', { n: g }) }))}
          />
        </section>

        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="glass rise !rounded-2xl p-3.5">
              <dt className="text-muted text-[12px] font-semibold">
                <span className={`tile ${tile.color} mb-2`}>
                  <Icon name={tile.icon} />
                </span>
                {tile.label}
              </dt>
              <dd className="m-0">
                <div className="font-display text-[22px] leading-tight font-bold tabular-nums">{tile.value}</div>
                <div className="text-muted min-h-[18px] text-[12px]">{tile.help}</div>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Card
        icon="activity"
        color="violet"
        title={t('progress.chart')}
        sub={t('progress.chart.caption', { n: series.length })}
        action={
          <Seg<Metric>
            label={t('progress.chart.metric')}
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'wpm', label: t('stat.wpm') },
              { value: 'accuracy', label: t('stat.accuracy') },
              { value: 'flow', label: t('stat.flow') },
            ]}
          />
        }
      >
        <LineChart
          values={series}
          height={180}
          fromZero={metric === 'wpm'}
          alt={t('progress.chart.alt', {
            metric: metricLabel,
            n: series.length,
            min: n(series.length ? Math.min(...series) : 0),
            max: n(series.length ? Math.max(...series) : 0),
          })}
        />
      </Card>

      <Card
        icon="keyboard"
        color="blue"
        title={t('heat.title')}
        sub={t('heat.allTime', { lang: t(`lang.${lang}.short`) })}
        action={
          <Seg<Lang>
            label={t('practice.language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'EN', ariaLabel: t('lang.en') },
              { value: 'pl', label: 'PL', ariaLabel: t('lang.pl') },
            ]}
          />
        }
      >
        <Keyboard stats={stats} lang={lang} />
        <div className="border-line mt-4 border-t pt-4">
          <h3 className="mb-2 text-[15.5px] font-bold">{t('weak.title')}</h3>
          {weakKeys.length === 0 && weakPairs.length === 0 ? (
            <p className="text-muted m-0 text-[13.5px]">{t('weak.none')}</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <WeakList title={t('weak.keys')} items={weakKeys} lang={lang} />
                <WeakList title={t('weak.bigrams')} items={weakPairs} lang={lang} />
              </div>
              <button
                type="button"
                className="btn primary mt-4"
                onClick={() => {
                  update({ mode: 'coach', contentLang: lang })
                  window.location.hash = '#/'
                }}
              >
                <Icon name="coach" />
                {t('weak.practice')}
              </button>
            </>
          )}
        </div>
      </Card>

      {bests.length > 0 && (
        <Card icon="trophy" color="amber" title={t('progress.bests')}>
          <ul className="divide-line m-0 flex list-none flex-col divide-y p-0">
            {bests.map((b) => (
              <li key={`${b.mode}-${b.amount}-${b.lang}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-display text-[15px] font-bold">{modeLabel(t, b.mode, b.amount)}</div>
                  <div className="text-muted text-[12.5px]">
                    {t(`lang.${b.lang}.short`)} · {new Date(b.at).toLocaleDateString(uiLang === 'pl' ? 'pl-PL' : 'en-US')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[19px] leading-tight font-bold tabular-nums">
                    {n(b.wpm)} <span className="text-muted text-[12px] font-semibold">{t('stat.wpm')}</span>
                  </div>
                  <div className="text-muted text-[12.5px] tabular-nums">{n(b.accuracy, 1)}%</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Card({ icon, color, title, sub, action, children }: { icon: IconName; color: string; title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass rise p-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`tile ${color}`}>
          <Icon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold">{title}</h2>
          {sub && <p className="text-muted m-0 text-[12.5px]">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function WeakList({ title, items, lang }: { title: string; items: WeakItem[]; lang: Lang }) {
  const t = useT()
  const uiLang = useStore((s) => s.settings.uiLang)
  return (
    <div>
      <div className="label mb-1.5">{title}</div>
      {items.length === 0 ? (
        <p className="text-muted m-0 text-[13px]">{t('weak.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((w) => {
            const ms = avgMs(w.agg)
            return (
              <li key={w.key} className="flex items-center gap-3">
                <kbd className="border-line-2 bg-card font-type min-w-[38px] rounded-lg border px-2 py-1 text-center text-[14px] font-semibold">
                  {w.key.toLocaleUpperCase(lang)}
                </kbd>
                <span className="text-muted text-[13px] tabular-nums">
                  {t('weak.detail', {
                    ms: ms === null ? '-' : formatNumber(uiLang, ms),
                    acc: formatNumber(uiLang, (1 - errorRate(w.agg)) * 100),
                  })}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
