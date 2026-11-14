import { describe, expect, it } from 'vitest'
import type { TextItem } from '../content'
import { applyFilters, prepareTexts } from './filters'

const all = { punctuation: true, numbers: true, capitals: true }

describe('applyFilters', () => {
  it('leaves text alone when everything is on', () => {
    expect(applyFilters("Hi, I'm 25!", all)).toBe("Hi, I'm 25!")
  })
  it('removes punctuation', () => {
    expect(applyFilters("Hi, I'm here - really!", { ...all, punctuation: false })).toBe('Hi Im here really')
  })
  it('removes words with digits', () => {
    expect(applyFilters('Call 555-0142 after 6:00 PM today', { ...all, numbers: false })).toBe('Call after PM today')
  })
  it('lower-cases text, including Polish letters', () => {
    expect(applyFilters('Łódź i Żory', { ...all, capitals: false }, 'pl')).toBe('łódź i żory')
  })
  it('keeps Polish letters when punctuation is off', () => {
    expect(applyFilters('Zażółć gęślą jaźń.', { ...all, punctuation: false })).toBe('Zażółć gęślą jaźń')
  })
})

describe('prepareTexts', () => {
  const item = (id: string, category: TextItem['category'], text: string): TextItem => ({ id, category, length: 'short', difficulty: 'easy', text })
  const texts = [item('a', 'quick', 'On my way.'), item('b', 'numbers', 'Call 555-0142 now.'), item('c', 'work', '2026 / 03')]

  it('filters by category', () => {
    expect(prepareTexts(texts, 'quick', all).map((t) => t.id)).toEqual(['a'])
  })
  it('skips number drills when numbers are off', () => {
    expect(prepareTexts(texts, 'all', { ...all, numbers: false }).map((t) => t.id)).toEqual(['a'])
  })
  it('drops texts that end up empty', () => {
    expect(prepareTexts(texts, 'work', { ...all, numbers: false })).toEqual([])
  })
})
