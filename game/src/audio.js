// Synthesized sound for Velvet Bay: no audio files, everything is WebAudio.
// Engine hum, sirens, gunshots, pickups and a small procedural music loop.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicTimer = null;
    this.musicStep = 0;
    this.master = null;
  }

  // Must be called from a user gesture at least once.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngine();
    this.startMusic();
  }

  startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // Engine pitch follows speed; quiet on foot.
  setEngine(speedKmh, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + Math.min(speedKmh / 160, 1) * 0.09 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(
      50 + Math.min(speedKmh, 160) * 1.1, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.035;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
      this.sirenOsc = null;
    }
  }

  updateSiren(dt) {
    if (!this.sirenOsc) return;
    this.sirenTimer += dt;
    const f = Math.sin(this.sirenTimer * 4.4) > 0 ? 660 : 520;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.18, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  gunshot() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.16;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g); g.connect(this.master);
    src.start();
    this.blip(160, 0.12, 'square', 0.2);
  }

  pickup() { this.blip(880, 0.12, 'sine', 0.2); setTimeout(() => this.blip(1320, 0.18, 'sine', 0.2), 90); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.22), i * 120));
  }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'sawtooth', 0.15), i * 180)); }

  // A lazy sunset groove: A-minor bass line + sparse lead, scheduled in steps.
  startMusic() {
    const bass = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 110, 0, 164.8, 146.8, 130.8, 123.5];
    const lead = [440, 0, 523, 0, 659, 0, 523, 440, 0, 392, 0, 440, 523, 0, 659, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || !this.musicOn) return;
      const i = this.musicStep % 16;
      if (bass[i]) this.blip(bass[i], 0.42, 'triangle', 0.10);
      if (lead[i]) this.blip(lead[i], 0.3, 'sine', 0.06);
      this.musicStep++;
    }, 300);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    return this.musicOn;
  }
}
