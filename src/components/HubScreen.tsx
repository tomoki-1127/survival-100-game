import { Coins, Compass, Play, Shield, SlidersHorizontal, Sparkles, Trophy, Volume2, VolumeX } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { COMPANION_SPRITE_MAP, EQUIPMENT_ICON_MAP, HERO_SPRITE_PATH } from "../data/assets";
import { getEquipmentById } from "../data/equipment";
import { COMPANION_CLASSES } from "../data/upgrades";
import { getWeaponSkillDef } from "../data/weaponSkills";
import type { SaveData } from "../types/game";
import {
  evaluateAchievements,
  getBaseHubStats,
  type SecretUnlockResult,
  unlockAllWeaponsSecret,
} from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { AudioSettingsModal } from "./AudioSettingsPanel";
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

const SECRET_PARTICLES = Array.from({ length: 24 }, (_, idx) => {
  const angle = (idx / 24) * Math.PI * 2 + (idx % 2) * 0.14;
  const dist = 110 + (idx % 4) * 42;
  return {
    id: idx,
    tx: `${Math.round(Math.cos(angle) * dist)}px`,
    ty: `${Math.round(Math.sin(angle) * dist)}px`,
    rot: `${(idx % 2 === 0 ? 1 : -1) * (140 + idx * 12)}deg`,
    size: idx % 3 === 0 ? 10 : 7,
    delay: `${(idx % 5) * 45}ms`,
  };
});

export function HubScreen({
  save,
  muted,
  onToggleMute,
  onStartRun,
  onDataChange,
  onToast,
}: HubScreenProps) {
  const [activeTab, setActiveTab] = useState<HubTab>("shop");
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [secretCelebration, setSecretCelebration] = useState<SecretUnlockResult | null>(null);

  const tapCountRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const tapResetTimerRef = useRef<number | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);

  const baseStats = getBaseHubStats(save);
  const equippedWeapon = getEquipmentById(save.equipped.weapon);
  const equippedShield = getEquipmentById(save.equipped.shield);
  const equippedSkill = getWeaponSkillDef(equippedWeapon?.category || "剣");

  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current !== null) {
        window.clearTimeout(tapResetTimerRef.current);
      }
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  const handleSecretTap = () => {
    const now = Date.now();
    if (tapResetTimerRef.current !== null) {
      window.clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }

    if (now - lastTapAtRef.current >= 5000) {
      tapCountRef.current = 0;
    }

    lastTapAtRef.current = now;
    tapCountRef.current += 1;

    if (tapCountRef.current >= 10) {
      tapCountRef.current = 0;
      const result = unlockAllWeaponsSecret();
      if (result.alreadyUnlocked) {
        SoundFX.playClick();
        onToast("すべての武器は解放済みです");
        return;
      }

      SoundFX.playLevelUp();
      evaluateAchievements((name) => onToast(`実績解除: ${name}`));
      onDataChange();
      setSecretCelebration(result);

      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current);
      }
      celebrationTimerRef.current = window.setTimeout(() => {
        setSecretCelebration(null);
        celebrationTimerRef.current = null;
      }, 4500);
      return;
    }

    tapResetTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      tapResetTimerRef.current = null;
    }, 5000);
  };

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
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-lg bg-slate-950/90 border-2 border-[#c89b3c] shadow-[0_0_18px_rgba(200,155,60,0.22)] flex items-center justify-center">
                <PixelSprite src={HERO_SPRITE_PATH} alt="主人公" className="w-14 h-14 sm:w-18 sm:h-18" fallbackText="勇" />
                {equippedWeapon && (
                  <div
                    title={`装備武器: ${equippedWeapon.name}（スキル: ${equippedSkill.name}）`}
                    className="absolute -bottom-1.5 -right-1.5 w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-slate-950 border border-[#c89b3c] shadow flex items-center justify-center p-0.5"
                  >
                    <PixelSprite
                      src={EQUIPMENT_ICON_MAP[equippedWeapon.id]}
                      alt={equippedWeapon.name}
                      className="w-6 h-6"
                      fallbackText="武"
                    />
                  </div>
                )}
                {equippedShield && (
                  <div
                    title={`装備盾: ${equippedShield.name}`}
                    className="absolute -bottom-1.5 -left-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-slate-950 border border-sky-500/80 shadow flex items-center justify-center p-0.5"
                  >
                    <PixelSprite
                      src={EQUIPMENT_ICON_MAP[equippedShield.id]}
                      alt={equippedShield.name}
                      className="w-5 h-5"
                      fallbackText="盾"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  <span className="text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600">
                    SURVIVAL{" "}
                  </span>
                  <span
                    onClick={handleSecretTap}
                    className="text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 touch-manipulation select-none cursor-default"
                  >
                    100
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  16bitダークファンタジー2DサバイバルRPG — 100日目の魔王討伐とエンドレス記録に挑戦
                </p>
                {equippedWeapon && (
                  <p className="text-[11px] sm:text-xs text-sky-300/95 font-semibold">
                    装備中: {equippedWeapon.name} · スキル「{equippedSkill.name}」
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  setShowAudioModal(true);
                }}
                aria-label="音量設定を開く"
                title="音量設定（BGM・効果音）"
                className="inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-200 border border-[#8f6b24] text-xs font-bold transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">音量</span>
              </button>
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

      {/* Secret Command Golden Celebration Overlay */}
      {secretCelebration && (
        <div
          onClick={() => setSecretCelebration(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-[2px] cursor-pointer"
        >
          {/* Momentary Golden Screen Flash */}
          <div className="pointer-events-none fixed inset-0 animate-secret-flash bg-[radial-gradient(circle_at_center,rgba(254,249,195,0.92)_0%,rgba(250,204,21,0.58)_45%,rgba(217,119,6,0.22)_100%)]" />

          {/* Golden Radial Particles */}
          <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            {SECRET_PARTICLES.map((p) => (
              <span
                key={p.id}
                className="absolute left-0 top-0 rotate-45 bg-gradient-to-br from-yellow-100 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.95)] animate-secret-particle"
                style={
                  {
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    animationDelay: p.delay,
                    "--tx": p.tx,
                    "--ty": p.ty,
                    "--rot": p.rot,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* Rare Unlock Banner */}
          <div className="relative df-panel animate-secret-card w-full max-w-md rounded-2xl border-2 border-[#facc15] p-6 text-center shadow-[0_0_50px_rgba(250,204,21,0.45),inset_0_0_24px_rgba(250,204,21,0.18)] space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-[#facc15]/80 text-amber-200 text-xs font-extrabold font-display tracking-[0.16em]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              SECRET COMMAND UNLOCKED!
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-500 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              全武器解放！
            </h2>

            <p className="text-sm sm:text-base font-bold text-amber-100 font-mono-num">
              解放した武器数:{" "}
              <span className="text-amber-300 text-lg">
                {secretCelebration.newlyUnlockedCount}
              </span>
              種（登録全 {secretCelebration.totalWeaponsCount} 種コンプリート）
            </p>

            <p className="text-xs text-slate-300 leading-relaxed">
              武器・防具ショップおよび装備変更からすべての武器を装備できます（コイン消費なし・自動装備なし）。
            </p>

            <div className="pt-1 text-[11px] text-amber-300/80">タップまたはクリックで閉じる</div>
          </div>
        </div>
      )}

      {showAudioModal && <AudioSettingsModal onClose={() => setShowAudioModal(false)} />}
    </div>
  );
}
