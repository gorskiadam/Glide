/** The US QWERTY layout (also the base of the Polish "programmer" layout), shared by the heatmap and the lesson guide. */

export const ROWS = ['`1234567890-=', 'qwertyuiop[]', "asdfghjkl;'", 'zxcvbnm,./'] as const
/** How far each row is shifted right, in key widths, as on a real keyboard. */
export const OFFSETS = [0, 0.5, 0.75, 1.25] as const
export const POLISH = 'ąćęłńóśźż'
/** Characters typed with Shift, mapped to the key they live on. */
export const SHIFTED: Record<string, string> = {
  '~': '`', '!': '1', '@': '2', '#': '3', $: '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
  _: '-', '+': '=', '{': '[', '}': ']', ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
}
/** Polish letters and the key pressed together with the right Alt key to type them. */
export const ALT_BASE: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'x', ż: 'z' }
/** Which finger presses each column of each row: 0-3 left pinky to index, 4-7 right index to pinky. */
export const FINGERS = ['0012334456777', '012334456777', '01233445677', '0123344567'] as const
export const FINGER_HUES = [330, 25, 48, 150, 190, 220, 265, 300] as const
/** Finger number used for the thumbs (space bar). */
export const THUMB = 8

export interface KeyPress {
  /** The physical key, as its unshifted character. */
  key: string
  /** 0-7 for fingers left pinky to right pinky, 8 for a thumb. */
  finger: number
  shift: boolean
  /** Right Alt is held (Polish letters). */
  alt: boolean
}

function fingerOf(key: string): number | null {
  for (let r = 0; r < ROWS.length; r++) {
    const c = (ROWS[r] as string).indexOf(key)
    if (c !== -1) return Number((FINGERS[r] as string)[c])
  }
  return null
}

/** How to type a character: which key, which finger, and whether Shift or right Alt is needed. Null if it is not on the layout. */
export function keyPress(char: string): KeyPress | null {
  if (char === ' ') return { key: ' ', finger: THUMB, shift: false, alt: false }
  const lower = char.toLocaleLowerCase('pl')
  let shift = lower !== char
  let key = lower
  let alt = false
  const base = ALT_BASE[key]
  if (base !== undefined) {
    key = base
    alt = true
  } else if (SHIFTED[key] !== undefined) {
    key = SHIFTED[key] as string
    shift = true
  }
  const finger = fingerOf(key)
  return finger === null ? null : { key, finger, shift, alt }
}
