import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Lang, TextItem } from '../content'
import { ALL_LESSONS, UNITS, corpusWords, isUnlocked, knownKeys, lessonText, nextLesson, starsFor, unitsFor } from './lessons'

function library(lang: Lang): TextItem[] {
  const dir = join(process.cwd(), 'content', lang)
  return readdirSync(dir).flatMap((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as TextItem[])
}
const texts = { en: library('en'), pl: library('pl') }
/** A repeatable random source, so a failing text can be reproduced. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

describe('lesson path', () => {
  it('has unique ids and the Polish unit only for Polish', () => {
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length)
    expect(unitsFor('en').map((u) => u.id)).toEqual(['home', 'top', 'bottom', 'numbers', 'symbols'])
    expect(unitsFor('pl').at(-1)?.id).toBe('polish')
  })

  it('teaches every letter, digit and Polish letter exactly once', () => {
    const taught = ALL_LESSONS.map((l) => l.keys).join('')
    expect(new Set(taught).size).toBe(taught.length)
    for (const c of 'abcdefghijklmnopqrstuvwxyz0123456789ąćęłńóśźż') expect(taught).toContain(c)
  })

  it('opens the first lesson of each unit and the rest one by one', () => {
    for (const u of UNITS) expect(isUnlocked(u.lessons[0]!, {})).toBe(true)
    const second = UNITS[0]!.lessons[1]!
    expect(isUnlocked(second, {})).toBe(false)
    expect(isUnlocked(second, { 'home-1': { stars: 0, wpm: 10, accuracy: 80 } })).toBe(false)
    expect(isUnlocked(second, { 'home-1': { stars: 1, wpm: 10, accuracy: 91 } })).toBe(true)
  })

  it('gives stars by accuracy', () => {
    expect([89.9, 90, 95, 97.9, 98, 100].map(starsFor)).toEqual([0, 1, 2, 2, 3, 3])
  })

  it('walks to the next lesson and stops at the end of the path', () => {
    expect(nextLesson('home-6', 'en')?.id).toBe('top-1')
    expect(nextLesson('symbols-5', 'en')).toBeNull()
    expect(nextLesson('symbols-5', 'pl')?.id).toBe('polish-1')
  })

  it('keeps Polish letters out of the other units', () => {
    expect(knownKeys(ALL_LESSONS.find((l) => l.id === 'symbols-5')!)).not.toMatch(/[ąęół]/)
    expect(knownKeys(ALL_LESSONS.find((l) => l.id === 'polish-1')!)).toContain('ę')
  })
})

describe('lesson texts', () => {
  it('extracts plain lower-case words', () => {
    const words = corpusWords([{ id: 'x', category: 'quick', length: 'short', difficulty: 'easy', text: "Hello, don't stop at 10:30 Żółw!" }], 'pl')
    expect(words).toEqual(['at', 'hello', 'stop', 'żółw'])
  })

  for (const lang of ['en', 'pl'] as const) {
    it(`uses only keys taught so far (${lang})`, () => {
      for (const lesson of unitsFor(lang).flatMap((u) => u.lessons)) {
        const known = new Set(knownKeys(lesson))
        const capitalsKnown = lesson.unit === 'symbols' || lesson.unit === 'polish'
        for (let seed = 1; seed <= 3; seed++) {
          const text = lessonText(lesson, texts[lang], lang, seeded(seed))
          expect(text.split(' ').length, `${lesson.id} is long enough`).toBeGreaterThanOrEqual(12)
          expect(text, `${lesson.id} has no double spaces`).not.toMatch(/ {2}|^ | $/)
          for (const ch of text) {
            if (ch === ' ') continue
            const lower = ch.toLocaleLowerCase(lang)
            if (lower !== ch) expect(capitalsKnown, `${lesson.id} capital "${ch}" in "${text}"`).toBe(true)
            expect(known.has(lower), `${lesson.id} unknown "${ch}" in "${text}"`).toBe(true)
          }
        }
      }
    })

    it(`practices the new keys of each lesson (${lang})`, () => {
      for (const lesson of unitsFor(lang).flatMap((u) => u.lessons)) {
        const text = lessonText(lesson, texts[lang], lang, seeded(7))
        for (const key of lesson.keys) expect(text.split(key).length - 1, `${lesson.id} uses "${key}"`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
