import { describe, expect, it } from 'vitest'
import { TypingEngine, toChars } from './engine'

/** Types a string at a fixed pace, one character every `gap` ms, starting at `start`. */
function run(engine: TypingEngine, text: string, gap = 100, start = 1000): number {
  let now = start
  for (const ch of toChars(text)) {
    engine.type(ch, now)
    now += gap
  }
  return now - gap
}

describe('TypingEngine', () => {
  it('tracks correct and incorrect characters', () => {
    const e = new TypingEngine('cat')
    e.type('c', 0)
    e.type('x', 100)
    expect(e.stateAt(0)).toBe('ok')
    expect(e.stateAt(1)).toBe('bad')
    expect(e.stateAt(2)).toBe('pending')
    expect(e.pos).toBe(2)
  })

  it('reports which positions changed', () => {
    const e = new TypingEngine('hello world')
    expect(e.type('h', 0)).toEqual({ from: 0, to: 1 })
    expect(e.backspace(50)).toEqual({ from: 0, to: 1 })
    expect(e.backspace(60)).toBeNull()
  })

  it('computes net and raw wpm', () => {
    // 10 characters, one every 100ms: the last key lands at 900ms.
    const e = new TypingEngine('abcde fghi')
    const end = run(e, 'abcde fghi')
    e.finish()
    const s = e.stats(end)
    expect(s.elapsedMs).toBe(900)
    expect(s.correctChars).toBe(10)
    expect(s.wpm).toBeCloseTo((10 / 5) / (900 / 60000), 5)
    expect(s.rawWpm).toBeCloseTo(s.wpm, 5)
    expect(s.accuracy).toBe(100)
    expect(s.errors).toBe(0)
  })

  it('keeps a corrected mistake in accuracy but not in net wpm', () => {
    const e = new TypingEngine('abcd')
    e.type('a', 0)
    e.type('x', 100) // mistake
    e.backspace(200)
    e.type('b', 300)
    e.type('c', 400)
    e.type('d', 500)
    e.finish()
    const s = e.stats(500)
    expect(s.correctChars).toBe(4)
    expect(s.incorrectChars).toBe(0)
    expect(s.errors).toBe(1)
    expect(s.accuracy).toBeCloseTo(80, 5) // 4 of 5 keystrokes
    expect(s.rawWpm).toBeGreaterThan(s.wpm)
  })

  it('uses the time limit as the duration of a timed test', () => {
    const e = new TypingEngine('a'.repeat(100))
    run(e, 'a'.repeat(50), 100, 0)
    e.finish(15000)
    const s = e.stats(99999)
    expect(s.elapsedMs).toBe(15000)
    expect(s.wpm).toBeCloseTo(40, 5) // 50 chars = 10 words in a quarter minute
  })

  it('ignores input after it finishes or reaches the end', () => {
    const e = new TypingEngine('ab')
    e.type('a', 0)
    e.type('b', 100)
    expect(e.atEnd).toBe(true)
    expect(e.type('c', 200)).toBeNull()
    e.finish()
    expect(e.backspace(300)).toBeNull()
    expect(e.pos).toBe(2)
  })

  it('deletes a whole word', () => {
    const e = new TypingEngine('one two three')
    run(e, 'one tw')
    expect(e.backspaceWord(2000)).toEqual({ from: 4, to: 6 })
    expect(e.pos).toBe(4)
    // Directly after a space it removes the space and the word before it.
    expect(e.backspaceWord(2100)).toEqual({ from: 0, to: 4 })
    expect(e.pos).toBe(0)
  })

  it('does not advance on a mistake in stop-on-error mode', () => {
    const e = new TypingEngine('ab', { stopOnError: true })
    expect(e.type('x', 0)).toEqual({ from: 0, to: 0 })
    expect(e.pos).toBe(0)
    e.type('a', 100)
    expect(e.pos).toBe(1)
    expect(e.stats(100).errors).toBe(1)
  })

  it('handles Polish diacritics as single characters', () => {
    const text = 'Zażółć gęślą jaźń'
    const e = new TypingEngine(text)
    expect(e.target.length).toBe(17)
    run(e, text)
    expect(e.atEnd).toBe(true)
    expect(e.stats(5000).accuracy).toBe(100)
  })

  it('treats composed and decomposed forms as the same character', () => {
    const e = new TypingEngine('ą') // precomposed
    e.type('ą', 0) // "a" + combining ogonek
    expect(e.stateAt(0)).toBe('ok')
  })

  it('marks a plain letter as wrong where a diacritic is expected', () => {
    const e = new TypingEngine('łódź')
    e.type('l', 0)
    expect(e.stateAt(0)).toBe('bad')
  })

  it('can be extended while running', () => {
    const e = new TypingEngine('ab')
    e.type('a', 0)
    expect(e.extend(' cd')).toEqual({ from: 2, to: 5 })
    e.type('b', 100)
    expect(e.atEnd).toBe(false)
    expect(e.target.join('')).toBe('ab cd')
  })

  it('measures consistency from per-second speed', () => {
    const steady = new TypingEngine('a'.repeat(200))
    run(steady, 'a'.repeat(100), 100, 0)
    steady.finish(10000)
    expect(steady.stats(0).consistency).toBe(100)

    const bursty = new TypingEngine('a'.repeat(200))
    let now = 0
    for (let i = 0; i < 100; i++) {
      bursty.type('a', now)
      now += i % 20 < 10 ? 20 : 180
    }
    bursty.finish(10000)
    expect(bursty.stats(0).consistency).toBeLessThan(80)
  })

  it('locks the next word in strict mode until the current word is fixed', () => {
    const e = new TypingEngine('ab cd', { strict: true })
    e.type('a', 0)
    e.type('x', 100)
    expect(e.type(' ', 200)).toBeNull()
    expect(e.pos).toBe(2)
    e.backspace(300)
    e.type('b', 400)
    expect(e.type(' ', 500)).toEqual({ from: 2, to: 3 })
  })

  it('is only complete in strict mode when the last word is correct', () => {
    const strict = new TypingEngine('ab', { strict: true })
    strict.type('a', 0)
    strict.type('x', 100)
    expect(strict.atEnd).toBe(true)
    expect(strict.complete).toBe(false)
    strict.backspace(200)
    strict.type('b', 300)
    expect(strict.complete).toBe(true)

    const relaxed = new TypingEngine('ab')
    relaxed.type('a', 0)
    relaxed.type('x', 100)
    expect(relaxed.complete).toBe(true)
  })
})
