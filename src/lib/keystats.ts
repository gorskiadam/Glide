import type { Keystroke } from '../engine/engine'
import { PAUSE_CAP_MS } from '../engine/flow'

/** Totals for one key or one pair of letters. */
export interface Agg {
  /** Times it was the target. */
  n: number
  /** Times the wrong key was pressed instead. */
  err: number
  /** Total time taken by the correct presses that were timed, in ms. */
  ms: number
  /** Number of correct presses that were timed. */
  timed: number
}

export interface TypingStats {
  /** Keyed by the lower-case character. */
  keys: Record<string, Agg>
  /** Keyed by two lower-case characters typed one after the other inside a word. */
  bigrams: Record<string, Agg>
}

export const emptyStats = (): TypingStats => ({ keys: {}, bigrams: {} })

function bump(map: Record<string, Agg>, key: string, ok: boolean, ms: number | null) {
  const agg = (map[key] ??= { n: 0, err: 0, ms: 0, timed: 0 })
  agg.n++
  if (!ok) agg.err++
  else if (ms !== null) {
    agg.ms += ms
    agg.timed++
  }
}

/** Builds per-key and per-pair statistics from the keystrokes of one test. */
export function collectStats(keystrokes: readonly Keystroke[], locale = 'en'): TypingStats {
  const stats = emptyStats()
  for (let i = 0; i < keystrokes.length; i++) {
    const k = keystrokes[i] as Keystroke
    const prev = keystrokes[i - 1]
    const ms = prev ? Math.min(PAUSE_CAP_MS, k.t - prev.t) : null
    const key = k.expected.toLocaleLowerCase(locale)
    bump(stats.keys, key, k.ok, ms)
    // A pair only counts when the first letter was typed correctly just before.
    if (prev && prev.ok && prev.index === k.index - 1 && key !== ' ' && prev.expected !== ' ') {
      bump(stats.bigrams, prev.expected.toLocaleLowerCase(locale) + key, k.ok, ms)
    }
  }
  return stats
}

function mergeMap(a: Record<string, Agg>, b: Record<string, Agg>): Record<string, Agg> {
  const out: Record<string, Agg> = { ...a }
  for (const [key, v] of Object.entries(b)) {
    const cur = out[key]
    out[key] = cur ? { n: cur.n + v.n, err: cur.err + v.err, ms: cur.ms + v.ms, timed: cur.timed + v.timed } : { ...v }
  }
  return out
}

export function mergeStats(a: TypingStats, b: TypingStats): TypingStats {
  return { keys: mergeMap(a.keys, b.keys), bigrams: mergeMap(a.bigrams, b.bigrams) }
}

export const avgMs = (a: Agg): number | null => (a.timed > 0 ? a.ms / a.timed : null)
export const errorRate = (a: Agg): number => (a.n > 0 ? a.err / a.n : 0)

/** Total presses recorded, used to decide whether there is enough data to judge. */
export function totalPresses(stats: TypingStats): number {
  let n = 0
  for (const a of Object.values(stats.keys)) n += a.n
  return n
}

/** Average time per correct key press across the whole map (space bar excluded), in ms. */
export function overallMs(map: Record<string, Agg>): number | null {
  let ms = 0
  let timed = 0
  for (const [key, a] of Object.entries(map)) {
    // The space bar is pressed between words, where people naturally pause, so it would skew the average.
    if (key.includes(' ')) continue
    ms += a.ms
    timed += a.timed
  }
  return timed > 0 ? ms / timed : null
}

export interface WeakItem {
  key: string
  /** Higher is weaker. */
  score: number
  agg: Agg
}

/**
 * Ranks keys or pairs from weakest to strongest. The score adds three times the
 * error rate to how much slower than average the item is (0.5 = 50% slower).
 * Items seen fewer than `minCount` times are ignored, and so is the space bar.
 */
export function rankWeak(map: Record<string, Agg>, minCount: number): WeakItem[] {
  const base = overallMs(map)
  const out: WeakItem[] = []
  for (const [key, agg] of Object.entries(map)) {
    if (agg.n < minCount || key.includes(' ')) continue
    const ms = avgMs(agg)
    const slow = base && ms ? Math.max(0, ms / base - 1) : 0
    out.push({ key, score: errorRate(agg) * 3 + slow, agg })
  }
  return out.sort((a, b) => b.score - a.score)
}

export interface WeakSpots {
  keys: string[]
  bigrams: string[]
}

/** The few keys and pairs most worth practicing. */
export function weakSpots(stats: TypingStats, count = 4): WeakSpots {
  const pick = (items: WeakItem[]) => items.filter((w) => w.score > 0.05).slice(0, count).map((w) => w.key)
  return { keys: pick(rankWeak(stats.keys, 8)), bigrams: pick(rankWeak(stats.bigrams, 4)) }
}
