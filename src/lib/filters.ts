import type { Category, TextItem } from '../content'

export interface TextFilters {
  punctuation: boolean
  numbers: boolean
  capitals: boolean
}

const NOT_LETTER_OR_DIGIT = /[^\p{L}\p{N}]/gu
const HAS_DIGIT = /\p{N}/u

/**
 * Simplifies a text for practice. With numbers off, words that contain a digit are
 * dropped. With punctuation off, everything except letters and digits is removed.
 * With capitals off, the text is lower-cased.
 */
export function applyFilters(text: string, filters: TextFilters, locale = 'en'): string {
  let words = text.split(' ')
  if (!filters.numbers) words = words.filter((w) => !HAS_DIGIT.test(w))
  if (!filters.punctuation) words = words.map((w) => w.replace(NOT_LETTER_OR_DIGIT, ''))
  let out = words.filter(Boolean).join(' ')
  if (!filters.capitals) out = out.toLocaleLowerCase(locale)
  return out
}

/** Picks the texts for a category and applies the filters. Texts that end up empty are left out. */
export function prepareTexts(
  texts: readonly TextItem[],
  category: Category | 'all',
  filters: TextFilters,
  locale = 'en',
): TextItem[] {
  const out: TextItem[] = []
  for (const item of texts) {
    if (category !== 'all' && item.category !== category) continue
    // The numbers-and-symbols drills make no sense with numbers or punctuation off.
    if (category === 'all' && item.category === 'numbers' && (!filters.numbers || !filters.punctuation)) continue
    const text = applyFilters(item.text, filters, locale)
    if (text.length >= 3) out.push({ ...item, text })
  }
  return out
}
