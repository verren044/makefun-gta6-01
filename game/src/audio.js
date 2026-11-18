// Sound, synthesized live with WebAudio — no audio files. Tiny bleeps for shots,
// pickups and menus, a thud for crashes, a two-tone siren while the heat is on,
// and a little arpeggio when a mission pays out. M mutes everything.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let sirenTimer = 0;
  let sirenHigh = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    try {
      const t0 = ac.currentTime + (when || 0);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol || 0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // Audio is decoration; a failure here never stops the game.
    }
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    play(name) {
      if (muted) return;
      if (name === 'shoot') tone(720, 0.09, 'square', 0.07);
      else if (name === 'punch') tone(160, 0.08, 'triangle', 0.12);
      else if (name === 'steal') tone(300, 0.12, 'sawtooth', 0.06);
      else if (name === 'crash') tone(90, 0.25, 'sawtooth', 0.14);
      else if (name === 'pickup') {
        tone(880, 0.1, 'sine', 0.1);
        tone(1320, 0.14, 'sine', 0.1, 0.09);
      } else if (name === 'stage') {
        tone(660, 0.1, 'sine', 0.09);
        tone(990, 0.12, 'sine', 0.09, 0.08);
      } else if (name === 'mission' || name === 'story') {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.1, i * 0.11));
      } else if (name === 'siren') {
        tone(700, 0.15, 'sine', 0.03);
      }
    },
    /** The two-tone police siren, called every frame while wanted > 0. */
    siren(dt, wanted) {
      if (muted || wanted <= 0) return;
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        tone(sirenHigh ? 780 : 580, 0.38, 'sine', 0.035);
      }
    },
  };
}
