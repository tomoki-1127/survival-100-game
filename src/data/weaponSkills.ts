import type { EquipCategory, Rarity } from "../types/game";

export interface WeaponSkillDef {
  id: string;
  category: EquipCategory;
  name: string;
  shortName: string;
  cooldown: number;
  color: string;
  desc: string;
}

export const WEAPON_SKILL_MAP: Record<string, WeaponSkillDef> = {
  剣: {
    id: "sword_combo",
    category: "剣",
    name: "連迅斬り",
    shortName: "連迅斬り",
    cooldown: 6.0,
    color: "#38bdf8",
    desc: "前方へ素早い3連続の斬撃を浴びせる",
  },
  大剣: {
    id: "greatsword_cleave",
    category: "大剣",
    name: "覇王烈斬",
    shortName: "覇王烈斬",
    cooldown: 8.5,
    color: "#f87171",
    desc: "前方の広範囲を粉砕する超重撃の一閃",
  },
  槍: {
    id: "spear_charge",
    category: "槍",
    name: "疾風穿孔",
    shortName: "疾風穿孔",
    cooldown: 6.5,
    color: "#60a5fa",
    desc: "前方へ直線突進し進路上の敵を一気に貫く",
  },
  斧: {
    id: "axe_quake",
    category: "斧",
    name: "大地砕き",
    shortName: "大地砕き",
    cooldown: 8.0,
    color: "#fb923c",
    desc: "地面を強打し周囲360°に衝撃波を放つ",
  },
  弓: {
    id: "bow_volley",
    category: "弓",
    name: "貫通流星矢",
    shortName: "流星矢",
    cooldown: 6.5,
    color: "#a3e635",
    desc: "敵を貫通する5本の矢を扇状に連射する",
  },
  杖: {
    id: "staff_nova",
    category: "杖",
    name: "メテオノヴァ",
    shortName: "魔導爆発",
    cooldown: 8.0,
    color: "#c084fc",
    desc: "敵集団の中心に強力な範囲魔法爆発を放つ",
  },
};

export function getWeaponSkillDef(category: EquipCategory): WeaponSkillDef {
  return WEAPON_SKILL_MAP[category] || WEAPON_SKILL_MAP["剣"];
}

export interface RarityVisualTheme {
  glow: string;
  core: string;
  accent: string;
  sparkCount: number;
  auraRadius: number;
}

export const RARITY_VISUAL_MAP: Record<Rarity, RarityVisualTheme> = {
  ノーマル: {
    glow: "rgba(226, 232, 240, 0.28)",
    core: "#f8fafc",
    accent: "#cbd5e1",
    sparkCount: 3,
    auraRadius: 0,
  },
  レア: {
    glow: "rgba(56, 189, 248, 0.55)",
    core: "#e0f2fe",
    accent: "#38bdf8",
    sparkCount: 6,
    auraRadius: 12,
  },
  エピック: {
    glow: "rgba(192, 132, 252, 0.68)",
    core: "#fae8ff",
    accent: "#c084fc",
    sparkCount: 9,
    auraRadius: 15,
  },
  レジェンダリー: {
    glow: "rgba(250, 204, 21, 0.85)",
    core: "#fef9c3",
    accent: "#facc15",
    sparkCount: 13,
    auraRadius: 19,
  },
};

export function getRarityVisualTheme(rarity: Rarity): RarityVisualTheme {
  return RARITY_VISUAL_MAP[rarity] || RARITY_VISUAL_MAP["ノーマル"];
}
