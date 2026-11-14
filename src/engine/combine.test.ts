import { describe, expect, it } from 'vitest'
import { combineRuns } from './combine'
import { TypingEngine } from './engine'

/** Types a text one key per `gap` ms; `wrongAt` positions get a wrong key first, then a fix. */
function run(text: string, gap: number, wrongAt: number[] = []) {
  const engine = new TypingEngine(text)
  let now = 1000
  Array.from(text).forEach((ch, i) => {
    if (wrongAt.includes(i)) {
      engine.type(ch === 'x' ? 'y' : 'x', now)
      now += gap
      engine.backspace(now)
    }
    engine.type(ch, now)
    now += gap
  })
  engine.finish()
  return { stats: engine.stats(now), keystrokes: engine.keystrokes }
}

describe('combineRuns', () => {
  it('equals the single run when there is only one', () => {
    const one = run('hello world', 100)
    expect(combineRuns([one])).toEqual(one.stats)
  })

  it('adds up characters and time, leaving out the pause between runs', () => {
    const a = run('hello there', 100)
    const b = run('see you soon', 200, [2])
    const all = combineRuns([a, b])
    expect(all.elapsedMs).toBe(a.stats.elapsedMs + b.stats.elapsedMs)
    expect(all.correctChars).toBe(11 + 12)
    expect(all.errors).toBe(1)
    expect(all.accuracy).toBeCloseTo((23 / 24) * 100)
    expect(all.wpm).toBeCloseTo(23 / 5 / (all.elapsedMs / 60000))
    expect(all.wpm).toBeGreaterThan(b.stats.wpm)
    expect(all.wpm).toBeLessThan(a.stats.wpm)
  })

  it('is empty for no runs', () => {
    const none = combineRuns([])
    expect(none.wpm).toBe(0)
    expect(none.accuracy).toBe(100)
  })
})
