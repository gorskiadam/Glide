import { describe, expect, it } from 'vitest'
import { TypingEngine } from '../engine/engine'
import { analyse, gaps, joinRecordings, playTimes, typedAt, type Recording } from './replay'

/** Plays a script into an engine: [char or 'BACK', ms since the previous key]. */
function record(text: string, script: [string, number][], options = {}): Recording & { elapsedMs: number } {
  const engine = new TypingEngine(text, options)
  let now = 1000
  for (const [key, wait] of script) {
    now += wait
    if (key === 'BACK') engine.backspace(now)
    else engine.type(key, now)
  }
  engine.finish()
  return { target: engine.target.slice(), log: engine.log, elapsedMs: engine.stats(now).elapsedMs }
}

describe('engine log', () => {
  it('records keys and backspaces with the caret after each', () => {
    const { log } = record('cat', [['c', 0], ['x', 100], ['BACK', 100], ['a', 100], ['t', 100]])
    expect(log.map((e) => [e.kind, e.t, e.pos])).toEqual([['key', 0, 1], ['key', 100, 2], ['back', 200, 1], ['key', 300, 2], ['key', 400, 3]])
    expect(log[1]).toMatchObject({ expected: 'a', typed: 'x', ok: false, index: 1 })
  })

  it('keeps the caret still for a wrong key in stop-on-error mode', () => {
    const { log } = record('ab', [['x', 0], ['a', 100]], { stopOnError: true })
    expect(log.map((e) => e.pos)).toEqual([0, 1])
  })
})

describe('replay', () => {
  const rec = record('cat', [['c', 0], ['x', 100], ['BACK', 100], ['a', 100], ['t', 100]])

  it('rebuilds the screen at any point', () => {
    expect(typedAt(rec.log, 0)).toEqual({ typed: [], pos: 0 })
    expect(typedAt(rec.log, 2)).toEqual({ typed: ['c', 'x'], pos: 2 })
    expect(typedAt(rec.log, 3)).toEqual({ typed: ['c'], pos: 1 })
    expect(typedAt(rec.log, 99)).toEqual({ typed: ['c', 'a', 't'], pos: 3 })
    const stop = record('ab', [['x', 0], ['a', 100]], { stopOnError: true })
    expect(typedAt(stop.log, 1)).toEqual({ typed: [], pos: 0 })
  })

  it('keeps the rhythm but shortens long pauses', () => {
    const slow = record('abc', [['a', 0], ['b', 200], ['c', 9000]])
    expect(gaps(slow.log)).toEqual([0, 200, 9000])
    expect(playTimes(slow.log)).toEqual([0, 200, 1700])
  })

  it('joins runs with offsets', () => {
    const a = record('hi', [['h', 0], ['i', 100]])
    const b = record('yo', [['y', 0], ['o', 100]])
    const all = joinRecordings([a, b])
    expect(all.target.join('')).toBe('hi yo')
    expect(all.log.map((e) => [e.t, e.pos])).toEqual([[0, 1], [100, 2], [500, 4], [600, 5]])
    expect(typedAt(all.log, 4).typed).toEqual(['h', 'i', undefined, 'y', 'o'])
  })
})

describe('run analysis', () => {
  it('finds confusions, the long pause and backspaces', () => {
    const rec = record('the cat sat on the mat', [
      ['t', 0], ['h', 100], ['e', 100], [' ', 100],
      ['v', 100], ['BACK', 150], ['c', 150], ['a', 100], ['t', 100], [' ', 100],
      ['s', 3000], ['a', 100], ['t', 100], [' ', 100],
      ['o', 100], ['n', 100], [' ', 100],
      ['t', 100], ['h', 100], ['e', 100], [' ', 100],
      ['m', 100], ['a', 100], ['t', 100],
    ])
    const found = analyse(rec)
    expect(found.keys).toBe(23)
    expect(found.errors).toBe(1)
    expect(found.backspaces).toBe(1)
    expect(found.confusions).toEqual([{ expected: 'c', typed: 'v', n: 1, at: 4 }])
    expect(found.pause).toMatchObject({ ms: 3000, word: 'sat' })
    expect(found.meanGap).toBeGreaterThan(95)
    expect(found.meanGap).toBeLessThan(110)
  })

  it('ranks slow keys and ignores keys seen once', () => {
    const rec = record('azaz bb q', [['a', 0], ['z', 400], ['a', 100], ['z', 420], [' ', 100], ['b', 100], ['b', 100], [' ', 100], ['q', 900]])
    const found = analyse(rec)
    expect(found.slowKeys.map((k) => k.key)).toEqual(['z'])
    expect(found.pause).toBeNull()
  })

  it('notices mistakes made in a hurry', () => {
    const script: [string, number][] = []
    const text = 'abcabcabcabc'
    Array.from(text).forEach((ch, i) => script.push(ch === 'c' ? ['x', i === 0 ? 0 : 60] : [ch, i === 0 ? 0 : 200]))
    expect(analyse(record(text, script)).rushed).toBe(true)
    expect(analyse(record('abab', [['a', 0], ['b', 100], ['a', 100], ['b', 100]])).rushed).toBe(false)
  })

  it('copes with an empty run', () => {
    expect(analyse({ target: ['a'], log: [] })).toMatchObject({ keys: 0, errors: 0, meanGap: 0, pause: null, confusions: [], slowKeys: [] })
  })
})
