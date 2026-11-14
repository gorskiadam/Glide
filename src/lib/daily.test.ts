import { describe, expect, it } from 'vitest'
import type { TextItem } from '../content'
import { betterDaily, dailyText, hash } from './daily'
import { rankFor } from './rank'

const item = (id: string, length: TextItem['length'] = 'medium'): TextItem => ({ id, category: 'everyday', length, difficulty: 'easy', text: `text ${id}` })

describe('daily challenge', () => {
  it('hashes the same input to the same number', () => {
    expect(hash('2026-11-14')).toBe(hash('2026-11-14'))
    expect(hash('2026-11-14')).not.toBe(hash('2026-11-15'))
  })

  it('picks the same text for a day whatever the order of the library', () => {
    const texts = Array.from({ length: 40 }, (_, i) => item(`t-${String(i).padStart(2, '0')}`))
    const a = dailyText(texts, '2026-11-14')
    const b = dailyText([...texts].reverse(), '2026-11-14')
    expect(a?.id).toBe(b?.id)
  })

  it('changes from day to day and uses medium texts', () => {
    const texts = [...Array.from({ length: 40 }, (_, i) => item(`m-${i}`)), item('short', 'short'), item('long', 'long')]
    const picks = new Set(Array.from({ length: 30 }, (_, d) => dailyText(texts, `2026-11-${String(d + 1).padStart(2, '0')}`)?.id))
    expect(picks.size).toBeGreaterThan(10)
    expect(picks.has('short') || picks.has('long')).toBe(false)
    expect(dailyText([], '2026-11-14')).toBeNull()
  })

  it('keeps the best run of the day and counts tries', () => {
    const first = betterDaily(undefined, 50, 96, 70)
    expect(first).toEqual({ wpm: 50, accuracy: 96, flow: 70, tries: 1 })
    expect(betterDaily(first, 45, 99, 80)).toEqual({ wpm: 50, accuracy: 96, flow: 70, tries: 2 })
    expect(betterDaily(first, 60, 94, 75)).toEqual({ wpm: 60, accuracy: 94, flow: 75, tries: 2 })
  })
})

describe('rank titles', () => {
  it('maps speed to a rank', () => {
    expect([0, 19.9, 20, 35, 49, 50, 70, 90, 120, 200].map(rankFor)).toEqual([
      'warmup', 'warmup', 'steady', 'smooth', 'smooth', 'swift', 'glider', 'jet', 'lightspeed', 'lightspeed',
    ])
  })
})
