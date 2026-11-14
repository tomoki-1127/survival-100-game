import { Coins, Compass, Play, Shield, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { COMPANION_SPRITE_MAP, HERO_SPRITE_PATH } from "../data/assets";
import { COMPANION_CLASSES } from "../data/upgrades";
import type { SaveData } from "../types/game";
import { getBaseHubStats } from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { PixelSprite } from "./PixelSprite";
import {
  EquipmentLoadoutPanel,
  EquipmentShopPanel,
  PermanentUpgradePanel,
  RecordsBestiaryPanel,
} from "./ShopEquipPanels";

type HubTab = "shop" | "upgrade" | "equip" | "record";

interface HubScreenProps {
  save: SaveData;
  muted: boolean;
  onToggleMute: () => void;
  onStartRun: () => void;
  onDataChange: () => void;
  onToast: (msg: string) => void;
}

export function HubScreen({
  save,
  muted,
  onToggleMute,
  onStartRun,
  onDataChange,
  onToast,
}: HubScreenProps) {
  const [activeTab, setActiveTab] = useState<HubTab>("shop");
  const baseStats = getBaseHubStats(save);

  const tabs: Array<{ id: HubTab; label: string; icon: typeof Shield }> = [
    { id: "shop", label: "武器・防具ショップ", icon: Shield },
    { id: "upgrade", label: "恒久強化ショップ", icon: Sparkles },
    { id: "equip", label: "装備変更", icon: Compass },
    { id: "record", label: "記録・図鑑・実績", icon: Trophy },
  ];

  return (
    <div className="relative z-20 w-full h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#172033_0%,_#070a12_72%)]">
      <div className="max-w-5xl mx-auto px-3.5 sm:px-5 py-4 sm:py-7 space-y-4 sm:space-y-5">
        {/* Hero Header */}
        <header className="df-panel p-4 sm:p-6 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg bg-slate-950/90 border-2 border-[#c89b3c] shadow-[0_0_18px_rgba(200,155,60,0.22)] flex items-center justify-center">
                <PixelSprite src={HERO_SPRITE_PATH} alt="主人公" className="w-14 h-14 sm:w-18 sm:h-18" fallbackText="勇" />
              </div>
              <div className="space-y-1">
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  SURVIVAL 100
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  16bitダークファンタジー2DサバイバルRPG — 100日目の魔王討伐とエンドレス記録に挑戦
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? "サウンドをオンにする" : "サウンドをミュートする"}
                className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-200 border border-[#8f6b24] transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  onStartRun();
                }}
                className="df-gold-btn inline-flex items-center gap-2 px-5 py-3 rounded-lg text-slate-950 font-extrabold text-sm sm:text-base active:scale-[0.98] transition-transform cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                冒険開始（1日目）
              </button>
            </div>
          </div>

          {/* Summary Metrics + Companion Roster Preview */}
          <div className="pt-3 border-t border-[#8f6b24]/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-slate-300">
              <div className="flex items-center gap-1.5 font-mono-num px-2.5 py-1 rounded bg-slate-950/90 border border-[#8f6b24]/70">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">所持コイン:</span>
                <strong className="text-amber-300">{save.coins.toLocaleString()} G</strong>
              </div>
              <div className="font-mono-num">
                <span className="text-slate-400">最高到達:</span>{" "}
                <strong className="text-sky-300">{save.bestDay}日</strong>
              </div>
              <div className="font-mono-num">
                <span className="text-slate-400">HP:</span>{" "}
                <strong className="text-slate-100">{baseStats.maxHp}</strong>
              </div>
              <div className="font-mono-num">
                <span className="text-slate-400">攻撃:</span>{" "}
                <strong className="text-slate-100">{baseStats.atk}</strong>
              </div>
              <div className="font-mono-num">
                <span className="text-slate-400">防御:</span>{" "}
                <strong className="text-slate-100">{baseStats.def}</strong>
              </div>
            </div>

            {/* Companion Class Strip */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 mr-1 whitespace-nowrap">仲間:</span>
              {Object.values(COMPANION_CLASSES).map((c) => {
                const unlocked = save.unlockedCompanions.includes(c.id);
                return (
                  <div
                    key={c.id}
                    title={unlocked ? `${c.name}（解放済み）` : `${c.role}（${c.unlockDay}日目〜救出）`}
                    className={`w-8 h-8 rounded bg-slate-950 border flex items-center justify-center ${
                      unlocked ? "border-[#c89b3c]" : "border-slate-800"
                    }`}
                  >
                    <PixelSprite
                      src={COMPANION_SPRITE_MAP[c.id]}
                      alt={c.role}
                      className={`w-7 h-7 ${unlocked ? "" : "grayscale opacity-35"}`}
                      fallbackText={c.role[0]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* Hub Navigation Tabs */}
        <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="拠点メニュー">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-gradient-to-b from-amber-500/25 to-amber-900/20 text-amber-200 border-[#c89b3c] shadow-[0_0_12px_rgba(200,155,60,0.2)]"
                    : "bg-slate-900/85 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Hub Content */}
        <main className="df-panel p-4 sm:p-5 rounded-xl">
          {activeTab === "shop" && (
            <EquipmentShopPanel save={save} onDataChange={onDataChange} onToast={onToast} />
          )}
          {activeTab === "upgrade" && (
            <PermanentUpgradePanel save={save} onDataChange={onDataChange} onToast={onToast} />
          )}
          {activeTab === "equip" && (
            <EquipmentLoadoutPanel save={save} onDataChange={onDataChange} onToast={onToast} />
          )}
          {activeTab === "record" && (
            <RecordsBestiaryPanel save={save} onDataChange={onDataChange} onToast={onToast} />
          )}
        </main>

        {/* Controls Footer Hint */}
        <footer className="text-center text-xs text-slate-400 pb-4">
          操作方法 — PC: WASD / 矢印キー移動 · Space/E スキル · Q/F 回復薬 · 自動攻撃 / スマホ: 左スティック移動 · 右ボタンでスキル・回復
        </footer>
      </div>
    </div>
  );
}
