import { useMemo, useState } from 'react'
import { Session } from '../components/Session'
import { useT } from '../i18n'
import { average } from '../lib/progress'
import { useTexts } from '../lib/useTexts'
import { warmupSegments } from '../lib/warmup'
import { isDrill, useStore } from '../store'

const STEPS = ['warmup.step.1', 'warmup.step.2', 'warmup.step.3'] as const

export function Warmup({ onTypingChange }: { onTypingChange: (typing: boolean) => void }) {
  const t = useT()
  const lang = useStore((s) => s.settings.contentLang)
  const texts = useTexts(lang)
  const [deal, setDeal] = useState(0)

  const segments = useMemo(() => {
    if (!texts) return []
    // Sized for about a minute at the speed of the last few tests (40 WPM before there are any).
    const recent = useStore.getState().history.filter((r) => r.lang === lang && !isDrill(r.mode)).slice(-10)
    return warmupSegments(texts, lang, recent.length > 0 ? average(recent.map((r) => r.wpm)) : 40)
    // `deal` is here on purpose: raising it deals a new warm-up.
  }, [texts, lang, deal])
  const again = () => setDeal((d) => d + 1)

  return (
    <div className="flex flex-col gap-4">
      <header className="fade-on-type">
        <h1 className="text-[27px] font-extrabold">{t('warmup.title')}</h1>
        <p className="text-muted m-0 mt-1">{t('warmup.sub')}</p>
      </header>
      <Session
        segments={segments}
        lang={lang}
        mode="warmup"
        amount={0}
        counter="messages"
        counterLabel={t('warmup.steps')}
        onNewText={again}
        onTypingChange={onTypingChange}
        nextLabel={t('progress.start')}
        onNext={() => {
          window.location.hash = '#/'
        }}
        above={(done) => (
          <ol className="steps" aria-label={t('warmup.steps')}>
            {STEPS.slice(0, segments.length).map((key, i) => (
              <li key={key} data-state={i < done ? 'done' : i === done ? 'now' : 'next'} aria-current={i === done ? 'step' : undefined}>
                <span aria-hidden="true">{i + 1}</span>
                {t(key)}
              </li>
            ))}
          </ol>
        )}
      />
    </div>
  )
}
