import { CATEGORY_TO_SLOT, getEquipmentById } from "../data/equipment";
import { ACHIEVEMENTS_DB, PERM_UPGRADES_DB } from "../data/upgrades";
import type { EquipmentItem, PermUpgradeDef, PermUpgradeKey, SaveData, StatBlock } from "../types/game";

export const SAVE_KEY = "survival100_save_data";
export const CURRENT_SAVE_VERSION = 1;

function sanitizeNonNegInt(val: unknown, fallback = 0): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    coins: 0,
    ownedEquipment: ["wp_sword_apprentice"],
    equipped: {
      weapon: "wp_sword_apprentice",
      shield: null,
      head: null,
      body: null,
      accessory: null,
    },
    permUpgrades: {
      atk: 0,
      maxHp: 0,
      def: 0,
      atkSpeed: 0,
      moveSpeed: 0,
      coinBonus: 0,
    },
    bestDay: 0,
    bestiary: {},
    achievements: [],
    unlockedCompanions: [],
    stats: {
      totalKills: 0,
      totalRuns: 0,
      boss100Defeated: false,
    },
  };
}

export function migrateSaveData(raw: unknown): SaveData {
  const base = createDefaultSave();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SaveData>;

  const perm: SaveData["permUpgrades"] = { ...base.permUpgrades };
  if (r.permUpgrades && typeof r.permUpgrades === "object") {
    for (const k of Object.keys(base.permUpgrades) as PermUpgradeKey[]) {
      const def = PERM_UPGRADES_DB.find((u) => u.id === k);
      const maxLv = def ? def.maxLv : 99;
      perm[k] = Math.min(maxLv, sanitizeNonNegInt(r.permUpgrades[k], 0));
    }
  }

  const equipped = { ...base.equipped, ...(r.equipped || {}) };
  if (!equipped.weapon || !getEquipmentById(equipped.weapon)) {
    equipped.weapon = "wp_sword_apprentice";
  }

  const owned = Array.isArray(r.ownedEquipment)
    ? Array.from(
        new Set([
          ...base.ownedEquipment,
          ...r.ownedEquipment.filter((id) => typeof id === "string" && !!getEquipmentById(id)),
        ])
      )
    : base.ownedEquipment;

  const bestiary: Record<string, number> = {};
  if (r.bestiary && typeof r.bestiary === "object") {
    for (const [k, v] of Object.entries(r.bestiary)) {
      bestiary[k] = sanitizeNonNegInt(v, 0);
    }
  }

  return {
    ...base,
    ...r,
    coins: sanitizeNonNegInt(r.coins, 0),
    bestDay: sanitizeNonNegInt(r.bestDay, 0),
    equipped,
    permUpgrades: perm,
    bestiary,
    stats: {
      ...base.stats,
      ...(r.stats || {}),
      totalKills: sanitizeNonNegInt(r.stats?.totalKills, 0),
      totalRuns: sanitizeNonNegInt(r.stats?.totalRuns, 0),
      boss100Defeated: Boolean(r.stats?.boss100Defeated),
    },
    ownedEquipment: owned,
    achievements: Array.isArray(r.achievements) ? Array.from(new Set(r.achievements)) : [],
    unlockedCompanions: Array.isArray(r.unlockedCompanions)
      ? Array.from(new Set(r.unlockedCompanions))
      : [],
    version: CURRENT_SAVE_VERSION,
  };
}

class SaveManagerImpl {
  data: SaveData = createDefaultSave();

  load(): SaveData {
    try {
      const rawStr = localStorage.getItem(SAVE_KEY);
      if (rawStr) {
        this.data = migrateSaveData(JSON.parse(rawStr));
      } else {
        this.data = createDefaultSave();
      }
    } catch {
      this.data = createDefaultSave();
    }
    return this.data;
  }

  save(): void {
    try {
      this.data.coins = sanitizeNonNegInt(this.data.coins, 0);
      this.data.version = CURRENT_SAVE_VERSION;
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // ignore storage quota errors gracefully
    }
  }

  resetAll(): SaveData {
    this.data = createDefaultSave();
    this.save();
    return this.data;
  }
}

export const SaveManager = new SaveManagerImpl();

// 段階＋指数コストテーブル（UI表示と購入処理で単一参照）
// Lv0→1: baseCost (2,500〜4,500)
// Lv1→2: 10,000〜18,000 / Lv2→3: 25,000〜45,000 / Lv3→4: 50,000〜90,000
// Lv4→5: 100,000〜180,000 / Lv5→6: 200,000〜360,000 / Lv6+: costScale倍で継続上昇
const PERM_STEP_MULTIPLIERS = [1, 4, 10, 20, 40, 80] as const;

export function getPermUpgradeCost(up: PermUpgradeDef, level: number): number {
  const safeLv = Math.max(0, Math.floor(Number.isFinite(level) ? level : 0));
  if (safeLv < PERM_STEP_MULTIPLIERS.length) {
    return Math.max(0, Math.round(up.baseCost * PERM_STEP_MULTIPLIERS[safeLv]));
  }
  const lv5Cost = up.baseCost * PERM_STEP_MULTIPLIERS[PERM_STEP_MULTIPLIERS.length - 1];
  const raw = lv5Cost * Math.pow(up.costScale, safeLv - (PERM_STEP_MULTIPLIERS.length - 1));
  return Math.max(0, Math.round(raw / 1000) * 1000);
}

