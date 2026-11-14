/** Rank titles shown on results and on the share card, by net WPM. */
export const RANKS = [
  { min: 0, id: 'warmup' },
  { min: 20, id: 'steady' },
  { min: 35, id: 'smooth' },
  { min: 50, id: 'swift' },
  { min: 70, id: 'glider' },
  { min: 90, id: 'jet' },
  { min: 120, id: 'lightspeed' },
] as const

export type RankId = (typeof RANKS)[number]['id']

export function rankFor(wpm: number): RankId {
  let id: RankId = 'warmup'
  for (const r of RANKS) if (wpm >= r.min) id = r.id
  return id
}
