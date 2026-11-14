import { getEquipmentById } from "../data/equipment";
import { ACHIEVEMENTS_DB } from "../data/upgrades";
import type { PermUpgradeDef, SaveData, StatBlock } from "../types/game";

export const SAVE_KEY = "survival100_save_data";
export const CURRENT_SAVE_VERSION = 1;

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

  return {
    ...base,
    ...r,
    equipped: { ...base.equipped, ...(r.equipped || {}) },
    permUpgrades: { ...base.permUpgrades, ...(r.permUpgrades || {}) },
    bestiary: { ...(r.bestiary || {}) },
    stats: { ...base.stats, ...(r.stats || {}) },
    ownedEquipment: Array.isArray(r.ownedEquipment)
      ? Array.from(new Set([...base.ownedEquipment, ...r.ownedEquipment]))
      : base.ownedEquipment,
    achievements: Array.isArray(r.achievements) ? r.achievements : [],
    unlockedCompanions: Array.isArray(r.unlockedCompanions) ? r.unlockedCompanions : [],
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

export function getPermUpgradeCost(up: PermUpgradeDef, level: number): number {
  return Math.floor(up.baseCost * Math.pow(up.costScale, level));
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
