import { describe, expect, it } from 'vitest'
import type { Keystroke } from '../engine/engine'
import { avgMs, collectStats, errorRate, mergeStats, rankWeak, totalPresses, weakSpots, type Agg } from './keystats'

const stroke = (t: number, index: number, expected: string, typed = expected): Keystroke => ({ t, index, expected, typed, ok: typed === expected })

describe('collectStats', () => {
  it('counts presses, errors and time per key', () => {
    const s = collectStats([stroke(0, 0, 'a'), stroke(100, 1, 'b'), stroke(300, 2, 'a', 'x')])
    expect(s.keys.a).toEqual({ n: 2, err: 1, ms: 0, timed: 0 })
    expect(s.keys.b).toEqual({ n: 1, err: 0, ms: 100, timed: 1 })
  })
  it('lower-cases keys, including Polish letters', () => {
    const s = collectStats([stroke(0, 0, 'Ł'), stroke(90, 1, 'ó')], 'pl')
    expect(Object.keys(s.keys)).toEqual(['ł', 'ó'])
  })
  it('records letter pairs inside a word only', () => {
    const s = collectStats([stroke(0, 0, 't'), stroke(100, 1, 'h'), stroke(200, 2, ' '), stroke(300, 3, 'e')])
    expect(Object.keys(s.bigrams)).toEqual(['th'])
    expect(s.bigrams.th).toEqual({ n: 1, err: 0, ms: 100, timed: 1 })
  })
  it('does not count a pair after a mistake or a retry', () => {
    const s = collectStats([stroke(0, 0, 't', 'x'), stroke(100, 1, 'h'), stroke(200, 1, 'h')])
    expect(s.bigrams).toEqual({})
  })
  it('caps long pauses', () => {
    const s = collectStats([stroke(0, 0, 'a'), stroke(60000, 1, 'b')])
    expect(s.keys.b?.ms).toBe(2000)
  })
})

describe('mergeStats', () => {
  it('adds totals together', () => {
    const a = collectStats([stroke(0, 0, 'a'), stroke(100, 1, 'b')])
    const b = collectStats([stroke(0, 0, 'b'), stroke(200, 1, 'b', 'x')])
    const m = mergeStats(a, b)
    expect(m.keys.b).toEqual({ n: 3, err: 1, ms: 100, timed: 1 })
    expect(totalPresses(m)).toBe(4)
  })
})

describe('rankWeak', () => {
  const agg = (n: number, err: number, perKey: number): Agg => ({ n, err, ms: (n - err) * perKey, timed: n - err })
  const map = { a: agg(20, 0, 100), b: agg(20, 6, 100), c: agg(20, 0, 220), ' ': agg(50, 10, 300), z: agg(2, 2, 100) }

  it('puts error-prone and slow keys first', () => {
    expect(rankWeak(map, 8).map((w) => w.key)).toEqual(['b', 'c', 'a'])
  })
  it('ignores rare keys and the space bar', () => {
    const keys = rankWeak(map, 8).map((w) => w.key)
    expect(keys).not.toContain('z')
    expect(keys).not.toContain(' ')
  })
  it('exposes averages', () => {
    expect(avgMs(map.c)).toBe(220)
    expect(errorRate(map.b)).toBeCloseTo(0.3)
  })
  it('leaves strong keys out of the weak spots', () => {
    expect(weakSpots({ keys: map, bigrams: {} }).keys).toEqual(['b', 'c'])
  })
})
