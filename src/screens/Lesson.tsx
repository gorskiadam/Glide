import { useCallback, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Session } from '../components/Session'
import { formatNumber, useT, type MessageKey } from '../i18n'
import { keyPress } from '../lib/layout'
import { STAR_ACCURACY, findLesson, lessonText, nextLesson, starsFor, unitsFor } from '../lib/lessons'
import { useTexts } from '../lib/useTexts'
import { useStore } from '../store'
import { Stars, lessonName } from './Lessons'
import type { Outcome } from './Practice'

const BackLink = ({ label }: { label: string }) => (
  <a className="btn ghost fade-on-type self-start no-underline" href="#/lessons">
    <Icon name="arrowLeft" />
    {label}
  </a>
)

export function Lesson({ id, onTypingChange }: { id: string; onTypingChange: (typing: boolean) => void }) {
  const t = useT()
  const lang = useStore((s) => s.settings.contentLang)
  const uiLang = useStore((s) => s.settings.uiLang)
  const saveLesson = useStore((s) => s.saveLesson)
  const texts = useTexts(lang)
  const lesson = findLesson(id)
  const [deal, setDeal] = useState(0)
  const [stars, setStars] = useState(0)

  const segments = useMemo(
    () => (texts && lesson ? [lessonText(lesson, texts, lang)] : []),
    // `deal` is here on purpose: raising it deals a new text for the same lesson.
    [texts, lesson, lang, deal],
  )
  const onFinish = useCallback(
    (outcome: Outcome) => {
      const earned = starsFor(outcome.stats.accuracy)
      setStars(earned)
      saveLesson(id, { stars: earned, wpm: outcome.stats.wpm, accuracy: outcome.stats.accuracy })
    },
    [id, saveLesson],
  )

  if (!lesson || (lesson.unit === 'polish' && lang !== 'pl')) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink label={t('lessons.back')} />
        <section className="glass rise px-6 py-10 text-center font-semibold">{t(lesson ? 'lessons.polishOnly' : 'lessons.missing')}</section>
      </div>
    )
  }

  const unit = unitsFor(lang).find((u) => u.id === lesson.unit)
  const number = (unit?.lessons.findIndex((l) => l.id === id) ?? 0) + 1
  const next = nextLesson(id, lang)
  const passed = stars > 0
  const intro =
    lesson.kind === 'review' ? t('lesson.intro.review') : lesson.kind === 'capitals' ? t('lesson.intro.capitals') : lesson.unit === 'polish' ? t('lesson.intro.polish') : null

  return (
    <div className="flex flex-col gap-4">
      <BackLink label={t('lessons.back')} />
      <header className="fade-on-type">
        <h1 className="text-[25px] font-extrabold">
          {t('lesson.title', { unit: t(`lessons.unit.${lesson.unit}`), n: number })}
          <span className="text-accent-text">{`: ${lessonName(t, lesson, lang)}`}</span>
        </h1>
        {lesson.kind === 'keys' && (
          <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[13.5px]" aria-label={t('lesson.new')}>
            {Array.from(lesson.keys).map((key) => {
              const press = keyPress(key)
              return (
                <li key={key} className="flex items-center gap-1.5">
                  <span className="pill accent font-type">{key.toLocaleUpperCase(lang)}</span>
                  {press && <span className="text-fg-2">{t(`finger.${press.finger}` as MessageKey)}</span>}
                </li>
              )
            })}
          </ul>
        )}
        {intro && <p className="text-fg-2 m-0 mt-2">{intro}</p>}
        <p className="text-muted m-0 mt-2 text-[13.5px]">{t('lesson.goal', { n: STAR_ACCURACY[0] })}</p>
      </header>

      <Session
        segments={segments}
        lang={lang}
        mode="lesson"
        amount={0}
        counter="words"
        guide
        onNewText={() => setDeal((d) => d + 1)}
        onTypingChange={onTypingChange}
        onFinish={onFinish}
        nextLabel={passed ? t(next ? 'lesson.next' : 'lesson.toList') : t('practice.restart')}
        onNext={() => {
          if (!passed) setDeal((d) => d + 1)
          else window.location.hash = next ? `#/lessons/${next.id}` : '#/lessons'
        }}
        resultExtra={(outcome) => (
          <div className={`lesson-banner ${passed ? 'pass' : ''}`} role="status">
            <Stars count={stars} />
            <div>
              <div className="font-display text-[16px] font-bold">{t(passed ? 'lesson.pass' : 'lesson.fail')}</div>
              <div className="text-fg-2 text-[13px]">
                {passed
                  ? t('lesson.pass.help', { acc: formatNumber(uiLang, outcome.stats.accuracy, 1), n: STAR_ACCURACY[2] })
                  : t('lesson.fail.help', { n: STAR_ACCURACY[0] })}
              </div>
            </div>
          </div>
        )}
      />
    </div>
  )
}
