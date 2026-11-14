import { useCallback, useMemo } from 'react'
import { Icon } from '../components/Icon'
import { Session } from '../components/Session'
import { formatNumber, useT } from '../i18n'
import { dailyText } from '../lib/daily'
import { dayKey } from '../lib/progress'
import { useTexts } from '../lib/useTexts'
import { useStore } from '../store'
import type { Outcome } from './Practice'

export function Daily({ onTypingChange }: { onTypingChange: (typing: boolean) => void }) {
  const t = useT()
  const lang = useStore((s) => s.settings.contentLang)
  const uiLang = useStore((s) => s.settings.uiLang)
  const daily = useStore((s) => s.daily)
  const saveDaily = useStore((s) => s.saveDaily)
  const texts = useTexts(lang)
  const day = dayKey(Date.now())
  const key = `${day}:${lang}`
  const score = daily[key]
  const days = new Set(Object.keys(daily).map((k) => k.split(':')[0])).size

  const segments = useMemo(() => {
    const item = texts ? dailyText(texts, day) : null
    return item ? [item.text] : []
  }, [texts, day])
  const onFinish = useCallback(
    (outcome: Outcome) => saveDaily(key, outcome.stats.wpm, outcome.stats.accuracy, outcome.flow),
    [key, saveDaily],
  )

  const pills = (
    <div className="flex flex-wrap gap-2">
      <span className="pill accent">
        <Icon name="calendar" />
        {new Date().toLocaleDateString(uiLang === 'pl' ? 'pl-PL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <span className="pill">{t(`lang.${lang}.short`)}</span>
      {score && (
        <>
          <span className="pill good">
            <Icon name="trophy" />
            {t('daily.best', { n: formatNumber(uiLang, score.wpm) })}
          </span>
          <span className="pill">{t('daily.tries', { n: score.tries })}</span>
        </>
      )}
      {days > 0 && <span className="pill">{t('daily.days', { n: days })}</span>}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="fade-on-type">
        <h1 className="text-[27px] font-extrabold">{t('daily.title')}</h1>
        <p className="text-muted m-0 mt-1 mb-3">{t('daily.sub')}</p>
        {pills}
      </header>
      <Session
        segments={segments}
        lang={lang}
        mode="daily"
        amount={0}
        counter="words"
        onTypingChange={onTypingChange}
        onFinish={onFinish}
        nextLabel={t('daily.back')}
        onNext={() => {
          window.location.hash = '#/'
        }}
      />
    </div>
  )
}
