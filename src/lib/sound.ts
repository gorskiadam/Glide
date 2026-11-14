/** Key sounds, synthesised with the Web Audio API so there are no audio files to download. */

export type SoundPack = 'soft' | 'thock' | 'typewriter'
export const SOUND_PACKS: readonly SoundPack[] = ['soft', 'thock', 'typewriter']
export type KeySound = 'key' | 'space' | 'back' | 'error'

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  if (!ctx) {
    ctx = new AudioContext()
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** A short burst of filtered noise: the "click" part of a key. */
function click(ac: AudioContext, type: BiquadFilterType, freq: number, gain: number, ms: number) {
  const src = ac.createBufferSource()
  src.buffer = noise
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  const amp = ac.createGain()
  const now = ac.currentTime
  amp.gain.setValueAtTime(gain, now)
  amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
  src.connect(filter).connect(amp).connect(ac.destination)
  src.start(now)
  src.stop(now + ms / 1000)
}

/** A short pitched tone that falls in pitch: the "body" of a key. */
function tone(ac: AudioContext, wave: OscillatorType, from: number, to: number, gain: number, ms: number) {
  const osc = ac.createOscillator()
  osc.type = wave
  const amp = ac.createGain()
  const now = ac.currentTime
  osc.frequency.setValueAtTime(from, now)
  osc.frequency.exponentialRampToValueAtTime(to, now + ms / 1000)
  amp.gain.setValueAtTime(gain, now)
  amp.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
  osc.connect(amp).connect(ac.destination)
  osc.start(now)
  osc.stop(now + ms / 1000)
}

export function playKey(pack: SoundPack, kind: KeySound): void {
  const ac = context()
  if (!ac) return
  if (kind === 'error') {
    tone(ac, 'sine', 190, 120, 0.16, 110)
    return
  }
  // Small random changes stop the sound from feeling like a machine gun.
  const vary = 0.9 + Math.random() * 0.2
  const low = kind === 'space' ? 0.7 : kind === 'back' ? 0.85 : 1
  if (pack === 'soft') {
    click(ac, 'bandpass', 1900 * vary * low, 0.16, 35)
  } else if (pack === 'thock') {
    tone(ac, 'sine', 150 * vary * low, 70, 0.28, 70)
    click(ac, 'lowpass', 900 * vary, 0.1, 30)
  } else {
    click(ac, 'highpass', 2600 * vary * low, 0.2, 28)
    tone(ac, 'square', 1100 * vary * low, 600, 0.04, 14)
  }
}
