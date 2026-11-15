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
  id: AreaId;
  name: string;
  minDay: number;
  bg: string;
  tile: string;
  accent: string;
  particle: string;
  propType: "forest" | "cave" | "wasteland" | "abyss";
}

export type MonsterTier = "通常" | "レア" | "強敵" | "ボス" | "最終ボス" | "特殊";

export type MonsterElement =
  | "無"
  | "毒"
  | "炎"
  | "氷"
  | "雷"
  | "闇"
  | "水"
  | "土"
  | "植物"
  | "魔力"
  | "複合";

export type MonsterAttackPattern =
  | "melee"
  | "split"
  | "poison"
  | "ranged"
  | "heavy_melee"
  | "fast_melee"
  | "charge"
  | "rapid_combo"
  | "phase_dash"
  | "drain"
  | "curse_magic"
  | "fire_aoe"
  | "freeze"
  | "chain_lightning"
  | "slow_slam"
  | "mud_slow"
  | "armor_slam"
  | "root_snare"
  | "homing_orb"
  | "swarm"
  | "dive_bomb"
  | "charm_bolt"
  | "fire_bolt"
  | "shadow_combo"
  | "shield_charge"
  | "soul_slash"
  | "ambush"
  | "burrow_breach"
  | "tidal_surge"
  | "multi_element"
  | "fire_breath"
  | "elite_magic"
  | "stage_boss"
  | "final_boss";

export type AreaId = "forest" | "cave" | "wasteland" | "abyss";

export interface MonsterDef {
  id: string;
  name: string;
  nameEn?: string;
  type: MonsterTier;
  element: MonsterElement;
  danger: 1 | 2 | 3 | 4 | 5;
  areas: AreaId[];
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
  attackPattern: MonsterAttackPattern;
  attackMethodDesc: string;
  specialAbilityDesc: string;
  shoots?: boolean;
  isBoss?: boolean;
  isStageBoss?: boolean;
  desc: string;
}

export interface BestiaryRecord {
  encounters: number;
  kills: number;
  lastDay: number;
  maxDefeatedLevel: number;
}

export interface MimicState {
  plannedDayByBlock: Record<string, number>;
  spawnedBlocks: string[];
  defeatedBlocks: string[];
  rewardedBlocks: string[];
  totalMimicDefeated: number;
}

export type GameSpeed = 1 | 2 | 3;

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
  bestiaryRecords: Record<string, BestiaryRecord>;
  mimicState: MimicState;
  bestiaryRewardsClaimed: {
    discoveredAll: boolean;
    defeatedAll: boolean;
  };
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
  rewardCoins: number;
  check: (save: SaveData) => boolean;
}

export interface AudioSettings {
  bgmVolume: number;
  sfxVolume: number;
  bgmMuted: boolean;
  sfxMuted: boolean;
}

export interface PlayerState {
  x: number;
  y: number;
  radius: number;
  facingAngle: number;
  facingX: number;
  walkPhase: number;
  attackAnimTimer: number;
  skillAnimTimer: number;
  skillAnimMax: number;
  dashInvulnTimer: number;
  guardFlashTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  poisonDps: number;
  slowTimer: number;
  weaponId: string;
  weaponCategory: EquipCategory;
  weaponRarity: Rarity;
  shieldId: string | null;
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
  isStageBoss: boolean;
  isFinalBoss: boolean;
  isMimic?: boolean;
  mimicBlockKey?: string;
  shoots: boolean;
  attackPattern: MonsterAttackPattern;
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
  dashTimer: number;
  dashVx: number;
  dashVy: number;
  telegraph: {
    x: number;
    y: number;
    radius: number;
    timer: number;
    maxTimer: number;
    kind?: "aoe" | "fire" | "ice" | "lightning" | "mud" | "root" | "burrow" | "charge";
    dmgMult?: number;
    slowSec?: number;
  } | null;
  hitFlash: number;
  bobPhase: number;
  facingX: number;
  attackAnimTimer: number;
  isSplitChild?: boolean;
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
  piercing?: boolean;
  homing?: boolean;
  homingTurn?: number;
  lifesteal?: number;
  sourceEnemy?: EnemyEntity;
  statusEffect?: "poison" | "freeze" | "mud" | "burn";
  hitTargets?: Set<EnemyEntity>;
  visualKind?:
    | "arrow"
    | "pierce_arrow"
    | "magic"
    | "enemy"
    | "poison"
    | "fire"
    | "ice"
    | "lightning"
    | "arcane"
    | "water";
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
  kind?:
    | "slash"
    | "cleave"
    | "thrust"
    | "spin"
    | "shockwave"
    | "magic_nova"
    | "guard"
    | "enemy_slash"
    | "lightning_bolt"
    | "tidal"
    | "bite";
  rarity?: Rarity;
  length?: number;
  targetX?: number;
  targetY?: number;
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

export interface MimicRewardSummary {
  blockKey: string;
  rewardType: "coins" | "equipment";
  coinsGained: number;
  equipment: EquipmentItem | null;
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
  gameSpeed: GameSpeed;
  mimicActive: boolean;
  playerDebuffs: {
    poisoned: boolean;
    slowed: boolean;
  };
  weaponId: string;
  weaponName: string;
  weaponCategory: EquipCategory;
  weaponRarity: Rarity;
  shieldId: string | null;
  skillName: string;
  skillDesc: string;
  skillColor: string;
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
