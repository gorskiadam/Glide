import type { TextItem } from '../content'

export type Rng = () => number

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/**
 * Deals texts in a random order and reshuffles when it runs out, so a text is not
 * repeated until every other text has been used.
 */
export class Deck {
  private pile: TextItem[] = []
  constructor(
    private readonly texts: readonly TextItem[],
    private readonly rng: Rng = Math.random,
  ) {}

  next(): string {
    if (this.pile.length === 0) this.pile = shuffle(this.texts, this.rng)
    return (this.pile.pop() as TextItem).text
  }

  /** Joins texts until there are at least `minChars` characters. */
  chars(minChars: number): string {
    let out = this.next()
    while (out.length < minChars) out += ' ' + this.next()
    return out
  }

  /** Joins texts and cuts the result to exactly `count` words. */
  words(count: number): string {
    let words: string[] = []
    while (words.length < count) words = words.concat(this.next().split(' '))
    return words.slice(0, count).join(' ')
  }
}

/** Number of words the caret has fully passed. */
export function wordsDone(target: readonly string[], pos: number): number {
  let n = 0
  for (let i = 0; i < pos; i++) if (target[i] === ' ') n++
  if (pos >= target.length && target.length > 0) n++
  return n
}
