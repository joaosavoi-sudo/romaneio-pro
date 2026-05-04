export function playBeep(success = true) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = success ? 880 : 220
    gain.gain.value = 0.4
    osc.start()
    osc.stop(ctx.currentTime + (success ? 0.18 : 0.5))
  } catch {}
}

export function vibrate(pattern = 200) {
  try { navigator.vibrate?.(pattern) } catch {}
}

export function feedbackSuccess() {
  playBeep(true)
  vibrate(150)
}

export function feedbackError() {
  playBeep(false)
  vibrate([100, 80, 100])
}
