import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { Shell, type Route } from './components/Shell'
import { Practice } from './screens/Practice'
import { useStore } from './store'

// Only the practice screen is in the first download; the other screens load when opened.
const Daily = lazy(() => import('./screens/Daily').then((m) => ({ default: m.Daily })))
const Lesson = lazy(() => import('./screens/Lesson').then((m) => ({ default: m.Lesson })))
const Lessons = lazy(() => import('./screens/Lessons').then((m) => ({ default: m.Lessons })))
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const Sprint = lazy(() => import('./screens/Sprint').then((m) => ({ default: m.Sprint })))
const Warmup = lazy(() => import('./screens/Warmup').then((m) => ({ default: m.Warmup })))
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })))

type Page = 'practice' | 'daily' | 'sprint' | 'warmup' | 'lessons' | 'lesson' | 'progress' | 'settings'
interface Location {
  page: Page
  /** The lesson id on a lesson page. */
  id: string
}

/** Which item of the navigation each page belongs to. */
const SECTION: Record<Page, Route> = {
  practice: 'practice',
  daily: 'practice',
  sprint: 'practice',
  warmup: 'practice',
  lessons: 'lessons',
  lesson: 'lessons',
  progress: 'progress',
  settings: 'settings',
}

function readRoute(): Location {
  const [first = '', id = ''] = window.location.hash.replace(/^#\/?/, '').split('/')
  if (first === 'lessons') return { page: id ? 'lesson' : 'lessons', id }
  if (first === 'settings' || first === 'progress' || first === 'daily' || first === 'sprint' || first === 'warmup') return { page: first, id: '' }
  return { page: 'practice', id: '' }
}

export function App() {
  const theme = useStore((s) => s.settings.theme)
  const uiLang = useStore((s) => s.settings.uiLang)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const [route, setRoute] = useState<Location>(readRoute)
  const [typing, setTyping] = useState(false)
  const [palette, setPalette] = useState(false)

  const closePalette = useCallback(() => {
    setPalette(false)
    // Back to typing straight away if the palette left the focus nowhere.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) document.querySelector<HTMLElement>('.type-input')?.focus({ preventScroll: true })
    })
  }, [])

  // Cmd+K on a Mac, Ctrl+K elsewhere, from anywhere in the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onHash = () => setRoute(readRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Each screen starts at the top.
  useEffect(() => {
    // In braces on purpose: newer browsers return a promise from scrollTo, and an effect must not return one.
    window.scrollTo(0, 0)
  }, [route.page, route.id])

  useEffect(() => {
    document.documentElement.lang = uiLang
  }, [uiLang])

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
  }, [reduceMotion])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return (
    <Shell route={SECTION[route.page]} typing={typing} onPalette={() => setPalette(true)}>
      <Suspense fallback={null}>
      {route.page === 'settings' && <Settings />}
      {route.page === 'progress' && <Progress />}
      {route.page === 'lessons' && <Lessons />}
      {route.page === 'lesson' && <Lesson key={route.id} id={route.id} onTypingChange={setTyping} />}
      {route.page === 'daily' && <Daily onTypingChange={setTyping} />}
      {route.page === 'sprint' && <Sprint onTypingChange={setTyping} />}
      {route.page === 'warmup' && <Warmup onTypingChange={setTyping} />}
      {route.page === 'practice' && <Practice onTypingChange={setTyping} />}
      </Suspense>
      {/* Its own boundary, so that loading the palette never hides the screen behind it. */}
      <Suspense fallback={null}>{palette && <CommandPalette onClose={closePalette} />}</Suspense>
    </Shell>
  )
}
