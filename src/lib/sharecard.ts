/** Everything the share card shows, already translated and formatted. */
export interface CardData {
  wpm: string
  wpmLabel: string
  rank: string
  tag: string
  /** "30 second test in English" */
  sub: string
  date: string
  stats: { label: string; value: string }[]
  /** Flow waveform, values from 0 to 1. */
  wave: number[]
}

export const CARD_W = 1200
export const CARD_H = 630

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, colour)
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Draws the result card. The canvas must be CARD_W x CARD_H. Fonts should be loaded before calling. */
export function drawCard(ctx: CanvasRenderingContext2D, data: CardData, fonts: { display: string; body: string }): void {
  const W = CARD_W
  const H = CARD_H
  ctx.clearRect(0, 0, W, H)

  // Background: Glide's violet-to-sky wash.
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#4c1d95')
  bg.addColorStop(0.5, '#7c3aed')
  bg.addColorStop(1, '#0ea5e9')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  blob(ctx, 180, 80, 420, 'rgba(255,255,255,0.22)')
  blob(ctx, 1050, 560, 480, 'rgba(125,211,252,0.35)')
  blob(ctx, 900, 60, 300, 'rgba(244,114,182,0.22)')

  // Glass panel.
  roundRect(ctx, 48, 48, W - 96, H - 96, 44)
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fill()
  const shine = ctx.createLinearGradient(0, 48, 0, 300)
  shine.addColorStop(0, 'rgba(255,255,255,0.22)')
  shine.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = shine
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.stroke()

  const left = 100
  const right = W - 100
  ctx.textBaseline = 'alphabetic'

  // Brand.
  roundRect(ctx, left, 92, 52, 52, 16)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(left + 10, 122)
  ctx.bezierCurveTo(left + 18, 104, left + 25, 104, left + 26, 118)
  ctx.bezierCurveTo(left + 28, 132, left + 35, 132, left + 42, 114)
  ctx.lineWidth = 4.5
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#7c3aed'
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 40px ${fonts.display}`
  ctx.fillText('Glide', left + 68, 132)
  const brandW = ctx.measureText('Glide').width
  ctx.font = `600 22px ${fonts.body}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(data.tag, left + 68 + brandW + 18, 131)

  // Date and test, top right.
  ctx.textAlign = 'right'
  ctx.font = `700 24px ${fonts.body}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(data.date, right, 116)
  ctx.font = `500 21px ${fonts.body}`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(data.sub, right, 146)
  ctx.textAlign = 'left'

  // Rank pill.
  ctx.font = `800 28px ${fonts.display}`
  const rankW = ctx.measureText(data.rank).width + 44
  roundRect(ctx, left, 190, rankW, 52, 26)
  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.fill()
  ctx.fillStyle = '#6d28d9'
  ctx.fillText(data.rank, left + 22, 226)

  // The number.
  ctx.fillStyle = '#ffffff'
  // Shrink a very long number so that it never runs into the stats column.
  let size = 210
  ctx.font = `800 ${size}px ${fonts.display}`
  while (size > 90 && ctx.measureText(data.wpm).width > 500) {
    size -= 10
    ctx.font = `800 ${size}px ${fonts.display}`
  }
  ctx.fillText(data.wpm, left - 8, 430)
  const numW = ctx.measureText(data.wpm).width
  ctx.font = `700 44px ${fonts.display}`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(data.wpmLabel, left + numW + 10, 430)

  // Flow waveform under the number.
  const waveLeft = left
  const waveRight = 660
  const mid = 500
  const n = data.wave.length
  if (n > 0) {
    const step = (waveRight - waveLeft) / n
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    data.wave.forEach((v, i) => {
      const h = Math.max(4, Math.min(1, v) * 34)
      roundRect(ctx, waveLeft + i * step, mid - h, Math.max(3, step * 0.55), h * 2, Math.min(3, step * 0.27))
      ctx.fill()
    })
  }

  // Stats column.
  const colX = 760
  data.stats.slice(0, 3).forEach((s, i) => {
    const y = 236 + i * 108
    ctx.font = `600 23px ${fonts.body}`
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.fillText(s.label, colX, y)
    ctx.font = `800 58px ${fonts.display}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(s.value, colX, y + 60)
  })
}
