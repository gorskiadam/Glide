import { describe, expect, it } from 'vitest'
import { translate } from '../i18n'
import { defaults, type Settings } from '../store'
import { buildCommands, filterCommands, fold } from './commands'

describe('command palette', () => {
  it('folds case and Polish accents', () => {
    expect(fold('Ćwicz ŻÓŁW')).toBe('cwicz zolw')
  })

  it('matches every word of the query, accents or not', () => {
    const items = [{ label: 'Przejdź do: Ćwicz' }, { label: 'Motyw: Ciemny' }, { label: 'Test na czas: 30 s' }]
    expect(filterCommands(items, 'cwicz')).toEqual([items[0]])
    expect(filterCommands(items, 'czas 30')).toEqual([items[2]])
    expect(filterCommands(items, '  ')).toHaveLength(3)
    expect(filterCommands(items, 'xyz')).toEqual([])
  })

  for (const lang of ['en', 'pl'] as const) {
    it(`has unique ids and labels, and commands that work (${lang})`, () => {
      let settings: Settings = { ...defaults(), sound: false }
      const hashes: string[] = []
      const commands = buildCommands(
        (key, params) => translate(lang, key, params),
        settings,
        (patch) => {
          settings = { ...settings, ...patch }
        },
        (hash) => hashes.push(hash),
      )
      expect(new Set(commands.map((c) => c.id)).size).toBe(commands.length)
      expect(new Set(commands.map((c) => c.label)).size).toBe(commands.length)
      commands.find((c) => c.id === 'time-60')?.run()
      expect([settings.mode, settings.seconds, hashes.at(-1)]).toEqual(['time', 60, '#/'])
      commands.find((c) => c.id === 'theme-dark')?.run()
      commands.find((c) => c.id === 'sound')?.run()
      commands.find((c) => c.id === 'go-lessons')?.run()
      expect([settings.theme, settings.sound, hashes.at(-1)]).toEqual(['dark', true, '#/lessons'])
    })
  }
})
