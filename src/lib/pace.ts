import type { Lang } from '../content'
import { bestWpm, isDrill, type Result, type ResultMode, type Settings } from '../store'
import { average } from './progress'

/**
 * The speed of the pace caret for a test, or null when there is nothing to race
 * yet (pace is off, or no earlier results to take an average or a best from).
 */
export function paceTarget(
  settings: Pick<Settings, 'pace' | 'paceWpm'>,
  history: readonly Result[],
  mode: ResultMode,
  amount: number,
  lang: Lang,
): number | null {
  if (settings.pace === 'off') return null
  if (settings.pace === 'custom') return settings.paceWpm > 0 ? settings.paceWpm : null
  if (settings.pace === 'best') return bestWpm(history, mode, amount, lang)
  const recent = history.filter((r) => r.lang === lang && !isDrill(r.mode)).slice(-10)
  return recent.length > 0 ? average(recent.map((r) => r.wpm)) : null
}

/** How many characters a typist at `wpm` has typed after `ms`. */
export const paceIndex = (wpm: number, ms: number): number => Math.floor((wpm * 5 * ms) / 60000)
