import { Coins } from "lucide-react";
import { useRef, useState } from "react";
import {
  COMPANION_SPRITE_MAP,
  EQUIPMENT_ICON_MAP,
} from "../data/assets";
import {
  CATEGORY_TO_SLOT,
  EQUIP_CATEGORIES,
  EQUIPMENT_DB,
  getEquipmentById,
  RARITY_COLOR_CLASS,
  RARITY_FRAME_CLASS,
  SLOT_LABELS,
} from "../data/equipment";
import { ACHIEVEMENTS_DB, COMPANION_CLASSES, PERM_UPGRADES_DB } from "../data/upgrades";
import { getWeaponSkillDef } from "../data/weaponSkills";
import type { EquipCategory, EquipSlot, SaveData } from "../types/game";
import {
  evaluateAchievements,
  formatItemStats,
  getBaseHubStats,
  getEquipmentPrice,
  getPermUpgradeCost,
  purchaseEquipmentAtomic,
  purchasePermUpgradeAtomic,
  SaveManager,
} from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { MonsterBestiary } from "./MonsterBestiary";
import { PixelSprite } from "./PixelSprite";

interface PanelProps {
  save: SaveData;
  onDataChange: () => void;
  onEquipChanged?: () => void;
  onToast: (msg: string) => void;
}

