import { getAreaForDay } from "../data/monsters";
import type {
  AreaDef,
  CompanionEntity,
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
  player: PlayerState | null;
  enemies: EnemyEntity[];
  companions: CompanionEntity[];
  projectiles: ProjectileEntity[];
  slashEffects: SlashEffect[];
  particles: ParticleEffect[];
  floatingTexts: FloatingText[];
  groundProps: GroundProp[];
  camera: { x: number; y: number };
  screenShake: number;
  weaponName: string;
}

function drawSmallHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color = "#ef4444"
) {
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 4);
}

function drawGroundProp(ctx: CanvasRenderingContext2D, gp: GroundProp, area: AreaDef) {
  const s = gp.size;
  if (area.propType === "forest") {
    if (gp.kind === 0) {
      // 小さな木立の影と葉
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(gp.x + 2, gp.y + s * 0.45, s * 0.75, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1b432b";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b6340";
      ctx.beginPath();
      ctx.arc(gp.x - s * 0.15, gp.y - s * 0.15, s * 0.42, 0, Math.PI * 2);
      ctx.fill();
    } else if (gp.kind === 1) {
      // 草むら
      ctx.fillStyle = area.accent;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 花・光粒
      ctx.fillStyle = "rgba(74, 222, 128, 0.25)";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (area.propType === "cave") {
    if (gp.kind === 0) {
      // 岩塊
      ctx.fillStyle = "#2b334d";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else if (gp.kind === 2) {
      // 青い鉱石結晶
      ctx.fillStyle = "rgba(96, 165, 250, 0.35)";
      ctx.beginPath();
      ctx.moveTo(gp.x, gp.y - s * 0.5);
      ctx.lineTo(gp.x + s * 0.35, gp.y + s * 0.2);
      ctx.lineTo(gp.x - s * 0.35, gp.y + s * 0.2);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = area.tile;
      ctx.fillRect(gp.x - s * 0.3, gp.y - s * 0.3, s * 0.6, s * 0.6);
    }
  } else if (area.propType === "wasteland") {
    if (gp.kind === 0) {
      ctx.fillStyle = "#523225";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.52, 0, Math.PI * 2);
      ctx.fill();
    } else if (gp.kind === 2) {
      // 灼熱の亀裂光
      ctx.fillStyle = "rgba(251, 146, 60, 0.26)";
      ctx.beginPath();
      ctx.ellipse(gp.x, gp.y, s * 0.6, s * 0.18, gp.seed, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = area.accent;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 魔王の領域: 黒曜石と魔方陣片
    if (gp.kind === 0) {
      ctx.fillStyle = "#351b45";
      ctx.fillRect(gp.x - s * 0.35, gp.y - s * 0.35, s * 0.7, s * 0.7);
    } else if (gp.kind === 2) {
      ctx.strokeStyle = "rgba(244, 63, 94, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#2a1638";
      ctx.beginPath();
      ctx.arc(gp.x, gp.y, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayerSprite(ctx: CanvasRenderingContext2D, p: PlayerState) {
  const bob = Math.sin(p.walkPhase) * 2;
  const flash = p.hitFlash > 0;
  const ang = p.facingAngle;

  // 足元影
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 16, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // マント（進行方向の後ろにたなびく）
  ctx.fillStyle = flash ? "#ffffff" : "#dc2626";
  ctx.beginPath();
  ctx.arc(p.x - Math.cos(ang) * 5, p.y - Math.sin(ang) * 5 + bob, 14.5, 0, Math.PI * 2);
  ctx.fill();

  // 兜・鎧の胴体
  ctx.fillStyle = flash ? "#ffffff" : "#38bdf8";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, p.radius - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ヘルメット装飾ライン
  ctx.fillStyle = flash ? "#ffffff" : "#f59e0b";
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 5, 0, Math.PI * 2);
  ctx.fill();

  // バイザー（向いている方向）
  const ex = p.x + Math.cos(ang) * 8;
  const ey = p.y + Math.sin(ang) * 8 + bob;
  ctx.fillStyle = "#fef08a";
  ctx.beginPath();
  ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
  ctx.fill();

  // 所持武器スタイル別描画
  const handX = p.x + Math.cos(ang + 0.45) * 14;
  const handY = p.y + Math.sin(ang + 0.45) * 14 + bob;

  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(ang);
  if (p.attackStyle === "arrow") {
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 12, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
  } else if (p.attackStyle === "magic") {
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(16, 0);
    ctx.stroke();
    ctx.fillStyle = "#f472b6";
    ctx.beginPath();
    ctx.arc(17, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.attackStyle === "spin") {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(13, -4, 6, 0, Math.PI);
    ctx.fill();
  } else if (p.attackStyle === "thrust") {
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(24, 0);
    ctx.stroke();
  } else {
    const bladeLen = p.attackStyle === "cleave" ? 22 : 16;
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = p.attackStyle === "cleave" ? 4.5 : 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bladeLen, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCompanionSprite(ctx: CanvasRenderingContext2D, c: CompanionEntity) {
  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 13, 12, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = c.hitFlash > 0 ? "#ffffff" : c.color;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(c.role[0], c.x, c.y + 4);

  drawSmallHpBar(ctx, c.x, c.y - 22, 28, c.hp / c.maxHp, "#38bdf8");
}

function drawMonsterSprite(ctx: CanvasRenderingContext2D, e: EnemyEntity) {
  const bob = Math.sin(e.bobPhase) * 2.4;
  const flash = e.hitFlash > 0;
  const r = e.radius;

  // 影
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + r * 0.85, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (e.id === "slime") {
    // スライム
    ctx.fillStyle = flash ? "#fff" : e.color;
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 3 + bob * 0.6, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ツヤ
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(e.x - r * 0.35, e.y - r * 0.22 + bob * 0.6, r * 0.24, r * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // 目
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(e.x - 6, e.y - 1 + bob * 0.6, 3, 4);
    ctx.fillRect(e.x + 3, e.y - 1 + bob * 0.6, 3, 4);
  } else if (e.id === "goblin") {
    // ゴブリン（尖った耳と赤い目）
    ctx.fillStyle = flash ? "#fff" : e.color;
    ctx.strokeStyle = "#1a2e05";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(e.x - r, e.y - 4 + bob);
    ctx.lineTo(e.x - r - 8, e.y - 11 + bob);
    ctx.lineTo(e.x - r + 4, e.y + 3 + bob);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(e.x + r, e.y - 4 + bob);
    ctx.lineTo(e.x + r + 8, e.y - 11 + bob);
    ctx.lineTo(e.x + r - 4, e.y + 3 + bob);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(e.x, e.y + bob, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(e.x - 6, e.y - 3 + bob, 4, 3);
    ctx.fillRect(e.x + 2, e.y - 3 + bob, 4, 3);
  } else if (e.id === "skeleton") {
    // スケルトン
    ctx.fillStyle = flash ? "#fff" : "#f1f5f9";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(e.x, e.y + bob * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(e.x - 5, e.y - 2 + bob * 0.5, 3.3, 0, Math.PI * 2);
    ctx.arc(e.x + 5, e.y - 2 + bob * 0.5, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(e.x - 5, e.y + 6 + bob * 0.5, 10, 3);
  } else {
    // 強敵・ボス（角付き装甲＋オーラ）
    if (e.isBoss) {
      ctx.strokeStyle = e.isFinalBoss ? "rgba(239, 68, 68, 0.45)" : "rgba(249, 115, 22, 0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 6 + Math.sin(e.bobPhase * 0.7) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = flash ? "#fff" : e.color;
    ctx.strokeStyle = e.isBoss ? "#fde047" : "#3b0764";
    ctx.lineWidth = e.isBoss ? 3.5 : 2.5;

    // 角
    ctx.beginPath();
    ctx.moveTo(e.x - r * 0.58, e.y - r * 0.45);
    ctx.lineTo(e.x - r * 0.96, e.y - r * 1.28);
    ctx.lineTo(e.x - r * 0.14, e.y - r * 0.85);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(e.x + r * 0.58, e.y - r * 0.45);
    ctx.lineTo(e.x + r * 0.96, e.y - r * 1.28);
    ctx.lineTo(e.x + r * 0.14, e.y - r * 0.85);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(e.x, e.y + bob * 0.4, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(e.x - r * 0.3, e.y - 3, r * 0.15, 0, Math.PI * 2);
    ctx.arc(e.x + r * 0.3, e.y - 3, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

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

  // タイルグリッド
  const tileSize = 96;
  const startX = Math.max(0, Math.floor(camX / tileSize) * tileSize);
  const endX = Math.min(state.arenaSize, camX + width + tileSize);
  const startY = Math.max(0, Math.floor(camY / tileSize) * tileSize);
  const endY = Math.min(state.arenaSize, camY + height + tileSize);

  ctx.strokeStyle = area.tile;
  ctx.lineWidth = 2;
  for (let tx = startX; tx <= endX; tx += tileSize) {
    ctx.beginPath();
    ctx.moveTo(tx, startY);
    ctx.lineTo(tx, endY);
    ctx.stroke();
  }
  for (let ty = startY; ty <= endY; ty += tileSize) {
    ctx.beginPath();
    ctx.moveTo(startX, ty);
    ctx.lineTo(endX, ty);
    ctx.stroke();
  }

  // 環境プロップ
  for (const gp of state.groundProps) {
    if (gp.x < camX - 40 || gp.x > camX + width + 40 || gp.y < camY - 40 || gp.y > camY + height + 40) {
      continue;
    }
    drawGroundProp(ctx, gp, area);
  }

  // アリーナ境界線
  ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, state.arenaSize - 32, state.arenaSize - 32);

  // 攻撃範囲リング
  const p = state.player;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.09)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.range, 0, Math.PI * 2);
  ctx.stroke();

  // ボス攻撃予兆
  for (const e of state.enemies) {
    if (e.telegraph) {
      const prog = 1 - e.telegraph.timer / e.telegraph.maxTimer;
      ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
      ctx.beginPath();
      ctx.arc(e.telegraph.x, e.telegraph.y, e.telegraph.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.telegraph.x, e.telegraph.y, e.telegraph.radius * prog, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 斬撃・魔法範囲エフェクト
  for (const s of state.slashEffects) {
    const alpha = s.life / s.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    if (s.arc >= Math.PI * 1.99) {
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    } else {
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, s.radius, s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  // 仲間
  for (const c of state.companions) {
    if (!c.downed) drawCompanionSprite(ctx, c);
  }

  // モンスター
  for (const e of state.enemies) {
    if (e.x < camX - 90 || e.x > camX + width + 90 || e.y < camY - 90 || e.y > camY + height + 90) {
      continue;
    }
    drawMonsterSprite(ctx, e);
  }

  // プレイヤー
  drawPlayerSprite(ctx, p);

  // 飛び道具
  for (const pr of state.projectiles) {
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // パーティクル
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // フローティングテキスト
  ctx.textAlign = "center";
  for (const ft of state.floatingTexts) {
    ctx.globalAlpha = Math.min(1, ft.life / 0.35);
    ctx.font = `800 ${ft.size}px "Plus Jakarta Sans", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}
