import { mean, stdDev } from './stats'

/** A pause longer than this counts as this long, so one coffee break does not ruin the score. */
export const PAUSE_CAP_MS = 2000

/** Time between each keystroke and the one before it. */
export function keyIntervals(times: readonly number[], capMs = PAUSE_CAP_MS): number[] {
  const out: number[] = []
  for (let i = 1; i < times.length; i++) {
    out.push(Math.min(capMs, Math.max(0, (times[i] as number) - (times[i - 1] as number))))
  }
  return out
}

/**
 * Flow Score from 0 to 100: how even the rhythm of the keystrokes was, whatever the speed.
 *
 * It uses the coefficient of variation (CV) of the gaps between keystrokes: their
 * standard deviation divided by their mean. A metronome has a CV of 0. The first
 * 0.15 of variation is free, because nobody is a metronome; after that the score
 * falls smoothly: 100 x (1 - tanh(1.1 x (CV - 0.15))).
 */
export function flowScore(intervals: readonly number[]): number {
  if (intervals.length < 2) return 100
  const m = mean(intervals)
  if (m <= 0) return 100
  const cv = stdDev(intervals) / m
  return Math.max(0, Math.min(100, 100 * (1 - Math.tanh(1.1 * Math.max(0, cv - 0.15)))))
}

/**
 * Turns the gaps between keystrokes into `points` values from 0 to 1 for drawing a
 * waveform: each value is the typing speed in that slice of the test, relative to
 * the fastest slice. An even rhythm gives a band of even height.
 */
export function flowWave(intervals: readonly number[], points = 48): number[] {
  if (intervals.length === 0) return []
  const n = Math.min(points, intervals.length)
  const speeds: number[] = []
  for (let p = 0; p < n; p++) {
    const from = Math.floor((p * intervals.length) / n)
    const to = Math.max(from + 1, Math.floor(((p + 1) * intervals.length) / n))
    const avg = mean(intervals.slice(from, to))
    speeds.push(avg > 0 ? 1 / avg : 0)
  }
  // Light smoothing so single keys do not make spikes.
  const smooth = speeds.map((_, i) => mean(speeds.slice(Math.max(0, i - 1), i + 2)))
  const max = Math.max(...smooth)
  return max > 0 ? smooth.map((v) => v / max) : smooth
}
