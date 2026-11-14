import { describe, expect, it } from 'vitest'
import { defaults, type SavedData } from '../store'
import { makeBackup, parseBackup } from './backup'
import { paceIndex, paceTarget } from './pace'
import { commonWords, warmupSegments } from './warmup'

const result = (wpm: number, extra: object = {}) => ({
  id: `r${wpm}`, at: 1, mode: 'time' as const, amount: 30, lang: 'en' as const, wpm, rawWpm: wpm, accuracy: 97, consistency: 80,
  flow: 70, errors: 1, elapsedMs: 30000, correctChars: 100, incorrectChars: 0, ...extra,
})

const data = (): SavedData => ({
  settings: { ...defaults(), theme: 'dark', dailyGoal: 15 },
  history: [result(50), result(60)],
  typing: { en: { keys: { a: { n: 3, err: 1, ms: 300, timed: 2 } }, bigrams: {} }, pl: { keys: {}, bigrams: {} } },
  lessons: { 'home-1': { stars: 3, wpm: 20, accuracy: 99 } },
  daily: { '2026-11-14:en': { wpm: 55, accuracy: 96, flow: 70, tries: 2 } },
})

describe('backup', () => {
  it('survives a round trip', () => {
    expect(parseBackup(makeBackup(data(), 0))).toEqual(data())
  })

  it('rejects files that are not Glide backups', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup('{"app":"other","version":1,"data":{}}')).toBeNull()
    expect(parseBackup('{"app":"glide","version":99,"data":{}}')).toBeNull()
    expect(parseBackup('[]')).toBeNull()
  })

  it('drops damaged parts and keeps defaults for bad settings', () => {
    const raw = JSON.parse(makeBackup(data(), 0))
    raw.data.history.push({ id: 'broken' }, 'nope')
    raw.data.settings.theme = 'banana'
    raw.data.settings.dailyGoal = 'ten'
    raw.data.settings.evil = true
    raw.data.typing.en.keys.b = { n: 'x' }
    raw.data.lessons.bad = { stars: 'many' }
    const parsed = parseBackup(JSON.stringify(raw)) as SavedData
    expect(parsed.history).toHaveLength(2)
    expect(parsed.settings.theme).toBe(defaults().theme)
    expect(parsed.settings.dailyGoal).toBe(defaults().dailyGoal)
    expect('evil' in parsed.settings).toBe(false)
    expect(Object.keys(parsed.typing.en.keys)).toEqual(['a'])
    expect(Object.keys(parsed.lessons)).toEqual(['home-1'])
  })

  it('fills in an empty backup', () => {
    const parsed = parseBackup('{"app":"glide","version":1,"data":{}}') as SavedData
    expect(parsed.history).toEqual([])
    expect(parsed.settings).toEqual(defaults())
  })
})

describe('pace caret', () => {
  const history = [result(40), result(60), result(90, { lang: 'pl' }), result(10, { mode: 'lesson' })]
  it('follows the setting', () => {
    expect(paceTarget({ pace: 'off', paceWpm: 50 }, history, 'time', 30, 'en')).toBeNull()
    expect(paceTarget({ pace: 'custom', paceWpm: 72 }, history, 'time', 30, 'en')).toBe(72)
    expect(paceTarget({ pace: 'best', paceWpm: 50 }, history, 'time', 30, 'en')).toBe(60)
    expect(paceTarget({ pace: 'best', paceWpm: 50 }, history, 'words', 25, 'en')).toBeNull()
    expect(paceTarget({ pace: 'average', paceWpm: 50 }, history, 'time', 30, 'en')).toBe(50)
    expect(paceTarget({ pace: 'average', paceWpm: 50 }, [], 'time', 30, 'en')).toBeNull()
  })
  it('moves five characters per word', () => {
    expect(paceIndex(60, 0)).toBe(0)
    expect(paceIndex(60, 1000)).toBe(5)
    expect(paceIndex(48, 30000)).toBe(120)
  })
})

describe('warm-up', () => {
  const texts = [
    { id: 'a', category: 'everyday' as const, length: 'short' as const, difficulty: 'easy' as const, text: 'The dog and the cat sat. The sun was out and the day was warm.' },
    { id: 'b', category: 'numbers' as const, length: 'short' as const, difficulty: 'easy' as const, text: 'Call 555 0199 at 10:30.' },
    { id: 'c', category: 'work' as const, length: 'short' as const, difficulty: 'hard' as const, text: 'Notwithstanding the aforementioned considerations.' },
  ]
  it('ranks short words by how often they appear', () => {
    expect(commonWords(texts, 'en').slice(0, 2)).toEqual(['the', 'and'])
    expect(commonWords(texts, 'en')).not.toContain('notwithstanding')
  })
  it('builds three steps sized by speed', () => {
    const slow = warmupSegments(texts, 'en', 20, () => 0.5)
    const fast = warmupSegments(texts, 'en', 100, () => 0.5)
    expect(slow).toHaveLength(3)
    expect(slow[0]).toMatch(/^asdf jkl;/)
    expect(slow[2]).not.toMatch(/\d|Notwithstanding/)
    expect(fast[0]!.length).toBeGreaterThan(slow[0]!.length)
    expect(slow[0]!.length).toBeLessThanOrEqual(34)
  })
})
