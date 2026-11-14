import { useEffect, useRef, useState } from 'react'
import { flowWave } from '../engine/flow'
import { formatNumber, useT } from '../i18n'
import { modeLabel } from '../lib/labels'
import { rankFor } from '../lib/rank'
import { CARD_H, CARD_W, drawCard, type CardData } from '../lib/sharecard'
import type { Outcome } from '../screens/Practice'
import { useStore } from '../store'
import { Icon } from './Icon'

const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))

/** A dialog with the result drawn as an image that can be downloaded, shared or copied. */
export function ShareCard({ outcome, onClose }: { outcome: Outcome; onClose: () => void }) {
  const t = useT()
  const uiLang = useStore((s) => s.settings.uiLang)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [status, setStatus] = useState('')
  const n = (value: number, digits = 0) => formatNumber(uiLang, value, digits)
  const { stats, flow } = outcome
  const rank = t(`rank.${rankFor(stats.wpm)}`)
  const wpm = n(stats.wpm)
  const fileName = `glide-${Math.round(stats.wpm)}-wpm.png`
  const canShareFiles = typeof navigator.canShare === 'function' && typeof File !== 'undefined'
  const canCopy = typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const css = getComputedStyle(document.documentElement)
    const fonts = { display: css.getPropertyValue('--font-display').trim(), body: css.getPropertyValue('--font-body').trim() }
    const data: CardData = {
      wpm,
      wpmLabel: t('stat.wpm'),
      rank,
      tag: t('brand.tag'),
      sub: t('result.sub', { mode: modeLabel(t, outcome.mode, outcome.amount), lang: t(`lang.${outcome.lang}.short`) }),
      date: new Date().toLocaleDateString(uiLang === 'pl' ? 'pl-PL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
      stats: [
        { label: t('stat.accuracy'), value: `${n(stats.accuracy, 1)}%` },
        { label: t('flow.title'), value: n(flow) },
        { label: t('stat.consistency'), value: `${n(stats.consistency)}%` },
      ],
      wave: flowWave(outcome.intervals),
    }
    let alive = true
    const text = [data.wpm, data.wpmLabel, data.rank, data.tag, data.sub, data.date, ...data.stats.flatMap((s) => [s.label, s.value]), 'Glide'].join('')
    // Draw at once with whatever fonts are ready, then again when the real ones have loaded.
    drawCard(ctx, data, fonts)
    void Promise.all([document.fonts.load(`800 60px ${fonts.display}`, text), document.fonts.load(`600 22px ${fonts.body}`, text)])
      .then(() => alive && drawCard(ctx, data, fonts))
      .catch(() => undefined)
    return () => {
      alive = false
    }
    // The card is drawn once, for the result the dialog was opened with.
  }, [])

  const withBlob = async (use: (blob: Blob) => Promise<void> | void, done?: string) => {
    try {
      const blob = canvasRef.current && (await toBlob(canvasRef.current))
      if (!blob) throw new Error('no image')
      await use(blob)
      setStatus(done ?? '')
    } catch (error) {
      // Closing the system share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus(t('share.failed'))
    }
  }

  const download = () =>
    withBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })

  const share = () =>
    withBlob(async (blob) => {
      const file = new File([blob], fileName, { type: 'image/png' })
      const data = { files: [file], text: t('share.text', { wpm }) }
      if (!navigator.canShare(data)) throw new Error('cannot share files')
      await navigator.share(data)
    })

  const copy = () => withBlob((blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]), t('share.copied'))

  return (
    <dialog ref={dialogRef} className="share-dialog" aria-labelledby="share-title" onClose={onClose} onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}>
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="share-title" className="text-[19px] font-bold">
            {t('share.title')}
          </h2>
          <button type="button" className="btn ghost !px-2.5" aria-label={t('share.close')} onClick={() => dialogRef.current?.close()}>
            <Icon name="x" />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={CARD_W}
          height={CARD_H}
          className="block h-auto w-full rounded-2xl"
          role="img"
          aria-label={t('share.alt', { wpm, acc: n(stats.accuracy, 1), flow: n(flow), rank })}
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn primary" onClick={download}>
            <Icon name="download" />
            {t('share.download')}
          </button>
          {canShareFiles && (
            <button type="button" className="btn soft" onClick={share}>
              <Icon name="share" />
              {t('share.share')}
            </button>
          )}
          {canCopy && (
            <button type="button" className="btn soft" onClick={copy}>
              <Icon name="copy" />
              {t('share.copy')}
            </button>
          )}
        </div>
        <p className="text-muted m-0 mt-3 min-h-[20px] text-[13px]" role="status">
          {status}
        </p>
      </div>
    </dialog>
  )
}
