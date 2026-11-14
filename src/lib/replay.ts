import type { LogEvent } from '../engine/engine'

/** A finished run, as it was typed: the text and every key and backspace in order. */
export interface Recording {
  target: string[]
  log: LogEvent[]
}

/** Pauses longer than this are shortened when a run is played back. */
export const REPLAY_PAUSE_CAP_MS = 1500
/** Gaps above this are thinking time, not key speed, and stay out of the averages. */
const GAP_CAP_MS = 2000

/**
 * Joins runs typed one after another (the messages of a sprint) into one recording.
 * The texts are joined with a space that is never typed.
 */
export function joinRecordings(runs: readonly (Recording & { elapsedMs: number })[]): Recording {
  const target: string[] = []
  const log: LogEvent[] = []
  let time = 0
  for (const run of runs) {
    if (target.length > 0) target.push(' ')
    const offset = target.length
    target.push(...run.target)
    for (const e of run.log) {
      log.push(e.kind === 'key' ? { ...e, t: e.t + time, pos: e.pos + offset, index: e.index + offset } : { ...e, t: e.t + time, pos: e.pos + offset })
    }
    // A short breath between runs, so the replay does not jump.
    time += run.elapsedMs + 400
  }
  return { target, log }
}

/** When each event happens in the replay: real rhythm, with long pauses shortened. */
export function playTimes(log: readonly LogEvent[], cap = REPLAY_PAUSE_CAP_MS): number[] {
  const out: number[] = []
  let at = 0
  log.forEach((e, i) => {
    if (i > 0) at += Math.min(cap, Math.max(0, e.t - (log[i - 1] as LogEvent).t))
    out.push(at)
  })
  return out
}

/** What was on screen after the first `count` events: the character typed at each position, and the caret. */
export function typedAt(log: readonly LogEvent[], count: number): { typed: (string | undefined)[]; pos: number } {
  const typed: (string | undefined)[] = []
  let pos = 0
  for (let i = 0; i < count && i < log.length; i++) {
    const e = log[i] as LogEvent
    // A wrong key in stop-on-error mode does not move the caret and leaves nothing behind.
    if (e.kind === 'key' && e.pos > e.index) typed[e.index] = e.typed
    typed.length = Math.min(typed.length, e.pos)
    pos = e.pos
  }
  return { typed, pos }
}

/** Milliseconds before each event since the one before it (0 for the first). */
export function gaps(log: readonly LogEvent[]): number[] {
  return log.map((e, i) => (i === 0 ? 0 : Math.max(0, e.t - (log[i - 1] as LogEvent).t)))
}

export interface Confusion {
  expected: string
  typed: string
  n: number
  /** Index of the first event where it happened. */
  at: number
}

export interface Insights {
  keys: number
  errors: number
  backspaces: number
  /** Average time between keys, pauses left out. */
  meanGap: number
  /** Wrong keys, grouped by what was expected and what was pressed, most frequent first. */
  confusions: Confusion[]
  /** Keys that took clearly longer than the average, slowest first. */
  slowKeys: { key: string; ms: number }[]
  /** The longest pause, if there was a real one. */
  pause: { ms: number; word: string; at: number } | null
  /** True when mistakes mostly came right after faster-than-usual keystrokes. */
  rushed: boolean
}

function wordAt(target: readonly string[], index: number): string {
  let from = Math.min(index, target.length - 1)
  // A pause on a space belongs to the word that follows it.
  while (from < target.length - 1 && target[from] === ' ') from++
  let to = from
  while (from > 0 && target[from - 1] !== ' ') from--
  while (to < target.length && target[to] !== ' ') to++
  return target.slice(from, to).join('')
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] as number
}

/** Looks at a run for the things worth working on. */
export function analyse(rec: Recording, locale = 'en'): Insights {
  const { log, target } = rec
  const gap = gaps(log)
  const fold = (c: string) => c.toLocaleLowerCase(locale)

  let keys = 0
  let errors = 0
  let backspaces = 0
  const flowing: number[] = []
  const errorGaps: number[] = []
  const confusion = new Map<string, Confusion>()
  const perKey = new Map<string, { ms: number; n: number }>()
  let pause: Insights['pause'] = null

  log.forEach((e, i) => {
    const g = gap[i] as number
    if (e.kind === 'back') {
      backspaces++
      return
    }
    keys++
    const timed = i > 0 && g <= GAP_CAP_MS
    if (timed) flowing.push(g)
    if (i > 0 && (!pause || g > pause.ms)) pause = { ms: g, word: wordAt(target, e.index), at: i }
    if (!e.ok) {
      errors++
      if (timed) errorGaps.push(g)
      const id = `${e.expected}\u0000${e.typed}`
      const c = confusion.get(id)
      if (c) c.n++
      else confusion.set(id, { expected: e.expected, typed: e.typed, n: 1, at: i })
    } else if (timed && e.expected !== ' ') {
      const k = perKey.get(fold(e.expected)) ?? { ms: 0, n: 0 }
      k.ms += g
      k.n++
      perKey.set(fold(e.expected), k)
    }
  })

  const meanGap = flowing.length > 0 ? flowing.reduce((a, b) => a + b, 0) / flowing.length : 0
  const slowKeys = [...perKey.entries()]
    // At least 30% and 40 ms slower than usual: smaller differences are noise.
    .filter(([, k]) => k.n >= 2 && k.ms / k.n >= meanGap * 1.3 && k.ms / k.n - meanGap >= 40)
    .map(([key, k]) => ({ key, ms: k.ms / k.n }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 3)
  const found = pause as Insights['pause']
  const realPause = found && found.ms >= Math.max(1000, 3 * median(flowing)) ? found : null
  const errorMean = errorGaps.length > 0 ? errorGaps.reduce((a, b) => a + b, 0) / errorGaps.length : 0

  return {
    keys,
    errors,
    backspaces,
    meanGap,
    confusions: [...confusion.values()].sort((a, b) => b.n - a.n || a.at - b.at),
    slowKeys,
    pause: realPause,
    rushed: errorGaps.length >= 3 && errorMean < meanGap * 0.85,
  }
}
