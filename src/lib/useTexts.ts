import { useEffect, useState } from 'react'
import { loadTexts, type Lang, type TextItem } from '../content'

/** The text library of a language, or null while it loads. */
export function useTexts(lang: Lang): TextItem[] | null {
  const [state, setState] = useState<{ lang: Lang; texts: TextItem[] } | null>(null)
  useEffect(() => {
    let alive = true
    void loadTexts(lang).then((texts) => alive && setState({ lang, texts }))
    return () => {
      alive = false
    }
  }, [lang])
  return state && state.lang === lang ? state.texts : null
}
