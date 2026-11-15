import { Music, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AudioSettings } from "../types/game";
import { SoundFX } from "../utils/sound";

export function useAudioSettings(): AudioSettings {
  const [settings, setSettings] = useState<AudioSettings>(() => SoundFX.getSettings());
  useEffect(() => {
    return SoundFX.subscribe(setSettings);
  }, []);
  return settings;
}

export function AudioSettingsPanel({ compact = false }: { compact?: boolean }) {
  const settings = useAudioSettings();

  const handleBgmVol = (val: number) => {
    SoundFX.unlockFromUserGesture();
    SoundFX.updateSettings({ bgmVolume: val });
  };

  const handleSfxVol = (val: number) => {
    SoundFX.unlockFromUserGesture();
    SoundFX.updateSettings({ sfxVolume: val });
  };

  const toggleBgmMute = () => {
    SoundFX.unlockFromUserGesture();
    SoundFX.updateSettings({ bgmMuted: !settings.bgmMuted });
    SoundFX.playClick();
  };

  const toggleSfxMute = () => {
    SoundFX.unlockFromUserGesture();
    const nextMuted = !settings.sfxMuted;
    SoundFX.updateSettings({ sfxMuted: nextMuted });
    if (!nextMuted) SoundFX.playClick();
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* BGM Volume & Mute */}
      <div className="df-card p-3.5 rounded-lg border border-[#8f6b24]/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-200">
            <Music className="w-4 h-4 text-amber-400 shrink-0" />
            <span>BGM 音量</span>
            <span className="font-mono-num text-amber-300 text-xs">
              {settings.bgmMuted ? "MUTE" : `${Math.round(settings.bgmVolume * 100)}%`}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleBgmMute}
            aria-label={settings.bgmMuted ? "BGMミュート解除" : "BGMをミュート"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
              settings.bgmMuted
                ? "bg-rose-950/70 text-rose-200 border-rose-500/60"
                : "bg-slate-900 hover:bg-slate-800 text-amber-200 border-[#8f6b24]/80"
            }`}
          >
            {settings.bgmMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {settings.bgmMuted ? "ミュート中" : "BGM ON"}
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label="BGM音量スライダー"
          value={Math.round(settings.bgmVolume * 100)}
          onChange={(e) => handleBgmVol(Number(e.target.value) / 100)}
          className="w-full h-2 accent-amber-400 bg-slate-950 rounded-lg cursor-pointer"
        />
      </div>

      {/* SFX Volume & Mute */}
      <div className="df-card p-3.5 rounded-lg border border-[#8f6b24]/60 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-200">
            <Volume2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span>効果音 音量</span>
            <span className="font-mono-num text-sky-300 text-xs">
              {settings.sfxMuted ? "MUTE" : `${Math.round(settings.sfxVolume * 100)}%`}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSfxMute}
            aria-label={settings.sfxMuted ? "効果音ミュート解除" : "効果音をミュート"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold border transition-colors cursor-pointer ${
              settings.sfxMuted
                ? "bg-rose-950/70 text-rose-200 border-rose-500/60"
                : "bg-slate-900 hover:bg-slate-800 text-sky-200 border-sky-600/60"
            }`}
          >
            {settings.sfxMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {settings.sfxMuted ? "ミュート中" : "効果音 ON"}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            aria-label="効果音音量スライダー"
            value={Math.round(settings.sfxVolume * 100)}
            onChange={(e) => handleSfxVol(Number(e.target.value) / 100)}
            className="flex-1 h-2 accent-sky-400 bg-slate-950 rounded-lg cursor-pointer"
          />
          <button
            type="button"
            onClick={() => {
              SoundFX.unlockFromUserGesture();
              SoundFX.playCoin();
            }}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 whitespace-nowrap cursor-pointer"
          >
            テスト
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 leading-relaxed">
        音量設定はブラウザに自動保存されます。iPhone / Safari では画面を最初にタップした後にBGM・効果音が再生されます。
      </p>
    </div>
  );
}

export function AudioSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="df-panel w-full max-w-md rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-slate-950/90 border-b border-[#8f6b24]/60 flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold text-amber-300">サウンド設定</h2>
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              onClose();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-100 border border-[#8f6b24] text-xs font-bold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            閉じる
          </button>
        </div>
        <div className="p-4">
          <AudioSettingsPanel />
        </div>
      </div>
    </div>
  );
}
