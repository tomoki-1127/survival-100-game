import { CATEGORY_TO_SLOT, EQUIPMENT_DB, getEquipmentById } from "../data/equipment";
import { MONSTERS_DB, TOTAL_MONSTER_COUNT } from "../data/monsters";
import {
  ACHIEVEMENTS_DB,
  BESTIARY_COMPLETE_DEFEAT_REWARD,
  BESTIARY_COMPLETE_DISCOVER_REWARD,
  PERM_UPGRADES_DB,
} from "../data/upgrades";
import type {
  AchievementDef,
  AreaId,
  BestiaryRecord,
  EquipmentItem,
  MimicRewardSummary,
  MimicState,
  PermUpgradeDef,
  PermUpgradeKey,
  SaveData,
  StatBlock,
} from "../types/game";

export const SAVE_KEY = "survival100_save_data";
export const CURRENT_SAVE_VERSION = 2;
export const MIMIC_MONSTER_ID = "exp_monster_26";
export const MIMIC_COIN_REWARD = 10000;

function sanitizeNonNegInt(val: unknown, fallback = 0): number {
  const n = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

export function createEmptyMimicState(): MimicState {
  return {
    plannedDayByBlock: {},
    spawnedBlocks: [],
    defeatedBlocks: [],
    rewardedBlocks: [],
    totalMimicDefeated: 0,
  };
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
    bestiaryRecords: {},
    mimicState: createEmptyMimicState(),
    bestiaryRewardsClaimed: {
      discoveredAll: false,
      defeatedAll: false,
    },
    achievements: [],
    unlockedCompanions: [],
    secretWeaponsUnlocked: false,
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

  const bestDay = sanitizeNonNegInt(r.bestDay, 0);

  const bestiary: Record<string, number> = {};
  if (r.bestiary && typeof r.bestiary === "object") {
    for (const [k, v] of Object.entries(r.bestiary)) {
      bestiary[k] = sanitizeNonNegInt(v, 0);
    }
  }

  const bestiaryRecords: Record<string, BestiaryRecord> = {};
  if (r.bestiaryRecords && typeof r.bestiaryRecords === "object") {
    for (const [k, rec] of Object.entries(r.bestiaryRecords)) {
      if (!rec || typeof rec !== "object") continue;
      const kills = sanitizeNonNegInt(rec.kills, bestiary[k] || 0);
      const encounters = Math.max(kills, sanitizeNonNegInt(rec.encounters, 0));
      const lastDay = sanitizeNonNegInt(rec.lastDay, 0);
      const maxDefeatedLevel = sanitizeNonNegInt(rec.maxDefeatedLevel, 0);
      bestiaryRecords[k] = {
        encounters,
        kills,
        lastDay,
        maxDefeatedLevel,
      };
      bestiary[k] = Math.max(bestiary[k] || 0, kills);
    }
  }

  // Migrate legacy v1 bestiary kill counts into bestiaryRecords
  for (const [k, killCount] of Object.entries(bestiary)) {
    if (killCount > 0 && !bestiaryRecords[k]) {
      const mDef = MONSTERS_DB[k];
      const fallbackDay = Math.max(mDef?.minDay || 1, bestDay || 1);
      bestiaryRecords[k] = {
        encounters: killCount,
        kills: killCount,
        lastDay: fallbackDay,
        maxDefeatedLevel: fallbackDay,
      };
    }
  }

  const rawMimic = r.mimicState;
  const mimicState: MimicState = createEmptyMimicState();
  if (rawMimic && typeof rawMimic === "object") {
    if (rawMimic.plannedDayByBlock && typeof rawMimic.plannedDayByBlock === "object") {
      for (const [blockKey, d] of Object.entries(rawMimic.plannedDayByBlock)) {
        const cleanDay = sanitizeNonNegInt(d, 0);
        if (cleanDay >= 1) mimicState.plannedDayByBlock[blockKey] = cleanDay;
      }
    }
    if (Array.isArray(rawMimic.spawnedBlocks)) {
      mimicState.spawnedBlocks = Array.from(
        new Set(rawMimic.spawnedBlocks.filter((x) => typeof x === "string"))
      );
    }
    if (Array.isArray(rawMimic.defeatedBlocks)) {
      mimicState.defeatedBlocks = Array.from(
        new Set(rawMimic.defeatedBlocks.filter((x) => typeof x === "string"))
      );
    }
    if (Array.isArray(rawMimic.rewardedBlocks)) {
      mimicState.rewardedBlocks = Array.from(
        new Set(rawMimic.rewardedBlocks.filter((x) => typeof x === "string"))
      );
    }
    mimicState.totalMimicDefeated = sanitizeNonNegInt(
      rawMimic.totalMimicDefeated,
      bestiaryRecords[MIMIC_MONSTER_ID]?.kills || 0
    );
  }

  const bestiaryRewardsClaimed = {
    discoveredAll: Boolean(r.bestiaryRewardsClaimed?.discoveredAll),
    defeatedAll: Boolean(r.bestiaryRewardsClaimed?.defeatedAll),
  };

  return {
    ...base,
    ...r,
    coins: sanitizeNonNegInt(r.coins, 0),
    bestDay,
    equipped,
    permUpgrades: perm,
    bestiary,
    bestiaryRecords,
    mimicState,
    bestiaryRewardsClaimed,
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
    secretWeaponsUnlocked: Boolean(r.secretWeaponsUnlocked),
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

// ===== Monster Bestiary Persistence & Stats =====
export function isMonsterDiscovered(save: SaveData, monsterId: string): boolean {
  const rec = save.bestiaryRecords?.[monsterId];
  return Boolean((rec && (rec.encounters > 0 || rec.kills > 0)) || (save.bestiary?.[monsterId] || 0) > 0);
}

export function isMonsterDefeated(save: SaveData, monsterId: string): boolean {
  const rec = save.bestiaryRecords?.[monsterId];
  return Boolean((rec && rec.kills > 0) || (save.bestiary?.[monsterId] || 0) > 0);
}

export function getBestiaryRecord(save: SaveData, monsterId: string): BestiaryRecord {
  const rec = save.bestiaryRecords?.[monsterId];
  const legacyKills = save.bestiary?.[monsterId] || 0;
  if (!rec) {
    return {
      encounters: legacyKills,
      kills: legacyKills,
      lastDay: 0,
      maxDefeatedLevel: 0,
    };
  }
  return {
    encounters: Math.max(rec.encounters, legacyKills),
    kills: Math.max(rec.kills, legacyKills),
    lastDay: rec.lastDay,
    maxDefeatedLevel: rec.maxDefeatedLevel,
  };
}

export function getBestiaryStats(save: SaveData = SaveManager.data) {
  let discoveredCount = 0;
  let defeatedCount = 0;
  for (const id of Object.keys(MONSTERS_DB)) {
    if (isMonsterDiscovered(save, id)) discoveredCount += 1;
    if (isMonsterDefeated(save, id)) defeatedCount += 1;
  }
  const totalCount = TOTAL_MONSTER_COUNT;
  const discoveryPct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;
  const defeatPct = totalCount > 0 ? Math.round((defeatedCount / totalCount) * 100) : 0;
  return {
    discoveredCount,
    defeatedCount,
    totalCount,
    discoveryPct,
    defeatPct,
  };
}

export function recordMonsterEncounter(monsterId: string, day: number): { isNewDiscovery: boolean } {
  if (!MONSTERS_DB[monsterId]) return { isNewDiscovery: false };
  const prev = SaveManager.data.bestiaryRecords[monsterId];
  const isNewDiscovery = !isMonsterDiscovered(SaveManager.data, monsterId);
  const next: BestiaryRecord = {
    encounters: (prev?.encounters || 0) + 1,
    kills: Math.max(prev?.kills || 0, SaveManager.data.bestiary[monsterId] || 0),
    lastDay: Math.max(1, day),
    maxDefeatedLevel: prev?.maxDefeatedLevel || 0,
  };
  SaveManager.data.bestiaryRecords[monsterId] = next;
  SaveManager.save();
  return { isNewDiscovery };
}

export function recordMonsterKill(
  monsterId: string,
  day: number
): { completedDiscoverReward: number; completedDefeatReward: number } {
  const safeDay = Math.max(1, day);
  const prevKills = Math.max(
    SaveManager.data.bestiary[monsterId] || 0,
    SaveManager.data.bestiaryRecords[monsterId]?.kills || 0
  );
  const newKills = prevKills + 1;
  SaveManager.data.bestiary[monsterId] = newKills;

  const prevRec = SaveManager.data.bestiaryRecords[monsterId];
  SaveManager.data.bestiaryRecords[monsterId] = {
    encounters: Math.max(prevRec?.encounters || 1, newKills),
    kills: newKills,
    lastDay: safeDay,
    maxDefeatedLevel: Math.max(prevRec?.maxDefeatedLevel || 0, safeDay),
  };

  let completedDiscoverReward = 0;
  let completedDefeatReward = 0;

  const stats = getBestiaryStats(SaveManager.data);
  if (stats.discoveredCount >= stats.totalCount && !SaveManager.data.bestiaryRewardsClaimed.discoveredAll) {
    SaveManager.data.bestiaryRewardsClaimed.discoveredAll = true;
    SaveManager.data.coins += BESTIARY_COMPLETE_DISCOVER_REWARD;
    completedDiscoverReward = BESTIARY_COMPLETE_DISCOVER_REWARD;
  }
  if (stats.defeatedCount >= stats.totalCount && !SaveManager.data.bestiaryRewardsClaimed.defeatedAll) {
    SaveManager.data.bestiaryRewardsClaimed.defeatedAll = true;
    SaveManager.data.coins += BESTIARY_COMPLETE_DEFEAT_REWARD;
    completedDefeatReward = BESTIARY_COMPLETE_DEFEAT_REWARD;
  }

  SaveManager.save();
  return { completedDiscoverReward, completedDefeatReward };
}

// ===== Mimic 50-Day Block Persistence & Atomic Reward =====
export function getMimicBlockInfo(day: number) {
  const safeDay = Math.max(1, Math.floor(day));
  const blockIndex = Math.floor((safeDay - 1) / 50);
  const minDay = blockIndex * 50 + 1;
  const maxDay = blockIndex * 50 + 50;
  const blockKey = `${minDay}-${maxDay}`;
  return { blockIndex, blockKey, minDay, maxDay };
}

function getEligibleMimicDaysInBlock(blockIndex: number): number[] {
  const minDay = blockIndex * 50 + 1;
  const maxDay = blockIndex * 50 + 50;

  if (blockIndex === 0) {
    // Pick randomly across existing stages in Days 1-50 (excluding boss days % 10 === 0 and Day 1 so run start isn't ambushed on sec 1)
    const stagePools: Record<AreaId, number[]> = {
      forest: [],
      cave: [],
      wasteland: [],
      abyss: [],
    };
    for (let d = 2; d <= 49; d++) {
      if (d % 10 === 0) continue;
      if (d <= 10) stagePools.forest.push(d);
      else if (d <= 20) stagePools.cave.push(d);
      else stagePools.wasteland.push(d);
    }
    const availableStages = ([stagePools.forest, stagePools.cave, stagePools.wasteland]).filter(
      (arr) => arr.length > 0
    );
    const chosenStagePool = availableStages[Math.floor(Math.random() * availableStages.length)];
    return chosenStagePool;
  }

  const days: number[] = [];
  for (let d = minDay; d <= maxDay; d++) {
    if (d % 10 !== 0) days.push(d);
  }
  return days;
}

export function getOrPlanMimicDayForBlock(day: number): number {
  const { blockIndex, blockKey, minDay, maxDay } = getMimicBlockInfo(day);
  const existing = SaveManager.data.mimicState.plannedDayByBlock[blockKey];
  if (existing && existing >= minDay && existing <= maxDay && existing % 10 !== 0) {
    return existing;
  }
  const pool = getEligibleMimicDaysInBlock(blockIndex);
  const picked = pool[Math.floor(Math.random() * pool.length)] ?? minDay + 1;
  SaveManager.data.mimicState.plannedDayByBlock[blockKey] = picked;
  SaveManager.save();
  return picked;
}

export function shouldSpawnMimicToday(day: number): { shouldSpawn: boolean; blockKey: string } {
  const safeDay = Math.max(1, Math.floor(day));
  const { blockKey } = getMimicBlockInfo(safeDay);
  if (safeDay % 10 === 0) {
    return { shouldSpawn: false, blockKey };
  }
  const ms = SaveManager.data.mimicState;
  if (
    ms.spawnedBlocks.includes(blockKey) ||
    ms.defeatedBlocks.includes(blockKey) ||
    ms.rewardedBlocks.includes(blockKey)
  ) {
    return { shouldSpawn: false, blockKey };
  }
  const plannedDay = getOrPlanMimicDayForBlock(safeDay);
  // Trigger on plannedDay (or immediately if somehow past plannedDay inside the same unspawned block)
  return { shouldSpawn: safeDay >= plannedDay, blockKey };
}

export function markMimicSpawned(blockKey: string): void {
  const ms = SaveManager.data.mimicState;
  if (!ms.spawnedBlocks.includes(blockKey)) {
    ms.spawnedBlocks.push(blockKey);
    SaveManager.save();
  }
}

export function resolveMimicRewardAtomic(blockKey: string): MimicRewardSummary | null {
  const ms = SaveManager.data.mimicState;
  if (ms.rewardedBlocks.includes(blockKey)) {
    return null;
  }
  if (!ms.spawnedBlocks.includes(blockKey)) ms.spawnedBlocks.push(blockKey);
  if (!ms.defeatedBlocks.includes(blockKey)) ms.defeatedBlocks.push(blockKey);
  ms.rewardedBlocks.push(blockKey);
  ms.totalMimicDefeated += 1;

  const ownedSet = new Set(SaveManager.data.ownedEquipment);
  const unowned = EQUIPMENT_DB.filter((item) => !ownedSet.has(item.id));
  const rollEquip = Math.random() < 0.3 && unowned.length > 0;

  let summary: MimicRewardSummary;
  if (rollEquip) {
    const picked = unowned[Math.floor(Math.random() * unowned.length)];
    SaveManager.data.ownedEquipment.push(picked.id);
    summary = {
      blockKey,
      rewardType: "equipment",
      coinsGained: 0,
      equipment: picked,
    };
  } else {
    SaveManager.data.coins += MIMIC_COIN_REWARD;
    summary = {
      blockKey,
      rewardType: "coins",
      coinsGained: MIMIC_COIN_REWARD,
      equipment: null,
    };
  }

  SaveManager.save();
  return summary;
}

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

export const SECRET_COIN_REWARD = 999999;

export interface SecretUnlockResult {
  alreadyUnlocked: boolean;
  newlyUnlockedCount: number;
  totalWeaponsCount: number;
  coinsAdded: number;
}

let secretUnlockLock = false;

export function unlockAllWeaponsSecret(): SecretUnlockResult {
  const allWeapons = EQUIPMENT_DB.filter((item) => CATEGORY_TO_SLOT[item.category] === "weapon");
  const totalWeaponsCount = allWeapons.length;

  if (secretUnlockLock || SaveManager.data.secretWeaponsUnlocked) {
    return {
      alreadyUnlocked: true,
      newlyUnlockedCount: 0,
      totalWeaponsCount,
      coinsAdded: 0,
    };
  }

  secretUnlockLock = true;
  try {
    const ownedSet = new Set(SaveManager.data.ownedEquipment);
    let newlyUnlockedCount = 0;

    for (const weapon of allWeapons) {
      if (!ownedSet.has(weapon.id)) {
        ownedSet.add(weapon.id);
        SaveManager.data.ownedEquipment.push(weapon.id);
        newlyUnlockedCount += 1;
      }
    }

    const prevCoins = sanitizeNonNegInt(SaveManager.data.coins, 0);
    SaveManager.data.coins = prevCoins + SECRET_COIN_REWARD;
    SaveManager.data.secretWeaponsUnlocked = true;
    SaveManager.save();

    return {
      alreadyUnlocked: false,
      newlyUnlockedCount,
      totalWeaponsCount,
      coinsAdded: SECRET_COIN_REWARD,
    };
  } finally {
    secretUnlockLock = false;
  }
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

export function evaluateAchievements(
  onUnlock?: (ach: AchievementDef) => void
): AchievementDef[] {
  const newlyUnlocked: AchievementDef[] = [];
  for (const ach of ACHIEVEMENTS_DB) {
    if (!SaveManager.data.achievements.includes(ach.id) && ach.check(SaveManager.data)) {
      SaveManager.data.achievements.push(ach.id);
      if (ach.rewardCoins > 0) {
        SaveManager.data.coins += ach.rewardCoins;
      }
      newlyUnlocked.push(ach);
      onUnlock?.(ach);
    }
  }
  if (newlyUnlocked.length > 0) {
    SaveManager.save();
  }
  return newlyUnlocked;
}

export function equipEquipmentItem(itemId: string): EquipmentItem | null {
  const item = getEquipmentById(itemId);
  if (!item) return null;
  if (!SaveManager.data.ownedEquipment.includes(item.id)) return null;
  const slot = CATEGORY_TO_SLOT[item.category];
  SaveManager.data.equipped[slot] = item.id;
  SaveManager.save();
  return item;
}
