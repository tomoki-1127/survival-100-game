import type { AchievementDef, CompanionDef, PerkDef, PermUpgradeDef, SaveData } from "../types/game";

export const PERM_UPGRADES_DB: PermUpgradeDef[] = [
  {
    id: "atk",
    name: "初期攻撃力",
    baseCost: 3000,
    costScale: 1.42,
    maxLv: 30,
    perLv: 3,
    unit: "",
    desc: "冒険開始時の基礎攻撃力 +3",
  },
  {
    id: "maxHp",
    name: "初期HP",
    baseCost: 2500,
    costScale: 1.4,
    maxLv: 30,
    perLv: 18,
    unit: "",
    desc: "冒険開始時の最大HP +18",
  },
  {
    id: "def",
    name: "初期防御力",
    baseCost: 3000,
    costScale: 1.42,
    maxLv: 25,
    perLv: 1.5,
    unit: "",
    desc: "冒険開始時の防御力 +1.5",
  },
  {
    id: "atkSpeed",
    name: "初期攻撃速度",
    baseCost: 4000,
    costScale: 1.45,
    maxLv: 20,
    perLv: 0.08,
    unit: "/秒",
    desc: "攻撃速度 +0.08/秒",
  },
  {
    id: "moveSpeed",
    name: "初期移動速度",
    baseCost: 3500,
    costScale: 1.42,
    maxLv: 15,
    perLv: 8,
    unit: "",
    desc: "移動速度 +8",
  },
  {
    id: "coinBonus",
    name: "コイン獲得量",
    baseCost: 4500,
    costScale: 1.45,
    maxLv: 20,
    perLv: 10,
    unit: "%",
    desc: "獲得コイン量 +10%",
  },
];

// 150日目以降、50日ごとに救出できる仲間システム定義
export const COMPANION_CLASSES: Record<string, CompanionDef> = {
  swordsman: {
    id: "swordsman",
    name: "剣士アレン",
    role: "剣士",
    unlockDay: 150,
    hp: 260,
    atk: 34,
    def: 8,
    speed: 155,
    range: 70,
    cd: 0.85,
    color: "#38bdf8",
    desc: "近距離攻撃で前線を支える。",
  },
  archer: {
    id: "archer",
    name: "弓使いリナ",
    role: "弓使い",
    unlockDay: 200,
    hp: 190,
    atk: 28,
    def: 5,
    speed: 160,
    range: 260,
    cd: 0.9,
    color: "#4ade80",
    desc: "遠距離から精密な矢を放つ。",
  },
  mage: {
    id: "mage",
    name: "魔導士セレス",
    role: "魔法使い",
    unlockDay: 250,
    hp: 180,
    atk: 40,
    def: 4,
    speed: 150,
    range: 230,
    cd: 1.35,
    color: "#c084fc",
    desc: "範囲魔法で敵の群れを焼き払う。",
  },
  knight: {
    id: "knight",
    name: "重騎士ガロン",
    role: "騎士",
    unlockDay: 300,
    hp: 460,
    atk: 24,
    def: 18,
    speed: 135,
    range: 65,
    cd: 1.1,
    color: "#fbbf24",
    desc: "高い防御力で敵を引きつける。",
  },
  priest: {
    id: "priest",
    name: "僧侶ミリア",
    role: "僧侶",
    unlockDay: 350,
    hp: 220,
    atk: 16,
    def: 7,
    speed: 150,
    range: 180,
    cd: 3.0,
    color: "#f472b6",
    desc: "味方とプレイヤーのHPを回復する。",
  },
};

export const LEVEL_UP_PERKS: PerkDef[] = [
  {
    id: "atk_up",
    title: "剛腕の覚醒",
    desc: "攻撃力 +5",
    apply: (p) => {
      p.runBonus.atk += 5;
    },
  },
  {
    id: "atk_pct",
    title: "戦士の気迫",
    desc: "攻撃力 +14%",
    apply: (p) => {
      p.runMult.atk += 0.14;
    },
  },
  {
    id: "hp_up",
    title: "生命の泉",
    desc: "最大HP +35 ＆ HP35回復",
    apply: (p) => {
      p.runBonus.maxHp += 35;
      p.healAmountOnRecalc += 35;
    },
  },
  {
    id: "def_up",
    title: "鉄壁の守り",
    desc: "防御力 +3",
    apply: (p) => {
      p.runBonus.def += 3;
    },
  },
  {
    id: "as_up",
    title: "連撃の極意",
    desc: "攻撃速度 +15%",
    apply: (p) => {
      p.runMult.atkSpeed += 0.15;
    },
  },
  {
    id: "ms_up",
    title: "疾風の歩法",
    desc: "移動速度 +18",
    apply: (p) => {
      p.runBonus.moveSpeed += 18;
    },
  },
  {
    id: "regen_up",
    title: "再生の祝福",
    desc: "自動回復 +1.5 HP/秒",
    apply: (p) => {
      p.runBonus.regen += 1.5;
    },
  },
  {
    id: "range_up",
    title: "武器熟練",
    desc: "攻撃範囲 +18% ＆ 攻撃力 +2",
    apply: (p) => {
      p.runMult.range += 0.18;
      p.runBonus.atk += 2;
    },
  },
  {
    id: "vamp",
    title: "吸収の紋章",
    desc: "敵撃破時 HP +2 回復",
    apply: (p) => {
      p.runBonus.lifeOnKill += 2;
    },
  },
  {
    id: "full_heal",
    title: "応急大回復",
    desc: "HPを50%回復 ＆ 防御力 +1.5",
    apply: (p) => {
      p.runBonus.def += 1.5;
      p.healRatioOnRecalc += 0.5;
    },
  },
];

