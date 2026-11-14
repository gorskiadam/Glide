import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Seg } from '../components/Seg'
import { Switch } from '../components/Switch'
import type { Lang } from '../content'
import { useT, type MessageKey } from '../i18n'
import { makeBackup, parseBackup } from '../lib/backup'
import { dayKey } from '../lib/progress'
import { SOUND_PACKS, playKey, type SoundPack } from '../lib/sound'
import { useStore, type Pace, type CaretStyle, type FontSize, type Settings as SettingsState, type Theme, type TypeFont } from '../store'

/** Settings that are a plain on/off value. */
type BooleanKey = { [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never }[keyof SettingsState]

export function Settings() {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.update)
  const resetAll = useStore((s) => s.resetAll)
  const importData = useStore((s) => s.importData)
  const [status, setStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [installer, setInstaller] = useState<InstallPrompt | null>(null)

  // Browsers that can install the app announce it with this event.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstaller(e as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const exportData = () => {
    const { settings, history, typing, lessons, daily } = useStore.getState()
    const url = URL.createObjectURL(new Blob([makeBackup({ settings, history, typing, lessons, daily }, Date.now())], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `glide-backup-${dayKey(Date.now())}.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setStatus(t('settings.export.done'))
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    const data = parseBackup(await file.text())
    if (!data) return setStatus(t('settings.import.bad'))
    if (!window.confirm(t('settings.import.confirm', { n: data.history.length }))) return
    importData(data)
    setStatus(t('settings.import.done'))
  }

  const langOptions = [
    { value: 'en' as Lang, label: t('lang.en') },
    { value: 'pl' as Lang, label: t('lang.pl') },
  ]

  const toggle = (key: BooleanKey, icon: IconName, color: string) => (
    <Row icon={icon} color={color} title={t(`settings.${key}` as MessageKey)} desc={t(`settings.${key}.desc` as MessageKey)}>
      <Switch label={t(`settings.${key}` as MessageKey)} checked={settings[key]} onChange={(v) => update({ [key]: v })} />
    </Row>
  )

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-[27px] font-extrabold">{t('settings.title')}</h1>
        <p className="text-muted m-0 mt-1">{t('settings.sub')}</p>
      </header>

      <Card title={t('settings.language')}>
        <Row icon="globe" color="blue" title={t('settings.uiLang')} desc={t('settings.uiLang.desc')}>
          <Seg label={t('settings.uiLang')} value={settings.uiLang} options={langOptions} onChange={(v) => update({ uiLang: v })} />
        </Row>
        <Row icon="book" color="violet" title={t('settings.contentLang')} desc={t('settings.contentLang.desc')}>
          <Seg label={t('settings.contentLang')} value={settings.contentLang} options={langOptions} onChange={(v) => update({ contentLang: v })} />
        </Row>
      </Card>

      <Card title={t('settings.appearance')}>
        <Row icon="sun" color="amber" title={t('settings.theme')} desc={t('settings.theme.desc')}>
          <Seg<Theme>
            label={t('settings.theme')}
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'light', label: [<Icon key="i" name="sun" />, t('settings.theme.light')] },
              { value: 'dark', label: [<Icon key="i" name="moon" />, t('settings.theme.dark')] },
              { value: 'system', label: [<Icon key="i" name="monitor" />, t('settings.theme.system')] },
            ]}
          />
        </Row>
        <Row icon="type" color="violet" title={t('settings.font')} desc={t('settings.font.desc')}>
          <Seg<TypeFont>
            label={t('settings.font')}
            value={settings.font}
            onChange={(v) => update({ font: v })}
            options={(['mono', 'sans', 'dyslexic'] as const).map((f) => ({ value: f, label: t(`font.${f}`) }))}
          />
        </Row>
        <Row icon="type" color="blue" title={t('settings.fontSize')} desc={t('settings.fontSize.desc')}>
          <Seg<FontSize>
            label={t('settings.fontSize')}
            value={settings.fontSize}
            onChange={(v) => update({ fontSize: v })}
            options={(['s', 'm', 'l', 'xl'] as const).map((s) => ({ value: s, label: t(`size.${s}`) }))}
          />
        </Row>
        <Row icon="caret" color="teal" title={t('settings.caret')} desc={t('settings.caret.desc')}>
          <Seg<CaretStyle>
            label={t('settings.caret')}
            value={settings.caret}
            onChange={(v) => update({ caret: v })}
            options={(['line', 'block', 'underline'] as const).map((c) => ({ value: c, label: t(`caret.${c}`) }))}
          />
        </Row>
        {toggle('smoothCaret', 'wave', 'violet')}
        {toggle('reduceMotion', 'pause', 'rose')}
      </Card>

      <Card title={t('settings.soundGroup')}>
        {toggle('sound', 'volume', 'green')}
        <Row icon="music" color="amber" title={t('settings.soundPack')} desc={t('settings.soundPack.desc')}>
          <Seg<SoundPack>
            label={t('settings.soundPack')}
            value={settings.soundPack}
            onChange={(v) => {
              update({ soundPack: v })
              // A short preview: three keys and a space.
              ;[0, 90, 180, 300].forEach((ms, i) => window.setTimeout(() => playKey(v, i === 3 ? 'space' : 'key'), ms))
            }}
            options={SOUND_PACKS.map((p) => ({ value: p, label: t(`pack.${p}`) }))}
          />
        </Row>
      </Card>

      <Card title={t('settings.typing')}>
        <Row icon="gauge" color="teal" title={t('settings.liveWpm')} desc={t('settings.liveWpm.desc')}>
          <Switch label={t('settings.liveWpm')} checked={settings.showLiveWpm} onChange={(v) => update({ showLiveWpm: v })} />
        </Row>
        {toggle('strict', 'shield', 'blue')}
        {toggle('stopOnError', 'x', 'rose')}
        <Row icon="gauge" color="blue" title={t('settings.pace')} desc={t('settings.pace.desc')}>
          <Seg<Pace>
            label={t('settings.pace')}
            value={settings.pace}
            onChange={(v) => update({ pace: v })}
            options={(['off', 'average', 'best', 'custom'] as const).map((p) => ({ value: p, label: t(`pace.${p}`) }))}
          />
          {settings.pace === 'custom' && (
            <input
              type="number"
              className="number-input"
              aria-label={t('settings.paceWpm')}
              min={10}
              max={250}
              step={5}
              value={settings.paceWpm}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) update({ paceWpm: Math.min(250, Math.max(0, Math.round(n))) })
              }}
            />
          )}
        </Row>
      </Card>

      <Card title={t('settings.text')}>
        {toggle('punctuation', 'quote', 'violet')}
        {toggle('numbers', 'hash', 'green')}
        {toggle('capitals', 'type', 'amber')}
      </Card>

      <Card title={t('settings.data')}>
        <Row icon="download" color="blue" title={t('settings.export')} desc={t('settings.export.desc')}>
          <button type="button" className="btn soft" onClick={exportData}>
            {t('settings.export.button')}
          </button>
        </Row>
        <Row icon="share" color="teal" title={t('settings.import')} desc={t('settings.import.desc')}>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void importFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <button type="button" className="btn soft" onClick={() => fileRef.current?.click()}>
            {t('settings.import.button')}
          </button>
        </Row>
        {installer && (
          <Row icon="monitor" color="violet" title={t('settings.install')} desc={t('settings.install.desc')}>
            <button
              type="button"
              className="btn soft"
              onClick={() => {
                void installer.prompt()
                setInstaller(null)
              }}
            >
              {t('settings.install.button')}
            </button>
          </Row>
        )}
        <Row icon="trash" color="rose" title={t('settings.reset')} desc={t('settings.reset.desc')}>
          <button
            type="button"
            className="btn ghost danger"
            onClick={() => {
              if (!window.confirm(t('settings.reset.confirm'))) return
              resetAll()
              setStatus(t('settings.reset.done'))
            }}
          >
            {t('settings.reset')}
          </button>
        </Row>
        <p className="text-good m-0 min-h-5 text-[13px] font-semibold" role="status">
          {status}
        </p>
        <p className="text-muted m-0 flex items-center gap-2 text-[13px]">
          <Icon name="shield" className="h-4 w-4 shrink-0" />
          {t('settings.privacy')} {t('settings.offline')}
        </p>
      </Card>
    </div>
  )
}

/** The event Chromium fires when the app can be installed. */
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="glass rise px-5 py-4 sm:px-6">
      <h2 className="label mb-1">{title}</h2>
      <div className="divide-line flex flex-col divide-y">{children}</div>
    </section>
  )
}

function Row({ icon, color, title, desc, children }: { icon: IconName; color: string; title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
      <span className={`tile ${color}`}>
        <Icon name={icon} />
      </span>
      <div className="min-w-[180px] flex-1">
        <div className="font-display text-[15.5px] font-bold">{title}</div>
        <div className="text-muted text-[13px]">{desc}</div>
      </div>
      {children}
    </div>
  )
}
