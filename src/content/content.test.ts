import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LANGS, TYPEABLE, lengthOf, type TextItem } from './types'

function read(lang: string): TextItem[] {
  const dir = join(process.cwd(), 'content', lang)
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as TextItem[])
}

describe.each(LANGS)('content: %s', (lang) => {
  const texts = read(lang)

  it('has at least 150 texts', () => {
    expect(texts.length).toBeGreaterThanOrEqual(150)
  })
  it('has unique ids', () => {
    expect(new Set(texts.map((t) => t.id)).size).toBe(texts.length)
  })
  it('only uses characters that can be typed', () => {
    for (const t of texts) expect(t.text, t.id).toMatch(TYPEABLE)
  })
  it('has no stray whitespace', () => {
    for (const t of texts) {
      expect(t.text, t.id).toBe(t.text.trim())
      expect(t.text, t.id).not.toMatch(/ {2}/)
    }
  })
  it('has correct tags', () => {
    for (const t of texts) {
      expect(t.length, t.id).toBe(lengthOf(t.text))
      expect(['easy', 'medium', 'hard'], t.id).toContain(t.difficulty)
      expect(t.id.startsWith(`${lang}-${t.category}-`), t.id).toBe(true)
    }
  })
})
