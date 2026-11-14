import type { Lang } from '../content'
import { formatNumber, type MessageKey, type Translate } from '../i18n'
import { LENGTH_OPTIONS, type ResultMode } from '../store'

/** "30 second test", "Passage (short)", "Zen session" and so on. */
export function modeLabel(t: Translate, mode: ResultMode, amount: number): string {
  if (mode === 'passage') {
    return t('result.mode.passage', { n: t(`length.${LENGTH_OPTIONS[amount - 1] ?? 'medium'}`).toLowerCase() })
  }
  return t(`result.mode.${mode}`, { n: amount })
}

/** "12 min" or "1 h 5 min". Anything above zero shows as at least one minute. */
export function durationLabel(t: Translate, ms: number): string {
  const minutes = ms <= 0 ? 0 : Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return t('time.min', { n: minutes })
  return t('time.hm', { h: Math.floor(minutes / 60), m: minutes % 60 })
}

/** The word that goes with a Flow Score. */
export function flowLevel(score: number): MessageKey {
  if (score >= 85) return 'flow.level.gliding'
  if (score >= 70) return 'flow.level.smooth'
  if (score >= 50) return 'flow.level.finding'
  return 'flow.level.choppy'
}

export const num = (lang: Lang, value: number, digits = 0) => formatNumber(lang, value, digits)
