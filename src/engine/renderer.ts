import {
  AREA_BG_MAP,
  AREA_PROP_MAP,
  COMPANION_SPRITE_MAP,
  getLoadedSprite,
  HERO_SPRITE_PATH,
  MONSTER_SPRITE_MAP,
} from "../data/assets";
import { getAreaForDay } from "../data/monsters";
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

function drawTintedSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
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

function drawPlayerSprite(ctx: CanvasRenderingContext2D, p: PlayerState, elapsed: number) {
  const isMoving = p.walkPhase > 0;
  const idleBob = Math.sin(elapsed * 4.2) * 1.4;
  const walkBob = Math.abs(Math.sin(p.walkPhase)) * 3.5;
  const bob = isMoving ? -walkBob : idleBob;
  const lunge = p.attackAnimTimer > 0 ? Math.sin((p.attackAnimTimer / 0.22) * Math.PI) * 7 : 0;
  const drawX = p.x + Math.cos(p.facingAngle) * lunge;
  const drawY = p.y + Math.sin(p.facingAngle) * lunge + bob;
  const tilt = isMoving ? Math.sin(p.walkPhase) * 0.06 : 0;

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 17, 17, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle hero golden aura ring
  ctx.strokeStyle = "rgba(251, 191, 36, 0.28)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 20, 9, 0, 0, Math.PI * 2);
  ctx.stroke();

  const heroImg = getLoadedSprite(HERO_SPRITE_PATH);
  if (heroImg) {
    const spriteSize = 58;
    drawTintedSprite(
      ctx,
      heroImg,
      drawX,
      drawY - 8,
      spriteSize,
      spriteSize,
      p.facingX,
      tilt,
      p.hitFlash > 0 ? 0.8 : 0
    );
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

  // 7. Glowing 16-bit Crescent Slash / Whirlwind / Skill Effects
  for (const s of state.slashEffects) {
    const alpha = Math.max(0, s.life / s.maxLife);
    ctx.save();
    if (s.arc >= Math.PI * 1.99) {
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
      ctx.arc(s.x, s.y, s.radius * (0.94 + (1 - alpha) * 0.08), s.angle, s.angle + Math.PI * 1.55);
      ctx.stroke();

      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * 0.75, s.angle + Math.PI, s.angle + Math.PI * 2.4);
      ctx.stroke();
    } else {
      // Glowing Crescent Slash Arc (matching target-game-design.jpeg)
      const rOuter = s.radius;
      const rInner = Math.max(18, s.radius * 0.54);
      const startA = s.angle - s.arc / 2;
      const endA = s.angle + s.arc / 2;

      ctx.globalAlpha = alpha * 0.32;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = alpha * 0.95;
      ctx.fillStyle = "#e0f2fe";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.arc(s.x, s.y, rInner, endA, startA, true);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = s.color === "#e2e8f0" ? "#38bdf8" : s.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, rOuter, startA, endA);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 8. Projectiles (Arrows, Magic Orbs, Enemy Bolts)
  for (const pr of state.projectiles) {
    ctx.save();
    if (pr.fromPlayer && pr.aoe === 0) {
      // Arrow with shaft & fletching
      const ang = Math.atan2(pr.vy, pr.vx);
      ctx.translate(pr.x, pr.y);
      ctx.rotate(ang);
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(4, -3.5);
      ctx.lineTo(4, 3.5);
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
