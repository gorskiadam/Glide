import type { Lang } from '../content'
import type { IconName } from '../components/Icon'
import type { Translate } from '../i18n'
import { TIME_OPTIONS, WORD_OPTIONS, type Pace, type Settings } from '../store'

export interface Command {
  id: string
  label: string
  icon: IconName
  run: () => void
}

/** Lower case, without accents, so "cwicz" finds "Ćwicz". */
export function fold(text: string): string {
  return text
    .toLocaleLowerCase('pl')
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Commands whose label contains every word of the query, in the original order. */
export function filterCommands<T extends { label: string }>(commands: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...commands]
  return commands.filter((c) => {
    const label = fold(c.label)
    return words.every((w) => label.includes(w))
  })
}

/** Everything the command palette can do. */
export function buildCommands(t: Translate, settings: Settings, update: (patch: Partial<Settings>) => void, go: (hash: string) => void): Command[] {
  const page = (id: string, hash: string, icon: IconName, name: string): Command => ({ id, icon, label: t('palette.go', { page: name }), run: () => go(hash) })
  const practice = (patch: Partial<Settings>) => () => {
    update(patch)
    go('#/')
  }
  const langs: Lang[] = ['en', 'pl']
  const paces: Pace[] = ['off', 'average', 'best']
  return [
    page('go-practice', '#/', 'keyboard', t('nav.practice')),
    page('go-lessons', '#/lessons', 'steps', t('nav.lessons')),
    page('go-daily', '#/daily', 'calendar', t('daily.title')),
    page('go-warmup', '#/warmup', 'flame', t('warmup.title')),
    page('go-sprint', '#/sprint', 'message', t('sprint.title')),
    page('go-progress', '#/progress', 'chart', t('nav.progress')),
    page('go-settings', '#/settings', 'settings', t('nav.settings')),
    ...TIME_OPTIONS.map((n): Command => ({ id: `time-${n}`, icon: 'clock', label: t('palette.seconds', { n }), run: practice({ mode: 'time', seconds: n }) })),
    ...WORD_OPTIONS.map((n): Command => ({ id: `words-${n}`, icon: 'type', label: t('palette.words', { n }), run: practice({ mode: 'words', words: n }) })),
    { id: 'mode-passage', icon: 'book', label: t('palette.mode', { mode: t('practice.mode.passage') }), run: practice({ mode: 'passage' }) },
    { id: 'mode-zen', icon: 'wave', label: t('palette.mode', { mode: t('practice.mode.zen') }), run: practice({ mode: 'zen' }) },
    { id: 'mode-coach', icon: 'coach', label: t('palette.mode', { mode: t('practice.mode.coach') }), run: practice({ mode: 'coach' }) },
    ...langs.map((l): Command => ({ id: `content-${l}`, icon: 'globe', label: t('palette.contentLang', { lang: t(`lang.${l}`) }), run: () => update({ contentLang: l }) })),
    ...langs.map((l): Command => ({ id: `ui-${l}`, icon: 'globe', label: t('palette.uiLang', { lang: t(`lang.${l}`) }), run: () => update({ uiLang: l }) })),
    { id: 'theme-light', icon: 'sun', label: t('palette.theme', { theme: t('settings.theme.light') }), run: () => update({ theme: 'light' }) },
    { id: 'theme-dark', icon: 'moon', label: t('palette.theme', { theme: t('settings.theme.dark') }), run: () => update({ theme: 'dark' }) },
    { id: 'theme-system', icon: 'monitor', label: t('palette.theme', { theme: t('settings.theme.system') }), run: () => update({ theme: 'system' }) },
    { id: 'sound', icon: 'volume', label: t(settings.sound ? 'palette.sound.off' : 'palette.sound.on'), run: () => update({ sound: !settings.sound }) },
    ...paces.map((p): Command => ({ id: `pace-${p}`, icon: 'gauge', label: t('palette.pace', { value: t(`pace.${p}`) }), run: () => update({ pace: p }) })),
  ]
}
