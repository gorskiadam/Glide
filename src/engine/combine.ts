import type { Keystroke, Stats } from './engine'
import { accuracy, consistency, perSecondWpm, wpm } from './stats'

/**
 * Adds up several runs typed one after another (the messages of a sprint) into one
 * set of statistics. The time between runs is not counted.
 */
export function combineRuns(runs: readonly { stats: Stats; keystrokes: readonly Keystroke[] }[]): Stats {
  let elapsedMs = 0
  let correctChars = 0
  let incorrectChars = 0
  let typedChars = 0
  let ok = 0
  const times: number[] = []
  for (const run of runs) {
    for (const k of run.keystrokes) {
      times.push(elapsedMs + k.t)
      if (k.ok) ok++
    }
    elapsedMs += run.stats.elapsedMs
    correctChars += run.stats.correctChars
    incorrectChars += run.stats.incorrectChars
    typedChars += run.stats.typedChars
  }
  const perSecond = perSecondWpm(times, elapsedMs)
  return {
    wpm: wpm(correctChars, elapsedMs),
    rawWpm: wpm(times.length, elapsedMs),
    accuracy: accuracy(ok, times.length),
    consistency: consistency(perSecond),
    errors: times.length - ok,
    correctChars,
    incorrectChars,
    typedChars,
    elapsedMs,
    perSecond,
  }
}
