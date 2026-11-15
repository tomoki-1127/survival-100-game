import {
  AREA_BG_MAP,
  AREA_PROP_MAP,
  COMPANION_SPRITE_MAP,
  EQUIPMENT_ICON_MAP,
  getLoadedSprite,
  HERO_SPRITE_PATH,
  MONSTER_SPRITE_MAP,
} from "../data/assets";
import { getAreaForDay } from "../data/monsters";
import { getRarityVisualTheme } from "../data/weaponSkills";
import type {
  AreaDef,
  CompanionEntity,
  DeathEffect,
  EnemyEntity,
  FloatingText,
  GroundProp,
  ParticleEffect,
  PlayerState,
  ProjectileEntity,
  SlashEffect,
} from "../types/game";

export interface RenderState {
  arenaSize: number;
  day: number;
  elapsedTotal: number;
  player: PlayerState | null;
  enemies: EnemyEntity[];
  companions: CompanionEntity[];
  projectiles: ProjectileEntity[];
  slashEffects: SlashEffect[];
  particles: ParticleEffect[];
  deathEffects: DeathEffect[];
  floatingTexts: FloatingText[];
  groundProps: GroundProp[];
  camera: { x: number; y: number };
  screenShake: number;
  weaponName: string;
}

// Reusable offscreen buffer for crisp white hit-flash tinting without bleeding onto canvas
let flashCanvas: HTMLCanvasElement | null = null;
let flashCtx: CanvasRenderingContext2D | null = null;

// Cached unarmed hero canvas (removes the baked-in blue sword blade so any equipped weapon renders cleanly)
let cachedUnarmedHeroSrc: HTMLImageElement | null = null;
let cachedUnarmedHeroCanvas: HTMLCanvasElement | null = null;

function getUnarmedHeroCanvas(heroImg: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  if (typeof document === "undefined") return heroImg;
  if (cachedUnarmedHeroSrc === heroImg && cachedUnarmedHeroCanvas) {
    return cachedUnarmedHeroCanvas;
  }

  const w = heroImg.naturalWidth || heroImg.width;
  const h = heroImg.naturalHeight || heroImg.height;
  if (!w || !h) return heroImg;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");
  if (!octx) return heroImg;

  octx.imageSmoothingEnabled = false;
  octx.drawImage(heroImg, 0, 0);

  try {
    const imgData = octx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const isCape = (px: number, py: number) => {
      if (px < 0 || px >= w || py < 0 || py >= h) return false;
      const idx = (py * w + px) * 4;
      return data[idx + 3] > 128 && data[idx] > data[idx + 1] + 30 && data[idx] > data[idx + 2] + 30;
    };

    const sx = w / 160;
    const sy = h / 160;

    for (let y = Math.floor(88 * sy); y <= Math.min(h - 1, Math.ceil(146 * sy)); y++) {
      for (let x = Math.floor(2 * sx); x <= Math.min(w - 1, Math.ceil(56 * sx)); x++) {
        const idx = (y * w + x) * 4;
        if (data[idx + 3] < 20) continue;
        if (isCape(x, y)) continue;

        const nx = x / sx;
        const ny = y / sy;

        // Preserve silver gauntlet upper cuff & right boot/greave
        if (ny <= 92 && nx >= 40 && data[idx + 2] >= data[idx]) continue;
        if (ny >= 112 && nx >= 47) continue;

        const lx = 48 - (ny - 92) * 0.96;
        const onBladeCorridor = ny >= 92 && Math.abs(nx - lx) <= 15.5 && nx <= 54;
        if (!onBladeCorridor) continue;

        let hasCapeL = false;
        let hasCapeR = false;
        for (let d = 1; d <= Math.ceil(12 * sx); d++) {
          if (isCape(x - d, y)) hasCapeL = true;
          if (isCape(x + d, y)) hasCapeR = true;
        }
        if (hasCapeL && hasCapeR && ny <= 126) {
          data[idx] = 94;
          data[idx + 1] = 16;
          data[idx + 2] = 22;
          data[idx + 3] = 255;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        }
      }
    }

    octx.putImageData(imgData, 0, 0);
    cachedUnarmedHeroSrc = heroImg;
    cachedUnarmedHeroCanvas = off;
    return off;
  } catch {
    return heroImg;
  }
}

