export const HERO_SPRITE_PATH = "/assets/characters/hero-swordsman.png";
export const HERO_PORTRAIT_PATH = "/assets/characters/hero-portrait.png";

export const COMPANION_SPRITE_MAP: Record<string, string> = {
  swordsman: "/assets/characters/companion-swordsman.png",
  archer: "/assets/characters/companion-archer.png",
  mage: "/assets/characters/companion-mage.png",
  knight: "/assets/characters/companion-knight.png",
  priest: "/assets/characters/companion-priest.png",
};

export const MONSTER_SPRITE_MAP: Record<string, string> = {
  slime: "/assets/monsters/monster-slime.png",
  goblin: "/assets/monsters/monster-goblin.png",
  skeleton: "/assets/monsters/monster-skeleton.png",
  elite_brute: "/assets/monsters/monster-elite-brute.png",
  boss_mid: "/assets/monsters/monster-boss-mid.png",
  boss_100: "/assets/monsters/monster-boss-100.png",
};

export const AREA_BG_MAP: Record<string, string> = {
  forest: "/assets/backgrounds/bg-forest.png",
  cave: "/assets/backgrounds/bg-cave.png",
  wasteland: "/assets/backgrounds/bg-wasteland.png",
  abyss: "/assets/backgrounds/bg-abyss.png",
};

export const AREA_PROP_MAP: Record<string, string> = {
  forest: "/assets/backgrounds/prop-forest.png",
  cave: "/assets/backgrounds/prop-cave.png",
  wasteland: "/assets/backgrounds/prop-wasteland.png",
  abyss: "/assets/backgrounds/prop-abyss.png",
};

export const SKILL_ICON_MAP = {
  whirlwind: "/assets/skills-effects/skill-whirlwind.png",
  potion: "/assets/skills-effects/skill-potion.png",
  autoAttack: "/assets/skills-effects/skill-auto-attack.png",
  defense: "/assets/skills-effects/skill-defense.png",
} as const;

export const EQUIPMENT_ICON_MAP: Record<string, string> = {
  // 剣
  wp_sword_apprentice: "/assets/weapons/wp-sword-apprentice.png",
  wp_sword_iron: "/assets/weapons/wp-sword-iron.png",
  wp_sword_flame: "/assets/weapons/wp-sword-flame.png",
  wp_sword_excalibur: "/assets/weapons/wp-sword-excalibur.png",
  // 大剣
  wp_greatsword_steel: "/assets/weapons/wp-greatsword-steel.png",
  wp_greatsword_titan: "/assets/weapons/wp-greatsword-titan.png",
  wp_greatsword_ragnarok: "/assets/weapons/wp-greatsword-ragnarok.png",
  // 槍
  wp_spear_hunter: "/assets/weapons/wp-spear-hunter.png",
  wp_spear_wind: "/assets/weapons/wp-spear-wind.png",
  wp_spear_dragon: "/assets/weapons/wp-spear-dragon.png",
  // 斧
  wp_axe_wood: "/assets/weapons/wp-axe-wood.png",
  wp_axe_battle: "/assets/weapons/wp-axe-battle.png",
  wp_axe_berserk: "/assets/weapons/wp-axe-berserk.png",
  // 弓
  wp_bow_traveler: "/assets/weapons/wp-bow-traveler.png",
  wp_bow_hunter: "/assets/weapons/wp-bow-hunter.png",
  wp_bow_elf: "/assets/weapons/wp-bow-elf.png",
  // 杖
  wp_staff_apprentice: "/assets/weapons/wp-staff-apprentice.png",
  wp_staff_azure: "/assets/weapons/wp-staff-azure.png",
  wp_staff_crimson: "/assets/weapons/wp-staff-crimson.png",
  // 盾
  sh_wood: "/assets/armors/sh-wood.png",
  sh_knight: "/assets/armors/sh-knight.png",
  sh_aegis: "/assets/armors/sh-aegis.png",
  // 頭防具
  hd_hood: "/assets/armors/hd-hood.png",
  hd_helm: "/assets/armors/hd-helm.png",
  hd_crown: "/assets/armors/hd-crown.png",
  // 胴防具
  bd_tunic: "/assets/armors/bd-tunic.png",
  bd_plate: "/assets/armors/bd-plate.png",
  bd_dragon: "/assets/armors/bd-dragon.png",
  // アクセサリー
  ac_ring_life: "/assets/armors/ac-ring-life.png",
  ac_anklet: "/assets/armors/ac-anklet.png",
  ac_amulet: "/assets/armors/ac-amulet.png",
  ac_phoenix: "/assets/armors/ac-phoenix.png",
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
  ];
  for (const p of paths) {
    getLoadedSprite(p);
  }
}
