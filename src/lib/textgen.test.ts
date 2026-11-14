import { describe, expect, it } from 'vitest'
import type { TextItem } from '../content'
import { Deck, shuffle, wordsDone } from './textgen'

const item = (id: string, text: string): TextItem => ({ id, category: 'quick', length: 'short', difficulty: 'easy', text })
const texts = [item('a', 'one two three'), item('b', 'four five'), item('c', 'six seven eight nine')]

describe('shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4])
  })
})

describe('Deck', () => {
  it('uses every text once before repeating', () => {
    const deck = new Deck(texts)
    const seen = new Set([deck.next(), deck.next(), deck.next()])
    expect(seen.size).toBe(3)
  })
  it('builds text with at least the requested characters', () => {
    expect(new Deck(texts).chars(200).length).toBeGreaterThanOrEqual(200)
  })
  it('builds text with exactly the requested words', () => {
    const text = new Deck(texts).words(25)
    expect(text.split(' ').length).toBe(25)
    expect(text).not.toMatch(/ {2}/)
  })
})

describe('wordsDone', () => {
  it('counts words the caret has passed', () => {
    const target = Array.from('one two three')
    expect(wordsDone(target, 0)).toBe(0)
    expect(wordsDone(target, 3)).toBe(0)
    expect(wordsDone(target, 4)).toBe(1)
    expect(wordsDone(target, 13)).toBe(3)
  })
})
