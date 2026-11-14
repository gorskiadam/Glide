import { useCallback } from 'react'
import type { Lang } from '../content'
import { useStore } from '../store'
import { en, type MessageKey, type Messages } from './en'
import { pl } from './pl'

const dictionaries: Record<Lang, Messages> = { en, pl }

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

export function translate(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string {
  let text = dictionaries[lang][key]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
  return text
}

/** Returns a `t` function bound to the current app language. */
export function useT(): Translate {
  const lang = useStore((s) => s.settings.uiLang)
  return useCallback<Translate>((key, params) => translate(lang, key, params), [lang])
}

/** Formats a number the way the app language expects (decimal comma in Polish). */
export function formatNumber(lang: Lang, value: number, digits = 0): string {
  return value.toLocaleString(lang === 'pl' ? 'pl-PL' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export type { MessageKey }
