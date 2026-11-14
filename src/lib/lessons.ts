import type { Lang, TextItem } from '../content'
import { sentences } from './coach'
import { shuffle, type Rng } from './textgen'

export type UnitId = 'home' | 'top' | 'bottom' | 'numbers' | 'symbols' | 'polish'

export interface Lesson {
  id: string
  unit: UnitId
  /** The keys this lesson introduces. Empty for a review lesson. */
  keys: string
  kind: 'keys' | 'capitals' | 'review'
}

export interface Unit {
  id: UnitId
  /** The unit is only offered for these practice languages (all when missing). */
  langs?: readonly Lang[]
  lessons: Lesson[]
}

function unit(id: UnitId, keySets: readonly string[], langs?: readonly Lang[]): Unit {
  const lessons: Lesson[] = keySets.map((keys, i) => ({
    id: `${id}-${i + 1}`,
    unit: id,
    keys: keys === 'CAPS' ? '' : keys,
    kind: keys === 'CAPS' ? 'capitals' : 'keys',
  }))
  lessons.push({ id: `${id}-${keySets.length + 1}`, unit: id, keys: '', kind: 'review' })
  return { id, lessons, ...(langs ? { langs } : {}) }
}

/** The path: home row first, then outwards, the way touch typing is usually taught. */
export const UNITS: readonly Unit[] = [
  unit('home', ['fj', 'dk', 'sl', 'a;', 'gh']),
  unit('top', ['ru', 'ei', 'wo', 'qp', 'ty']),
  unit('bottom', ['vm', 'c,', 'x.', 'bn', 'z/']),
  unit('numbers', ['4567', '38', '29', '10']),
  unit('symbols', ['CAPS', '?!', '-\'"', ':()']),
  unit('polish', ['ąę', 'ół', 'ść', 'żźń'], ['pl']),
]

export const ALL_LESSONS: readonly Lesson[] = UNITS.flatMap((u) => u.lessons)

export const unitsFor = (lang: Lang): Unit[] => UNITS.filter((u) => !u.langs || u.langs.includes(lang))
export const findLesson = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id)

/** Accuracy needed to pass a lesson, and for two and three stars. */
export const STAR_ACCURACY = [90, 95, 98] as const

export function starsFor(accuracy: number): number {
  return STAR_ACCURACY.filter((min) => accuracy >= min).length
}

export interface LessonScore {
  stars: number
  wpm: number
  accuracy: number
}

/** The first lesson of every unit is open; the others open when the one before is passed. */
export function isUnlocked(lesson: Lesson, done: Readonly<Record<string, LessonScore>>): boolean {
  const lessons = UNITS.find((u) => u.id === lesson.unit)?.lessons ?? []
  const i = lessons.findIndex((l) => l.id === lesson.id)
  if (i <= 0) return true
  return (done[(lessons[i - 1] as Lesson).id]?.stars ?? 0) > 0
}

/** The lesson after this one in the path for a language, or null at the end. */
export function nextLesson(id: string, lang: Lang): Lesson | null {
  const all = unitsFor(lang).flatMap((u) => u.lessons)
  const i = all.findIndex((l) => l.id === id)
  return i === -1 ? null : (all[i + 1] ?? null)
}

/** Every key taught up to and including a lesson. */
export function knownKeys(lesson: Lesson): string {
  let keys = ''
  for (const l of ALL_LESSONS) {
    // The Polish letters are not needed for the other units.
    if (l.unit !== 'polish' || lesson.unit === 'polish') keys += l.keys
    if (l.id === lesson.id) break
  }
  return keys
}

const isLetter = (c: string) => c.toLocaleLowerCase('pl') !== c.toLocaleUpperCase('pl')
const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)] as T

/** All distinct lower-case words of a text library, letters only. */
export function corpusWords(texts: readonly TextItem[], lang: Lang): string[] {
  const out = new Set<string>()
  for (const item of texts) {
    for (const raw of item.text.split(/\s+/)) {
      // Drop the punctuation around a word; skip tokens with anything but letters inside ("don't", "10:30").
      const word = raw.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, '').toLocaleLowerCase(lang)
      if (/^\p{L}{2,}$/u.test(word)) out.add(word)
    }
  }
  return [...out].sort()
}

/** Warm-up groups for new keys: "fff jjj fj jf fjf jfj". */
function drill(keys: string): string[] {
  const k = Array.from(keys)
  const out: string[] = k.map((c) => c.repeat(3))
  for (let i = 0; i + 1 < k.length; i += 2) {
    const a = k[i] as string
    const b = k[i + 1] as string
    out.push(a + b, b + a, a + b + a, b + a + b)
  }
  if (k.length % 2 === 1 && k.length > 1) {
    const a = k[k.length - 1] as string
    const b = k[0] as string
    out.push(a + b, b + a)
  }
  return out
}