export function EquipmentShopPanel({ save, onDataChange, onEquipChanged, onToast }: PanelProps) {
  const [selectedCat, setSelectedCat] = useState<"すべて" | EquipCategory>("すべて");
  const lockRef = useRef(false);

  const filtered =
    selectedCat === "すべて"
      ? EQUIPMENT_DB
      : EQUIPMENT_DB.filter((item) => item.category === selectedCat);

  const handleBuy = (itemId: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const res = purchaseEquipmentAtomic(itemId);
      if (!res.ok) {
        onToast(res.reason);
        return;
      }
      SoundFX.playPurchase();
      evaluateAchievements((ach) => {
        SoundFX.playAchievement();
        onToast(`実績解除: ${ach.name} (+${ach.rewardCoins.toLocaleString()}G)`);
      });
      onEquipChanged?.();
      onDataChange();
      onToast(`${res.item.name}を購入・装備しました`);
    } finally {
      lockRef.current = false;
    }
  };

  const handleEquip = (itemId: string) => {
    const item = getEquipmentById(itemId);
    if (!item) return;
    if (!SaveManager.data.ownedEquipment.includes(item.id)) return;
    SoundFX.playItemPickup();
    const slot = CATEGORY_TO_SLOT[item.category];
    SaveManager.data.equipped[slot] = item.id;
    SaveManager.save();
    onEquipChanged?.();
    onDataChange();
    onToast(`${item.name}を装備しました`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="装備カテゴリ">
        {(["すべて", ...EQUIP_CATEGORIES] as const).map((cat) => {
          const active = selectedCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setSelectedCat(cat);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 transition-colors border cursor-pointer ${
                active
                  ? "bg-amber-500/20 text-amber-300 border-[#c89b3c]"
                  : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((item) => {
          const owned = save.ownedEquipment.includes(item.id);
          const slot = CATEGORY_TO_SLOT[item.category];
          const equipped = save.equipped[slot] === item.id;
          const price = getEquipmentPrice(item);
          const canAfford = save.coins >= price;
          const statText = formatItemStats(item.stats);

          return (
            <div
              key={item.id}
              className={`df-card flex flex-col justify-between gap-3 p-3.5 rounded-lg border ${RARITY_FRAME_CLASS[item.rarity]}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-14 h-14 shrink-0 rounded-md bg-slate-950/90 border flex items-center justify-center p-1 ${RARITY_FRAME_CLASS[item.rarity]}`}
                >
                  <PixelSprite
                    src={EQUIPMENT_ICON_MAP[item.id]}
                    alt={item.name}
                    className="w-11 h-11"
                    fallbackText={item.category[0]}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className={`font-bold text-sm truncate ${RARITY_COLOR_CLASS[item.rarity]}`}>
                      {item.name}
                    </h4>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className={RARITY_COLOR_CLASS[item.rarity]}>{item.rarity}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SLOT_LABELS[slot]}枠</span>
                  </div>
                  {statText && <p className="text-xs font-semibold text-emerald-300">{statText}</p>}
                  {slot === "weapon" && (
                    <p className="text-[11px] text-sky-300/95 font-semibold">
                      専用スキル: {getWeaponSkillDef(item.category).name}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>

              {owned ? (
                <button
                  type="button"
                  onClick={() => handleEquip(item.id)}
                  disabled={equipped}
                  className={`w-full py-2 px-3 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                    equipped
                      ? "bg-emerald-800/60 text-emerald-200 border border-emerald-500/60 cursor-default"
                      : "bg-slate-800 text-amber-100 border border-[#8f6b24] hover:bg-slate-700 cursor-pointer"
                  }`}
                >
                  {equipped ? "購入済み · 装備中" : "購入済み · 装備する"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleBuy(item.id)}
                  disabled={!canAfford}
                  className={`w-full py-2 px-3 rounded-md text-xs font-bold transition-colors whitespace-nowrap font-mono-num inline-flex items-center justify-center gap-1.5 ${
                    canAfford
                      ? "df-gold-btn text-slate-950 cursor-pointer"
                      : "bg-slate-900/70 text-slate-500 border border-slate-800 cursor-not-allowed"
                  }`}
                >
                  <Coins className={`w-3.5 h-3.5 ${canAfford ? "text-amber-950" : "text-slate-600"}`} />
                  {price.toLocaleString()} G で購入
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PermanentUpgradePanel({ save, onDataChange, onToast }: PanelProps) {
  const lockRef = useRef(false);

  const handleUpgrade = (upId: (typeof PERM_UPGRADES_DB)[number]["id"]) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      const res = purchasePermUpgradeAtomic(upId);
      if (!res.ok) {
        onToast(res.reason);
        return;
      }
      SoundFX.playPurchase();
      evaluateAchievements((ach) => {
        SoundFX.playAchievement();
        onToast(`実績解除: ${ach.name} (+${ach.rewardCoins.toLocaleString()}G)`);
      });
      onDataChange();
      onToast(`${res.up.name}を Lv.${res.newLevel} に強化しました`);
    } finally {
      lockRef.current = false;
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        コインを消費して基礎能力を恒久的に強化します。死亡して1日目からやり直しても強化は失われません。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PERM_UPGRADES_DB.map((up) => {
          const lv = save.permUpgrades[up.id] || 0;
          const isMax = lv >= up.maxLv;
          const cost = getPermUpgradeCost(up, lv);
          const canAfford = !isMax && save.coins >= cost;
          const bonusVal = Number((lv * up.perLv).toFixed(2));

          return (
            <div
              key={up.id}
              className="df-card flex flex-col justify-between gap-3 p-3.5 rounded-lg border border-[#8f6b24]/70"
            >
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="font-bold text-sm text-amber-100">{up.name}</h4>
                  <span className="text-xs font-mono-num text-amber-300 font-bold">
                    Lv.{lv} / {up.maxLv}
                  </span>
                </div>
                <p className="text-xs text-emerald-300 font-semibold font-mono-num">
                  現在効果: +{bonusVal}
                  {up.unit}
                </p>
                <p className="text-xs text-slate-400">{up.desc}</p>
              </div>

              <button
                type="button"
                onClick={() => handleUpgrade(up.id)}
                disabled={!canAfford}
                className={`w-full py-2 px-3 rounded-md text-xs font-bold transition-colors whitespace-nowrap font-mono-num inline-flex items-center justify-center gap-1.5 ${
                  isMax
                    ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50 cursor-default"
                    : canAfford
                      ? "df-gold-btn text-slate-950 cursor-pointer"
                      : "bg-slate-900/70 text-slate-500 border border-slate-800 cursor-not-allowed"
                }`}
              >
                {!isMax && (
                  <Coins className={`w-3.5 h-3.5 ${canAfford ? "text-amber-950" : "text-slate-600"}`} />
                )}
                {isMax ? "最大強化済み" : `${cost.toLocaleString()} G で強化`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EquipmentLoadoutPanel({ save, onDataChange, onEquipChanged, onToast }: PanelProps) {
  const handleEquip = (itemId: string) => {
    const item = getEquipmentById(itemId);
    if (!item) return;
    if (!SaveManager.data.ownedEquipment.includes(item.id)) return;
    SoundFX.playItemPickup();
    const slot = CATEGORY_TO_SLOT[item.category];
    SaveManager.data.equipped[slot] = item.id;
    SaveManager.save();
    onEquipChanged?.();
    onDataChange();
    onToast(`${item.name}を装備しました`);
  };

  const handleUnequip = (slot: EquipSlot) => {
    if (slot === "weapon") return;
    SoundFX.playClick();
    SaveManager.data.equipped[slot] = null;
    SaveManager.save();
    onEquipChanged?.();
    onDataChange();
    onToast(`${SLOT_LABELS[slot]}を外しました`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-amber-200 mb-2.5">現在の装備スロット</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {(Object.entries(SLOT_LABELS) as Array<[EquipSlot, string]>).map(([slotKey, label]) => {
            const item = getEquipmentById(save.equipped[slotKey]);
            return (
              <div
                key={slotKey}
                className={`p-3 rounded-lg bg-slate-950/90 border flex items-center gap-2.5 ${
                  item ? RARITY_FRAME_CLASS[item.rarity] : "border-slate-800"
                }`}
              >
                <div className="w-10 h-10 shrink-0 rounded bg-slate-900 border border-slate-700/80 flex items-center justify-center">
                  {item ? (
                    <PixelSprite
                      src={EQUIPMENT_ICON_MAP[item.id]}
                      alt={item.name}
                      className="w-8 h-8"
                      fallbackText={label[0]}
                    />
                  ) : (
                    <span className="text-[10px] text-slate-600">空</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-slate-400">{label}</div>
                  {item ? (
                    <div className={`text-xs font-bold truncate ${RARITY_COLOR_CLASS[item.rarity]}`}>
                      {item.name}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">未装備</div>
                  )}
                  {item && slotKey !== "weapon" && (
                    <button
                      type="button"
                      onClick={() => handleUnequip(slotKey)}
                      className="text-[11px] text-slate-400 hover:text-amber-300 mt-0.5 cursor-pointer"
                    >
                      外す
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-amber-200 mb-2.5">
          所持している装備 ({save.ownedEquipment.length}種)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {save.ownedEquipment.map((id) => {
            const item = getEquipmentById(id);
            if (!item) return null;
            const slot = CATEGORY_TO_SLOT[item.category];
            const isEquipped = save.equipped[slot] === item.id;
            return (
              <div
                key={item.id}
                className={`df-card flex flex-col justify-between gap-2.5 p-3.5 rounded-lg border ${RARITY_FRAME_CLASS[item.rarity]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded bg-slate-950 border border-slate-700/80 flex items-center justify-center">
                    <PixelSprite
                      src={EQUIPMENT_ICON_MAP[item.id]}
                      alt={item.name}
                      className="w-10 h-10"
                      fallbackText={item.category[0]}
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className={`font-bold text-sm truncate ${RARITY_COLOR_CLASS[item.rarity]}`}>
                        {item.name}
                      </h4>
                      <span className="text-xs text-slate-400 shrink-0">{item.category}</span>
                    </div>
                    <p className="text-xs text-emerald-300">{formatItemStats(item.stats)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleEquip(item.id)}
                  disabled={isEquipped}
                  className={`w-full py-1.5 px-3 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${
                    isEquipped
                      ? "bg-emerald-800/60 text-emerald-200 border border-emerald-500/60 cursor-default"
                      : "df-gold-btn text-slate-950 cursor-pointer"
                  }`}
                >
                  {isEquipped ? "装備中" : "装備する"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function RecordsBestiaryPanel({
  save,
  onDataChange,
  onToast,
  allowReset = true,
}: {
  save: SaveData;
  onDataChange: () => void;
  onToast: (msg: string) => void;
  allowReset?: boolean;
}) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const base = getBaseHubStats(save);

  const handleReset = () => {
    SaveManager.resetAll();
    setConfirmingReset(false);
    onDataChange();
    onToast("セーブデータを初期化しました");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="df-card p-3 rounded-lg border border-[#8f6b24]/60">
          <div className="text-xs text-slate-400">最高到達日数</div>
          <div className="text-lg font-bold text-amber-300 font-mono-num">{save.bestDay}日</div>
        </div>
        <div className="df-card p-3 rounded-lg border border-slate-700/80">
          <div className="text-xs text-slate-400">累計討伐数</div>
          <div className="text-lg font-bold text-slate-100 font-mono-num">
            {save.stats.totalKills.toLocaleString()}体
          </div>
        </div>
        <div className="df-card p-3 rounded-lg border border-slate-700/80">
          <div className="text-xs text-slate-400">冒険回数</div>
          <div className="text-lg font-bold text-slate-100 font-mono-num">
            {save.stats.totalRuns}回
          </div>
        </div>
        <div className="df-card p-3 rounded-lg border border-slate-700/80">
          <div className="text-xs text-slate-400">コイン獲得倍率</div>
          <div className="text-lg font-bold text-emerald-400 font-mono-num">
            {Math.round(base.coinMult * 100)}%
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-amber-200 mb-2.5">モンスター図鑑</h3>
        <MonsterBestiary save={save} />
      </div>

      <div>
        <h3 className="text-sm font-bold text-amber-200 mb-2.5">
          仲間解放状況（150日目以降 · 50日ごとに救出）
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.values(COMPANION_CLASSES).map((c) => {
            const unlocked = save.unlockedCompanions.includes(c.id);
            return (
              <div
                key={c.id}
                className={`df-card p-3.5 rounded-lg border flex items-start gap-3 ${
                  unlocked ? "border-[#c89b3c]/70" : "border-slate-800"
                }`}
              >
                <div className="w-13 h-13 shrink-0 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center p-1">
                  <PixelSprite
                    src={COMPANION_SPRITE_MAP[c.id]}
                    alt={c.name}
                    className={`w-11 h-11 ${unlocked ? "" : "grayscale opacity-45"}`}
                    fallbackText={c.role[0]}
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4
                      className="font-bold text-sm truncate"
                      style={{ color: unlocked ? c.color : "#94a3b8" }}
                    >
                      {unlocked ? c.name : `${c.role}（未救出）`}
                    </h4>
                    <span className="text-xs text-slate-400 font-mono-num shrink-0">{c.unlockDay}日目〜</span>
                  </div>
                  <p className="text-xs text-slate-400">{c.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-amber-200 mb-2.5">
          実績 ({save.achievements.length} / {ACHIEVEMENTS_DB.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENTS_DB.map((ach) => {
            const done = save.achievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`df-card p-3.5 rounded-lg border space-y-1.5 ${
                  done ? "border-[#c89b3c]" : "border-slate-800"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className={`font-bold text-sm ${done ? "text-amber-300" : "text-slate-300"}`}>
                    {ach.name}
                  </h4>
                  <span className={`text-xs shrink-0 ${done ? "text-emerald-400 font-bold" : "text-slate-500"}`}>
                    {done ? "達成" : "未達成"}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{ach.desc}</p>
                {ach.rewardCoins > 0 && (
                  <div className="text-[11px] font-mono-num text-amber-300/90 font-semibold">
                    報酬: +{ach.rewardCoins.toLocaleString()} G {done ? "(獲得済)" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {allowReset && (
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          {confirmingReset ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-rose-300">
                全データ（コイン・装備・強化・記録）を消去しますか？
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                初期化する
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReset(false)}
                className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              セーブデータ初期化
            </button>
          )}
        </div>
      )}
    </div>
  );
}
