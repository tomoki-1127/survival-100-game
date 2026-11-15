import { AUDIO_BGM_MAP, AUDIO_SFX_MAP, type BgmTrackId, type SfxTrackId } from "../data/assets";
import type { AudioSettings, EquipCategory, Rarity } from "../types/game";

export const AUDIO_SETTINGS_KEY = "survival100_audio_settings";

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  bgmVolume: 0.5,
  sfxVolume: 0.72,
  bgmMuted: false,
  sfxMuted: false,
};

function clamp01(val: unknown, fallback: number): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function loadAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      bgmVolume: clamp01(parsed.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
      sfxVolume: clamp01(parsed.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
      bgmMuted: Boolean(parsed.bgmMuted),
      sfxMuted: Boolean(parsed.sfxMuted),
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

function saveAudioSettings(settings: AudioSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

interface ActiveBgmNode {
  trackId: BgmTrackId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private bgmMasterGain: GainNode | null = null;
  private sfxMasterGain: GainNode | null = null;

  private settings: AudioSettings = loadAudioSettings();
  private listeners = new Set<(s: AudioSettings) => void>();

  private unlocked = false;
  private unlockListenersBound = false;

  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();

  private desiredBgmId: BgmTrackId | null = null;
  private inFlightBgmId: BgmTrackId | null = null;
  private activeBgm: ActiveBgmNode | null = null;
  private bgmTransitionToken = 0;

  private lastSfxAt = new Map<string, number>();

  constructor() {
    this.bindUnlockListeners();
  }

  private bindUnlockListeners() {
    if (typeof window === "undefined" || this.unlockListenersBound) return;
    this.unlockListenersBound = true;

    const onInteract = () => {
      this.unlockFromUserGesture();
    };

    const events = ["pointerdown", "touchstart", "touchend", "keydown", "click"] as const;
    for (const ev of events) {
      window.addEventListener(ev, onInteract, { capture: true, passive: true });
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  private createOrResumeContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.bgmMasterGain = this.ctx.createGain();
      this.sfxMasterGain = this.ctx.createGain();
      this.bgmMasterGain.gain.setValueAtTime(
        this.settings.bgmMuted ? 0 : this.settings.bgmVolume,
        this.ctx.currentTime
      );
      this.sfxMasterGain.gain.setValueAtTime(
        this.settings.sfxMuted ? 0 : this.settings.sfxVolume,
        this.ctx.currentTime
      );
      this.bgmMasterGain.connect(this.ctx.destination);
      this.sfxMasterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlockFromUserGesture() {
    const ctx = this.createOrResumeContext();
    if (!ctx) return;

    if (!this.unlocked) {
      // iOS Safari unlock: play an empty 1-sample buffer directly inside user gesture
      try {
        const silent = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // ignore
      }
      this.unlocked = true;
      this.preloadSfxBuffers();
    }

    if (
      this.desiredBgmId &&
      this.activeBgm?.trackId !== this.desiredBgmId &&
      this.inFlightBgmId !== this.desiredBgmId
    ) {
      const target = this.desiredBgmId;
      void this.transitionToBgm(target);
    }
  }

  get muted(): boolean {
    return this.settings.bgmMuted && this.settings.sfxMuted;
  }

  set muted(val: boolean) {
    this.updateSettings({ bgmMuted: val, sfxMuted: val });
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  subscribe(listener: (s: AudioSettings) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSettings());
    return () => {
      this.listeners.delete(listener);
    };
  }

  updateSettings(patch: Partial<AudioSettings>) {
    this.settings = {
      bgmVolume: patch.bgmVolume !== undefined ? clamp01(patch.bgmVolume, this.settings.bgmVolume) : this.settings.bgmVolume,
      sfxVolume: patch.sfxVolume !== undefined ? clamp01(patch.sfxVolume, this.settings.sfxVolume) : this.settings.sfxVolume,
      bgmMuted: patch.bgmMuted !== undefined ? Boolean(patch.bgmMuted) : this.settings.bgmMuted,
      sfxMuted: patch.sfxMuted !== undefined ? Boolean(patch.sfxMuted) : this.settings.sfxMuted,
    };
    saveAudioSettings(this.settings);
    this.applyMasterGains();

    for (const listener of this.listeners) {
      listener(this.getSettings());
    }
  }

  private applyMasterGains() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.bgmMasterGain) {
      this.bgmMasterGain.gain.setTargetAtTime(
        this.settings.bgmMuted ? 0 : this.settings.bgmVolume,
        now,
        0.02
      );
    }
    if (this.sfxMasterGain) {
      this.sfxMasterGain.gain.setTargetAtTime(
        this.settings.sfxMuted ? 0 : this.settings.sfxVolume,
        now,
        0.01
      );
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const pending = this.loadingPromises.get(url);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const ctx = this.createOrResumeContext();
        if (!ctx || typeof fetch === "undefined") return null;
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.bufferCache.set(url, audioBuf);
        return audioBuf;
      } catch {
        return null;
      } finally {
        this.loadingPromises.delete(url);
      }
    })();

    this.loadingPromises.set(url, promise);
    return promise;
  }

  private preloadSfxBuffers() {
    for (const url of Object.values(AUDIO_SFX_MAP)) {
      void this.loadBuffer(url);
    }
  }

  // --- BGM Controls (with Fade-Out / Fade-In & Double-Play Guard) ---
  playBgm(trackId: BgmTrackId) {
    if (
      this.desiredBgmId === trackId &&
      (this.activeBgm?.trackId === trackId || this.inFlightBgmId === trackId)
    ) {
      return;
    }
    this.desiredBgmId = trackId;
    if (!this.unlocked) {
      return;
    }
    void this.transitionToBgm(trackId);
  }

  stopBgm(fadeSec = 0.35) {
    this.desiredBgmId = null;
    this.inFlightBgmId = null;
    this.bgmTransitionToken += 1;
    this.fadeOutActiveBgm(fadeSec);
  }

  private fadeOutActiveBgm(fadeSec: number) {
    const prev = this.activeBgm;
    if (!prev || !this.ctx) return;
    this.activeBgm = null;

    const now = this.ctx.currentTime;
    try {
      prev.gain.gain.cancelScheduledValues(now);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, now);
      prev.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
      prev.source.stop(now + fadeSec + 0.04);
    } catch {
      try {
        prev.source.stop();
      } catch {
        // ignore
      }
    }
  }

  private async transitionToBgm(trackId: BgmTrackId) {
    if (this.activeBgm?.trackId === trackId || this.inFlightBgmId === trackId) return;

    const token = ++this.bgmTransitionToken;
    this.inFlightBgmId = trackId;
    const url = AUDIO_BGM_MAP[trackId];
    if (!url) {
      if (this.inFlightBgmId === trackId) this.inFlightBgmId = null;
      return;
    }

    try {
      const buffer = await this.loadBuffer(url);
      if (!buffer) return;
      // Another track superseded while loading, or stopped
      if (token !== this.bgmTransitionToken || this.desiredBgmId !== trackId) {
        return;
      }
      // Already playing this exact track
      if (this.activeBgm?.trackId === trackId) {
        return;
      }

      const ctx = this.createOrResumeContext();
      if (!ctx || !this.bgmMasterGain) return;

      // Fade out current BGM cleanly before fading in the new track
      const fadeOutSec = 0.42;
      const fadeInSec = 0.55;
      const hasPrev = Boolean(this.activeBgm);
      this.fadeOutActiveBgm(fadeOutSec);

      const startTime = ctx.currentTime + (hasPrev ? 0.14 : 0);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const trackGain = ctx.createGain();
      trackGain.gain.setValueAtTime(0, startTime);
      trackGain.gain.linearRampToValueAtTime(1, startTime + fadeInSec);

      source.connect(trackGain);
      trackGain.connect(this.bgmMasterGain);

      source.onended = () => {
        if (this.activeBgm?.source === source) {
          this.activeBgm = null;
        }
        try {
          source.disconnect();
          trackGain.disconnect();
        } catch {
          // ignore
        }
      };

      source.start(startTime);
      this.activeBgm = { trackId, source, gain: trackGain };
    } finally {
      if (this.inFlightBgmId === trackId) {
        this.inFlightBgmId = null;
      }
    }
  }

  // --- SFX Controls (Non-cutting multi-voice Web Audio playback) ---
  private playSfxFile(
    sfxId: SfxTrackId,
    options?: {
      volume?: number;
      playbackRate?: number;
      minIntervalMs?: number;
      throttleKey?: string;
      delayMs?: number;
    }
  ) {
    if (this.settings.sfxMuted || this.settings.sfxVolume <= 0) return;

    const minInterval = options?.minIntervalMs ?? 0;
    const throttleKey = options?.throttleKey ?? sfxId;
    if (minInterval > 0) {
      const nowMs = performance.now();
      const prevMs = this.lastSfxAt.get(throttleKey) ?? 0;
      if (nowMs - prevMs < minInterval) return;
      this.lastSfxAt.set(throttleKey, nowMs);
    }

    const ctx = this.createOrResumeContext();
    if (!ctx || !this.sfxMasterGain) return;

    const url = AUDIO_SFX_MAP[sfxId];
    const startPlayback = (buf: AudioBuffer) => {
      if (this.settings.sfxMuted || this.settings.sfxVolume <= 0 || !this.sfxMasterGain) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (options?.playbackRate && options.playbackRate !== 1) {
        src.playbackRate.setValueAtTime(options.playbackRate, ctx.currentTime);
      }

      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(options?.volume ?? 1, ctx.currentTime);

      src.connect(voiceGain);
      voiceGain.connect(this.sfxMasterGain);

      const when = ctx.currentTime + (options?.delayMs ? options.delayMs / 1000 : 0);
      src.onended = () => {
        try {
          src.disconnect();
          voiceGain.disconnect();
        } catch {
          // ignore
        }
      };
      src.start(when);
    };

    const cached = this.bufferCache.get(url);
    if (cached) {
      startPlayback(cached);
    } else {
      void this.loadBuffer(url).then((buf) => {
        if (buf) startPlayback(buf);
      });
    }
  }

  private tone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = "triangle",
    gainVal = 0.14
  ) {
    if (this.settings.sfxMuted || this.settings.sfxVolume <= 0) return;
    const ctx = this.createOrResumeContext();
    if (!ctx || !this.sfxMasterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxMasterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  // --- Game Event SFX ---
  playWeaponAutoAttack(category: EquipCategory, rarity: Rarity) {
    const rarityBoost =
      rarity === "レジェンダリー" ? 1.08 : rarity === "エピック" ? 1.04 : 1.0;

    switch (category) {
      case "杖":
        this.playSfxFile("magic", {
          volume: 0.65,
          playbackRate: rarityBoost,
          minIntervalMs: 75,
          throttleKey: "auto_magic",
        });
        break;
      case "大剣":
        // 重い斬撃音の専用WAVは未収録のため、sfx_sword_slash.wav を低ピッチ再生して重厚感を表現
        this.playSfxFile("sword_slash", {
          volume: 0.78,
          playbackRate: 0.72 * rarityBoost,
          minIntervalMs: 85,
          throttleKey: "auto_cleave",
        });
        break;
      case "槍":
        // 槍の風切り音専用WAVは未収録のため、sfx_sword_slash.wav を高速度再生して鋭い突きを表現
        this.playSfxFile("sword_slash", {
          volume: 0.68,
          playbackRate: 1.28 * rarityBoost,
          minIntervalMs: 65,
          throttleKey: "auto_thrust",
        });
        break;
      case "斧":
        // 斧の衝撃音専用WAVは未収録のため、sfx_sword_slash.wav を重めの中低ピッチで再生
        this.playSfxFile("sword_slash", {
          volume: 0.75,
          playbackRate: 0.82 * rarityBoost,
          minIntervalMs: 80,
          throttleKey: "auto_axe",
        });
        break;
      case "弓":
        // 弓の弦・発射音専用WAVは未収録のため、sfx_sword_slash.wav を高ピッチ短音で代用
        this.playSfxFile("sword_slash", {
          volume: 0.45,
          playbackRate: 1.55 * rarityBoost,
          minIntervalMs: 70,
          throttleKey: "auto_bow",
        });
        break;
      case "剣":
      default:
        this.playSfxFile("sword_slash", {
          volume: 0.7,
          playbackRate: 1.02 * rarityBoost,
          minIntervalMs: 65,
          throttleKey: "auto_sword",
        });
        break;
    }
  }

  playWeaponSkill(category: EquipCategory, _rarity: Rarity) {
    switch (category) {
      case "剣":
        this.playSfxFile("skill", { volume: 0.85, playbackRate: 1.05 });
        this.playSfxFile("sword_slash", { volume: 0.8, playbackRate: 1.05, delayMs: 25 });
        this.playSfxFile("sword_slash", { volume: 0.75, playbackRate: 1.15, delayMs: 110 });
        this.playSfxFile("sword_slash", { volume: 0.85, playbackRate: 0.96, delayMs: 195 });
        break;
      case "大剣":
        this.playSfxFile("skill", { volume: 0.9, playbackRate: 0.8 });
        this.playSfxFile("sword_slash", { volume: 0.95, playbackRate: 0.66, delayMs: 40 });
        break;
      case "槍":
        this.playSfxFile("skill", { volume: 0.85, playbackRate: 1.2 });
        this.playSfxFile("sword_slash", { volume: 0.85, playbackRate: 1.38, delayMs: 30 });
        break;
      case "斧":
        this.playSfxFile("skill", { volume: 0.92, playbackRate: 0.76 });
        this.playSfxFile("sword_slash", { volume: 0.9, playbackRate: 0.7, delayMs: 35 });
        break;
      case "弓":
        this.playSfxFile("skill", { volume: 0.82, playbackRate: 1.25 });
        this.playSfxFile("sword_slash", { volume: 0.58, playbackRate: 1.55, delayMs: 20 });
        this.playSfxFile("sword_slash", { volume: 0.5, playbackRate: 1.65, delayMs: 90 });
        break;
      case "杖":
        this.playSfxFile("skill", { volume: 0.85, playbackRate: 1.08 });
        this.playSfxFile("magic", { volume: 0.95, playbackRate: 0.92, delayMs: 30 });
        break;
      default:
        this.playSfxFile("skill", { volume: 0.9 });
        break;
    }
  }

  playShieldBlock() {
    // 盾の防御音専用WAVは未収録のため、短く締まった実在SFX（sfx_sword_slash 低ピッチ）＋金属ガード音で表現
    this.playSfxFile("sword_slash", {
      volume: 0.35,
      playbackRate: 0.58,
      minIntervalMs: 180,
      throttleKey: "shield_guard",
    });
  }

  playCoin() {
    this.playSfxFile("coin", { volume: 0.42, minIntervalMs: 60, throttleKey: "coin" });
  }

  playItemPickup() {
    this.playSfxFile("item_pickup", { volume: 0.8, minIntervalMs: 60, throttleKey: "item_pickup" });
  }

  playPurchase() {
    this.playSfxFile("purchase", { volume: 0.85 });
  }

  playLevelUp() {
    this.playSfxFile("level_up", { volume: 0.9 });
  }

  playBossAppears() {
    this.playSfxFile("boss_appears", { volume: 0.95 });
  }

  playPlayerDeath() {
    this.playSfxFile("player_death", { volume: 0.95 });
  }

  playFinalVictory() {
    this.playSfxFile("final_victory", { volume: 0.95 });
  }

  playSlash() {
    this.playSfxFile("sword_slash", { volume: 0.65, minIntervalMs: 65, throttleKey: "auto_sword" });
  }

  playShot() {
    this.playSfxFile("magic", { volume: 0.55, minIntervalMs: 75, throttleKey: "auto_magic" });
  }

  playHit() {
    this.tone(180, 75, 0.06, "square", 0.06);
  }

  playKill() {
    this.tone(520, 780, 0.09, "sine", 0.07);
  }

  playPlayerHurt() {
    this.tone(150, 55, 0.14, "sawtooth", 0.12);
  }

  playSkill() {
    this.playSfxFile("skill", { volume: 0.85 });
  }

  playHeal() {
    this.playSfxFile("item_pickup", { volume: 0.72, playbackRate: 1.15 });
  }

  playBossWarn() {
    this.playBossAppears();
  }

  playClick() {
    this.tone(600, 480, 0.045, "sine", 0.08);
  }
}

export const SoundFX = new SoundManager();
