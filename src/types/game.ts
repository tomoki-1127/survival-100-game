export type EquipCategory =
  | "剣"
  | "大剣"
  | "槍"
  | "斧"
  | "弓"
  | "杖"
  | "盾"
  | "頭防具"
  | "胴防具"
  | "アクセサリー";

export type EquipSlot = "weapon" | "shield" | "head" | "body" | "accessory";

export type Rarity = "ノーマル" | "レア" | "エピック" | "レジェンダリー";

export type AttackStyle = "slash" | "cleave" | "thrust" | "spin" | "arrow" | "magic";

export interface StatBlock {
  atk?: number;
  maxHp?: number;
  def?: number;
  atkSpeed?: number;
  moveSpeed?: number;
  regen?: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: EquipCategory;
  rarity: Rarity;
  price: number;
  stats: StatBlock;
  range?: number;
  attackStyle?: AttackStyle;
  desc: string;
}

export type PermUpgradeKey = "atk" | "maxHp" | "def" | "atkSpeed" | "moveSpeed" | "coinBonus";

export interface PermUpgradeDef {
  id: PermUpgradeKey;
  name: string;
  baseCost: number;
  costScale: number;
  maxLv: number;
  perLv: number;
  unit: string;
  desc: string;
}

export interface AreaDef {
  id: string;
  name: string;
  minDay: number;
  bg: string;
  tile: string;
  accent: string;
  particle: string;
  propType: "forest" | "cave" | "wasteland" | "abyss";
}

export type MonsterTier = "通常" | "強敵" | "ボス" | "最終ボス";

export interface MonsterDef {
  id: string;
  name: string;
  type: MonsterTier;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  radius: number;
  xp: number;
  coins: number;
  minDay: number;
  color: string;
  attackRange: number;
  atkCd: number;
  shoots?: boolean;
  isBoss?: boolean;
  desc: string;
}

export type CompanionRole = "剣士" | "弓使い" | "魔法使い" | "騎士" | "僧侶";

export interface CompanionDef {
  id: string;
  name: string;
  role: CompanionRole;
  unlockDay: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  range: number;
  cd: number;
  color: string;
  desc: string;
}

export interface SaveData {
  version: number;
  coins: number;
  ownedEquipment: string[];
  equipped: Record<EquipSlot, string | null>;
  permUpgrades: Record<PermUpgradeKey, number>;
  bestDay: number;
  bestiary: Record<string, number>;
  achievements: string[];
  unlockedCompanions: string[];
  secretWeaponsUnlocked?: boolean;
  stats: {
    totalKills: number;
    totalRuns: number;
    boss100Defeated: boolean;
  };
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (save: SaveData) => boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  radius: number;
  facingAngle: number;
  facingX: number;
  walkPhase: number;
  attackAnimTimer: number;
  level: number;
  xp: number;
  nextXp: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  moveSpeed: number;
  regen: number;
  range: number;
  attackStyle: AttackStyle;
  atkTimer: number;
  hitFlash: number;
  runBonus: {
    atk: number;
    maxHp: number;
    def: number;
    atkSpeed: number;
    moveSpeed: number;
    regen: number;
    lifeOnKill: number;
  };
  runMult: {
    atk: number;
    atkSpeed: number;
    range: number;
  };
  healAmountOnRecalc: number;
  healRatioOnRecalc: number;
}

export interface PerkDef {
  id: string;
  title: string;
  desc: string;
  apply: (player: PlayerState) => void;
}

export interface EnemyEntity {
  id: string;
  name: string;
  isBoss: boolean;
  isFinalBoss: boolean;
  shoots: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  xp: number;
  coins: number;
  color: string;
  attackRange: number;
  atkCd: number;
  atkTimer: number;
  specialTimer: number;
  telegraph: {
    x: number;
    y: number;
    radius: number;
    timer: number;
    maxTimer: number;
  } | null;
  hitFlash: number;
  bobPhase: number;
  facingX: number;
  attackAnimTimer: number;
}

export interface CompanionEntity extends CompanionDef {
  x: number;
  y: number;
  maxHp: number;
  atkTimer: number;
  downed: boolean;
  hitFlash: number;
  facingX: number;
  attackAnimTimer: number;
}

export interface ProjectileEntity {
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  dmg: number;
  aoe: number;
  color: string;
  life: number;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  arc: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface ParticleEffect {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface DeathEffect {
  spriteId: string;
  isBoss: boolean;
  x: number;
  y: number;
  radius: number;
  facingX: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface GroundProp {
  x: number;
  y: number;
  size: number;
  kind: number;
  seed: number;
}

export interface HudSnapshot {
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  nextXp: number;
  coins: number;
  runCoins: number;
  day: number;
  dayProgress: number;
  isBossDay: boolean;
  areaName: string;
  elapsedTotal: number;
  weaponName: string;
  skillCooldown: number;
  skillMaxCd: number;
  potionCharges: number;
  potionMaxCharges: number;
  potionCooldown: number;
  boss: { name: string; hp: number; maxHp: number } | null;
  playerStats: {
    atk: number;
    def: number;
    atkSpeed: number;
    moveSpeed: number;
    regen: number;
    range: number;
  };
  companionCount: number;
}
