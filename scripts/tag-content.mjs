// Fills in the `category` and `length` tags of every text in /content, so authors
// only have to write `id`, `difficulty` and `text`. Run with: npm run tag-content
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../content/', import.meta.url))
const lengthOf = (text) => {
  const n = Array.from(text).length
  return n < 90 ? 'short' : n < 220 ? 'medium' : 'long'
}

for (const lang of readdirSync(root)) {
  if (lang.startsWith('.')) continue
  let count = 0
  for (const file of readdirSync(join(root, lang)).filter((f) => f.endsWith('.json'))) {
    const path = join(root, lang, file)
    const category = basename(file, '.json')
    const texts = JSON.parse(readFileSync(path, 'utf8')).map((t) => ({
      id: t.id,
      category,
      length: lengthOf(t.text),
      difficulty: t.difficulty,
      text: t.text.normalize('NFC'),
    }))
    writeFileSync(path, '[\n' + texts.map((t) => '  ' + JSON.stringify(t)).join(',\n') + '\n]\n')
    count += texts.length
  }
  console.log(`${lang}: ${count} texts`)
}
