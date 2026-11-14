import { describe, expect, it } from 'vitest'
import { accuracy, consistency, perSecondWpm, wpm } from './stats'

describe('wpm', () => {
  it('counts five characters as one word', () => {
    expect(wpm(250, 60000)).toBe(50)
    expect(wpm(50, 30000)).toBe(20)
  })
  it('is zero with no time or no characters', () => {
    expect(wpm(10, 0)).toBe(0)
    expect(wpm(0, 1000)).toBe(0)
  })
})

describe('accuracy', () => {
  it('is the share of correct keystrokes', () => {
    expect(accuracy(90, 100)).toBe(90)
    expect(accuracy(0, 4)).toBe(0)
  })
  it('is 100 before anything is typed', () => {
    expect(accuracy(0, 0)).toBe(100)
  })
})

describe('perSecondWpm', () => {
  it('buckets keystrokes by second', () => {
    // 5 keys in second one, 10 keys in second two
    const times = [0, 100, 200, 300, 400, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900]
    expect(perSecondWpm(times, 2000)).toEqual([60, 120])
  })
  it('scales a partial last second and drops a tiny one', () => {
    expect(perSecondWpm([0, 100, 1000, 1100], 1500)).toEqual([24, 48])
    expect(perSecondWpm([0, 100, 1000], 1100)).toEqual([24])
  })
})

describe('consistency', () => {
  it('is 100 for a perfectly even pace', () => {
    expect(consistency([60, 60, 60, 60])).toBe(100)
  })
  it('drops as the pace gets uneven', () => {
    const even = consistency([58, 60, 62, 60])
    const uneven = consistency([20, 100, 30, 90])
    expect(even).toBeGreaterThan(95)
    expect(uneven).toBeLessThan(even)
    expect(uneven).toBeGreaterThanOrEqual(0)
  })
})
