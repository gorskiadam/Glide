import type { Lang, TextItem } from '../content'
import { sentences } from './coach'
import { shuffle, type Rng } from './textgen'

/** Finger groups for the first step: home row first, then one reach up and one down. */
const GROUPS = ['asdf', 'jkl;', 'fjfj', 'dkdk', 'slsl', 'a;a;', 'fghj', 'asdf', 'jkl;', 'frfr', 'juju', 'dede', 'kiki', 'fvfv', 'jmjm'] as const

export const WARMUP_SECONDS = 60
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Joins items until the text is about `chars` long (at least one item). */
function fill(items: readonly string[], chars: number): string {
  let out = ''
  for (const item of items) {
    if (out.length > 0 && out.length + item.length + 1 > chars) break
    out += (out ? ' ' : '') + item
  }
  return out
}

/** The most used short words of a library, most frequent first. */
export function commonWords(texts: readonly TextItem[], lang: Lang, count = 60): string[] {
  const seen = new Map<string, number>()
  for (const item of texts) {
    for (const raw of item.text.split(/\s+/)) {
      const word = raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLocaleLowerCase(lang)
      if (/^\p{L}{2,5}$/u.test(word)) seen.set(word, (seen.get(word) ?? 0) + 1)
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, count).map(([word]) => word)
}

/**
 * A warm-up of about a minute at the given speed, in three steps: finger groups
 * on the home row, short common words, then easy sentences.
 */
export function warmupSegments(texts: readonly TextItem[], lang: Lang, wpm: number, rng: Rng = Math.random): string[] {
  // Characters typed in a third of the warm-up at this speed.
  const third = Math.round((clamp(wpm, 20, 120) * 5 * (WARMUP_SECONDS / 60)) / 3)
  const fingers = fill([...GROUPS, ...GROUPS], third)
  const words = fill(shuffle(commonWords(texts, lang), rng), third)
  const easy = shuffle(texts.filter((item) => item.difficulty === 'easy' && item.category !== 'numbers'), rng)
  const flow = fill(easy.flatMap((item) => sentences(item.text)), third)
  return [fingers, words, flow].filter((s) => s.length > 0)
}
