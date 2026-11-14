import { Coins, Compass, Play, Shield, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import type { SaveData } from "../types/game";
import { getBaseHubStats } from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
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
    <div className="relative z-20 w-full h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#0b0f17_70%)]">
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-8 space-y-5">
        {/* Hero Header */}
        <header className="p-5 sm:p-6 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-wider text-amber-400">
                SURVIVAL 100
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                見下ろし型2DファンタジーサバイバルRPG — 100日目の魔王討伐とエンドレス記録に挑戦
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? "サウンドをオンにする" : "サウンドをミュートする"}
                className="p-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  onStartRun();
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white font-bold text-sm sm:text-base transition-all shadow-lg shadow-amber-900/30 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                冒険開始（1日目）
              </button>
            </div>
          </div>

          {/* Unboxed clean summary metrics */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-300">
            <div className="flex items-center gap-1.5 font-mono-num">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="text-slate-400">所持コイン:</span>
              <strong className="text-amber-300">{save.coins.toLocaleString()}</strong>
            </div>
            <div className="font-mono-num">
              <span className="text-slate-400">最高到達日数:</span>{" "}
              <strong className="text-sky-400">{save.bestDay}日</strong>
            </div>
            <div className="font-mono-num">
              <span className="text-slate-400">初期HP:</span>{" "}
              <strong className="text-slate-100">{baseStats.maxHp}</strong>
            </div>
            <div className="font-mono-num">
              <span className="text-slate-400">初期攻撃力:</span>{" "}
              <strong className="text-slate-100">{baseStats.atk}</strong>
            </div>
            <div className="font-mono-num">
              <span className="text-slate-400">初期防御力:</span>{" "}
              <strong className="text-slate-100">{baseStats.def}</strong>
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
                    ? "bg-slate-800 text-amber-300 border-amber-500/60"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800/70"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Hub Content */}
        <main className="p-4 sm:p-5 rounded-xl bg-slate-900/75 border border-slate-800">
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
        <footer className="text-center text-xs text-slate-500 pb-4">
          操作方法 — PC: WASD / 矢印キー移動 · Space/E スキル · Q/F 回復薬 · 自動攻撃 / スマホ: 左スティック移動 · 右ボタンでスキル・回復
        </footer>
      </div>
    </div>
  );
}
