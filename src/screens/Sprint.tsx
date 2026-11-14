import { useMemo, useState } from 'react'
import { Session } from '../components/Session'
import { useT } from '../i18n'
import { SPRINT_MESSAGES } from '../lib/sprint'
import { shuffle } from '../lib/textgen'
import { useTexts } from '../lib/useTexts'
import { useStore } from '../store'


export function Sprint({ onTypingChange }: { onTypingChange: (typing: boolean) => void }) {
  const t = useT()
  const lang = useStore((s) => s.settings.contentLang)
  const texts = useTexts(lang)
  const [deal, setDeal] = useState(0)

  const segments = useMemo(
    () => (texts ? shuffle(texts.filter((item) => item.category === 'quick')).slice(0, SPRINT_MESSAGES).map((item) => item.text) : []),
    // `deal` is here on purpose: raising it deals new messages.
    [texts, deal],
  )
  const again = () => setDeal((d) => d + 1)

  return (
    <div className="flex flex-col gap-4">
      <header className="fade-on-type">
        <h1 className="text-[27px] font-extrabold">{t('sprint.title')}</h1>
        <p className="text-muted m-0 mt-1">{t('sprint.sub')}</p>
      </header>
      <Session
        segments={segments}
        lang={lang}
        mode="sprint"
        amount={SPRINT_MESSAGES}
        counter="messages"
        onNewText={again}
        onTypingChange={onTypingChange}
        nextLabel={t('sprint.next')}
        onNext={again}
        above={(done) =>
          done > 0 && (
            <ol className="chat" aria-label={t('sprint.sent')}>
              {segments.slice(0, done).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ol>
          )
        }
      />
    </div>
  )
}
