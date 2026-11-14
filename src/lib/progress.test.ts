import { describe, expect, it } from 'vitest'
import type { Result } from '../store'
import { average, dayKey, personalBests, practicedToday, streak } from './progress'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()
const result = (over: Partial<Result>): Result => ({
  id: 'x', at: 0, mode: 'time', amount: 30, lang: 'en', wpm: 50, rawWpm: 52, accuracy: 96, consistency: 80,
  errors: 2, elapsedMs: 30000, correctChars: 125, incorrectChars: 0, ...over,
})

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(at(2026, 3, 5, 23))).toBe('2026-03-05')
  })
})

describe('streak', () => {
  const now = at(2026, 3, 10, 18)
  it('is zero with no results', () => {
    expect(streak([], now)).toBe(0)
  })
  it('counts days in a row ending today', () => {
    expect(streak([{ at: at(2026, 3, 8) }, { at: at(2026, 3, 9) }, { at: at(2026, 3, 10) }], now)).toBe(3)
  })
  it('counts several tests on one day once', () => {
    expect(streak([{ at: at(2026, 3, 10, 8) }, { at: at(2026, 3, 10, 9) }], now)).toBe(1)
  })
  it('keeps yesterday\'s streak alive until today ends', () => {
    expect(streak([{ at: at(2026, 3, 8) }, { at: at(2026, 3, 9) }], now)).toBe(2)
  })
  it('breaks after a missed day', () => {
    expect(streak([{ at: at(2026, 3, 6) }, { at: at(2026, 3, 7) }], now)).toBe(0)
    expect(streak([{ at: at(2026, 3, 7) }, { at: at(2026, 3, 9) }, { at: at(2026, 3, 10) }], now)).toBe(2)
  })
})

describe('practicedToday', () => {
  it('adds up only today\'s typing time', () => {
    const history = [{ at: at(2026, 3, 9), elapsedMs: 60000 }, { at: at(2026, 3, 10, 7), elapsedMs: 30000 }, { at: at(2026, 3, 10, 9), elapsedMs: 15000 }]
    expect(practicedToday(history, at(2026, 3, 10, 18))).toBe(45000)
  })
})

describe('average', () => {
  it('handles empty lists', () => {
    expect(average([])).toBe(0)
    expect(average([40, 60])).toBe(50)
  })
})

describe('personalBests', () => {
  it('keeps the best result per setup and skips zen and coach', () => {
    const bests = personalBests([
      result({ wpm: 50 }),
      result({ wpm: 64 }),
      result({ mode: 'words', amount: 25, wpm: 70 }),
      result({ lang: 'pl', wpm: 41 }),
      result({ mode: 'zen', amount: 0, wpm: 99 }),
      result({ mode: 'coach', amount: 0, wpm: 99 }),
    ])
    expect(bests.map((b) => [b.mode, b.amount, b.lang, b.wpm])).toEqual([
      ['words', 25, 'en', 70],
      ['time', 30, 'en', 64],
      ['time', 30, 'pl', 41],
    ])
  })
})
