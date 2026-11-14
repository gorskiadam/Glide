import { accuracy, consistency, perSecondWpm, wpm } from './stats'

/** One character the user pressed (backspaces are not recorded here). */
export interface Keystroke {
  /** Milliseconds since the first keystroke of the test. */
  t: number
  /** Position in the target text this keystroke was aimed at. */
  index: number
  expected: string
  typed: string
  ok: boolean
}

/** Everything that happened, in order, including backspaces: enough to replay a run exactly. */
export type LogEvent =
  | { kind: 'key'; t: number; pos: number; index: number; expected: string; typed: string; ok: boolean }
  | { kind: 'back'; t: number; pos: number }

export interface EngineOptions {
  /** When true, a wrong character does not move the caret: the user must type the right one. */
  stopOnError?: boolean
  /** When true, a word with a mistake in it must be fixed before the next word can be started. */
  strict?: boolean
}

export interface Stats {
  /** Net speed: only characters that are correct on screen count. */
  wpm: number
  /** Raw speed: every character typed counts, right or wrong. */
  rawWpm: number
  /** 0 to 100. Mistakes still count after they are corrected. */
  accuracy: number
  /** 0 to 100. */
  consistency: number
  /** Number of wrong keystrokes, including ones that were corrected later. */
  errors: number
  correctChars: number
  incorrectChars: number
  typedChars: number
  elapsedMs: number
  /** Raw WPM for each second of the test, for charts. */
  perSecond: number[]
}

/** A range of character positions whose on-screen state changed: [from, to). */
export interface Change {
  from: number
  to: number
}

/** Splits text into user-visible characters. NFC keeps "ą" as one character, not "a" + ogonek. */
export function toChars(text: string): string[] {
  return Array.from(text.normalize('NFC'))
}

/**
 * The typing engine. It holds the target text and what the user has typed, and it
 * knows nothing about the DOM or about clocks: callers pass `now` (from
 * `performance.now()`) into every method, which also makes it easy to test.
 */
export class TypingEngine {
  readonly target: string[]
  /** What the user typed at each position before the caret. */
  readonly typed: string[] = []
  readonly keystrokes: Keystroke[] = []
  /** Keystrokes and backspaces with the caret position after each one (`pos`), for the replay. */
  readonly log: LogEvent[] = []
  private readonly stopOnError: boolean
  private readonly strict: boolean
  private startedAt: number | null = null
  private lastAt: number | null = null
  private endedAt: number | null = null

  constructor(text: string, options: EngineOptions = {}) {
    this.target = toChars(text)
    this.stopOnError = options.stopOnError ?? false
    this.strict = options.strict ?? false
  }

  /** Caret position: the index of the next character to type. */
  get pos(): number {
    return this.typed.length
  }
  get started(): boolean {
    return this.startedAt !== null
  }
  get finished(): boolean {
    return this.endedAt !== null
  }
  /** True when the caret has reached the end of the target text. */
  get atEnd(): boolean {
    return this.typed.length >= this.target.length
  }

  /** True when the test text is finished. In strict mode the last word must also be correct. */
  get complete(): boolean {
    return this.atEnd && !(this.strict && this.wordHasError(this.target.length))
  }

  /** Whether the word that ends just before `end` contains a wrong character. */
  private wordHasError(end: number): boolean {
    for (let i = end - 1; i >= 0 && this.target[i] !== ' '; i--) {
      if (this.typed[i] !== this.target[i]) return true
    }
    return false
  }

  /** Adds more text to the end (used by timed tests so the text never runs out). */
  extend(text: string): Change {
    const from = this.target.length
    for (const ch of toChars(text)) this.target.push(ch)
    return { from, to: this.target.length }
  }

  /** Types one character. Returns the positions that changed, or null if nothing happened. */
  type(input: string, now: number): Change | null {
    if (this.finished || this.atEnd) return null
    const ch = toChars(input)[0]
    if (ch === undefined) return null
    // Strict mode: the space after a word is locked until the word is correct.
    if (this.strict && this.target[this.typed.length] === ' ' && this.wordHasError(this.typed.length)) return null
    if (this.startedAt === null) this.startedAt = now
    this.lastAt = now

    const index = this.typed.length
    const expected = this.target[index] as string
    const ok = ch === expected
    const t = now - this.startedAt
    this.keystrokes.push({ t, index, expected, typed: ch, ok })
    const moves = ok || !this.stopOnError
    if (moves) this.typed.push(ch)
    this.log.push({ kind: 'key', t, pos: this.typed.length, index, expected, typed: ch, ok })
    return moves ? { from: index, to: index + 1 } : { from: index, to: index }
  }

  /** Types several characters in a row (pasted composition text, for example). */
  typeAll(input: string, now: number): Change | null {
    let change: Change | null = null
    for (const ch of toChars(input)) {
      const c = this.type(ch, now)
      if (c) change = change ? { from: Math.min(change.from, c.from), to: Math.max(change.to, c.to) } : c
    }
    return change
  }

  /** Deletes the character before the caret. */
  backspace(now: number): Change | null {
    if (this.finished || this.typed.length === 0) return null
    this.lastAt = now
    this.typed.pop()
    this.logBack(now)
    return { from: this.typed.length, to: this.typed.length + 1 }
  }

  /** Deletes back to the start of the current word (Ctrl/Alt + Backspace). */
  backspaceWord(now: number): Change | null {
    if (this.finished || this.typed.length === 0) return null
    this.lastAt = now
    const to = this.typed.length
    let i = to
    while (i > 0 && this.target[i - 1] === ' ') i--
    while (i > 0 && this.target[i - 1] !== ' ') i--
    this.typed.length = i
    this.logBack(now)
    return { from: i, to }
  }

  private logBack(now: number): void {
    this.log.push({ kind: 'back', t: now - (this.startedAt ?? now), pos: this.typed.length })
  }

  /** Whether the character at a position is currently correct, wrong, or not typed yet. */
  stateAt(index: number): 'ok' | 'bad' | 'pending' {
    const t = this.typed[index]
    if (t === undefined) return 'pending'
    return t === this.target[index] ? 'ok' : 'bad'
  }

  /** Milliseconds since the first keystroke (0 before the test starts). */
  elapsed(now: number): number {
    if (this.startedAt === null) return 0
    return (this.endedAt ?? now) - this.startedAt
  }

  /**
   * Ends the test. `elapsedMs` fixes the duration (a timed test passes its time
   * limit); without it the test ends at the last keystroke.
   */
  finish(elapsedMs?: number): void {
    if (this.finished || this.startedAt === null) return
    this.endedAt = elapsedMs !== undefined ? this.startedAt + elapsedMs : (this.lastAt ?? this.startedAt)
  }

  stats(now: number): Stats {
    const elapsedMs = this.elapsed(now)
    let correctChars = 0
    for (let i = 0; i < this.typed.length; i++) if (this.typed[i] === this.target[i]) correctChars++
    let okStrokes = 0
    const times: number[] = []
    for (const k of this.keystrokes) {
      if (k.ok) okStrokes++
      times.push(k.t)
    }
    const total = this.keystrokes.length
    const perSecond = perSecondWpm(times, elapsedMs)
    return {
      wpm: wpm(correctChars, elapsedMs),
      rawWpm: wpm(total, elapsedMs),
      accuracy: accuracy(okStrokes, total),
      consistency: consistency(perSecond),
      errors: total - okStrokes,
      correctChars,
      incorrectChars: this.typed.length - correctChars,
      typedChars: this.typed.length,
      elapsedMs,
      perSecond,
    }
  }
}
