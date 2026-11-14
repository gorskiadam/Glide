import { Icon, type IconName } from '../components/Icon'
import { Seg } from '../components/Seg'
import type { Lang } from '../content'
import { useT, type Translate } from '../i18n'
import { isUnlocked, unitsFor, type Lesson, type UnitId } from '../lib/lessons'
import { useStore } from '../store'

const UNIT_LOOK: Record<UnitId, { icon: IconName; color: string }> = {
  home: { icon: 'keyboard', color: 'violet' },
  top: { icon: 'type', color: 'blue' },
  bottom: { icon: 'caret', color: 'teal' },
  numbers: { icon: 'hash', color: 'amber' },
  symbols: { icon: 'quote', color: 'rose' },
  polish: { icon: 'globe', color: 'green' },
}

/** "F J", "Review" or "Capitals". */
export function lessonName(t: Translate, lesson: Lesson, lang: Lang): string {
  if (lesson.kind === 'review') return t('lessons.review')
  if (lesson.kind === 'capitals') return t('lessons.capitals')
  return Array.from(lesson.keys.toLocaleUpperCase(lang)).join(' ')
}

export function Stars({ count }: { count: number }) {
  return (
    <span className="stars" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <Icon key={i} name="star" className={i <= count ? 'on' : undefined} />
      ))}
    </span>
  )
}

export function Lessons() {
  const t = useT()
  const lang = useStore((s) => s.settings.contentLang)
  const update = useStore((s) => s.update)
  const done = useStore((s) => s.lessons)
  const units = unitsFor(lang)
  const all = units.flatMap((u) => u.lessons)
  const passed = all.filter((l) => (done[l.id]?.stars ?? 0) > 0).length

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-[560px]">
          <h1 className="text-[27px] font-extrabold">{t('lessons.title')}</h1>
          <p className="text-muted m-0 mt-1">{t('lessons.sub')}</p>
        </div>
        <Seg<Lang>
          label={t('practice.language')}
          value={lang}
          onChange={(v) => update({ contentLang: v })}
          options={[
            { value: 'en', label: [<Icon key="i" name="globe" />, 'EN'], ariaLabel: t('lang.en') },
            { value: 'pl', label: 'PL', ariaLabel: t('lang.pl') },
          ]}
        />
      </header>

      <div>
        <span className="pill accent">
          <Icon name="check" />
          {t('lessons.progress', { done: passed, total: all.length })}
        </span>
      </div>

      {units.map((unit, u) => (
        <section key={unit.id} className="glass rise p-4 sm:p-5" style={{ animationDelay: `${u * 40}ms` }} aria-labelledby={`unit-${unit.id}`}>
          <div className="mb-3.5 flex items-center gap-3">
            <span className={`tile ${UNIT_LOOK[unit.id].color}`}>
              <Icon name={UNIT_LOOK[unit.id].icon} />
            </span>
            <div className="min-w-0">
              <h2 id={`unit-${unit.id}`} className="text-[17px] font-bold">
                {t(`lessons.unit.${unit.id}`)}
              </h2>
              <p className="text-muted m-0 text-[13px]">{t(`lessons.unit.${unit.id}.desc`)}</p>
            </div>
          </div>
          <ol className="lesson-grid">
            {unit.lessons.map((lesson, i) => {
              const stars = done[lesson.id]?.stars ?? 0
              const name = lessonName(t, lesson, lang)
              const body = (
                <>
                  <span className="lesson-n">{i + 1}</span>
                  <span className={`lesson-keys ${lesson.kind === 'keys' ? 'font-type' : ''}`}>{name}</span>
                </>
              )
              return (
                <li key={lesson.id}>
                  {isUnlocked(lesson, done) ? (
                    <a className="lesson" href={`#/lessons/${lesson.id}`} data-done={stars > 0}>
                      {body}
                      <Stars count={stars} />
                      <span className="sr-only">, {stars > 0 ? t('lessons.stars', { n: stars }) : t('lessons.notDone')}</span>
                    </a>
                  ) : (
                    <span className="lesson" aria-disabled="true">
                      {body}
                      <Icon name="lock" className="lesson-lock" />
                      <span className="sr-only">, {t('lessons.locked')}</span>
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      {lang !== 'pl' && <p className="text-muted m-0 px-1 text-[13px]">{t('lessons.polishOnly')}</p>}
    </div>
  )
}