function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  facingX: number,
  tilt = 0,
  flashAlpha = 0
) {
  ctx.save();
  ctx.translate(dx, dy);
  if (tilt !== 0) ctx.rotate(tilt);
  ctx.scale(facingX >= 0 ? 1 : -1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

  if (flashAlpha > 0.01 && typeof document !== "undefined") {
    if (!flashCanvas) {
      flashCanvas = document.createElement("canvas");
      flashCtx = flashCanvas.getContext("2d");
    }
    if (flashCanvas && flashCtx) {
      const pw = Math.max(1, Math.round(dw));
      const ph = Math.max(1, Math.round(dh));
      if (flashCanvas.width !== pw || flashCanvas.height !== ph) {
        flashCanvas.width = pw;
        flashCanvas.height = ph;
      }
      flashCtx.clearRect(0, 0, pw, ph);
      flashCtx.imageSmoothingEnabled = false;
      flashCtx.globalCompositeOperation = "source-over";
      flashCtx.drawImage(img, 0, 0, pw, ph);
      flashCtx.globalCompositeOperation = "source-atop";
      flashCtx.fillStyle = "#ffffff";
      flashCtx.fillRect(0, 0, pw, ph);
      ctx.globalAlpha = Math.min(0.85, flashAlpha);
      ctx.drawImage(flashCanvas, -dw / 2, -dh / 2, dw, dh);
    }
  }
  ctx.restore();
}

function drawSmallHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color = "#ef4444"
) {
  const clamped = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = "#090d16";
  ctx.fillRect(Math.round(x - w / 2 - 2), Math.round(y - 2), Math.round(w + 4), 7);
  ctx.strokeStyle = "#8f6b24";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x - w / 2 - 1.5), Math.round(y - 1.5), Math.round(w + 3), 6);
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w), 3);
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - w / 2), Math.round(y), Math.round(w * clamped), 3);
}

