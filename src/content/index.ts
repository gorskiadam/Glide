import type { Lang, TextItem } from './types'

export * from './types'

// Each language's JSON files are split into their own chunk and loaded on demand.
const files = import.meta.glob<TextItem[]>('/content/*/*.json', { import: 'default' })
const cache = new Map<Lang, Promise<TextItem[]>>()

export function loadTexts(lang: Lang): Promise<TextItem[]> {
  let pending = cache.get(lang)
  if (!pending) {
    const loaders = Object.entries(files)
      .filter(([path]) => path.startsWith(`/content/${lang}/`))
      .map(([, load]) => load())
    pending = Promise.all(loaders).then((groups) => groups.flat())
    cache.set(lang, pending)
  }
  return pending
}
