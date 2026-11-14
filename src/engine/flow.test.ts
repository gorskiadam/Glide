import { describe, expect, it } from 'vitest'
import { flowScore, flowWave, keyIntervals } from './flow'

describe('keyIntervals', () => {
  it('returns the gaps between keystrokes', () => {
    expect(keyIntervals([0, 100, 250, 400])).toEqual([100, 150, 150])
  })
  it('caps long pauses', () => {
    expect(keyIntervals([0, 100, 9000])).toEqual([100, 2000])
  })
})

describe('flowScore', () => {
  it('is 100 for a perfectly even rhythm', () => {
    expect(flowScore([120, 120, 120, 120, 120])).toBe(100)
  })
  it('does not depend on speed', () => {
    expect(flowScore([80, 100, 80, 100])).toBeCloseTo(flowScore([160, 200, 160, 200]), 6)
  })
  it('forgives small natural variation', () => {
    expect(flowScore([110, 125, 118, 130, 112, 121])).toBe(100)
  })
  it('drops for bursts and pauses', () => {
    const steady = flowScore([120, 130, 110, 125, 115, 120])
    const choppy = flowScore([60, 60, 60, 900, 60, 60, 700, 60])
    expect(choppy).toBeLessThan(40)
    expect(choppy).toBeLessThan(steady)
    expect(choppy).toBeGreaterThanOrEqual(0)
  })
  it('is 100 when there is too little to measure', () => {
    expect(flowScore([])).toBe(100)
    expect(flowScore([200])).toBe(100)
  })
})

describe('flowWave', () => {
  it('returns values between 0 and 1', () => {
    const wave = flowWave([100, 200, 100, 400, 100, 100, 300, 100], 4)
    expect(wave).toHaveLength(4)
    for (const v of wave) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('is flat for an even rhythm', () => {
    expect(flowWave([100, 100, 100, 100, 100, 100], 3)).toEqual([1, 1, 1])
  })
  it('is empty with no data', () => {
    expect(flowWave([])).toEqual([])
  })
})
