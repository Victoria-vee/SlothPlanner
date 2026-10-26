// A short, soft two-note chime made with the Web Audio API: no audio file, no network request.
// Every call is best-effort. Browsers may block audio until the user has interacted with the page,
// and none of this may ever break the visual completion message.

let context = null

function getContext() {
  if (context) return context
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    context = null
  }
  return context
}

// Call from a click handler (a user gesture) so the browser lets later sounds play.
export function primeAudio() {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

// Resolves true if the chime was scheduled, false if audio was unavailable or blocked.
export async function playChime() {
  try {
    const ctx = getContext()
    if (!ctx) return false
    if (ctx.state === 'suspended') await ctx.resume()
    if (ctx.state !== 'running') return false

    const start = ctx.currentTime + 0.02
    ;[
      { freq: 659.25, at: 0 },
      { freq: 880, at: 0.22 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start + at)
      gain.gain.exponentialRampToValueAtTime(0.07, start + at + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.9)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start + at)
      osc.stop(start + at + 1)
    })
    return true
  } catch {
    return false
  }
}
