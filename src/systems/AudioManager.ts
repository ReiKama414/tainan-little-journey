export class AudioManager {
  ctx = null;
  masterGain = null;
  bgmGain = null;
  sfxGain = null;
  isMuted = false;
  volume = 0.7;
  bgmTimer = null;
  currentSceneType = 'shared';
  stepIndex = 0;

  /** Single shared ComfyUI ACE-Step loop for the whole journey */
  bgmUrl = './audio/bgm_fucheng_stroll.mp3';
  bgmBuffer = null;
  bgmSource = null;
  bgmLoadPromise = null;
  useFileBgm = true;
  bgmStarted = false;

  constructor() {
    try {
      const savedVol = localStorage.getItem('tainan_volume');
      const savedMute = localStorage.getItem('tainan_muted');
      if (savedVol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(savedVol)));
      if (savedMute !== null) this.isMuted = savedMute === 'true';
    } catch {}
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.bgmGain.gain.value = 0.48;
      this.sfxGain.gain.value = 0.75;

      this.bgmGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyMasterVolume();
      this.ensureBgmLoaded();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  ensureBgmLoaded() {
    if (!this.ctx || this.bgmBuffer || this.bgmLoadPromise) return this.bgmLoadPromise;
    this.bgmLoadPromise = fetch(this.bgmUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`BGM HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => this.ctx.decodeAudioData(buf))
      .then((decoded) => {
        this.bgmBuffer = decoded;
        return decoded;
      })
      .catch((err) => {
        console.warn('[AudioManager] file BGM unavailable, using synth fallback', err);
        this.useFileBgm = false;
        this.bgmLoadPromise = null;
        return null;
      });
    return this.bgmLoadPromise;
  }

  isBgmPlaying() {
    return Boolean(this.bgmSource) || this.bgmTimer !== null;
  }

  stopFileBgm() {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch {}
      try { this.bgmSource.disconnect(); } catch {}
      this.bgmSource = null;
    }
    this.bgmStarted = false;
  }

  /**
   * Start the shared Fucheng stroll loop once.
   * Safe to call on every scene / menu click — will NOT restart if already playing.
   */
  async ensureSharedBgm() {
    this.init();
    this.currentSceneType = 'shared';
    if (this.isBgmPlaying()) return true;

    if (this.useFileBgm) {
      await this.ensureBgmLoaded();
      if (this.bgmBuffer && !this.bgmSource) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.bgmBuffer;
        src.loop = true;
        src.connect(this.bgmGain);
        src.start(0);
        this.bgmSource = src;
        this.bgmStarted = true;
        return true;
      }
    }

    if (!this.isBgmPlaying()) {
      this.startSynthBgmFallback();
    }
    return this.isBgmPlaying();
  }

  /** @deprecated Use ensureSharedBgm — kept so old call sites keep working without restarting. */
  startSceneAudio(_sceneType) {
    return this.ensureSharedBgm();
  }

  applyMasterVolume() {
    if (!this.masterGain || !this.ctx) return;
    const effective = this.isMuted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.04);
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.volume > 0 && this.isMuted) this.isMuted = false;
    try {
      localStorage.setItem('tainan_volume', String(this.volume));
      localStorage.setItem('tainan_muted', String(this.isMuted));
    } catch {}
    this.applyMasterVolume();
  }

  getVolume() { return this.volume; }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('tainan_muted', String(this.isMuted));
    } catch {}
    this.applyMasterVolume();
    return this.isMuted;
  }

  getMuted() { return this.isMuted; }

  startSynthBgmFallback() {
    if (this.bgmTimer !== null) return;

    const prog = [
      [261.63, 329.63, 392.00, 523.25],
      [220.00, 261.63, 329.63, 440.00],
      [174.61, 220.00, 261.63, 349.23],
      [196.00, 246.94, 293.66, 392.00]
    ];
    this.stepIndex = 0;

    this.bgmTimer = window.setInterval(() => {
      if (!this.ctx || !this.bgmGain || this.isMuted || this.ctx.state !== 'running') return;
      const chordIdx = Math.floor(this.stepIndex / 4) % prog.length;
      const noteIdx = this.stepIndex % 4;
      const chord = prog[chordIdx];
      const freq = chord[noteIdx];

      this.playTone(freq, 0.95, 'triangle', 0.13, this.bgmGain);
      if (noteIdx === 0) {
        this.playTone(chord[0] * 0.5, 1.8, 'sine', 0.11, this.bgmGain);
      }
      this.stepIndex++;
    }, 540);
    this.bgmStarted = true;
  }

  /** Hard stop — only for teardown / explicit shutdown, not scene changes. */
  stopLoops() {
    this.stopFileBgm();
    if (this.bgmTimer !== null) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  playTone(freq, duration, type, gainVal, dest) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(gainVal, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(g);
    g.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playNoiseBurst(duration, filterFreq, peakGain) {
    if (!this.ctx || !this.sfxGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 1.8;
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peakGain, now + duration * 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  playFootstep() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playNoiseBurst(0.05, 340 + Math.random() * 100, 0.035);
  }

  playInteract() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playTone(523.25, 0.14, 'triangle', 0.16, this.sfxGain);
    setTimeout(() => { if (this.sfxGain) this.playTone(659.25, 0.18, 'triangle', 0.16, this.sfxGain); }, 70);
  }

  playCollect() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => { if (this.sfxGain) this.playTone(n, 0.26, 'triangle', 0.17, this.sfxGain); }, idx * 80);
    });
  }

  playCameraShutter() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playTone(1200, 0.04, 'square', 0.18, this.sfxGain);
    setTimeout(() => { if (this.sfxGain) this.playNoiseBurst(0.09, 1400, 0.2); }, 50);
  }

  playPortal() {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    this.playTone(392.0, 0.22, 'sine', 0.12, this.sfxGain);
    setTimeout(() => { if (this.sfxGain) this.playTone(587.33, 0.32, 'sine', 0.14, this.sfxGain); }, 95);
  }
}
