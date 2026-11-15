import { Coins, Sparkles, X } from "lucide-react";
import { EQUIPMENT_ICON_MAP, MONSTER_SPRITE_MAP } from "../data/assets";
import { RARITY_COLOR_CLASS, RARITY_FRAME_CLASS } from "../data/equipment";
import type { HudSnapshot, MimicRewardSummary, PerkDef, SaveData } from "../types/game";
import { formatItemStats } from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { AudioSettingsPanel } from "./AudioSettingsPanel";
import { PixelSprite } from "./PixelSprite";
import {
  EquipmentLoadoutPanel,
  EquipmentShopPanel,
  RecordsBestiaryPanel,
} from "./ShopEquipPanels";

export type GameMenuTab = "stats" | "equip" | "shop" | "bestiary" | "system";

export function LevelUpModal({
  level,
  choices,
  onSelect,
}: {
  level: number;
  choices: PerkDef[];
  onSelect: (perk: PerkDef) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="df-panel w-full max-w-2xl rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-[#8f6b24]/60">
          <h2 className="font-display text-lg font-extrabold text-amber-300 tracking-wide">
            LEVEL UP · Lv.{level} — 強化を1つ選択
          </h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {choices.map((perk) => (
            <button
              key={perk.id}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                onSelect(perk);
              }}
              className="df-card p-4 rounded-xl border-2 border-[#8f6b24]/80 hover:border-amber-300 hover:shadow-[0_0_18px_rgba(251,191,36,0.28)] text-left transition-all cursor-pointer flex flex-col justify-between gap-2"
            >
              <h3 className="text-base font-bold text-amber-300">{perk.title}</h3>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{perk.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GameMenuModal({
  activeTab,
  onTabChange,
  onClose,
  hud,
  save,
  onDataChange,
  onEquipChanged,
  onAbandonToHub,
  onToast,
}: {
  activeTab: GameMenuTab;
  onTabChange: (tab: GameMenuTab) => void;
  onClose: () => void;
  hud: HudSnapshot;
  save: SaveData;
  onDataChange: () => void;
  onEquipChanged: () => void;
  onAbandonToHub: () => void;
  onToast: (msg: string) => void;
}) {
  const tabs: Array<{ id: GameMenuTab; label: string }> = [
    { id: "stats", label: "ステータス" },
    { id: "equip", label: "装備変更" },
    { id: "shop", label: "武器・防具ショップ" },
    { id: "bestiary", label: "図鑑・実績" },
    { id: "system", label: "音量・拠点" },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="df-panel w-full max-w-3xl max-h-[88vh] rounded-xl flex flex-col overflow-hidden">
        <div className="px-4 py-3 bg-slate-950/90 border-b border-[#8f6b24]/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-base font-extrabold text-amber-300">冒険メニュー</h2>
            <span className="text-xs text-amber-200 font-mono-num px-2 py-0.5 rounded bg-slate-900 border border-[#8f6b24]/60">
              所持コイン: {save.coins.toLocaleString()} G
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-amber-100 border border-[#8f6b24] text-xs font-bold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            閉じる（再開）
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-slate-800 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                onTabChange(tab.id);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "bg-amber-500/20 text-amber-200 border-[#c89b3c]"
                  : "bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          {activeTab === "stats" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">レベル</span>
                  <strong className="font-mono-num text-amber-300">Lv.{hud.level}</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">HP</span>
                  <strong className="font-mono-num">
                    {Math.ceil(hud.hp)} / {hud.maxHp}
                  </strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">攻撃力</span>
                  <strong className="font-mono-num">{hud.playerStats.atk}</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">防御力</span>
                  <strong className="font-mono-num">{hud.playerStats.def}</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">攻撃速度</span>
                  <strong className="font-mono-num">{hud.playerStats.atkSpeed}/秒</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">移動速度</span>
                  <strong className="font-mono-num">{hud.playerStats.moveSpeed}</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">自動回復</span>
                  <strong className="font-mono-num">+{hud.playerStats.regen}/秒</strong>
                </div>
                <div className="df-card p-3 rounded-lg border border-slate-700/80 flex justify-between text-xs sm:text-sm">
                  <span className="text-slate-400">攻撃範囲</span>
                  <strong className="font-mono-num">{hud.playerStats.range}px</strong>
                </div>
              </div>
              <div className="df-card p-3.5 rounded-lg border border-[#8f6b24]/60 space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-bold text-amber-300">
                    武器スキル: {hud.skillName}（{hud.weaponCategory}）
                  </span>
                  <span className="font-mono-num text-xs text-slate-300">
                    CD {hud.skillMaxCd}秒
                  </span>
                </div>
                <p className="text-xs text-slate-300">{hud.skillDesc}</p>
              </div>
              <p className="text-xs text-slate-400">
                同行中の仲間: {hud.companionCount}人（150日目以降、50日ごとに救出イベントが発生します）
              </p>
            </div>
          )}

          {activeTab === "equip" && (
            <EquipmentLoadoutPanel
              save={save}
              onDataChange={onDataChange}
              onEquipChanged={onEquipChanged}
              onToast={onToast}
            />
          )}

          {activeTab === "shop" && (
            <EquipmentShopPanel
              save={save}
              onDataChange={onDataChange}
              onEquipChanged={onEquipChanged}
              onToast={onToast}
            />
          )}

          {activeTab === "bestiary" && (
            <RecordsBestiaryPanel
              save={save}
              onDataChange={onDataChange}
              onToast={onToast}
              allowReset={false}
            />
          )}

          {activeTab === "system" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-amber-200 mb-2.5">サウンド設定</h3>
                <AudioSettingsPanel compact />
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-amber-200">冒険の中断</h3>
                <p className="text-sm text-slate-300">
                  現在の冒険を終了して拠点へ戻りますか？獲得したコインや最高到達日数、図鑑の記録は保持されます。
                </p>
                <button
                  type="button"
                  onClick={onAbandonToHub}
                  className="px-4 py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 border border-rose-400/60 text-white text-sm font-bold cursor-pointer"
                >
                  拠点へ戻る
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeathModal({
  summary,
  onRetry,
  onReturnHub,
}: {
  summary: { reachedDay: number; bestDay: number; runCoins: number; totalCoins: number };
  onRetry: () => void;
  onReturnHub: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/88 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="df-panel w-full max-w-md rounded-xl border-rose-500/60 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-rose-500/40">
          <h2 className="font-display text-lg font-extrabold text-rose-400">力尽きた……</h2>
        </div>
        <div className="p-5 space-y-4 text-center">
          <div>
            <div className="text-xs text-slate-400">到達記録</div>
            <div className="text-3xl font-extrabold text-amber-300 font-mono-num">
              {summary.reachedDay}日目
            </div>
            <div className="text-xs text-slate-300 mt-1 font-mono-num">
              最高到達日数: {summary.bestDay}日目
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-slate-950/85 border border-[#8f6b24]/60 text-xs font-mono-num">
            <div>
              <div className="text-slate-400">今回獲得コイン</div>
              <div className="text-base font-bold text-amber-300">
                +{summary.runCoins.toLocaleString()} G
              </div>
            </div>
            <div>
              <div className="text-slate-400">所持コイン合計</div>
              <div className="text-base font-bold text-amber-300">
                {summary.totalCoins.toLocaleString()} G
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            レベルと冒険中の一時強化はリセットされますが、コイン・購入済み装備・恒久強化・図鑑・実績・最高記録はすべて維持されます。
          </p>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onRetry}
              className="df-gold-btn flex-1 py-2.5 px-4 rounded-lg text-slate-950 font-extrabold text-sm cursor-pointer"
            >
              1日目から再挑戦
            </button>
            <button
              type="button"
              onClick={onReturnHub}
              className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-100 border border-[#8f6b24] font-bold text-sm cursor-pointer"
            >
              拠点へ戻る
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VictoryEndlessModal({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/88 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="df-panel w-full max-w-md rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/90 border-b border-[#c89b3c]/60">
          <h2 className="font-display text-lg font-extrabold text-amber-300">100日目ボス撃破！</h2>
        </div>
        <div className="p-5 space-y-4 text-center">
          <p className="text-base font-bold text-slate-100">破滅の魔王ゼノスを討伐しました！</p>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            これよりエンドレスモード（101日目以降）に突入します。150日目以降は50日ごとに仲間を救出できます。限界まで生き残りましょう。
          </p>
          <button
            type="button"
            onClick={onContinue}
            className="df-gold-btn w-full py-2.5 px-4 rounded-lg text-slate-950 font-extrabold text-sm cursor-pointer"
          >
            エンドレスモードへ進む
          </button>
        </div>
      </div>
    </div>
  );
}

export function MimicRewardModal({
  summary,
  onEquipAndContinue,
  onContinue,
}: {
  summary: MimicRewardSummary;
  onEquipAndContinue: (itemId: string) => void;
  onContinue: () => void;
}) {
  const eq = summary.equipment;
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/88 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="df-panel w-full max-w-md rounded-2xl border-2 border-[#facc15] shadow-[0_0_40px_rgba(250,204,21,0.38)] overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-950/95 border-b border-[#c89b3c]/70 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-amber-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-300" />
            ミミック撃破報酬！
          </h2>
          <span className="text-[11px] font-mono-num text-amber-200/80">
            期間 {summary.blockKey}日目
          </span>
        </div>

        <div className="p-5 space-y-4 text-center">
          <div className="mx-auto w-20 h-20 rounded-xl bg-slate-950 border-2 border-[#facc15]/80 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.28)]">
            <PixelSprite
              src={MONSTER_SPRITE_MAP.exp_monster_26}
              alt="ミミック"
              className="w-16 h-16"
              fallbackText="宝"
            />
          </div>

          {summary.rewardType === "equipment" && eq ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-yellow-200">
                黄金の宝箱から未所持の装備を発見した！
              </div>
              <div
                className={`p-3.5 rounded-xl bg-slate-950/90 border text-left flex items-start gap-3 ${RARITY_FRAME_CLASS[eq.rarity]}`}
              >
                <div className="w-14 h-14 shrink-0 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center p-1">
                  <PixelSprite
                    src={EQUIPMENT_ICON_MAP[eq.id]}
                    alt={eq.name}
                    className="w-11 h-11"
                    fallbackText={eq.category[0]}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className={`font-extrabold text-sm truncate ${RARITY_COLOR_CLASS[eq.rarity]}`}>
                      {eq.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 shrink-0">{eq.category}</span>
                  </div>
                  <div className={`text-[11px] font-bold ${RARITY_COLOR_CLASS[eq.rarity]}`}>
                    {eq.rarity}
                  </div>
                  <p className="text-xs font-semibold text-emerald-300">
                    {formatItemStats(eq.stats)}
                  </p>
                  <p className="text-xs text-slate-400">{eq.desc}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playItemPickup();
                    onEquipAndContinue(eq.id);
                  }}
                  className="df-gold-btn flex-1 py-2.5 px-4 rounded-lg text-slate-950 font-extrabold text-sm cursor-pointer"
                >
                  今すぐ装備して続ける
                </button>
                <button
                  type="button"
                  onClick={() => {
                    SoundFX.playClick();
                    onContinue();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-100 border border-[#8f6b24] font-bold text-sm cursor-pointer"
                >
                  受け取って続ける
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-bold text-yellow-200">
                黄金の宝箱から大量の財宝を手に入れた！
              </div>
              <div className="p-4 rounded-xl bg-slate-950/90 border border-[#c89b3c] flex items-center justify-center gap-2.5 font-mono-num">
                <Coins className="w-7 h-7 text-amber-400" />
                <span className="text-2xl font-extrabold text-amber-300">
                  +{summary.coinsGained.toLocaleString()} G
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  SoundFX.playClick();
                  onContinue();
                }}
                className="df-gold-btn w-full py-2.5 px-4 rounded-lg text-slate-950 font-extrabold text-sm cursor-pointer"
              >
                財宝を受け取って冒険を続ける
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
