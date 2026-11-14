import { describe, expect, it } from 'vitest'
import type { TextItem } from '../content'
import { buildDrill, drillScore, sentences } from './coach'

const item = (id: string, text: string): TextItem => ({ id, category: 'everyday', length: 'short', difficulty: 'easy', text })

describe('sentences', () => {
  it('splits on sentence endings', () => {
    expect(sentences('Hi there. How are you? Fine!')).toEqual(['Hi there.', 'How are you?', 'Fine!'])
  })
  it('keeps text without punctuation whole', () => {
    expect(sentences('no punctuation here')).toEqual(['no punctuation here'])
  })
})

describe('drillScore', () => {
  it('is higher for sentences full of the weak keys', () => {
    const spots = { keys: ['z'], bigrams: [] }
    expect(drillScore('A lazy zebra dozed in the zoo.', spots)).toBeGreaterThan(drillScore('The cat sat on the mat.', spots))
  })
  it('counts pairs double and ignores case', () => {
    expect(drillScore('The Thing', { keys: [], bigrams: ['th'] })).toBe(4 / 20)
  })
  it('matches Polish letters', () => {
    expect(drillScore('Żółw łapie żabę.', { keys: ['ż', 'ł'], bigrams: [] }, 'pl')).toBe(4 / 20)
  })
})

describe('buildDrill', () => {
  const texts = [
    item('a', 'The quick zebra zigzags. Nothing here at all.'),
    item('b', 'A dozen lazy lizards. Pizza is amazing. One more plain line.'),
  ]
  it('only uses sentences that contain a weak spot', () => {
    const drill = buildDrill(texts, { keys: ['z'], bigrams: [] }, 100)
    expect(drill).toContain('zebra')
    expect(drill).toContain('Pizza')
    expect(drill).not.toContain('Nothing here')
    expect(drill).not.toContain('plain line')
  })
  it('stops once it has enough words', () => {
    const drill = buildDrill(texts, { keys: ['z'], bigrams: [] }, 3)
    expect(sentences(drill)).toHaveLength(1)
  })
  it('is empty when nothing matches', () => {
    expect(buildDrill(texts, { keys: ['ź'], bigrams: [] })).toBe('')
  })
})
