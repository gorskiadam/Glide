import { hasBest, type Result } from '../store'

/** Local calendar day of a timestamp, as YYYY-MM-DD. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Number of days in a row with at least one finished test, ending today. If nothing
 * was done today yet, yesterday still counts, so the streak is not shown as lost
 * before the day is over.
 */
export function streak(history: readonly Pick<Result, 'at'>[], now: number): number {
  const days = new Set(history.map((r) => dayKey(r.at)))
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (days.has(dayKey(cursor.getTime()))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** Milliseconds of typing done on the same local day as `now`. */
export function practicedToday(history: readonly Pick<Result, 'at' | 'elapsedMs'>[], now: number): number {
  const today = dayKey(now)
  let ms = 0
  for (const r of history) if (dayKey(r.at) === today) ms += r.elapsedMs
  return ms
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export interface Best {
  mode: Result['mode']
  amount: number
  lang: Result['lang']
  wpm: number
  accuracy: number
  at: number
}

/** The best result for every test setup that has a personal best (zen, coach and lessons have none). */
export function personalBests(history: readonly Result[]): Best[] {
  const map = new Map<string, Best>()
  for (const r of history) {
    if (!hasBest(r.mode)) continue
    const key = `${r.mode}-${r.amount}-${r.lang}`
    const cur = map.get(key)
    if (!cur || r.wpm > cur.wpm) map.set(key, { mode: r.mode, amount: r.amount, lang: r.lang, wpm: r.wpm, accuracy: r.accuracy, at: r.at })
  }
  return [...map.values()].sort((a, b) => b.wpm - a.wpm)
}
