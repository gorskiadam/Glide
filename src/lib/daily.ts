import type { TextItem } from '../content'

/** FNV-1a: a small, stable hash, so that a date picks the same text on every device. */
export function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The text of the daily challenge: the same for everyone on the same calendar day.
 * Medium-length texts only, so the challenge takes about the same effort every day.
 */
export function dailyText(texts: readonly TextItem[], day: string): TextItem | null {
  const medium = texts.filter((item) => item.length === 'medium')
  const pool = (medium.length > 0 ? medium : [...texts]).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (pool.length === 0) return null
  return pool[hash(day) % pool.length] as TextItem
}

export interface DailyScore {
  wpm: number
  accuracy: number
  flow: number
  tries: number
}

/** Keeps the fastest attempt of the day and counts the tries. */
export function betterDaily(old: DailyScore | undefined, wpm: number, accuracy: number, flow: number): DailyScore {
  const tries = (old?.tries ?? 0) + 1
  return old && old.wpm >= wpm ? { ...old, tries } : { wpm, accuracy, flow, tries }
}