function drawGroundProp(ctx: CanvasRenderingContext2D, gp: GroundProp, area: AreaDef, elapsed: number) {
  const s = gp.size;
  if (gp.kind === 0) {
    const propImg = getLoadedSprite(AREA_PROP_MAP[area.id]);
    if (propImg) {
      const drawS = Math.round(s * 3.1);
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.beginPath();
      ctx.ellipse(gp.x, gp.y + drawS * 0.34, drawS * 0.38, drawS * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle torch/crystal ambient glow for cave, wasteland, abyss
      if (area.id === "cave" || area.id === "wasteland" || area.id === "abyss") {
        const pulse = 0.14 + Math.sin(elapsed * 3.5 + gp.seed) * 0.04;
        const glowColor =
          area.id === "cave"
            ? `rgba(56, 189, 248, ${pulse})`
            : area.id === "wasteland"
              ? `rgba(251, 146, 60, ${pulse})`
              : `rgba(244, 63, 94, ${pulse})`;
        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(gp.x, gp.y - drawS * 0.05, drawS * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(propImg, Math.round(gp.x - drawS / 2), Math.round(gp.y - drawS * 0.6), drawS, drawS);
      return;
    }
  }

  // Fallback / smaller secondary ground accents (wildflowers, pebbles, runes)
  if (area.propType === "forest") {
    if (gp.kind === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(gp.x + 2, gp.y + s * 0.45, s * 0.75, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b432b";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.65, 0, Math.PI * 2);
      ctx.fill();
    } else if (gp.kind === 1) {
      ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(196, 181, 253, 0.45)";
      ctx.fillRect(Math.round(gp.x - 2), Math.round(gp.y - 2), 3, 3);
      ctx.fillStyle = "rgba(250, 204, 21, 0.45)";
      ctx.fillRect(Math.round(gp.x + 3), Math.round(gp.y + 1), 2, 2);
    }
  } else if (area.propType === "cave") {
    ctx.fillStyle = gp.kind === 2 ? "rgba(96, 165, 250, 0.32)" : "rgba(30, 41, 59, 0.5)";
    ctx.fillRect(Math.round(gp.x - s * 0.22), Math.round(gp.y - s * 0.22), Math.round(s * 0.44), Math.round(s * 0.44));
  } else if (area.propType === "wasteland") {
    ctx.fillStyle = gp.kind === 2 ? "rgba(251, 146, 60, 0.24)" : "rgba(66, 42, 32, 0.55)";
    ctx.beginPath();
    ctx.ellipse(gp.x, gp.y, s * 0.45, s * 0.16, gp.seed, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = gp.kind === 2 ? "rgba(244, 63, 94, 0.26)" : "rgba(88, 28, 135, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gp.x, gp.y, s * 0.36, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHeroShield(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  drawX: number,
  drawY: number,
  elapsed: number
) {
  if (!p.shieldId) return;
  const shieldImg = getLoadedSprite(EQUIPMENT_ICON_MAP[p.shieldId]);
  if (!shieldImg) return;

  const isGuarding = p.guardFlashTimer > 0;
  const shieldX = drawX - p.facingX * (isGuarding ? 14 : 11);
  const shieldY = drawY - 1 + Math.sin(elapsed * 4.5) * 0.8;
  const shieldSize = isGuarding ? 27 : 23;

  ctx.save();
  ctx.translate(shieldX, shieldY);
  if (isGuarding) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#60a5fa";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.rotate(p.facingX * (isGuarding ? -0.18 : -0.06));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(shieldImg, -shieldSize / 2, -shieldSize / 2, shieldSize, shieldSize);
  ctx.restore();
}

function drawHeroWeapon(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  drawX: number,
  drawY: number,
  elapsed: number
) {
  const weaponImg = getLoadedSprite(EQUIPMENT_ICON_MAP[p.weaponId]);
  if (!weaponImg) return;

  const rarityTheme = getRarityVisualTheme(p.weaponRarity);
  const isSkill = p.skillAnimTimer > 0;
  const skillProgress = isSkill ? 1 - p.skillAnimTimer / Math.max(0.01, p.skillAnimMax) : 0;
  const atkDur = p.weaponCategory === "大剣" ? 0.28 : 0.22;
  const isAtk = p.attackAnimTimer > 0;
  const atkProgress = isAtk ? 1 - p.attackAnimTimer / atkDur : 0;

  // Hand anchor in world space (front/side hand facing aim)
  const handX = drawX + p.facingX * 11;
  const handY = drawY + 1;

  // Sprite size by weapon category
  const sizeByCat: Record<string, number> = {
    剣: 34,
    大剣: 50,
    槍: 52,
    斧: 38,
    弓: 36,
    杖: 40,
  };
  const weaponSize = sizeByCat[p.weaponCategory] || 34;

  // All weapon PNGs except bow/dual-axe point bottom-left -> top-right (-PI/4).
  // Adding +PI/4 aligns the weapon tip to 0 rad (pointing directly along +X).
  const isDualAxe = p.weaponId === "wp_axe_berserk";
  const restFacingAngle = p.facingX >= 0 ? -0.32 : Math.PI + 0.32;
  const aimAngle = isAtk || isSkill ? p.facingAngle : restFacingAngle;

  let drawAngle = aimAngle;
  let extendDist = 6;
  let gripOffsetX = -weaponSize * 0.26;
  let gripOffsetY = weaponSize * 0.26;
  let baseSpriteRotation = Math.PI / 4; // maps bottom-left->top-right (-45deg) to 0deg

  switch (p.weaponCategory) {
    case "剣": {
      if (isSkill) {
        // Rapid 3-wave alternating slash swings
        const wave = Math.sin(skillProgress * Math.PI * 3);
        drawAngle = aimAngle + wave * 1.15;
        extendDist = 11;
      } else if (isAtk) {
        const swing = -1.25 + atkProgress * 2.4;
        drawAngle = aimAngle + swing * (p.facingX >= 0 ? 1 : -1);
        extendDist = 9;
      } else {
        drawAngle = p.facingX >= 0 ? -0.35 : Math.PI + 0.35;
        extendDist = 5;
      }
      break;
    }

    case "大剣": {
      if (isSkill) {
        const sweep = -1.75 + skillProgress * 3.35;
        drawAngle = aimAngle + sweep * (p.facingX >= 0 ? 1 : -1);
        extendDist = 13;
      } else if (isAtk) {
        const sweep = -1.45 + atkProgress * 2.75;
        drawAngle = aimAngle + sweep * (p.facingX >= 0 ? 1 : -1);
        extendDist = 11;
      } else {
        // Heavy shoulder-resting stance
        drawAngle = p.facingX >= 0 ? -0.95 : Math.PI + 0.95;
        extendDist = 4;
      }
      break;
    }

    case "槍": {
      if (isSkill) {
        // Long forward thrust lunge
        drawAngle = aimAngle;
        extendDist = 18 + Math.sin(skillProgress * Math.PI) * 14;
      } else if (isAtk) {
        drawAngle = aimAngle;
        extendDist = 6 + Math.sin(atkProgress * Math.PI) * 18;
      } else {
        drawAngle = p.facingX >= 0 ? -0.18 : Math.PI + 0.18;
        extendDist = 6;
      }
      break;
    }

    case "斧": {
      if (isDualAxe) {
        baseSpriteRotation = 0;
        gripOffsetX = 0;
        gripOffsetY = 0;
      }
      if (isSkill) {
        // Ground slam overhead -> impact
        drawAngle = aimAngle + Math.sin(skillProgress * Math.PI) * 1.35 * p.facingX;
        extendDist = 10 + (1 - Math.abs(skillProgress - 0.5) * 2) * 6;
      } else if (isAtk) {
        // 360-degree spin swing
        drawAngle = aimAngle + atkProgress * Math.PI * 2 * p.facingX;
        extendDist = 12;
      } else {
        drawAngle = p.facingX >= 0 ? -0.45 : Math.PI + 0.45;
        extendDist = 5;
      }
      break;
    }

    case "弓": {
      // Bow curves toward -135deg; +3*PI/4 aligns bow belly facing 0deg forward
      baseSpriteRotation = (Math.PI * 3) / 4;
      gripOffsetX = 0;
      gripOffsetY = 0;
      drawAngle = isAtk || isSkill ? aimAngle : p.facingX >= 0 ? 0.08 : Math.PI - 0.08;
      extendDist = isAtk || isSkill ? 10 - Math.sin((isSkill ? skillProgress : atkProgress) * Math.PI) * 4 : 9;
      break;
    }

    case "杖": {
      if (isSkill || isAtk) {
        const pulse = Math.sin((isSkill ? skillProgress : atkProgress) * Math.PI);
        drawAngle = aimAngle - pulse * 0.4 * p.facingX;
        extendDist = 9 + pulse * 6;
      } else {
        drawAngle = p.facingX >= 0 ? -0.78 : Math.PI + 0.78;
        extendDist = 6;
      }
      break;
    }
  }

  ctx.save();
  ctx.translate(
    handX + Math.cos(drawAngle) * extendDist,
    handY + Math.sin(drawAngle) * extendDist
  );

  // Rarity & Weapon Aura Glow
  if (p.weaponRarity !== "ノーマル" || p.weaponCategory === "杖") {
    const auraColor =
      p.weaponRarity !== "ノーマル" ? rarityTheme.glow : "rgba(192, 132, 252, 0.42)";
    const tipDist = p.weaponCategory === "弓" ? 6 : weaponSize * 0.42;
    const tipX = Math.cos(drawAngle) * tipDist;
    const tipY = Math.sin(drawAngle) * tipDist;
    const pulseR =
      (p.weaponRarity !== "ノーマル" ? rarityTheme.auraRadius : 10) +
      Math.sin(elapsed * 7) * 2.2;
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(tipX, tipY, Math.max(6, pulseR), 0, Math.PI * 2);
    ctx.fill();
  }

  // Drawn bowstring + glowing arrow during bow attack/skill
  if (p.weaponCategory === "弓" && (isAtk || isSkill)) {
    ctx.save();
    ctx.rotate(drawAngle);
    ctx.strokeStyle = p.weaponRarity !== "ノーマル" ? rarityTheme.core : "#fef08a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(11, -3);
    ctx.lineTo(11, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.rotate(drawAngle + baseSpriteRotation);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    weaponImg,
    -weaponSize / 2 - gripOffsetX,
    -weaponSize / 2 - gripOffsetY,
    weaponSize,
    weaponSize
  );
  ctx.restore();
}

function drawPlayerSprite(ctx: CanvasRenderingContext2D, p: PlayerState, elapsed: number) {
  const isMoving = p.walkPhase > 0;
  const idleBob = Math.sin(elapsed * 4.2) * 1.4;
  const walkBob = Math.abs(Math.sin(p.walkPhase)) * 3.5;
  const bob = isMoving ? -walkBob : idleBob;
  const lunge =
    p.attackAnimTimer > 0 && p.weaponCategory !== "弓"
      ? Math.sin((p.attackAnimTimer / (p.weaponCategory === "大剣" ? 0.28 : 0.22)) * Math.PI) *
        (p.weaponCategory === "槍" ? 10 : 7)
      : 0;
  const drawX = p.x + Math.cos(p.facingAngle) * lunge;
  const drawY = p.y + Math.sin(p.facingAngle) * lunge + bob;
  const tilt = isMoving ? Math.sin(p.walkPhase) * 0.06 : 0;

  const rarityTheme = getRarityVisualTheme(p.weaponRarity);

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 17, 17, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rarity / Hero aura ring under feet
  ctx.strokeStyle =
    p.weaponRarity !== "ノーマル" ? rarityTheme.glow : "rgba(251, 191, 36, 0.28)";
  ctx.lineWidth = p.weaponRarity === "レジェンダリー" ? 2.4 : 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 20, 9, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Spear dash invulnerability streak aura
  if (p.dashInvulnTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = rarityTheme.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(drawX, drawY - 4, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const heroImg = getLoadedSprite(HERO_SPRITE_PATH);
  if (heroImg) {
    const baseHero = getUnarmedHeroCanvas(heroImg);
    const spriteSize = 58;
    drawTintedSprite(
      ctx,
      baseHero,
      drawX,
      drawY - 8,
      spriteSize,
      spriteSize,
      p.facingX,
      tilt,
      p.hitFlash > 0 ? 0.8 : 0
    );

    // Draw equipped shield on off-hand and equipped weapon in main hand
    drawHeroShield(ctx, p, drawX, drawY, elapsed);
    drawHeroWeapon(ctx, p, drawX, drawY, elapsed);

    // Orbiting pixel sparkles for Epic / Legendary weapons
    if (p.weaponRarity === "エピック" || p.weaponRarity === "レジェンダリー") {
      const orbCount = p.weaponRarity === "レジェンダリー" ? 3 : 2;
      for (let i = 0; i < orbCount; i++) {
        const a = elapsed * 3.4 + (i * Math.PI * 2) / orbCount;
        const sx = drawX + Math.cos(a) * 24;
        const sy = drawY - 4 + Math.sin(a) * 14;
        ctx.fillStyle = rarityTheme.core;
        ctx.fillRect(Math.round(sx - 1.5), Math.round(sy - 1.5), 3, 3);
      }
    }
    return;
  }

  // Fallback procedural hero
  const flash = p.hitFlash > 0;
  const ang = p.facingAngle;
  ctx.fillStyle = flash ? "#ffffff" : "#dc2626";
  ctx.beginPath();
  ctx.arc(p.x - Math.cos(ang) * 5, p.y - Math.sin(ang) * 5 + bob, 14.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = flash ? "#ffffff" : "#38bdf8";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, p.radius - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawCompanionSprite(ctx: CanvasRenderingContext2D, c: CompanionEntity, elapsed: number) {
  const bob = Math.sin(elapsed * 4.8 + c.x * 0.03) * 1.8;
  const lunge = c.attackAnimTimer > 0 ? Math.sin((c.attackAnimTimer / 0.22) * Math.PI) * 5 : 0;
  const drawX = c.x + c.facingX * lunge;
  const drawY = c.y + bob;

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 15, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const img = getLoadedSprite(COMPANION_SPRITE_MAP[c.id]);
  if (img) {
    drawTintedSprite(ctx, img, drawX, drawY - 6, 50, 50, c.facingX, 0, c.hitFlash > 0 ? 0.75 : 0);
  } else {
    ctx.fillStyle = c.hitFlash > 0 ? "#ffffff" : c.color;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.role[0], drawX, drawY + 4);
  }

  drawSmallHpBar(ctx, c.x, c.y - 32, 32, c.hp / c.maxHp, "#38bdf8");
}

function drawMonsterSprite(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  const bob = Math.sin(e.bobPhase) * (e.isBoss ? 3.2 : 2.2);
  const flash = e.hitFlash > 0;
  const r = e.radius;
  const lunge = e.attackAnimTimer > 0 ? Math.sin((e.attackAnimTimer / 0.2) * Math.PI) * 5 : 0;
  const drawX = e.x + e.facingX * lunge;
  const drawY = e.y + bob;

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.44)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + r * 0.85, r * 0.98, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.isBoss) {
    ctx.strokeStyle = e.isFinalBoss ? "rgba(239, 68, 68, 0.55)" : "rgba(249, 115, 22, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(
      e.x,
      e.y + r * 0.72,
      r * 1.15 + Math.sin(e.bobPhase * 0.6) * 3,
      r * 0.52,
      0,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }

  const spriteImg = getLoadedSprite(MONSTER_SPRITE_MAP[e.id]);
  if (spriteImg) {
    const spriteSize = e.isFinalBoss
      ? Math.round(r * 3.1)
      : e.isBoss
        ? Math.round(r * 2.9)
        : e.id === "elite_brute"
          ? Math.round(r * 2.8)
          : e.id === "slime"
            ? Math.round(r * 2.4)
            : Math.round(r * 2.9);

    drawTintedSprite(
      ctx,
      spriteImg,
      drawX,
      drawY - r * 0.18,
      spriteSize,
      spriteSize,
      e.facingX,
      0,
      flash ? 0.82 : 0
    );

    if (!e.isBoss && e.hp < e.maxHp) {
      drawSmallHpBar(ctx, e.x, e.y - spriteSize * 0.52, Math.max(28, r * 1.9), e.hp / e.maxHp, "#ef4444");
    }
    return;
  }

  // Fallback procedural monster
  ctx.fillStyle = flash ? "#fff" : e.color;
  ctx.strokeStyle = e.isBoss ? "#fde047" : "#0f172a";
  ctx.lineWidth = e.isBoss ? 3.5 : 2;
  ctx.beginPath();
  ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (!e.isBoss && e.hp < e.maxHp) {
    drawSmallHpBar(ctx, e.x, e.y - r - 9, r * 2, e.hp / e.maxHp);
  }
}

export function renderWorld(ctx: CanvasRenderingContext2D, width: number, height: number, state: RenderState) {
  ctx.clearRect(0, 0, width, height);

  if (!state.player) {
    ctx.fillStyle = "#0b0f17";
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const area = getAreaForDay(state.day);
  const shakeX = state.screenShake > 0 ? (Math.random() - 0.5) * 9 : 0;
  const shakeY = state.screenShake > 0 ? (Math.random() - 0.5) * 9 : 0;
  const camX = state.camera.x - width / 2 + shakeX;
  const camY = state.camera.y - height / 2 + shakeY;

  ctx.fillStyle = area.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(-camX, -camY);

  // 1. Background Ground Tilemap Layer
  const tileSize = 384;
  const startX = Math.max(0, Math.floor(camX / tileSize) * tileSize);
  const endX = Math.min(state.arenaSize, camX + width + tileSize);
  const startY = Math.max(0, Math.floor(camY / tileSize) * tileSize);
  const endY = Math.min(state.arenaSize, camY + height + tileSize);

  const bgTileImg = getLoadedSprite(AREA_BG_MAP[area.id]);
  if (bgTileImg) {
    ctx.imageSmoothingEnabled = false;
    for (let tx = startX; tx < endX; tx += tileSize) {
      for (let ty = startY; ty < endY; ty += tileSize) {
        const w = Math.min(tileSize, state.arenaSize - tx);
        const h = Math.min(tileSize, state.arenaSize - ty);
        if (w <= 0 || h <= 0) continue;
        ctx.drawImage(bgTileImg, 0, 0, bgTileImg.width * (w / tileSize), bgTileImg.height * (h / tileSize), tx, ty, w, h);
      }
    }
  } else {
    ctx.strokeStyle = area.tile;
    ctx.lineWidth = 2;
    for (let tx = startX; tx <= endX; tx += 96) {
      ctx.beginPath();
      ctx.moveTo(tx, startY);
      ctx.lineTo(tx, endY);
      ctx.stroke();
    }
    for (let ty = startY; ty <= endY; ty += 96) {
      ctx.beginPath();
      ctx.moveTo(startX, ty);
      ctx.lineTo(endX, ty);
      ctx.stroke();
    }
  }

  // 2. Environment Props Layer
  for (const gp of state.groundProps) {
    if (gp.x < camX - 90 || gp.x > camX + width + 90 || gp.y < camY - 90 || gp.y > camY + height + 90) {
      continue;
    }
    drawGroundProp(ctx, gp, area, state.elapsedTotal);
  }

  // Arena boundary border (ornate crimson-gold warning frame)
  ctx.strokeStyle = "rgba(200, 155, 60, 0.5)";
  ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, state.arenaSize - 32, state.arenaSize - 32);
  ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(22, 22, state.arenaSize - 44, state.arenaSize - 44);

  // Player Attack Range Ring (subtle)
  const p = state.player;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.range, 0, Math.PI * 2);
  ctx.stroke();

  // Boss Attack Telegraph
  for (const e of state.enemies) {
    if (e.telegraph) {
      const prog = 1 - e.telegraph.timer / e.telegraph.maxTimer;
      ctx.fillStyle = "rgba(239, 68, 68, 0.24)";
      ctx.beginPath();
      ctx.arc(e.telegraph.x, e.telegraph.y, e.telegraph.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.telegraph.x, e.telegraph.y, e.telegraph.radius * prog, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 3. Death Dissolve Animations
  for (const de of state.deathEffects) {
    const t = Math.max(0, de.life / de.maxLife);
    const spriteImg = getLoadedSprite(MONSTER_SPRITE_MAP[de.spriteId]);
    if (spriteImg) {
      ctx.save();
      ctx.globalAlpha = t * 0.85;
      const scale = 0.7 + t * 0.3;
      const baseSize = de.isBoss ? de.radius * 2.9 : de.radius * 2.7;
      const drawSize = baseSize * scale;
      drawTintedSprite(ctx, spriteImg, de.x, de.y - (1 - t) * 10, drawSize, drawSize, de.facingX, (1 - t) * 0.35, 0.65);
      ctx.restore();
    }
  }

  // 4. Companions
  for (const c of state.companions) {
    if (!c.downed) drawCompanionSprite(ctx, c, state.elapsedTotal);
  }

  // 5. Monsters
  for (const e of state.enemies) {
    if (e.x < camX - 120 || e.x > camX + width + 120 || e.y < camY - 120 || e.y > camY + height + 120) {
      continue;
    }
    drawMonsterSprite(ctx, e);
  }

  // 6. Player Hero
  drawPlayerSprite(ctx, p, state.elapsedTotal);

  // 7. Glowing 16-bit Crescent Slash / Thrust / Shockwave / Magic Nova / Guard Effects
  for (const s of state.slashEffects) {
    const alpha = Math.max(0, s.life / s.maxLife);
    const prog = 1 - alpha;
    ctx.save();

    if (s.kind === "shockwave") {
      // Axe ground-slam expanding crater & tremor waves
      const r1 = s.radius * (0.35 + prog * 0.68);
      const r2 = s.radius * (0.2 + prog * 0.55);
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r1, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.95;
      ctx.strokeStyle = "#fef3c7";
      ctx.lineWidth = 5 * alpha + 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r1, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.kind === "magic_nova") {
      // Staff AoE magic circle + expanding arcane detonation
      const r = s.radius * (0.45 + prog * 0.58);
      ctx.globalAlpha = alpha * 0.34;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.95;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating arcane hexagram inside circle
      ctx.translate(s.x, s.y);
      ctx.rotate(prog * 1.4);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.5;
      for (let tri = 0; tri < 2; tri++) {
        ctx.beginPath();
        for (let v = 0; v < 3; v++) {
          const a = (v * Math.PI * 2) / 3 + (tri * Math.PI) / 3;
          const px = Math.cos(a) * r * 0.78;
          const py = Math.sin(a) * r * 0.78;
          if (v === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else if (s.kind === "thrust") {
      // Spear piercing dash beam & wind streaks
      const len = s.length || s.radius;
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = alpha * 0.42;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(0, -14 * alpha);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, 14 * alpha);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = alpha * 0.96;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 4 * alpha + 1.5;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, -10);
      ctx.lineTo(len * 0.85, -3);
      ctx.moveTo(14, 10);
      ctx.lineTo(len * 0.85, 3);
      ctx.stroke();
    } else if (s.kind === "guard") {
      // Shield guard ripple arc
      ctx.globalAlpha = alpha * 0.88;
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius + prog * 10, s.angle - 1.1, s.angle + 1.1);
      ctx.stroke();
    } else if (s.arc >= Math.PI * 1.99) {
      // Whirlwind / Spin ring
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = alpha * 0.92;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 6 * alpha + 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * (0.94 + prog * 0.08), s.angle, s.angle + Math.PI * 1.55);
      ctx.stroke();

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.75, s.angle + Math.PI, s.angle + Math.PI * 2.4);
      ctx.stroke();
    } else {
      // Glowing Crescent Slash / Greatsword Cleave Arc
      const rOuter = s.radius;
      const rInner = Math.max(18, s.radius * (s.kind === "cleave" ? 0.44 : 0.54));
      const startA = s.angle - s.arc / 2;
      const endA = s.angle + s.arc / 2;

      ctx.globalAlpha = alpha * (s.kind === "cleave" ? 0.4 : 0.32);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = s.rarity === "レジェンダリー" ? "#fef9c3" : "#e0f2fe";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.arc(s.x, s.y, rInner, endA, startA, true);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = s.color === "#e2e8f0" ? "#38bdf8" : s.color;
      ctx.lineWidth = s.kind === "cleave" ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8. Projectiles (Arrows, Piercing Arrows, Magic Orbs, Enemy Bolts)
  for (const pr of state.projectiles) {
    ctx.save();
    if (pr.fromPlayer && pr.aoe === 0) {
      const ang = Math.atan2(pr.vy, pr.vx);
      const isPierce = pr.visualKind === "pierce_arrow" || pr.piercing;
      ctx.translate(pr.x, pr.y);
      ctx.rotate(ang);

      if (isPierce) {
        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(12, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.strokeStyle = isPierce ? pr.color : "#fef08a";
      ctx.lineWidth = isPierce ? 3.5 : 3;
      ctx.beginPath();
      ctx.moveTo(isPierce ? -16 : -10, 0);
      ctx.lineTo(isPierce ? 12 : 8, 0);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(isPierce ? 15 : 10, 0);
      ctx.lineTo(isPierce ? 6 : 4, isPierce ? -4.5 : -3.5);
      ctx.lineTo(isPierce ? 6 : 4, isPierce ? 4.5 : 3.5);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = pr.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 1.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 9. Pixel Particles
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    const sz = Math.max(2, Math.round(pt.r * 1.6));
    ctx.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), sz, sz);
  }
  ctx.globalAlpha = 1;

  // 10. Floating Combat & Coin Numbers
  ctx.textAlign = "center";
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = Math.min(1, ft.life / 0.35);
    ctx.font = `800 ${ft.size}px "Plus Jakarta Sans", "Noto Sans JP", sans-serif`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(8, 12, 22, 0.92)";
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
