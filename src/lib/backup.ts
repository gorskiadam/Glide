import { LANGS, type Lang } from '../content'
import { defaults, type Result, type SavedData, type Settings } from '../store'
import type { Agg, TypingStats } from './keystats'

export const BACKUP_APP = 'glide'
export const BACKUP_VERSION = 1

export function makeBackup(data: SavedData, now: number): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), data }, null, 2)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang)

function result(v: unknown): Result | null {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.mode !== 'string' || !isLang(v.lang)) return null
  const numbers = ['at', 'amount', 'wpm', 'rawWpm', 'accuracy', 'consistency', 'errors', 'elapsedMs', 'correctChars', 'incorrectChars'] as const
  if (!numbers.every((key) => isNumber(v[key]))) return null
  if (v.flow !== undefined && !isNumber(v.flow)) return null
  return v as unknown as Result
}

function aggs(v: unknown): Record<string, Agg> {
  const out: Record<string, Agg> = {}
  if (!isObject(v)) return out
  for (const [key, a] of Object.entries(v)) {
    if (isObject(a) && isNumber(a.n) && isNumber(a.err) && isNumber(a.ms) && isNumber(a.timed)) out[key] = { n: a.n, err: a.err, ms: a.ms, timed: a.timed }
  }
  return out
}

const stats = (v: unknown): TypingStats => ({ keys: aggs(isObject(v) ? v.keys : null), bigrams: aggs(isObject(v) ? v.bigrams : null) })

/** Settings that must be one of a fixed list of words. */
const CHOICES: Record<string, readonly string[]> = {
  uiLang: LANGS,
  contentLang: LANGS,
  theme: ['light', 'dark', 'system'],
  mode: ['time', 'words', 'passage', 'zen', 'coach'],
  passageLength: ['short', 'medium', 'long'],
  category: ['all', 'quick', 'everyday', 'work', 'school', 'stories', 'practical', 'numbers'],
  soundPack: ['soft', 'thock', 'typewriter'],
  caret: ['line', 'block', 'underline'],
  fontSize: ['s', 'm', 'l', 'xl'],
  font: ['mono', 'sans', 'dyslexic'],
  pace: ['off', 'average', 'best', 'custom'],
}

/** Only known settings of the right type are taken; everything else keeps its default. */
function settings(v: unknown): Settings {
  const base = defaults()
  if (!isObject(v)) return base
  const out = base as unknown as Record<string, unknown>
  for (const key of Object.keys(base)) {
    const value = v[key]
    if (typeof value !== typeof out[key]) continue
    const allowed = CHOICES[key]
    if (allowed && !allowed.includes(value as string)) continue
    out[key] = value
  }
  return base
}

function scores<T>(v: unknown, fields: readonly string[]): Record<string, T> {
  const out: Record<string, T> = {}
  if (!isObject(v)) return out
  for (const [key, s] of Object.entries(v)) {
    if (isObject(s) && fields.every((f) => isNumber(s[f]))) out[key] = s as T
  }
  return out
}

/**
 * Reads a backup file. Returns null when it is not a Glide backup; damaged parts
 * inside a real backup are dropped rather than trusted.
 */
export function parseBackup(text: string): SavedData | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP || raw.version !== BACKUP_VERSION || !isObject(raw.data)) return null
  const d = raw.data
  const typing = isObject(d.typing) ? d.typing : {}
  return {
    settings: settings(d.settings),
    history: Array.isArray(d.history) ? d.history.flatMap((r) => result(r) ?? []) : [],
    typing: { en: stats(typing.en), pl: stats(typing.pl) },
    lessons: scores(d.lessons, ['stars', 'wpm', 'accuracy']),
    daily: scores(d.daily, ['wpm', 'accuracy', 'flow', 'tries']),
  }
}
