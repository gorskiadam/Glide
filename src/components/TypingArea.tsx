import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { Change, TypingEngine } from '../engine/engine'
import { paceIndex } from '../lib/pace'
import type { KeySound } from '../lib/sound'
import type { CaretStyle, FontSize, TypeFont } from '../store'

export interface TypingAreaHandle {
  focus: () => void
}

interface Props {
  ref?: Ref<TypingAreaHandle>
  engine: TypingEngine
  /** Called after every keystroke that changed something. */
  onInput: () => void
  onEscape: () => void
  /** Timed tests supply more text so the user never reaches the end. */
  getMore?: () => string
  /** Called with the kind of key pressed, for key sounds. */
  onKey?: (kind: KeySound) => void
  caret: CaretStyle
  smoothCaret: boolean
  fontSize: FontSize
  font: TypeFont
  label: string
  blurHint: string
  /** Speed of the pace caret in WPM. No pace caret when missing. */
  paceWpm?: number | null
}

/** Accent keys that start a composition on desktop ("dead keys"). They are not typed on their own. */
const DEAD_KEY = /^[´`ˆ˜¨¸˛˙˚ˇ^~]$/
/** The hidden input always holds one space, so Backspace has something to delete on phones. */
const FILLER = ' '
const EXTEND_WHEN_LEFT = 140

/**
 * The typing surface. For speed it does not re-render through React on each key:
 * characters are plain spans whose class is changed directly, and the caret is
 * moved with a transform.
 */
export function TypingArea({ ref, engine, onInput, onEscape, getMore, onKey, caret, smoothCaret, fontSize, font, label, blurHint, paceWpm }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLDivElement>(null)
  const paceRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const spans = useRef<HTMLSpanElement[]>([])
  const [focused, setFocused] = useState(false)

  // Keep the latest callbacks without re-binding the native listeners.
  const cb = useRef({ onInput, onEscape, getMore, onKey })
  cb.current = { onInput, onEscape, getMore, onKey }

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus({ preventScroll: true }) }), [])

  const api = useRef({
    append(_from: number) {},
    paint(_change: Change) {},
    placeCaret() {},
  })

  useLayoutEffect(() => {
    const inner = innerRef.current as HTMLDivElement
    const caret = caretRef.current as HTMLDivElement
    let word: HTMLSpanElement | null = null
    spans.current = []
    inner.replaceChildren(caret)
    if (paceRef.current) inner.append(paceRef.current)
    inner.style.transform = ''

    api.current.append = (from) => {
      const frag = document.createDocumentFragment()
      for (let i = from; i < engine.target.length; i++) {
        const ch = engine.target[i] as string
        const span = document.createElement('span')
        span.className = 'c'
        span.textContent = ch
        spans.current.push(span)
        // A word and the space after it share one unbreakable box, so a line
        // can never start with a space.
        if (!word) {
          word = document.createElement('span')
          word.className = 'w'
          frag.append(word)
        }
        word.append(span)
        if (ch === ' ') word = null
      }
      inner.append(frag)
    }

    api.current.paint = ({ from, to }) => {
      for (let i = from; i < to; i++) {
        const span = spans.current[i]
        if (!span) continue
        const state = engine.stateAt(i)
        span.className = state === 'pending' ? 'c' : `c ${state}`
      }
    }

    api.current.placeCaret = () => {
      const all = spans.current
      const lineHeight = parseFloat(getComputedStyle(inner).lineHeight) || 44
      const current = all[engine.pos]
      const last = all[all.length - 1]
      let x = 0
      let top = 0
      if (current) {
        x = current.offsetLeft
        top = current.offsetTop
      } else if (last) {
        x = last.offsetLeft + last.offsetWidth
        top = last.offsetTop
      }
      const line = Math.floor(top / lineHeight)
      // Block and underline carets are as wide as the character under them.
      const width = current?.offsetWidth ?? last?.offsetWidth ?? 12
      caret.style.setProperty('--caret-w', `${width}px`)
      caret.style.transform = `translate(${x}px, ${line * lineHeight}px)`
      caret.classList.toggle('idle', !engine.started)
      // Keep the current line in the middle of the three visible lines.
      inner.style.transform = `translateY(${-Math.max(0, line - 1) * lineHeight}px)`
    }

    api.current.append(0)
    api.current.paint({ from: 0, to: engine.pos })
    api.current.placeCaret()

    const onResize = () => api.current.placeCaret()
    window.addEventListener('resize', onResize)
    void document.fonts?.ready.then(onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [engine])

  // The pace caret: moves at a fixed speed from the first keystroke on.
  useEffect(() => {
    const pace = paceRef.current
    if (!pace || !paceWpm) return
    const inner = innerRef.current as HTMLDivElement
    let frame = 0
    let shown = -1
    const step = () => {
      frame = requestAnimationFrame(step)
      if (!engine.started) {
        if (shown !== -1) pace.style.opacity = '0'
        shown = -1
        return
      }
      const all = spans.current
      const index = Math.min(paceIndex(paceWpm, engine.elapsed(performance.now())), all.length - 1)
      if (index === shown) return
      shown = index
      const span = all[index]
      if (!span) return
      const lineHeight = parseFloat(getComputedStyle(inner).lineHeight) || 44
      pace.style.opacity = engine.finished ? '0' : '1'
      pace.style.transform = `translate(${span.offsetLeft}px, ${Math.floor(span.offsetTop / lineHeight) * lineHeight}px)`
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      pace.style.opacity = '0'
    }
  }, [engine, paceWpm])

  // A new font or size moves every character, so the caret has to be placed again.
  useLayoutEffect(() => {
    api.current.placeCaret()
    void document.fonts?.ready.then(() => api.current.placeCaret())
  }, [caret, fontSize, font])

  useEffect(() => {
    const input = inputRef.current as HTMLTextAreaElement
    let composition = ''

    const resetInput = () => {
      input.value = FILLER
      input.setSelectionRange(FILLER.length, FILLER.length)
    }
    resetInput()

    const after = (change: Change | null) => {
      if (!change) return
      const more = cb.current.getMore
      if (more && engine.target.length - engine.pos < EXTEND_WHEN_LEFT) {
        const added = engine.extend(' ' + more())
        api.current.append(added.from)
      }
      api.current.paint(change)
      api.current.placeCaret()
      cb.current.onInput()
    }

    const typeChar = (ch: string, now: number) => {
      const before = engine.keystrokes.length
      const change = engine.type(ch, now)
      const stroke = engine.keystrokes[before]
      if (stroke) cb.current.onKey?.(stroke.ok ? (ch === ' ' ? 'space' : 'key') : 'error')
      // Strict mode refused the key: the word before the caret still has a mistake.
      else if (!engine.atEnd && !engine.finished) cb.current.onKey?.('error')
      after(change)
    }
    const erase = (change: Change | null) => {
      if (change) cb.current.onKey?.('back')
      after(change)
    }

    /** Makes the engine match an in-progress composition string (phone keyboards, dead keys). */
    const syncComposition = (next: string, now: number, final: boolean) => {
      if (!final && DEAD_KEY.test(next)) return
      const a = Array.from(composition)
      const b = Array.from(next.normalize('NFC'))
      let same = 0
      while (same < a.length && same < b.length && a[same] === b[same]) same++
      for (let i = a.length; i > same; i--) erase(engine.backspace(now))
      for (let i = same; i < b.length; i++) typeChar(b[i] as string, now)
      composition = b.join('')
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cb.current.onEscape()
        return
      }
      if (e.key === 'Enter') e.preventDefault()
      // A held-down key must not fill the text with repeats. Backspace may repeat.
      if (e.repeat && e.key !== 'Backspace') e.preventDefault()
    }

    const onBeforeInput = (e: InputEvent) => {
      if (e.isComposing || e.inputType.includes('Composition')) return
      e.preventDefault()
      // performance.now() rather than e.timeStamp: some input methods deliver a
      // batch of events that all share one timestamp.
      const now = performance.now()
      switch (e.inputType) {
        case 'insertText':
        case 'insertReplacementText':
          if (e.data) for (const ch of Array.from(e.data.normalize('NFC'))) typeChar(ch, now)
          break
        case 'deleteContentBackward':
          erase(engine.backspace(now))
          break
        case 'deleteWordBackward':
        case 'deleteSoftLineBackward':
        case 'deleteHardLineBackward':
          erase(engine.backspaceWord(now))
          break
        default:
          // Paste, drop, Enter and the rest are ignored.
          break
      }
    }

    const onCompositionStart = () => {
      composition = ''
    }
    const onCompositionUpdate = (e: CompositionEvent) => syncComposition(e.data, performance.now(), false)
    const onCompositionEnd = (e: CompositionEvent) => {
      syncComposition(e.data, performance.now(), true)
      composition = ''
      resetInput()
    }
    const onFocus = () => {
      setFocused(true)
      resetInput()
    }
    const onBlur = () => setFocused(false)

    input.addEventListener('keydown', onKeyDown)
    input.addEventListener('beforeinput', onBeforeInput)
    input.addEventListener('compositionstart', onCompositionStart)
    input.addEventListener('compositionupdate', onCompositionUpdate)
    input.addEventListener('compositionend', onCompositionEnd)
    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)
    return () => {
      input.removeEventListener('keydown', onKeyDown)
      input.removeEventListener('beforeinput', onBeforeInput)
      input.removeEventListener('compositionstart', onCompositionStart)
      input.removeEventListener('compositionupdate', onCompositionUpdate)
      input.removeEventListener('compositionend', onCompositionEnd)
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)
    }
  }, [engine])

  return (
    <div ref={viewportRef} className="type-viewport" data-caret={caret} data-smooth={smoothCaret} data-size={fontSize} data-font={font}>
      <div ref={innerRef} className="type-inner" aria-hidden="true">
        <div ref={caretRef} className="type-caret idle" />
        {paceWpm ? <div ref={paceRef} className="type-pace" /> : null}
      </div>
      <textarea
        ref={inputRef}
        className="type-input"
        aria-label={label}
        aria-describedby="type-text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        rows={1}
      />
      {/* The visible text is built from spans for speed, so screen readers get this copy. */}
      <p id="type-text" className="sr-only">
        {engine.target.slice(0, 600).join('')}
      </p>
      {!focused && <div className="type-blur">{blurHint}</div>}
    </div>
  )
}
