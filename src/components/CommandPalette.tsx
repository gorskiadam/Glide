import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { buildCommands, filterCommands } from '../lib/commands'
import { useStore } from '../store'
import { Icon } from './Icon'

/** Cmd/Ctrl+K: a searchable list of everything the app can do, driven from the keyboard. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const update = useStore((s) => s.update)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const commands = useMemo(
    () =>
      buildCommands(t, settings, update, (hash) => {
        window.location.hash = hash
      }),
    [t, settings, update],
  )
  const shown = useMemo(() => filterCommands(commands, query), [commands, query])
  const current = Math.min(active, Math.max(0, shown.length - 1))

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [current, shown])

  const run = (index: number) => {
    const command = shown[index]
    if (!command) return
    dialogRef.current?.close()
    command.run()
  }

  return (
    <dialog ref={dialogRef} className="palette" aria-label={t('palette.title')} onClose={onClose} onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <div className="palette-search">
        <Icon name="zap" />
        <input
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={shown[current] ? `cmd-${shown[current].id}` : undefined}
          aria-label={t('palette.title')}
          placeholder={t('palette.placeholder')}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive(shown.length === 0 ? 0 : (current + 1) % shown.length)
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive(shown.length === 0 ? 0 : (current - 1 + shown.length) % shown.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(current)
            }
          }}
        />
        <kbd>Esc</kbd>
      </div>
      <ul ref={listRef} id="palette-list" role="listbox" aria-label={t('palette.results')}>
        {shown.map((command, i) => (
          <li
            key={command.id}
            id={`cmd-${command.id}`}
            role="option"
            aria-selected={i === current}
            onMouseMove={() => setActive(i)}
            onClick={() => run(i)}
          >
            <Icon name={command.icon} />
            {command.label}
          </li>
        ))}
      </ul>
      <p className="palette-empty" role="status">
        {shown.length === 0 ? t('palette.empty') : ''}
      </p>
    </dialog>
  )
}
