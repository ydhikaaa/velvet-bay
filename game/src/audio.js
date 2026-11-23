// Velvet Bay — procedural WebAudio: mission jingle, stage chirp, gunshots,
// siren blips, engine hum that follows speed, and a per-district ambient pad.
// Written fresh for round 10 (attempt 5).
import { districtAt } from './state.js';

const PADS = {
  DOWNTOWN: [110, 164.8, 220], HARBOR: [98, 146.8, 196], RESIDENTIAL: [130.8, 196, 261.6],
  'COASTAL BLVD': [123.5, 185, 246.9], ENTERTAINMENT: [116.5, 174.6, 233.1],
  MARINA: [103.8, 155.6, 207.7], DOCKYARD: [92.5, 138.6, 185], 'OLD TOWN': [146.8, 220, 293.7],
  BEACHFRONT: [123.5, 185, 246.9], 'VELVET BAY': [110, 164.8, 220],
};

export function createAudio(state) {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null;
  let padOsc = [], padGain = null;
  let currentPad = null;
  let musicTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55.8;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Ambient pad: three soft sines.
      padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      padGain.connect(master);
      padOsc = [0, 1, 2].map(() => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 110;
        o.connect(padGain);
        o.start();
        return o;
      });
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ensure() || state.muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || state.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  return {
    ensure,
    resume() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    jingle() {
      // Mission-complete arpeggio: C E G C up.
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.34, 'triangle', 0.28, i * 0.09));
      tone(1318.5, 0.5, 'triangle', 0.2, 0.4);
    },
    chirp() { tone(880, 0.12, 'sine', 0.22); tone(1174.7, 0.14, 'sine', 0.22, 0.1); },
    gunshot() { noiseBurst(0.14, 0.5, 1800); tone(160, 0.1, 'square', 0.18); },
    dryFire() { tone(1200, 0.05, 'square', 0.12); },
    sirenBlip() { tone(660, 0.16, 'sine', 0.1); tone(520, 0.16, 'sine', 0.1, 0.16); },
    pickup() { tone(1046.5, 0.1, 'triangle', 0.2); tone(1568, 0.18, 'triangle', 0.2, 0.08); },
    crash() { noiseBurst(0.25, 0.4, 900); },
    update(dt, speedKmh, inCar) {
      if (!ctx) return;
      if (engineGain) {
        engineGain.gain.value = inCar ? 0.05 + Math.min(0.1, speedKmh / 1400) : 0;
        if (engineOsc) engineOsc.frequency.value = 50 + speedKmh * 0.9;
      }
      // Per-district pad: retune when the district changes.
      const d = districtAt(state.player.x, state.player.z);
      if (d !== currentPad) {
        currentPad = d;
        const notes = PADS[d] || PADS['VELVET BAY'];
        padOsc.forEach((o, i) => {
          o.frequency.setTargetAtTime(notes[i % notes.length], ctx.currentTime, 0.8);
        });
      }
      // Gentle music pulse every ~7s when music is on.
      if (state.musicOn && !state.muted) {
        musicTimer -= dt;
        if (musicTimer <= 0) {
          musicTimer = 7;
          const root = (PADS[currentPad] || PADS['VELVET BAY'])[0];
          tone(root * 2, 0.5, 'triangle', 0.05);
          tone(root * 3, 0.4, 'triangle', 0.04, 0.25);
        }
      }
    },
  };
}