/** A made-up "word" from the letters learned so far, for when real words are not possible yet. */
function pseudoWord(letters: readonly string[], must: readonly string[], rng: Rng): string {
  const len = 2 + Math.floor(rng() * 3)
  const chars = Array.from({ length: len }, () => pick(letters, rng))
  if (must.length > 0) chars[Math.floor(rng() * len)] = pick(must, rng)
  return chars.join('')
}

/** How a symbol is attached to a word so that the result looks like real writing. */
function withSymbol(symbol: string, a: string, b: string): string {
  if (symbol === '-' || symbol === '/') return `${a}${symbol}${b}`
  if (symbol === '"' || symbol === "'") return `${symbol}${a}${symbol}`
  if (symbol === '(' || symbol === ')') return `(${a})`
  return `${a}${symbol}`
}

const capitalise = (word: string, lang: Lang) => word.charAt(0).toLocaleUpperCase(lang) + word.slice(1)

const WORDS = 14

/**
 * The text of a lesson: a short warm-up on the new keys, then words that use only
 * keys taught so far. Real words from the library are used wherever enough exist.
 */
export function lessonText(lesson: Lesson, texts: readonly TextItem[], lang: Lang, rng: Rng = Math.random): string {
  const known = new Set(Array.from(knownKeys(lesson)))
  const fresh = Array.from(lesson.keys)
  const freshLetters = fresh.filter(isLetter)
  const freshSymbols = fresh.filter((c) => !isLetter(c) && !/\d/.test(c))
  const digits = Array.from(known).filter((c) => /\d/.test(c))
  const letters = Array.from(known).filter(isLetter)
  const all = corpusWords(texts, lang)
  // From the numbers unit on every letter of the basic alphabet is known; Polish letters only in their own unit.
  const usable = all.filter((w) => Array.from(w).every((c) => known.has(c)))

  if (lesson.unit === 'symbols' && (lesson.kind === 'review' || freshSymbols.length > 0)) {
    // Real sentences that contain the marks being practiced.
    const wanted = lesson.kind === 'review' ? ['?', '!', '-', "'", '"', ':', '(', ',', '.'] : freshSymbols
    const pool = shuffle(
      texts
        .flatMap((item) => sentences(item.text))
        .filter((s) => s.length <= 90 && wanted.some((c) => s.includes(c)) && Array.from(s).every((c) => c === ' ' || known.has(c.toLocaleLowerCase(lang)))),
      rng,
    )
    const out: string[] = lesson.kind === 'review' ? [] : drill(lesson.keys)
    let count = 0
    for (const s of pool) {
      if (count >= WORDS + 6) break
      out.push(s)
      count += s.split(' ').length
    }
    // Too few sentences with these marks: make up the rest from single words.
    const words = shuffle(usable, rng)
    for (let i = 0; count < WORDS && words.length > 1; i++, count++) {
      out.push(withSymbol(pick(wanted, rng), words[i % words.length] as string, words[(i + 1) % words.length] as string))
    }
    return out.join(' ')
  }

  if (lesson.kind === 'capitals') {
    const words = shuffle(usable, rng).slice(0, WORDS + 4)
    return ['Aa Ff Jj', 'Dd Kk Ss Ll', ...words.map((w) => capitalise(w, lang))].join(' ')
  }

  // Prefer words that contain a new letter; a review takes any word made of known letters.
  const wanted = lesson.kind === 'review' || freshLetters.length === 0 ? usable : usable.filter((w) => freshLetters.some((c) => w.includes(c)))
  const words = shuffle(wanted, rng).slice(0, WORDS)
  while (words.length < WORDS) {
    // Not enough real words yet (early home row): fill up, mixing made-up words between the real ones.
    words.splice(Math.floor(rng() * (words.length + 1)), 0, pseudoWord(letters, freshLetters, rng))
  }

  const out = lesson.kind === 'review' ? [] : drill(lesson.keys)
  words.forEach((word, i) => {
    if (lesson.unit === 'numbers') {
      const number = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => pick(digits, rng)).join('')
      out.push(word, number)
    } else if (freshSymbols.length > 0 && i % 2 === 1) {
      out.push(withSymbol(pick(freshSymbols, rng), word, words[i - 1] as string))
    } else if (lesson.kind === 'review' && lesson.unit === 'bottom' && i % 4 === 3) {
      out.push(`${word}${pick([',', '.'], rng)}`)
    } else out.push(word)
  })
  return out.join(' ')
}