export function getEquipmentPrice(item: EquipmentItem): number {
  return sanitizeNonNegInt(item.price, 0);
}

export function purchaseEquipmentAtomic(
  itemId: string
): { ok: true; item: EquipmentItem; cost: number } | { ok: false; reason: string } {
  const item = getEquipmentById(itemId);
  if (!item) return { ok: false, reason: "装備データが見つかりません" };
  if (SaveManager.data.ownedEquipment.includes(item.id)) {
    return { ok: false, reason: "すでに所持しています" };
  }
  const cost = getEquipmentPrice(item);
  const currentCoins = sanitizeNonNegInt(SaveManager.data.coins, 0);
  if (!Number.isFinite(cost) || cost < 0 || currentCoins < cost) {
    return { ok: false, reason: "コインが不足しています" };
  }

  SaveManager.data.coins = currentCoins - cost;
  SaveManager.data.ownedEquipment.push(item.id);
  const slot = CATEGORY_TO_SLOT[item.category];
  SaveManager.data.equipped[slot] = item.id;
  SaveManager.save();
  return { ok: true, item, cost };
}

export function purchasePermUpgradeAtomic(
  upId: PermUpgradeKey
): { ok: true; up: PermUpgradeDef; newLevel: number; cost: number } | { ok: false; reason: string } {
  const up = PERM_UPGRADES_DB.find((u) => u.id === upId);
  if (!up) return { ok: false, reason: "強化項目が見つかりません" };
  const lv = sanitizeNonNegInt(SaveManager.data.permUpgrades[up.id], 0);
  if (lv >= up.maxLv) return { ok: false, reason: "最大レベルに達しています" };
  const cost = getPermUpgradeCost(up, lv);
  const currentCoins = sanitizeNonNegInt(SaveManager.data.coins, 0);
  if (!Number.isFinite(cost) || cost < 0 || currentCoins < cost) {
    return { ok: false, reason: "コインが不足しています" };
  }

  const newLevel = lv + 1;
  SaveManager.data.coins = currentCoins - cost;
  SaveManager.data.permUpgrades[up.id] = newLevel;
  SaveManager.save();
  return { ok: true, up, newLevel, cost };
}

export function getEquippedStats(save: SaveData = SaveManager.data): Required<StatBlock> {
  const total: Required<StatBlock> = {
    atk: 0,
    maxHp: 0,
    def: 0,
    atkSpeed: 0,
    moveSpeed: 0,
    regen: 0,
  };
  for (const slot of Object.keys(save.equipped) as Array<keyof SaveData["equipped"]>) {
    const id = save.equipped[slot];
    const item = getEquipmentById(id);
    if (item?.stats) {
      total.atk += item.stats.atk || 0;
      total.maxHp += item.stats.maxHp || 0;
      total.def += item.stats.def || 0;
      total.atkSpeed += item.stats.atkSpeed || 0;
      total.moveSpeed += item.stats.moveSpeed || 0;
      total.regen += item.stats.regen || 0;
    }
  }
  return total;
}

export function getBaseHubStats(save: SaveData = SaveManager.data) {
  const perm = save.permUpgrades;
  const eq = getEquippedStats(save);
  return {
    maxHp: Math.round(100 + perm.maxHp * 18 + eq.maxHp),
    atk: Math.round(14 + perm.atk * 3 + eq.atk),
    def: Number((2 + perm.def * 1.5 + eq.def).toFixed(1)),
    atkSpeed: Number((1.25 + perm.atkSpeed * 0.08 + eq.atkSpeed).toFixed(2)),
    moveSpeed: Math.round(180 + perm.moveSpeed * 8 + eq.moveSpeed),
    regen: Number((0.4 + eq.regen).toFixed(1)),
    coinMult: 1 + perm.coinBonus * 0.1,
  };
}

export function formatItemStats(stats: StatBlock): string {
  const labels: Record<keyof StatBlock, string> = {
    atk: "攻撃力",
    maxHp: "最大HP",
    def: "防御力",
    atkSpeed: "攻撃速度",
    moveSpeed: "移動速度",
    regen: "自動回復",
  };
  return (Object.entries(stats) as Array<[keyof StatBlock, number]>)
    .filter(([, v]) => v !== 0 && v !== undefined)
    .map(([k, v]) => `${labels[k]} ${v > 0 ? "+" : ""}${v}`)
    .join(" / ");
}

export function evaluateAchievements(onUnlock?: (name: string) => void): boolean {
  let unlocked = false;
  for (const ach of ACHIEVEMENTS_DB) {
    if (!SaveManager.data.achievements.includes(ach.id) && ach.check(SaveManager.data)) {
      SaveManager.data.achievements.push(ach.id);
      unlocked = true;
      onUnlock?.(ach.name);
    }
  }
  if (unlocked) SaveManager.save();
  return unlocked;
}
