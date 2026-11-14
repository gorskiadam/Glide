import type { TextItem } from '../content'
import type { WeakSpots } from './keystats'
import { shuffle, type Rng } from './textgen'

/** Splits a text into sentences, keeping the punctuation that ends each one. */
export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function count(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) n++
  return n
}

/** How densely a sentence is packed with the weak keys and pairs. Pairs count double. */
export function drillScore(sentence: string, spots: WeakSpots, locale = 'en'): number {
  const lower = sentence.toLocaleLowerCase(locale)
  let hits = 0
  for (const key of spots.keys) hits += count(lower, key)
  for (const pair of spots.bigrams) hits += 2 * count(lower, pair)
  return hits / Math.max(20, lower.length)
}

/**
 * Builds a drill of about `minWords` words from the real sentences in the library
 * that contain the most weak keys and pairs. Returns an empty string when no
 * sentence contains any of them.
 */
export function buildDrill(texts: readonly TextItem[], spots: WeakSpots, minWords = 40, locale = 'en', rng: Rng = Math.random): string {
  const scored: { sentence: string; score: number }[] = []
  const seen = new Set<string>()
  for (const item of texts) {
    for (const sentence of sentences(item.text)) {
      if (seen.has(sentence)) continue
      seen.add(sentence)
      const score = drillScore(sentence, spots, locale)
      if (score > 0) scored.push({ sentence, score })
    }
  }
  // Take the best quarter (at least 12) and shuffle it, so the drill changes every time.
  scored.sort((a, b) => b.score - a.score)
  const pool = shuffle(scored.slice(0, Math.max(12, Math.ceil(scored.length / 4))), rng)
  const out: string[] = []
  let words = 0
  for (const { sentence } of pool) {
    if (words >= minWords) break
    out.push(sentence)
    words += sentence.split(' ').length
  }
  return out.join(' ')
}
