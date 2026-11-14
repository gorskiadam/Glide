// Appends texts to a content file and gives them the next free ids.
// Usage: node scripts/add-texts.mjs <lang> <category> < lines.txt
// Each input line is "<difficulty>|<text>", where difficulty is e, m or h
// (or easy, medium, hard). Run `npm run tag-content` afterwards.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [lang, category] = process.argv.slice(2)
if (!lang || !category) throw new Error('Usage: add-texts.mjs <lang> <category> < lines.txt')
const path = fileURLToPath(new URL(`../content/${lang}/${category}.json`, import.meta.url))
const texts = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : []
const levels = { e: 'easy', m: 'medium', h: 'hard', easy: 'easy', medium: 'medium', hard: 'hard' }

let next = texts.length + 1
for (const line of readFileSync(0, 'utf8').split('\n')) {
  if (!line.trim()) continue
  const cut = line.indexOf('|')
  const difficulty = levels[line.slice(0, cut).trim()]
  const text = line.slice(cut + 1).trim()
  if (!difficulty || !text) throw new Error(`Bad line: ${line}`)
  texts.push({ id: `${lang}-${category}-${String(next++).padStart(2, '0')}`, difficulty, text })
}
writeFileSync(path, JSON.stringify(texts, null, 2) + '\n')
console.log(`${lang}/${category}: ${texts.length} texts`)
