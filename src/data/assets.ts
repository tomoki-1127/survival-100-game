const RAW_BASE = import.meta.env?.BASE_URL || "/";
const NORMALIZED_BASE = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;

export function assetUrl(relativePath: string): string {
  return `${NORMALIZED_BASE}${relativePath.replace(/^\/+/, "")}`;
}

// 1. characters: プレイヤーキャラクター
export const HERO_SPRITE_PATH = assetUrl("assets/characters/hero-swordsman.png");

// 2. ui: UIアイコン・ポートレート・装飾
export const HERO_PORTRAIT_PATH = assetUrl("assets/ui/hero-portrait.png");

// 3. companions: 仲間キャラクター
export const COMPANION_SPRITE_MAP: Record<string, string> = {
  swordsman: assetUrl("assets/companions/companion-swordsman.png"),
  archer: assetUrl("assets/companions/companion-archer.png"),
  mage: assetUrl("assets/companions/companion-mage.png"),
  knight: assetUrl("assets/companions/companion-knight.png"),
  priest: assetUrl("assets/companions/companion-priest.png"),
};

// 4. monsters: 敵・ボス
export const MONSTER_SPRITE_MAP: Record<string, string> = {
  slime: assetUrl("assets/monsters/monster-slime.png"),
  goblin: assetUrl("assets/monsters/monster-goblin.png"),
  skeleton: assetUrl("assets/monsters/monster-skeleton.png"),
  elite_brute: assetUrl("assets/monsters/monster-elite-brute.png"),
  boss_mid: assetUrl("assets/monsters/monster-boss-mid.png"),
  boss_100: assetUrl("assets/monsters/monster-boss-100.png"),
};

// 5. backgrounds: 各エリアの背景・環境オブジェクト
export const AREA_BG_MAP: Record<string, string> = {
  forest: assetUrl("assets/backgrounds/bg-forest.png"),
  cave: assetUrl("assets/backgrounds/bg-cave.png"),
  wasteland: assetUrl("assets/backgrounds/bg-wasteland.png"),
  abyss: assetUrl("assets/backgrounds/bg-abyss.png"),
};

export const AREA_PROP_MAP: Record<string, string> = {
  forest: assetUrl("assets/backgrounds/prop-forest.png"),
  cave: assetUrl("assets/backgrounds/prop-cave.png"),
  wasteland: assetUrl("assets/backgrounds/prop-wasteland.png"),
  abyss: assetUrl("assets/backgrounds/prop-abyss.png"),
};

// 6. effects & ui: スキル・攻撃エフェクト／UIアイコン
export const SKILL_ICON_MAP = {
  whirlwind: assetUrl("assets/effects/skill-whirlwind.png"),
  autoAttack: assetUrl("assets/effects/skill-auto-attack.png"),
  potion: assetUrl("assets/ui/skill-potion.png"),
  defense: assetUrl("assets/ui/skill-defense.png"),
} as const;

// 7. weapons & armors: 武器・防具・盾・アクセサリー（装備ショップ・装備欄専用）
export const EQUIPMENT_ICON_MAP: Record<string, string> = {
  // weapons: 剣
  wp_sword_apprentice: assetUrl("assets/weapons/wp-sword-apprentice.png"),
  wp_sword_iron: assetUrl("assets/weapons/wp-sword-iron.png"),
  wp_sword_flame: assetUrl("assets/weapons/wp-sword-flame.png"),
  wp_sword_excalibur: assetUrl("assets/weapons/wp-sword-excalibur.png"),
  // weapons: 大剣
  wp_greatsword_steel: assetUrl("assets/weapons/wp-greatsword-steel.png"),
  wp_greatsword_titan: assetUrl("assets/weapons/wp-greatsword-titan.png"),
  wp_greatsword_ragnarok: assetUrl("assets/weapons/wp-greatsword-ragnarok.png"),
  // weapons: 槍
  wp_spear_hunter: assetUrl("assets/weapons/wp-spear-hunter.png"),
  wp_spear_wind: assetUrl("assets/weapons/wp-spear-wind.png"),
  wp_spear_dragon: assetUrl("assets/weapons/wp-spear-dragon.png"),
  // weapons: 斧
  wp_axe_wood: assetUrl("assets/weapons/wp-axe-wood.png"),
  wp_axe_battle: assetUrl("assets/weapons/wp-axe-battle.png"),
  wp_axe_berserk: assetUrl("assets/weapons/wp-axe-berserk.png"),
  // weapons: 弓
  wp_bow_traveler: assetUrl("assets/weapons/wp-bow-traveler.png"),
  wp_bow_hunter: assetUrl("assets/weapons/wp-bow-hunter.png"),
  wp_bow_elf: assetUrl("assets/weapons/wp-bow-elf.png"),
  // weapons: 杖
  wp_staff_apprentice: assetUrl("assets/weapons/wp-staff-apprentice.png"),
  wp_staff_azure: assetUrl("assets/weapons/wp-staff-azure.png"),
  wp_staff_crimson: assetUrl("assets/weapons/wp-staff-crimson.png"),
  // armors: 盾
  sh_wood: assetUrl("assets/armors/sh-wood.png"),
  sh_knight: assetUrl("assets/armors/sh-knight.png"),
  sh_aegis: assetUrl("assets/armors/sh-aegis.png"),
  // armors: 頭防具
  hd_hood: assetUrl("assets/armors/hd-hood.png"),
  hd_helm: assetUrl("assets/armors/hd-helm.png"),
  hd_crown: assetUrl("assets/armors/hd-crown.png"),
  // armors: 胴防具
  bd_tunic: assetUrl("assets/armors/bd-tunic.png"),
  bd_plate: assetUrl("assets/armors/bd-plate.png"),
  bd_dragon: assetUrl("assets/armors/bd-dragon.png"),
  // armors: アクセサリー
  ac_ring_life: assetUrl("assets/armors/ac-ring-life.png"),
  ac_anklet: assetUrl("assets/armors/ac-anklet.png"),
  ac_amulet: assetUrl("assets/armors/ac-amulet.png"),
  ac_phoenix: assetUrl("assets/armors/ac-phoenix.png"),
};

interface CachedSprite {
  img: HTMLImageElement;
  loaded: boolean;
  broken: boolean;
}

const spriteMap = new Map<string, CachedSprite>();

export function getLoadedSprite(path: string | undefined): HTMLImageElement | null {
  if (!path || typeof Image === "undefined") return null;
  let entry = spriteMap.get(path);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false, broken: false };
    img.onload = () => {
      if (entry) entry.loaded = true;
    };
    img.onerror = () => {
      if (entry) entry.broken = true;
    };
    img.src = path;
    spriteMap.set(path, entry);
  }
  if (entry.broken || !entry.loaded || !entry.img.complete || entry.img.naturalWidth === 0) {
    return null;
  }
  return entry.img;
}

export function preloadCoreGameAssets(): void {
  const paths = [
    HERO_SPRITE_PATH,
    HERO_PORTRAIT_PATH,
    ...Object.values(COMPANION_SPRITE_MAP),
    ...Object.values(MONSTER_SPRITE_MAP),
    ...Object.values(AREA_BG_MAP),
    ...Object.values(AREA_PROP_MAP),
    ...Object.values(SKILL_ICON_MAP),
  ];
  for (const p of paths) {
    getLoadedSprite(p);
  }
}