export const BESTIARY_COMPLETE_DISCOVER_REWARD = 15000;
export const BESTIARY_COMPLETE_DEFEAT_REWARD = 35000;
export const TOTAL_REGISTERED_MONSTERS = 36;

function countDiscoveredMonsters(save: SaveData): number {
  let count = 0;
  for (const [id, rec] of Object.entries(save.bestiaryRecords || {})) {
    if (rec && (rec.encounters > 0 || rec.kills > 0 || (save.bestiary[id] || 0) > 0)) {
      count += 1;
    }
  }
  return count;
}

function countDefeatedSpecies(save: SaveData): number {
  let count = 0;
  for (const [id, rec] of Object.entries(save.bestiaryRecords || {})) {
    if ((rec?.kills || 0) > 0 || (save.bestiary[id] || 0) > 0) {
      count += 1;
    }
  }
  return count;
}

export const ACHIEVEMENTS_DB: AchievementDef[] = [
  {
    id: "first_blood",
    name: "初陣",
    desc: "モンスターを1体倒す",
    rewardCoins: 150,
    check: (s) => s.stats.totalKills >= 1,
  },
  {
    id: "discover_1",
    name: "未知との遭遇",
    desc: "図鑑にモンスターを1種類登録する",
    rewardCoins: 200,
    check: (s) => countDiscoveredMonsters(s) >= 1,
  },
  {
    id: "discover_10",
    name: "生態調査員",
    desc: "図鑑で10種類のモンスターと遭遇する",
    rewardCoins: 1500,
    check: (s) => countDiscoveredMonsters(s) >= 10,
  },
  {
    id: "discover_20",
    name: "博物学者",
    desc: "図鑑で20種類のモンスターと遭遇する",
    rewardCoins: 4000,
    check: (s) => countDiscoveredMonsters(s) >= 20,
  },
  {
    id: "discover_30",
    name: "魔物博士",
    desc: "図鑑で30種類のモンスターと遭遇する",
    rewardCoins: 9000,
    check: (s) => countDiscoveredMonsters(s) >= 30,
  },
  {
    id: "mimic_first_kill",
    name: "トレジャーハンター",
    desc: "ミミックを初めて撃破する",
    rewardCoins: 5000,
    check: (s) =>
      (s.mimicState?.totalMimicDefeated || 0) >= 1 ||
      (s.bestiaryRecords?.exp_monster_26?.kills || 0) >= 1 ||
      (s.bestiary?.exp_monster_26 || 0) >= 1,
  },
  {
    id: "discover_all",
    name: "全魔物発見",
    desc: `図鑑の全${TOTAL_REGISTERED_MONSTERS}種類のモンスターと遭遇する`,
    rewardCoins: 15000,
    check: (s) => countDiscoveredMonsters(s) >= TOTAL_REGISTERED_MONSTERS,
  },
  {
    id: "kill_all",
    name: "図鑑完全制覇",
    desc: `図鑑の全${TOTAL_REGISTERED_MONSTERS}種類のモンスターを撃破する`,
    rewardCoins: 30000,
    check: (s) => countDefeatedSpecies(s) >= TOTAL_REGISTERED_MONSTERS,
  },
  {
    id: "slime_30",
    name: "スライムハンター",
    desc: "スライムを累計30体倒す",
    rewardCoins: 600,
    check: (s) => (s.bestiary.slime || 0) >= 30,
  },
  {
    id: "day_10",
    name: "最初の試練",
    desc: "10日目に到達する",
    rewardCoins: 1200,
    check: (s) => s.bestDay >= 10,
  },
  {
    id: "day_11",
    name: "洞窟の探索者",
    desc: "11日目（忘却の洞窟）に到達する",
    rewardCoins: 1800,
    check: (s) => s.bestDay >= 11,
  },
  {
    id: "day_21",
    name: "荒野の踏破者",
    desc: "21日目（焦熱の荒野）に到達する",
    rewardCoins: 3500,
    check: (s) => s.bestDay >= 21,
  },
  {
    id: "day_50",
    name: "半百の英雄",
    desc: "50日目に到達する",
    rewardCoins: 8000,
    check: (s) => s.bestDay >= 50,
  },
  {
    id: "day_100_clear",
    name: "SURVIVAL 100",
    desc: "100日目の魔王を撃破する",
    rewardCoins: 25000,
    check: (s) => s.stats.boss100Defeated,
  },
  {
    id: "gear_5",
    name: "装備コレクター",
    desc: "装備を合計5個以上所持する",
    rewardCoins: 2000,
    check: (s) => s.ownedEquipment.length >= 5,
  },
  {
    id: "perm_5",
    name: "鍛錬の証",
    desc: "恒久強化を合計5回購入する",
    rewardCoins: 2500,
    check: (s) =>
      Object.values(s.permUpgrades).reduce((a, b) => a + b, 0) >= 5,
  },
];
