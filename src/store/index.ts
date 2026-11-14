import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Category, Lang, TextLength } from '../content'
import { betterDaily, type DailyScore } from '../lib/daily'
import { emptyStats, mergeStats, type TypingStats } from '../lib/keystats'
import type { LessonScore } from '../lib/lessons'
import type { SoundPack } from '../lib/sound'

export type Theme = 'light' | 'dark' | 'system'
export type Mode = 'time' | 'words' | 'passage' | 'zen' | 'coach'
/** What a saved result can be: a practice mode, or one of the guided activities. */
export type ResultMode = Mode | 'lesson' | 'daily' | 'sprint' | 'warmup'
/** What the pace caret races against. */
export type Pace = 'off' | 'average' | 'best' | 'custom'
export type CaretStyle = 'line' | 'block' | 'underline'
export type FontSize = 's' | 'm' | 'l' | 'xl'
export type TypeFont = 'mono' | 'sans' | 'dyslexic'

export const TIME_OPTIONS = [15, 30, 60, 120] as const
export const WORD_OPTIONS = [25, 50, 100] as const
export const LENGTH_OPTIONS: readonly TextLength[] = ['short', 'medium', 'long']
export const GOAL_OPTIONS = [5, 10, 15, 30] as const

export interface Settings {
  uiLang: Lang
  contentLang: Lang
  theme: Theme
  mode: Mode
  seconds: number
  words: number
  passageLength: TextLength
  category: Category | 'all'
  showLiveWpm: boolean
  sound: boolean
  soundPack: SoundPack
  caret: CaretStyle
  smoothCaret: boolean
  fontSize: FontSize
  font: TypeFont
  strict: boolean
  stopOnError: boolean
  punctuation: boolean
  numbers: boolean
  capitals: boolean
  reduceMotion: boolean
  /** Minutes of typing to aim for each day. */
  dailyGoal: number
  /** A second caret that moves at a steady speed, to race against. */
  pace: Pace
  /** Speed of the pace caret when `pace` is "custom". */
  paceWpm: number
}

/** Everything Glide saves: also the content of an exported backup. */
export interface SavedData {
  settings: Settings
  history: Result[]
  typing: Record<Lang, TypingStats>
  lessons: Record<string, LessonScore>
  daily: Record<string, DailyScore>
}

export interface Result {
  id: string
  /** Unix time in ms. */
  at: number
  mode: ResultMode
  /** Seconds (time), word count (words), 1-3 for passage length, messages (sprint), 0 otherwise. */
  amount: number
  lang: Lang
  wpm: number
  rawWpm: number
  accuracy: number
  consistency: number
  /** Flow Score, 0 to 100. Missing on results saved before it existed. */
  flow?: number
  errors: number
  elapsedMs: number
  correctChars: number
  incorrectChars: number
}

interface State {
  settings: Settings
  history: Result[]
  /** Per-key and per-pair totals for each practice language, used by the heatmap and the coach. */
  typing: Record<Lang, TypingStats>
  /** Best score for each finished lesson, by lesson id. */
  lessons: Record<string, LessonScore>
  /** Best daily challenge score, by "YYYY-MM-DD:lang". */
  daily: Record<string, DailyScore>
  update: (patch: Partial<Settings>) => void
  addResult: (result: Result) => void
  addTyping: (lang: Lang, stats: TypingStats) => void
  saveLesson: (id: string, score: LessonScore) => void
  saveDaily: (key: string, wpm: number, accuracy: number, flow: number) => void
  resetAll: () => void
  /** Replaces everything with the content of a backup. */
  importData: (data: SavedData) => void
}

function detectLang(): Lang {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  return nav.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

export function defaults(): Settings {
  const lang = detectLang()
  return {
    uiLang: lang,
    contentLang: lang,
    theme: 'system',
    mode: 'time',
    seconds: 30,
    words: 25,
    passageLength: 'medium',
    category: 'all',
    showLiveWpm: true,
    sound: false,
    soundPack: 'soft',
    caret: 'line',
    smoothCaret: true,
    fontSize: 'm',
    font: 'mono',
    strict: false,
    stopOnError: false,
    punctuation: true,
    numbers: true,
    capitals: true,
    reduceMotion: false,
    dailyGoal: 10,
    pace: 'off',
    paceWpm: 50,
  }
}

const HISTORY_LIMIT = 500
const noTyping = (): Record<Lang, TypingStats> => ({ en: emptyStats(), pl: emptyStats() })

export const useStore = create<State>()(
  persist(
    (set) => ({
      settings: defaults(),
      history: [],
      typing: noTyping(),
      lessons: {},
      daily: {},
      update: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      addResult: (result) => set((s) => ({ history: [...s.history, result].slice(-HISTORY_LIMIT) })),
      addTyping: (lang, stats) => set((s) => ({ typing: { ...s.typing, [lang]: mergeStats(s.typing[lang], stats) } })),
      saveLesson: (id, score) =>
        set((s) => {
          const old = s.lessons[id]
          const best = old
            ? { stars: Math.max(old.stars, score.stars), wpm: Math.max(old.wpm, score.wpm), accuracy: Math.max(old.accuracy, score.accuracy) }
            : score
          return { lessons: { ...s.lessons, [id]: best } }
        }),
      saveDaily: (key, wpm, accuracy, flow) => set((s) => ({ daily: { ...s.daily, [key]: betterDaily(s.daily[key], wpm, accuracy, flow) } })),
      resetAll: () => set({ settings: defaults(), history: [], typing: noTyping(), lessons: {}, daily: {} }),
      importData: (data) => set({ settings: data.settings, history: data.history.slice(-HISTORY_LIMIT), typing: data.typing, lessons: data.lessons, daily: data.daily }),
    }),
    {
      name: 'glide:v1',
      version: 1,
      // Saved settings from an older version may lack newer options: fill them in from the defaults.
      merge: (saved, current) => {
        const old = (saved ?? {}) as Partial<State>
        return {
          ...current,
          history: old.history ?? [],
          lessons: old.lessons ?? {},
          daily: old.daily ?? {},
          typing: { ...current.typing, ...old.typing },
          settings: { ...current.settings, ...old.settings },
        }
      },
    },
  ),
)

/** The number stored as a result's `amount` for the current setup. */
export function amountOf(s: Pick<Settings, 'mode' | 'seconds' | 'words' | 'passageLength'>): number {
  if (s.mode === 'time') return s.seconds
  if (s.mode === 'words') return s.words
  if (s.mode === 'passage') return LENGTH_OPTIONS.indexOf(s.passageLength) + 1
  return 0
}

/** Modes whose results are not comparable from one run to the next, so they have no personal best. */
export const hasBest = (mode: ResultMode) => mode !== 'zen' && mode !== 'coach' && mode !== 'lesson' && mode !== 'warmup'

/** Key drills rather than real text: their speed stays out of averages and charts. */
export const isDrill = (mode: ResultMode) => mode === 'lesson' || mode === 'warmup'

/** Best net WPM for one exact test setup, or null if it has never been played or the mode has no best. */
export function bestWpm(history: readonly Result[], mode: ResultMode, amount: number, lang: Lang): number | null {
  if (!hasBest(mode)) return null
  let best: number | null = null
  for (const r of history) {
    if (r.mode === mode && r.amount === amount && r.lang === lang && (best === null || r.wpm > best)) best = r.wpm
  }
  return best
}
