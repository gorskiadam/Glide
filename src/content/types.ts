export type Lang = 'en' | 'pl'
export const LANGS: readonly Lang[] = ['en', 'pl']

export type Category = 'quick' | 'everyday' | 'work' | 'school' | 'stories' | 'practical' | 'numbers'
export type TextLength = 'short' | 'medium' | 'long'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface TextItem {
  id: string
  category: Category
  length: TextLength
  difficulty: Difficulty
  text: string
}

/** Length tag rule shared by the tagging script and the tests. */
export function lengthOf(text: string): TextLength {
  const n = Array.from(text).length
  return n < 90 ? 'short' : n < 220 ? 'medium' : 'long'
}

/** Every character a text may contain: printable ASCII plus Polish letters. */
export const TYPEABLE = /^[ -~ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/
