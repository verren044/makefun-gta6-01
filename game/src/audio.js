// Sound, synthesised with WebAudio: no audio files, nothing fetched. An engine
// hum that follows the car's speed, a two-tone siren while wanted, a gunshot
// crack, a pickup chime and a mission-complete jingle. Everything is guarded:
// with no AudioContext (headless runs, muted tabs) every call is a no-op.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenT = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    const c = ensure();
    if (!c) return;
    try {
      if (c.state === 'suspended') void c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      gain.gain.value = vol;
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch {
      // Sound is garnish; a failure never breaks the game.
    }
  }

  return {
    /** Call once from a user gesture so the browser allows sound. */
    unlock() { ensure(); },
    /** Engine hum follows speed (0..1); siren wails while wanted. */
    update(speed01, wanted, dt) {
      const c = ctx;
      if (!c) return;
      try {
        if (engineOsc && engineGain) {
          engineOsc.frequency.value = 55 + speed01 * 140;
          engineGain.gain.value = speed01 > 0.02 ? 0.03 + speed01 * 0.03 : 0;
        }
        if (sirenOsc && sirenGain) {
          if (wanted > 0) {
            sirenT -= dt;
            if (sirenT <= 0) {
              sirenT = 0.45;
              sirenHigh = !sirenHigh;
              sirenOsc.frequency.value = sirenHigh ? 880 : 660;
            }
            sirenGain.gain.value = 0.018;
          } else {
            sirenGain.gain.value = 0;
          }
        }
      } catch {
        // Ignore audio errors mid-frame.
      }
    },
    shoot() { blip(220, 0.12, 'square', 0.12, 60); },
    pickup() { blip(660, 0.12, 'sine', 0.14, 990); },
    mission() {
      blip(523, 0.14, 'sine', 0.14);
      setTimeout(() => blip(659, 0.14, 'sine', 0.14), 130);
      setTimeout(() => blip(784, 0.22, 'sine', 0.16), 260);
    },
    busted() { blip(330, 0.5, 'sawtooth', 0.12, 110); },
    click() { blip(440, 0.05, 'sine', 0.08); },
  };
}
