/** Pure statistics helpers. No DOM, no timers: everything takes numbers in and returns numbers. */

/** Words per minute, using the standard "one word = five characters" rule. */
export function wpm(chars: number, ms: number): number {
  if (ms <= 0 || chars <= 0) return 0
  return chars / 5 / (ms / 60000)
}

/** Share of keystrokes that were correct, as a percentage from 0 to 100. */
export function accuracy(correctKeystrokes: number, totalKeystrokes: number): number {
  if (totalKeystrokes <= 0) return 100
  return (correctKeystrokes / totalKeystrokes) * 100
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  let sq = 0
  for (const v of values) sq += (v - m) ** 2
  return Math.sqrt(sq / values.length)
}

/**
 * Consistency from 0 to 100: how even the typing speed was from second to second.
 * 100 means every second had the same speed. It is based on the coefficient of
 * variation (standard deviation / mean), squashed so that it never goes below 0.
 */
export function consistency(perSecondWpm: readonly number[]): number {
  if (perSecondWpm.length < 2) return 100
  const m = mean(perSecondWpm)
  if (m <= 0) return 0
  const cv = stdDev(perSecondWpm) / m
  return Math.max(0, Math.min(100, 100 * (1 - Math.tanh(cv))))
}

/**
 * Splits keystroke times (ms since the test started) into one-second buckets and
 * returns the raw WPM of each bucket. A final partial second is scaled up to a full
 * second when it is at least 300ms long, and dropped when shorter.
 */
export function perSecondWpm(keystrokeTimes: readonly number[], durationMs: number): number[] {
  if (durationMs <= 0) return []
  const full = Math.floor(durationMs / 1000)
  const rest = durationMs - full * 1000
  const buckets = new Array<number>(full + (rest > 0 ? 1 : 0)).fill(0)
  for (const t of keystrokeTimes) {
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor(t / 1000)))
    buckets[i] = (buckets[i] ?? 0) + 1
  }
  const out: number[] = []
  for (let i = 0; i < buckets.length; i++) {
    const count = buckets[i] ?? 0
    const span = i < full ? 1000 : rest
    if (span < 300) continue
    out.push(wpm(count, span))
  }
  return out
}
