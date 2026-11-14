class SoundManager {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "triangle",
    gainVal = 0.08
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playSlash() {
    this.tone(360, 140, 0.09, "triangle", 0.06);
  }

  playShot() {
    this.tone(520, 260, 0.08, "sine", 0.05);
  }

  playHit() {
    this.tone(180, 75, 0.07, "square", 0.045);
  }

  playKill() {
    this.tone(520, 780, 0.11, "sine", 0.06);
  }

  playPlayerHurt() {
    this.tone(150, 55, 0.14, "sawtooth", 0.07);
  }

  playSkill() {
    this.tone(240, 620, 0.18, "sawtooth", 0.075);
  }

  playHeal() {
    this.tone(440, 660, 0.16, "sine", 0.07);
  }

  playLevelUp() {
    this.tone(440, 554, 0.12, "triangle", 0.08);
    setTimeout(() => this.tone(554, 659, 0.14, "triangle", 0.08), 80);
    setTimeout(() => this.tone(659, 880, 0.22, "triangle", 0.09), 170);
  }

  playBossWarn() {
    this.tone(160, 110, 0.28, "sawtooth", 0.09);
  }

  playClick() {
    this.tone(600, 480, 0.05, "sine", 0.04);
  }
}

export const SoundFX = new SoundManager();
