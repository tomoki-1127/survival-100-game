import { type BgmTrackId, preloadCoreGameAssets } from "../data/assets";
import { getEquipmentById } from "../data/equipment";
import { getAreaForDay, MONSTERS_DB, pickEnemyIdForDay } from "../data/monsters";
import { COMPANION_CLASSES, LEVEL_UP_PERKS } from "../data/upgrades";
import { getRarityVisualTheme, getWeaponSkillDef } from "../data/weaponSkills";
import type {
  AchievementDef,
  CompanionEntity,
  DeathEffect,
  EnemyEntity,
  FloatingText,
  GameSpeed,
  GroundProp,
  HudSnapshot,
  MimicRewardSummary,
  ParticleEffect,
  PerkDef,
  PlayerState,
  ProjectileEntity,
  SlashEffect,
} from "../types/game";
import {
  evaluateAchievements,
  getBaseHubStats,
  markMimicSpawned,
  MIMIC_MONSTER_ID,
  recordMonsterEncounter,
  recordMonsterKill,
  resolveMimicRewardAtomic,
  SaveManager,
  shouldSpawnMimicToday,
} from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { renderWorld } from "./renderer";

export const ARENA_SIZE = 2400;
export const DAY_DURATION = 16;

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onToast: (msg: string) => void;
  onLevelUp: (level: number, choices: PerkDef[]) => void;
  onDeath: (summary: { reachedDay: number; bestDay: number; runCoins: number; totalCoins: number }) => void;
  onVictory100: () => void;
  onMimicSpawn?: (day: number, areaName: string) => void;
  onMimicReward?: (summary: MimicRewardSummary) => void;
  onAchievementUnlock?: (ach: AchievementDef) => void;
  onSaveChanged: () => void;
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private rafId: number | null = null;
  private lastTime = 0;
  private hudSyncTimer = 0;

  mode: "hub" | "playing" = "hub";
  paused = false;
  gameSpeed: GameSpeed = 1;

  day = 1;
  dayTimer = 0;
  elapsedTotal = 0;
  runCoins = 0;
  spawnTimer = 0;
  bossSpawnedThisDay = false;
  mimicCheckedThisDay = false;
  skillCooldown = 0;
  skillMaxCd = 7.5;
  potionCharges = 2;
  potionMaxCharges = 3;
  potionCd = 0;
  screenShake = 0;
  lastSaveTick = 0;

  player: PlayerState | null = null;
  enemies: EnemyEntity[] = [];
  companions: CompanionEntity[] = [];
  projectiles: ProjectileEntity[] = [];
  slashEffects: SlashEffect[] = [];
  particles: ParticleEffect[] = [];
  deathEffects: DeathEffect[] = [];
  floatingTexts: FloatingText[] = [];
  groundProps: GroundProp[] = [];
  camera = { x: ARENA_SIZE / 2, y: ARENA_SIZE / 2 };

  private keys: Record<string, boolean> = {};
  private joyX = 0;
  private joyY = 0;
  private joyActive = false;
  private inShopMenu = false;
  private recentSpawnIds: string[] = [];
  private scheduledSwordWaves: Array<{ delay: number; angle: number; waveIdx: number }> = [];

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.callbacks = callbacks;
    preloadCoreGameAssets();
    this.syncBgm();
  }

  setGameSpeed(speed: GameSpeed) {
    this.gameSpeed = speed;
    this.emitHud();
  }

  cycleGameSpeed(): GameSpeed {
    const next: GameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
    this.setGameSpeed(next);
    return next;
  }

  resumeAfterMimicReward() {
    this.paused = false;
    this.checkLevelUp();
    this.emitHud();
  }

  setInShopMenu(open: boolean) {
    if (this.inShopMenu === open) return;
    this.inShopMenu = open;
    this.syncBgm();
  }

  resolveActiveBgmTrack(): BgmTrackId {
    if (this.mode === "hub" || this.inShopMenu) {
      return "home_shop";
    }
    const livingStageBoss = this.enemies.find((e) => e.isStageBoss && e.hp > 0);
    if (livingStageBoss) {
      return livingStageBoss.isFinalBoss ? "final_boss_day100" : "boss";
    }
    if (this.day >= 101) {
      return "endless";
    }
    const area = getAreaForDay(this.day);
    if (area.id === "cave") return "cave";
    if (area.id === "wasteland") return "wasteland";
    if (area.id === "abyss") return "demon_realm";
    return "forest";
  }

  syncBgm() {
    SoundFX.playBgm(this.resolveActiveBgmTrack());
  }

  startLoop() {
    if (this.rafId !== null) return;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const rawDt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.stepSimulation(rawDt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private stepSimulation(rawDt: number) {
    if (this.mode !== "playing" || this.paused || !this.player) return;

    // Autosave timer & HUD sync run on real wall-clock dt
    this.lastSaveTick += rawDt;
    if (this.lastSaveTick >= 5) {
      this.lastSaveTick = 0;
      SaveManager.save();
    }

    // Apply gameSpeed multiplier to gameplay simulation with bounded substeps (prevents tunneling at 2x/3x)
    const totalSimDt = rawDt * this.gameSpeed;
    const maxStep = 1 / 60;
    const steps = Math.max(1, Math.ceil(totalSimDt / maxStep));
    const stepDt = totalSimDt / steps;

    for (let i = 0; i < steps; i++) {
      if (this.paused || this.mode !== "playing") break;
      this.update(stepDt);
    }

    this.hudSyncTimer += rawDt;
    if (this.hudSyncTimer >= 0.065) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  resize(width: number, height: number) {
    this.canvas.width = Math.max(1, width);
    this.canvas.height = Math.max(1, height);
  }

  setKey(code: string, pressed: boolean) {
    this.keys[code] = pressed;
  }

  clearKeys() {
    this.keys = {};
    this.joyX = 0;
    this.joyY = 0;
    this.joyActive = false;
  }

  setJoystick(x: number, y: number, active: boolean) {
    if (!active) {
      this.joyX = 0;
      this.joyY = 0;
      this.joyActive = false;
      return;
    }
    const sx = Number.isFinite(x) ? x : 0;
    const sy = Number.isFinite(y) ? y : 0;
    const mag = Math.hypot(sx, sy);
    if (mag > 1) {
      this.joyX = sx / mag;
      this.joyY = sy / mag;
    } else {
      this.joyX = sx;
      this.joyY = sy;
    }
    this.joyActive = true;
  }

  startNewRun() {
    SaveManager.data.stats.totalRuns += 1;
    if (SaveManager.data.bestDay < 1) SaveManager.data.bestDay = 1;
    SaveManager.save();
    this.callbacks.onSaveChanged();

    this.mode = "playing";
    this.paused = false;
    this.inShopMenu = false;
    this.day = 1;
    this.dayTimer = 0;
    this.elapsedTotal = 0;
    this.runCoins = 0;
    this.spawnTimer = 0.45;
    this.bossSpawnedThisDay = false;
    this.mimicCheckedThisDay = false;
    this.skillCooldown = 0;
    this.potionCharges = 2;
    this.potionCd = 0;
    this.screenShake = 0;
    this.enemies = [];
    this.projectiles = [];
    this.slashEffects = [];
    this.particles = [];
    this.deathEffects = [];
    this.floatingTexts = [];
    this.recentSpawnIds = [];
    this.scheduledSwordWaves = [];

    this.player = this.createPlayerObject();
    this.skillMaxCd = getWeaponSkillDef(this.player.weaponCategory).cooldown;
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.generateGroundProps();
    this.spawnSavedCompanions();

    this.syncBgm();
    this.emitHud();
    this.callbacks.onToast(`1日目: ${getAreaForDay(1).name} — サバイバル開始`);
  }

  returnToHub() {
    if (this.mode === "playing" && this.day > SaveManager.data.bestDay) {
      SaveManager.data.bestDay = this.day;
    }
    SaveManager.save();
    this.mode = "hub";
    this.paused = true;
    this.inShopMenu = false;
    this.scheduledSwordWaves = [];
    this.clearKeys();
    this.syncBgm();
    this.callbacks.onSaveChanged();
  }

  private createPlayerObject(): PlayerState {
    const base = getBaseHubStats();
    const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
    const weaponCategory = weapon?.category || "剣";
    return {
      x: ARENA_SIZE / 2,
      y: ARENA_SIZE / 2,
      radius: 17,
      facingAngle: 0,
      facingX: 1,
      walkPhase: 0,
      attackAnimTimer: 0,
      skillAnimTimer: 0,
      skillAnimMax: 0.3,
      dashInvulnTimer: 0,
      guardFlashTimer: 0,
      poisonTimer: 0,
      poisonTickTimer: 0,
      poisonDps: 0,
      slowTimer: 0,
      weaponId: weapon?.id || "wp_sword_apprentice",
      weaponCategory,
      weaponRarity: weapon?.rarity || "ノーマル",
      shieldId: SaveManager.data.equipped.shield || null,
      level: 1,
      xp: 0,
      nextXp: 40,
      hp: base.maxHp,
      maxHp: base.maxHp,
      atk: base.atk,
      def: base.def,
      atkSpeed: base.atkSpeed,
      moveSpeed: base.moveSpeed,
      regen: base.regen,
      range: weapon?.range || 95,
      attackStyle: weapon?.attackStyle || "slash",
      atkTimer: 0,
      hitFlash: 0,
      runBonus: {
        atk: 0,
        maxHp: 0,
        def: 0,
        atkSpeed: 0,
        moveSpeed: 0,
        regen: 0,
        lifeOnKill: 0,
      },
      runMult: {
        atk: 1,
        atkSpeed: 1,
        range: 1,
      },
      healAmountOnRecalc: 0,
      healRatioOnRecalc: 0,
    };
  }

  recalculatePlayerStats() {
    const p = this.player;
    if (!p) return;
    const base = getBaseHubStats();
    const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
    const prevMax = p.maxHp;
    const weaponCategory = weapon?.category || "剣";
    const weaponChanged = p.weaponId !== (weapon?.id || "wp_sword_apprentice");

    p.maxHp = Math.max(10, Math.round(base.maxHp + p.runBonus.maxHp));
    p.atk = Math.max(1, Math.round((base.atk + p.runBonus.atk) * p.runMult.atk));
    p.def = Number((base.def + p.runBonus.def).toFixed(1));
    p.atkSpeed = Math.max(
      0.3,
      Number(((base.atkSpeed + p.runBonus.atkSpeed) * p.runMult.atkSpeed).toFixed(2))
    );
    p.moveSpeed = Math.round(base.moveSpeed + p.runBonus.moveSpeed);
    p.regen = Number((base.regen + p.runBonus.regen).toFixed(1));
    p.range = Math.round((weapon?.range || 95) * p.runMult.range);
    p.attackStyle = weapon?.attackStyle || "slash";
    p.weaponId = weapon?.id || "wp_sword_apprentice";
    p.weaponCategory = weaponCategory;
    p.weaponRarity = weapon?.rarity || "ノーマル";
    p.shieldId = SaveManager.data.equipped.shield || null;

    const newSkillDef = getWeaponSkillDef(p.weaponCategory);
    this.skillMaxCd = newSkillDef.cooldown;
    if (this.skillCooldown > this.skillMaxCd) {
      this.skillCooldown = this.skillMaxCd;
    }
    if (weaponChanged) {
      this.scheduledSwordWaves = [];
    }

    if (p.maxHp > prevMax) {
      p.hp += p.maxHp - prevMax;
    }
    if (p.healAmountOnRecalc > 0) {
      p.hp += p.healAmountOnRecalc;
      p.healAmountOnRecalc = 0;
    }
    if (p.healRatioOnRecalc > 0) {
      p.hp += Math.round(p.maxHp * p.healRatioOnRecalc);
      p.healRatioOnRecalc = 0;
    }
    p.hp = Math.min(p.maxHp, p.hp);
    this.emitHud();
  }

  applyLevelUpPerk(perk: PerkDef) {
    if (!this.player) return;
    perk.apply(this.player);
    this.recalculatePlayerStats();
    if (this.player.xp >= this.player.nextXp) {
      this.checkLevelUp();
    } else {
      this.paused = false;
    }
    this.emitHud();
  }

  private generateGroundProps() {
    this.groundProps = [];
    for (let i = 0; i < 180; i++) {
      this.groundProps.push({
        x: 60 + Math.random() * (ARENA_SIZE - 120),
        y: 60 + Math.random() * (ARENA_SIZE - 120),
        size: 8 + Math.random() * 14,
        kind: i % 3,
        seed: Math.random() * Math.PI,
      });
    }
  }

  private spawnSavedCompanions() {
    if (!this.player) return;
    this.companions = [];
    for (const key of SaveManager.data.unlockedCompanions) {
      const def = COMPANION_CLASSES[key];
      if (!def) continue;
      this.companions.push({
        ...def,
        x: this.player.x + (Math.random() * 80 - 40),
        y: this.player.y + (Math.random() * 80 - 40),
        maxHp: def.hp,
        atkTimer: 0,
        downed: false,
        hitFlash: 0,
        facingX: 1,
        attackAnimTimer: 0,
      });
    }
  }

  private getEnemyScaling(day: number) {
    const hpMult = 1 + (day - 1) * 0.16 + Math.pow(Math.max(0, day - 20), 1.32) * 0.025;
    const atkMult = 1 + (day - 1) * 0.1 + Math.max(0, day - 30) * 0.035;
    const rewardMult = 1 + (day - 1) * 0.08;
    const coinMult = 1 + (day - 1) * 0.14 + Math.pow(Math.max(0, day - 10), 1.52) * 0.35;
    return { hpMult, atkMult, rewardMult, coinMult };
  }

  private spawnEnemy(
    typeId: string,
    options?: {
      x?: number;
      y?: number;
      isSplitChild?: boolean;
      mimicBlockKey?: string;
    }
  ) {
    if (!this.player) return;
    const def = MONSTERS_DB[typeId];
    if (!def) return;
    const isMimic = typeId === MIMIC_MONSTER_ID;
    if (this.enemies.length >= 110 && !def.isBoss && !isMimic) return;

    const scale = this.getEnemyScaling(this.day);
    const angle = Math.random() * Math.PI * 2;
    const dist = isMimic
      ? Math.min(340, Math.max(this.canvas.width, this.canvas.height) * 0.32 + 90)
      : Math.max(this.canvas.width, this.canvas.height) * 0.46 + 140;
    const rawX = options?.x ?? this.player.x + Math.cos(angle) * dist;
    const rawY = options?.y ?? this.player.y + Math.sin(angle) * dist;
    const x = Math.max(40, Math.min(ARENA_SIZE - 40, rawX));
    const y = Math.max(40, Math.min(ARENA_SIZE - 40, rawY));

    const splitFactor = options?.isSplitChild ? 0.36 : 1;
    const hp = Math.max(
      12,
      Math.round(
        def.hp *
          scale.hpMult *
          (def.isStageBoss ? 1 + (this.day / 100) * 0.5 : 1) *
          splitFactor
      )
    );
    const atk = Math.max(2, Math.round(def.atk * scale.atkMult * (options?.isSplitChild ? 0.72 : 1)));
    const defStat = Math.round(def.def * (1 + (this.day - 1) * 0.04));
    const radius = options?.isSplitChild ? Math.max(10, Math.round(def.radius * 0.72)) : def.radius;

    this.enemies.push({
      id: typeId,
      name:
        def.isStageBoss && this.day !== 100
          ? `${this.day}日目の守護者`
          : options?.isSplitChild
            ? `${def.name}（分裂体）`
            : def.name,
      isBoss: !!def.isBoss,
      isStageBoss: !!def.isStageBoss,
      isFinalBoss: typeId === "boss_100",
      isMimic,
      mimicBlockKey: options?.mimicBlockKey,
      shoots: !!def.shoots,
      attackPattern: def.attackPattern,
      x,
      y,
      radius,
      hp,
      maxHp: hp,
      atk,
      def: defStat,
      speed: def.speed + Math.min(45, this.day * 0.4) + (options?.isSplitChild ? 16 : 0),
      xp: Math.max(1, Math.round(def.xp * scale.rewardMult * splitFactor)),
      coins: Math.max(1, Math.round(def.coins * scale.coinMult * splitFactor)),
      color: def.color,
      attackRange: def.attackRange,
      atkCd: def.atkCd,
      atkTimer: 0.45,
      specialTimer: isMimic ? 1.8 : 2.2 + Math.random() * 1.4,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      telegraph: null,
      hitFlash: 0,
      bobPhase: Math.random() * 6,
      facingX: x >= this.player.x ? -1 : 1,
      attackAnimTimer: 0,
      isSplitChild: options?.isSplitChild,
    });

    if (!options?.isSplitChild) {
      this.recentSpawnIds.push(typeId);
      if (this.recentSpawnIds.length > 6) this.recentSpawnIds.shift();

      const { isNewDiscovery } = recordMonsterEncounter(typeId, this.day);
      if (isNewDiscovery) {
        this.callbacks.onToast(`図鑑登録: ${def.name}`);
      }
      this.checkAndNotifyAchievements();
      this.callbacks.onSaveChanged();
    }

    if (def.isStageBoss) {
      this.syncBgm();
    }
  }

  private tryTriggerMimicForDay() {
    if (this.mimicCheckedThisDay) return;
    if (this.day % 10 === 0) {
      this.mimicCheckedThisDay = true;
      return;
    }
    const { shouldSpawn, blockKey } = shouldSpawnMimicToday(this.day);
    if (!shouldSpawn) {
      this.mimicCheckedThisDay = true;
      return;
    }
    if (this.dayTimer < 2.5) return;

    this.mimicCheckedThisDay = true;
    markMimicSpawned(blockKey);
    this.spawnEnemy(MIMIC_MONSTER_ID, { mimicBlockKey: blockKey });
    SoundFX.playMimicAppears();
    this.screenShake = 0.22;
    const areaName = getAreaForDay(this.day).name;
    this.callbacks.onMimicSpawn?.(this.day, areaName);
    this.callbacks.onToast(`レア遭遇！黄金の「ミミック」が出現した！`);
  }

  private pickEnemyTypeForDay(day: number): string {
    const activeBossLikeCount = this.enemies.filter((e) => e.isBoss && !e.isStageBoss && e.hp > 0).length;
    return pickEnemyIdForDay(day, this.recentSpawnIds, activeBossLikeCount);
  }

  private spawnFloatingText(x: number, y: number, text: string, color = "#fff", size = 14) {
    if (this.floatingTexts.length > 60) this.floatingTexts.shift();
    this.floatingTexts.push({ x, y, text, color, size, life: 0.75, maxLife: 0.75 });
  }

  private spawnParticles(x: number, y: number, color: string, count = 6) {
    if (this.particles.length > 160) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 110;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r: 2 + Math.random() * 3,
        color,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
      });
    }
  }

  private damageEnemy(enemy: EnemyEntity, rawDmg: number, knockAngle: number | null, knockForce = 65): boolean {
    const actual = Math.max(1, Math.round(rawDmg - enemy.def * 0.45));
    enemy.hp -= actual;
    enemy.hitFlash = 0.12;
    this.spawnFloatingText(
      enemy.x + (Math.random() * 16 - 8),
      enemy.y - enemy.radius - 4,
      `${actual}`,
      "#fef08a",
      14
    );

    if (knockAngle !== null && !enemy.isBoss) {
      enemy.x = Math.max(32, Math.min(ARENA_SIZE - 32, enemy.x + Math.cos(knockAngle) * (knockForce * 0.12)));
      enemy.y = Math.max(32, Math.min(ARENA_SIZE - 32, enemy.y + Math.sin(knockAngle) * (knockForce * 0.12)));
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      return true;
    }
    SoundFX.playHit();
    return false;
  }

  private killEnemy(enemy: EnemyEntity) {
    const p = this.player;
    if (!p) return;
    SoundFX.playKill();
    SoundFX.playCoin();
    this.spawnParticles(enemy.x, enemy.y, enemy.color, enemy.isBoss || enemy.isMimic ? 28 : 9);
    if (this.deathEffects.length < 40) {
      this.deathEffects.push({
        spriteId: enemy.id,
        isBoss: enemy.isBoss,
        x: enemy.x,
        y: enemy.y,
        radius: enemy.radius,
        facingX: enemy.facingX,
        color: enemy.color,
        life: enemy.isBoss ? 0.55 : 0.34,
        maxLife: enemy.isBoss ? 0.55 : 0.34,
      });
    }

    const coinMult = 1 + SaveManager.data.permUpgrades.coinBonus * 0.1;
    const gainedCoins = Math.max(1, Math.round(enemy.coins * coinMult));
    this.runCoins += gainedCoins;
    SaveManager.data.coins += gainedCoins;
    SaveManager.data.stats.totalKills += 1;

    this.spawnFloatingText(enemy.x, enemy.y - 22, `+${gainedCoins}G`, "#fbbf24", 12);

    // Bestiary record + completion check
    const rewardRes = recordMonsterKill(enemy.id, this.day);
    if (rewardRes.completedDiscoverReward > 0) {
      this.callbacks.onToast(
        `図鑑発見コンプリート報酬 +${rewardRes.completedDiscoverReward.toLocaleString()} G！`
      );
    }
    if (rewardRes.completedDefeatReward > 0) {
      this.callbacks.onToast(
        `図鑑全種討伐コンプリート報酬 +${rewardRes.completedDefeatReward.toLocaleString()} G！`
      );
    }

    // Split monster ability (exp_monster_01)
    if (enemy.attackPattern === "split" && !enemy.isSplitChild && this.enemies.length < 104) {
      for (let i = 0; i < 2; i++) {
        const ang = (Math.PI * i) + Math.random() * 1.2;
        this.spawnEnemy(enemy.id, {
          x: enemy.x + Math.cos(ang) * 26,
          y: enemy.y + Math.sin(ang) * 26,
          isSplitChild: true,
        });
      }
      this.spawnFloatingText(enemy.x, enemy.y - 36, "分裂！", "#4ade80", 13);
    }

    if (p.runBonus.lifeOnKill > 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.runBonus.lifeOnKill);
    }

    p.xp += enemy.xp;

    // Mimic special defeat reward (atomic per 50-day block)
    if (enemy.isMimic && enemy.mimicBlockKey) {
      const mimicReward = resolveMimicRewardAtomic(enemy.mimicBlockKey);
      if (mimicReward) {
        if (mimicReward.coinsGained > 0) {
          this.runCoins += mimicReward.coinsGained;
        }
        SoundFX.playMimicVictory();
        this.spawnParticles(enemy.x, enemy.y, "#facc15", 34);
        this.paused = true;
        this.clearKeys();
        this.checkAndNotifyAchievements();
        this.callbacks.onSaveChanged();
        this.emitHud();
        this.callbacks.onMimicReward?.(mimicReward);
        return;
      }
    }

    this.checkLevelUp();
    this.checkAndNotifyAchievements();

    if (enemy.isFinalBoss) {
      SaveManager.data.stats.boss100Defeated = true;
      SaveManager.save();
      this.checkAndNotifyAchievements();
      this.onDayComplete(true);
    } else if (enemy.isStageBoss) {
      SaveManager.save();
      this.onDayComplete(false);
    }
    this.callbacks.onSaveChanged();
  }

  private checkLevelUp() {
    const p = this.player;
    if (!p) return;
    if (p.xp >= p.nextXp) {
      p.xp -= p.nextXp;
      p.level += 1;
      p.nextXp = Math.round(p.nextXp * 1.28 + 18);
      this.paused = true;
      this.clearKeys();
      SoundFX.playLevelUp();

      const pool = [...LEVEL_UP_PERKS];
      const picks: PerkDef[] = [];
      while (picks.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        picks.push(pool.splice(idx, 1)[0]);
      }
      this.callbacks.onLevelUp(p.level, picks);
    }
  }

  private checkAndNotifyAchievements() {
    evaluateAchievements((ach) => {
      SoundFX.playAchievement();
      this.callbacks.onAchievementUnlock?.(ach);
      this.callbacks.onToast(
        `実績解除: ${ach.name}${ach.rewardCoins > 0 ? ` (+${ach.rewardCoins.toLocaleString()}G)` : ""}`
      );
    });
  }

  private performPlayerAutoAttack(): boolean {
    const p = this.player;
    if (!p) return false;
    let nearest: EnemyEntity | null = null;
    let bestDist = Infinity;

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
      if (d <= p.range && d < bestDist) {
        bestDist = d;
        nearest = e;
      }
    }

    if (!nearest) return false;

    const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    p.facingAngle = angle;
    if (Math.abs(Math.cos(angle)) > 0.15) {
      p.facingX = Math.cos(angle) >= 0 ? 1 : -1;
    }
    p.attackAnimTimer = p.weaponCategory === "大剣" ? 0.28 : 0.22;

    const rarityTheme = getRarityVisualTheme(p.weaponRarity);
    const style = p.attackStyle;
    SoundFX.playWeaponAutoAttack(p.weaponCategory, p.weaponRarity);

    if (style === "arrow" || style === "magic") {
      const projColor =
        p.weaponRarity !== "ノーマル"
          ? rarityTheme.accent
          : style === "arrow"
            ? "#fef08a"
            : "#f472b6";
      this.projectiles.push({
        fromPlayer: true,
        x: p.x + Math.cos(angle) * 18,
        y: p.y + Math.sin(angle) * 18,
        vx: Math.cos(angle) * (style === "arrow" ? 560 : 420),
        vy: Math.sin(angle) * (style === "arrow" ? 560 : 420),
        radius: style === "arrow" ? 5 : 9,
        dmg: p.atk,
        aoe: style === "magic" ? 56 : 0,
        color: projColor,
        life: 1.1,
        visualKind: style === "arrow" ? "arrow" : "magic",
      });
      if (p.weaponRarity !== "ノーマル") {
        this.spawnParticles(p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, rarityTheme.accent, 3);
      }
    } else if (style === "spin") {
      const slashColor = p.weaponRarity === "ノーマル" ? "#fb923c" : rarityTheme.accent;
      this.slashEffects.push({
        x: p.x,
        y: p.y,
        angle,
        arc: Math.PI * 2,
        radius: p.range,
        color: slashColor,
        life: 0.2,
        maxLife: 0.2,
        kind: "spin",
        rarity: p.weaponRarity,
      });
      for (const e of [...this.enemies]) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
        if (d <= p.range) {
          this.damageEnemy(e, p.atk * 1.05, Math.atan2(e.y - p.y, e.x - p.x), 80);
        }
      }
    } else if (style === "thrust") {
      const thrustColor = p.weaponRarity === "ノーマル" ? "#38bdf8" : rarityTheme.accent;
      this.slashEffects.push({
        x: p.x,
        y: p.y,
        angle,
        arc: 0.48,
        radius: p.range,
        length: p.range,
        color: thrustColor,
        life: 0.16,
        maxLife: 0.16,
        kind: "thrust",
        rarity: p.weaponRarity,
      });
      for (const e of [...this.enemies]) {
        if (e.hp <= 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) - e.radius;
        if (d <= p.range) {
          const diff = Math.abs(
            Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle))
          );
          if (diff <= 0.45) {
            this.damageEnemy(e, p.atk * 1.08, angle, 90);
          }
        }
      }
    } else {
      const arc = style === "cleave" ? 2.15 : 1.45;
      const slashColor =
        p.weaponRarity !== "ノーマル"
          ? rarityTheme.accent
          : style === "cleave"
            ? "#f87171"
            : "#e2e8f0";
      this.slashEffects.push({
        x: p.x,
        y: p.y,
        angle,
        arc,
        radius: p.range,
        color: slashColor,
        life: style === "cleave" ? 0.22 : 0.18,
        maxLife: style === "cleave" ? 0.22 : 0.18,
        kind: style === "cleave" ? "cleave" : "slash",
        rarity: p.weaponRarity,
      });
      for (const e of [...this.enemies]) {
        if (e.hp <= 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) - e.radius;
        if (d <= p.range) {
          const diff = Math.abs(
            Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle))
          );
          if (diff <= arc * 0.58) {
            this.damageEnemy(e, p.atk, Math.atan2(dy, dx), style === "cleave" ? 110 : 70);
          }
        }
      }
    }

    this.enemies = this.enemies.filter((e) => e.hp > 0);
    return true;
  }

  private findSkillAimTarget(): EnemyEntity | null {
    const p = this.player;
    if (!p) return null;
    let nearest: EnemyEntity | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestDist && d <= Math.max(360, p.range * 1.6)) {
        bestDist = d;
        nearest = e;
      }
    }
    return nearest;
  }

  private executeSwordSkillWave(angle: number, waveIdx: number) {
    const p = this.player;
    if (!p) return;
    const rarityTheme = getRarityVisualTheme(p.weaponRarity);
    const radius = Math.max(140, p.range * 1.45);
    const arc = 2.05;
    const waveAngle = angle + (waveIdx - 1) * 0.16;

    p.x = Math.max(32, Math.min(ARENA_SIZE - 32, p.x + Math.cos(angle) * 10));
    p.y = Math.max(32, Math.min(ARENA_SIZE - 32, p.y + Math.sin(angle) * 10));
    p.attackAnimTimer = 0.16;

    this.slashEffects.push({
      x: p.x,
      y: p.y,
      angle: waveAngle,
      arc,
      radius,
      color: p.weaponRarity === "ノーマル" ? "#38bdf8" : rarityTheme.accent,
      life: 0.2,
      maxLife: 0.2,
      kind: "slash",
      rarity: p.weaponRarity,
    });
    this.spawnParticles(
      p.x + Math.cos(waveAngle) * (radius * 0.55),
      p.y + Math.sin(waveAngle) * (radius * 0.55),
      rarityTheme.accent,
      rarityTheme.sparkCount
    );

    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) - e.radius;
      if (d <= radius) {
        const diff = Math.abs(
          Math.atan2(Math.sin(Math.atan2(dy, dx) - waveAngle), Math.cos(Math.atan2(dy, dx) - waveAngle))
        );
        if (diff <= arc * 0.62) {
          this.damageEnemy(e, p.atk * 0.92 + 5, Math.atan2(dy, dx), 55);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  triggerActiveSkill() {
    if (this.mode !== "playing" || this.paused || this.skillCooldown > 0 || !this.player) return;
    const p = this.player;
    const skillDef = getWeaponSkillDef(p.weaponCategory);
    const rarityTheme = getRarityVisualTheme(p.weaponRarity);

    this.skillCooldown = skillDef.cooldown;
    this.skillMaxCd = skillDef.cooldown;
    p.skillAnimMax = 0.36;
    p.skillAnimTimer = 0.36;
    p.attackAnimTimer = 0.3;

    const target = this.findSkillAimTarget();
    const aimAngle = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facingAngle;
    p.facingAngle = aimAngle;
    if (Math.abs(Math.cos(aimAngle)) > 0.15) {
      p.facingX = Math.cos(aimAngle) >= 0 ? 1 : -1;
    }

    SoundFX.playWeaponSkill(p.weaponCategory, p.weaponRarity);

    switch (p.weaponCategory) {
      case "剣": {
        this.screenShake = 0.12;
        this.executeSwordSkillWave(aimAngle, 0);
        this.scheduledSwordWaves.push(
          { delay: 0.085, angle: aimAngle, waveIdx: 1 },
          { delay: 0.17, angle: aimAngle, waveIdx: 2 }
        );
        this.spawnFloatingText(p.x, p.y - 32, `${skillDef.name}！`, skillDef.color, 15);
        break;
      }

      case "大剣": {
        const radius = Math.max(175, p.range * 1.48);
        const arc = Math.PI * 1.42;
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: aimAngle,
          arc,
          radius,
          color: p.weaponRarity === "ノーマル" ? "#f87171" : rarityTheme.accent,
          life: 0.34,
          maxLife: 0.34,
          kind: "cleave",
          rarity: p.weaponRarity,
        });
        this.spawnParticles(
          p.x + Math.cos(aimAngle) * (radius * 0.6),
          p.y + Math.sin(aimAngle) * (radius * 0.6),
          rarityTheme.accent,
          rarityTheme.sparkCount + 6
        );
        this.screenShake = 0.24;

        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          const d = Math.hypot(dx, dy) - e.radius;
          if (d <= radius) {
            const diff = Math.abs(
              Math.atan2(Math.sin(Math.atan2(dy, dx) - aimAngle), Math.cos(Math.atan2(dy, dx) - aimAngle))
            );
            if (diff <= arc * 0.56) {
              this.damageEnemy(e, p.atk * 2.85 + 22, Math.atan2(dy, dx), 220);
            }
          }
        }
        this.spawnFloatingText(p.x, p.y - 34, `${skillDef.name}！`, skillDef.color, 16);
        break;
      }

      case "槍": {
        const startX = p.x;
        const startY = p.y;
        const dashDist = Math.max(165, Math.min(220, p.range * 1.05));
        const endX = Math.max(32, Math.min(ARENA_SIZE - 32, startX + Math.cos(aimAngle) * dashDist));
        const endY = Math.max(32, Math.min(ARENA_SIZE - 32, startY + Math.sin(aimAngle) * dashDist));
        p.x = endX;
        p.y = endY;
        p.dashInvulnTimer = 0.24;

        const actualDist = Math.max(80, Math.hypot(endX - startX, endY - startY));
        this.slashEffects.push({
          x: startX,
          y: startY,
          angle: aimAngle,
          arc: 0.45,
          radius: actualDist,
          length: actualDist + 36,
          color: p.weaponRarity === "ノーマル" ? "#38bdf8" : rarityTheme.accent,
          life: 0.28,
          maxLife: 0.28,
          kind: "thrust",
          rarity: p.weaponRarity,
        });

        for (let step = 0; step <= 4; step++) {
          const t = step / 4;
          this.spawnParticles(
            startX + (endX - startX) * t,
            startY + (endY - startY) * t,
            rarityTheme.accent,
            4
          );
        }
        this.screenShake = 0.14;

        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const distToLine = this.pointToSegmentDist(e.x, e.y, startX, startY, endX, endY);
          if (distToLine <= e.radius + 36) {
            this.damageEnemy(e, p.atk * 2.35 + 16, aimAngle, 150);
          }
        }
        this.spawnFloatingText(p.x, p.y - 32, `${skillDef.name}！`, skillDef.color, 15);
        break;
      }

      case "斧": {
        const radius = Math.max(170, p.range * 1.62);
        this.slashEffects.push({
          x: p.x,
          y: p.y,
          angle: 0,
          arc: Math.PI * 2,
          radius,
          color: p.weaponRarity === "ノーマル" ? "#fb923c" : rarityTheme.accent,
          life: 0.36,
          maxLife: 0.36,
          kind: "shockwave",
          rarity: p.weaponRarity,
        });
        this.spawnParticles(p.x, p.y, rarityTheme.accent, rarityTheme.sparkCount + 12);
        this.screenShake = 0.26;

        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y) - e.radius;
          if (d <= radius) {
            this.damageEnemy(e, p.atk * 2.45 + 18, Math.atan2(e.y - p.y, e.x - p.x), 210);
          }
        }
        this.spawnFloatingText(p.x, p.y - 34, `${skillDef.name}！`, skillDef.color, 16);
        break;
      }

      case "弓": {
        const offsets = [-0.28, -0.14, 0, 0.14, 0.28];
        const arrowColor = p.weaponRarity === "ノーマル" ? "#a3e635" : rarityTheme.accent;
        for (const off of offsets) {
          const a = aimAngle + off;
          this.projectiles.push({
            fromPlayer: true,
            x: p.x + Math.cos(a) * 18,
            y: p.y + Math.sin(a) * 18,
            vx: Math.cos(a) * 680,
            vy: Math.sin(a) * 680,
            radius: 8,
            dmg: p.atk * 1.3 + 8,
            aoe: 0,
            color: arrowColor,
            life: 0.95,
            piercing: true,
            hitTargets: new Set<EnemyEntity>(),
            visualKind: "pierce_arrow",
          });
        }
        this.spawnParticles(
          p.x + Math.cos(aimAngle) * 20,
          p.y + Math.sin(aimAngle) * 20,
          arrowColor,
          rarityTheme.sparkCount + 4
        );
        this.screenShake = 0.1;
        this.spawnFloatingText(p.x, p.y - 32, `${skillDef.name}！`, skillDef.color, 15);
        break;
      }

      case "杖": {
        const cx = target ? target.x : Math.max(40, Math.min(ARENA_SIZE - 40, p.x + Math.cos(aimAngle) * 140));
        const cy = target ? target.y : Math.max(40, Math.min(ARENA_SIZE - 40, p.y + Math.sin(aimAngle) * 140));
        const radius = Math.max(150, p.range * 0.62);
        const magicColor = p.weaponRarity === "ノーマル" ? "#c084fc" : rarityTheme.accent;

        this.slashEffects.push({
          x: cx,
          y: cy,
          angle: aimAngle,
          arc: Math.PI * 2,
          radius,
          color: magicColor,
          life: 0.42,
          maxLife: 0.42,
          kind: "magic_nova",
          rarity: p.weaponRarity,
        });
        this.spawnParticles(cx, cy, magicColor, rarityTheme.sparkCount + 14);
        this.screenShake = 0.2;

        for (const e of [...this.enemies]) {
          if (e.hp <= 0) continue;
          const d = Math.hypot(e.x - cx, e.y - cy) - e.radius;
          if (d <= radius) {
            this.damageEnemy(e, p.atk * 2.55 + 20, Math.atan2(e.y - cy, e.x - cx), 140);
          }
        }
        this.spawnFloatingText(p.x, p.y - 34, `${skillDef.name}！`, skillDef.color, 16);
        break;
      }
    }

    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.emitHud();
  }

  useRecoveryPotion() {
    if (this.mode !== "playing" || this.paused || !this.player) return;
    if (this.potionCharges <= 0 || this.potionCd > 0) return;
    const p = this.player;
    if (p.hp >= p.maxHp) {
      this.callbacks.onToast("HPはすでに満タンです");
      return;
    }
    this.potionCharges -= 1;
    this.potionCd = 1.5;
    SoundFX.playHeal();
    const heal = Math.round(p.maxHp * 0.45);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    p.poisonTimer = 0;
    p.slowTimer = 0;
    this.spawnParticles(p.x, p.y, "#4ade80", 12);
    this.spawnFloatingText(p.x, p.y - 26, `+${heal} HP`, "#4ade80", 16);
    this.emitHud();
  }

  private applyStatusToPlayer(status?: "poison" | "freeze" | "mud" | "burn") {
    const p = this.player;
    if (!p || !status) return;
    if (status === "poison") {
      p.poisonTimer = Math.max(p.poisonTimer, 3.2);
      p.poisonDps = Math.max(p.poisonDps, Math.max(2, Math.round(p.maxHp * 0.025)));
      this.spawnFloatingText(p.x, p.y - 36, "毒！", "#a3e635", 13);
    } else if (status === "freeze" || status === "mud") {
      p.slowTimer = Math.max(p.slowTimer, 2.2);
      this.spawnFloatingText(
        p.x,
        p.y - 36,
        status === "freeze" ? "凍結減速！" : "泥沼減速！",
        status === "freeze" ? "#38bdf8" : "#d97706",
        13
      );
    } else if (status === "burn") {
      p.poisonTimer = Math.max(p.poisonTimer, 2.0);
      p.poisonDps = Math.max(p.poisonDps, Math.max(3, Math.round(p.maxHp * 0.03)));
      this.spawnFloatingText(p.x, p.y - 36, "炎上！", "#f97316", 13);
    }
  }

  private damagePlayer(rawDmg: number, status?: "poison" | "freeze" | "mud" | "burn") {
    const p = this.player;
    if (!p) return;
    if (p.dashInvulnTimer > 0) return;

    const dmg = Math.max(1, Math.round(rawDmg - p.def * 0.65));
    p.hp -= dmg;
    p.hitFlash = 0.18;
    this.screenShake = 0.12;
    if (p.shieldId) {
      p.guardFlashTimer = 0.24;
      SoundFX.playShieldBlock();
      this.slashEffects.push({
        x: p.x,
        y: p.y,
        angle: p.facingAngle,
        arc: Math.PI * 1.1,
        radius: 30,
        color: "#60a5fa",
        life: 0.18,
        maxLife: 0.18,
        kind: "guard",
        rarity: p.weaponRarity,
      });
    } else {
      SoundFX.playPlayerHurt();
    }
    this.spawnFloatingText(p.x, p.y - 24, `-${dmg}`, "#ef4444", 15);
    if (status) this.applyStatusToPlayer(status);

    if (p.hp <= 0) {
      p.hp = 0;
      this.handlePlayerDeath();
    }
  }

  private handlePlayerDeath() {
    this.paused = true;
    this.clearKeys();
    SoundFX.playPlayerDeath();
    const reached = this.day;
    if (reached > SaveManager.data.bestDay) {
      SaveManager.data.bestDay = reached;
    }
    SaveManager.save();
    this.checkAndNotifyAchievements();
    this.callbacks.onSaveChanged();
    this.emitHud();

    this.callbacks.onDeath({
      reachedDay: reached,
      bestDay: SaveManager.data.bestDay,
      runCoins: this.runCoins,
      totalCoins: SaveManager.data.coins,
    });
  }

  private onDayComplete(isDay100BossClear: boolean) {
    const prevArea = getAreaForDay(this.day);
    this.day += 1;
    this.dayTimer = 0;
    this.bossSpawnedThisDay = false;
    this.mimicCheckedThisDay = false;

    if (this.day > SaveManager.data.bestDay) {
      SaveManager.data.bestDay = this.day;
    }

    if (this.player) {
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp + Math.round(this.player.maxHp * 0.12)
      );
    }

    if (this.day % 3 === 0 && this.potionCharges < this.potionMaxCharges) {
      this.potionCharges += 1;
      SoundFX.playItemPickup();
      this.callbacks.onToast("回復薬を1つ補充した");
    }

    for (const c of this.companions) {
      c.downed = false;
      c.hp = c.maxHp;
    }

    if (this.day >= 150 && (this.day - 150) % 50 === 0) {
      const classKeys = Object.keys(COMPANION_CLASSES);
      const idx = Math.floor((this.day - 150) / 50) % classKeys.length;
      const key = classKeys[idx];
      if (!SaveManager.data.unlockedCompanions.includes(key)) {
        SaveManager.data.unlockedCompanions.push(key);
        this.spawnSavedCompanions();
        SoundFX.playItemPickup();
        this.callbacks.onToast(`新たな仲間「${COMPANION_CLASSES[key].name}」を救出した！`);
      }
    }

    const nextArea = getAreaForDay(this.day);
    if (nextArea.id !== prevArea.id) {
      this.callbacks.onToast(`新エリア解放: ${nextArea.name}`);
    }

    if (isDay100BossClear) {
      this.paused = true;
      this.clearKeys();
      SoundFX.playFinalVictory();
      this.callbacks.onVictory100();
    } else if (this.day % 10 === 0) {
      SoundFX.playBossAppears();
      this.callbacks.onToast(`${this.day}日目: ボスが出現した！`);
    }

    this.syncBgm();
    SaveManager.save();
    this.checkAndNotifyAchievements();
    this.callbacks.onSaveChanged();
  }

  private damageTarget(
    targetComp: CompanionEntity | null,
    rawDmg: number,
    status?: "poison" | "freeze" | "mud" | "burn"
  ) {
    if (targetComp) {
      targetComp.hp -= Math.max(1, Math.round(rawDmg - targetComp.def));
      targetComp.hitFlash = 0.14;
      if (targetComp.hp <= 0) {
        targetComp.hp = 0;
        targetComp.downed = true;
        this.callbacks.onToast(`${targetComp.name}が戦闘離脱（翌日復活）`);
      }
    } else {
      this.damagePlayer(rawDmg, status);
    }
  }

  private updateEnemyAI(e: EnemyEntity, dt: number, p: PlayerState) {
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.attackAnimTimer > 0) e.attackAnimTimer = Math.max(0, e.attackAnimTimer - dt);
    e.bobPhase += dt * 7;

    // Troll slow natural regeneration
    if (e.attackPattern === "slow_slam" && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.008 * dt);
    }

    let targetObj: { x: number; y: number; radius: number } = p;
    let targetComp: CompanionEntity | null = null;
    for (const c of this.companions) {
      if (!c.downed && c.role === "騎士") {
        const dC = Math.hypot(c.x - e.x, c.y - e.y);
        const dP = Math.hypot(p.x - e.x, p.y - e.y);
        if (dC < dP && dC < 240) {
          targetObj = { x: c.x, y: c.y, radius: 14 };
          targetComp = c;
        }
      }
    }

    const dx = targetObj.x - e.x;
    const dy = targetObj.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    if (Math.abs(nx) > 0.12) {
      e.facingX = nx >= 0 ? 1 : -1;
    }

    // Active dash movement (charge, phase_dash, dive_bomb, shadow_combo, shield_charge, ambush)
    if (e.dashTimer > 0) {
      e.dashTimer = Math.max(0, e.dashTimer - dt);
      e.x = Math.max(32, Math.min(ARENA_SIZE - 32, e.x + e.dashVx * dt));
      e.y = Math.max(32, Math.min(ARENA_SIZE - 32, e.y + e.dashVy * dt));
      if (Math.random() < 0.45) {
        this.spawnParticles(e.x, e.y, e.color, 1);
      }
    }

    // Telegraph resolution
    if (e.telegraph) {
      e.telegraph.timer -= dt;
      if (e.telegraph.timer <= 0) {
        const tel = e.telegraph;
        const td = Math.hypot(p.x - tel.x, p.y - tel.y);
        const mult = tel.dmgMult ?? 1.35;
        if (td <= tel.radius + p.radius) {
          const status =
            tel.kind === "ice"
              ? "freeze"
              : tel.kind === "mud" || tel.kind === "root"
                ? "mud"
                : tel.kind === "fire"
                  ? "burn"
                  : undefined;
          this.damagePlayer(e.atk * mult, status);
          if (tel.slowSec && p) {
            p.slowTimer = Math.max(p.slowTimer, tel.slowSec);
          }
        }
        if (tel.kind === "burrow") {
          // Sand Worm surfaces at telegraph center
          e.x = Math.max(36, Math.min(ARENA_SIZE - 36, tel.x));
          e.y = Math.max(36, Math.min(ARENA_SIZE - 36, tel.y));
          e.attackAnimTimer = 0.25;
        }
        this.spawnParticles(tel.x, tel.y, e.color, e.isBoss ? 16 : 10);
        e.telegraph = null;
      }
    }

    // Special Ability / Telegraph Triggers
    e.specialTimer -= dt;
    if (!e.telegraph && e.specialTimer <= 0) {
      const ang = Math.atan2(dy, dx);
      if (e.isStageBoss) {
        e.specialTimer = e.isFinalBoss ? 2.8 : 3.8;
        e.attackAnimTimer = 0.3;
        e.telegraph = { x: p.x, y: p.y, radius: 68, timer: 0.95, maxTimer: 0.95, kind: "aoe", dmgMult: 1.45 };
        const count = e.isFinalBoss ? 10 : 6;
        for (let i = 0; i < count; i++) {
          const a = (Math.PI * 2 * i) / count;
          this.projectiles.push({
            fromPlayer: false,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 210,
            vy: Math.sin(a) * 210,
            radius: 7,
            dmg: e.atk * 0.9,
            aoe: 0,
            color: "#f43f5e",
            life: 2.0,
            visualKind: "enemy",
          });
        }
      } else if (e.attackPattern === "elite_magic") {
        e.specialTimer = 3.6;
        e.telegraph = { x: p.x, y: p.y, radius: 52, timer: 0.9, maxTimer: 0.9, kind: "aoe", dmgMult: 1.35 };
      } else if (e.attackPattern === "fire_aoe") {
        e.specialTimer = 3.4;
        if (dist <= e.attackRange + 80) {
          e.telegraph = { x: p.x, y: p.y, radius: 56, timer: 0.95, maxTimer: 0.95, kind: "fire", dmgMult: 1.35 };
        }
      } else if (e.attackPattern === "curse_magic") {
        e.specialTimer = 3.8;
        if (dist <= e.attackRange + 70) {
          e.telegraph = { x: p.x, y: p.y, radius: 54, timer: 1.0, maxTimer: 1.0, kind: "aoe", dmgMult: 1.3 };
        }
      } else if (e.attackPattern === "root_snare") {
        e.specialTimer = 3.5;
        if (dist <= e.attackRange + 55) {
          e.telegraph = { x: p.x, y: p.y, radius: 54, timer: 0.95, maxTimer: 0.95, kind: "root", dmgMult: 1.15, slowSec: 2.2 };
        }
      } else if (e.attackPattern === "armor_slam" || e.attackPattern === "slow_slam") {
        e.specialTimer = 3.4;
        if (dist <= e.attackRange + 35) {
          e.telegraph = {
            x: e.x,
            y: e.y,
            radius: e.attackPattern === "armor_slam" ? 72 : 62,
            timer: 0.85,
            maxTimer: 0.85,
            kind: "aoe",
            dmgMult: 1.4,
          };
        }
      } else if (e.attackPattern === "burrow_breach") {
        e.specialTimer = 3.8;
        if (dist <= e.attackRange + 80) {
          e.telegraph = { x: p.x, y: p.y, radius: 52, timer: 0.9, maxTimer: 0.9, kind: "burrow", dmgMult: 1.45 };
        }
      } else if (
        e.attackPattern === "charge" ||
        e.attackPattern === "phase_dash" ||
        e.attackPattern === "dive_bomb" ||
        e.attackPattern === "shield_charge" ||
        e.attackPattern === "shadow_combo" ||
        e.attackPattern === "ambush"
      ) {
        e.specialTimer = e.attackPattern === "ambush" ? 2.7 : 3.1;
        if (dist <= e.attackRange + 60 && dist > e.radius + targetObj.radius + 14) {
          e.dashTimer = 0.28;
          const dashSpd = e.speed * (e.attackPattern === "phase_dash" ? 3.2 : 2.6);
          e.dashVx = Math.cos(ang) * dashSpd;
          e.dashVy = Math.sin(ang) * dashSpd;
          e.attackAnimTimer = 0.25;
          this.spawnParticles(e.x, e.y, e.color, 6);
        }
      } else if (e.attackPattern === "multi_element") {
        e.specialTimer = 3.4;
        e.telegraph = { x: p.x, y: p.y, radius: 64, timer: 0.9, maxTimer: 0.9, kind: "fire", dmgMult: 1.4 };
        const elems: Array<{ c: string; v: ProjectileEntity["visualKind"]; st?: ProjectileEntity["statusEffect"] }> = [
          { c: "#f97316", v: "fire", st: "burn" },
          { c: "#38bdf8", v: "ice", st: "freeze" },
          { c: "#facc15", v: "lightning" },
        ];
        for (let i = -1; i <= 1; i++) {
          const el = elems[i + 1];
          const a = ang + i * 0.24;
          this.projectiles.push({
            fromPlayer: false,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 245,
            vy: Math.sin(a) * 245,
            radius: 7,
            dmg: e.atk * 0.85,
            aoe: 0,
            color: el.c,
            life: 2.0,
            statusEffect: el.st,
            visualKind: el.v,
          });
        }
      } else if (e.attackPattern === "fire_breath") {
        e.specialTimer = 3.2;
        e.telegraph = { x: p.x, y: p.y, radius: 70, timer: 0.95, maxTimer: 0.95, kind: "fire", dmgMult: 1.5 };
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * 0.17;
          this.projectiles.push({
            fromPlayer: false,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            radius: 7,
            dmg: e.atk * 0.8,
            aoe: 0,
            color: "#fb923c",
            life: 1.9,
            statusEffect: "burn",
            visualKind: "fire",
          });
        }
      }
    }

    // Standard movement
    const stopDist = e.shoots ? e.attackRange * 0.78 : e.radius + targetObj.radius - 2;
    if (dist > stopDist && e.dashTimer <= 0) {
      e.x = Math.max(32, Math.min(ARENA_SIZE - 32, e.x + nx * e.speed * dt));
      e.y = Math.max(32, Math.min(ARENA_SIZE - 32, e.y + ny * e.speed * dt));
    }

    // Primary attack cooldown
    e.atkTimer -= dt;
    if (dist <= e.attackRange + targetObj.radius && e.atkTimer <= 0) {
      e.atkTimer = e.atkCd;
      e.attackAnimTimer = 0.22;
      const aimAng = Math.atan2(dy, dx);

      if (e.shoots && dist > e.radius + targetObj.radius + 14) {
        this.performEnemyRangedAttack(e, aimAng, nx, ny, targetObj);
      } else if (dist <= e.radius + targetObj.radius + 18) {
        this.performEnemyMeleeAttack(e, aimAng, targetComp);
      }
    }
  }

  private performEnemyRangedAttack(
    e: EnemyEntity,
    aimAng: number,
    nx: number,
    ny: number,
    targetObj: { x: number; y: number; radius: number }
  ) {
    switch (e.attackPattern) {
      case "poison":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 225,
          vy: ny * 225,
          radius: 6,
          dmg: e.atk * 0.85,
          aoe: 0,
          color: "#84cc16",
          life: 1.6,
          statusEffect: "poison",
          visualKind: "poison",
        });
        break;
      case "drain":
      case "charm_bolt":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 235,
          vy: ny * 235,
          radius: 6.5,
          dmg: e.atk,
          aoe: 0,
          color: e.attackPattern === "charm_bolt" ? "#ec4899" : "#93c5fd",
          life: 1.9,
          lifesteal: 0.6,
          sourceEnemy: e,
          visualKind: "arcane",
        });
        break;
      case "curse_magic":
      case "homing_orb":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 205,
          vy: ny * 205,
          radius: 6.5,
          dmg: e.atk,
          aoe: 0,
          color: e.color,
          life: 2.3,
          homing: true,
          homingTurn: e.attackPattern === "homing_orb" ? 2.5 : 1.7,
          visualKind: "arcane",
        });
        break;
      case "freeze":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 250,
          vy: ny * 250,
          radius: 6.5,
          dmg: e.atk,
          aoe: 0,
          color: "#38bdf8",
          life: 1.8,
          statusEffect: "freeze",
          visualKind: "ice",
        });
        break;
      case "mud_slow":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 220,
          vy: ny * 220,
          radius: 7,
          dmg: e.atk,
          aoe: 0,
          color: "#b45309",
          life: 1.7,
          statusEffect: "mud",
          visualKind: "enemy",
        });
        break;
      case "fire_aoe":
      case "fire_bolt":
      case "fire_breath":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 270,
          vy: ny * 270,
          radius: 6.5,
          dmg: e.atk,
          aoe: 0,
          color: "#f97316",
          life: 1.75,
          statusEffect: "burn",
          visualKind: "fire",
        });
        break;
      case "chain_lightning":
        this.slashEffects.push({
          x: e.x,
          y: e.y,
          angle: aimAng,
          arc: 0,
          radius: 10,
          color: "#facc15",
          life: 0.16,
          maxLife: 0.16,
          kind: "lightning_bolt",
          targetX: targetObj.x,
          targetY: targetObj.y,
        });
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 330,
          vy: ny * 330,
          radius: 5.5,
          dmg: e.atk,
          aoe: 0,
          color: "#facc15",
          life: 1.4,
          visualKind: "lightning",
        });
        break;
      case "swarm":
      case "tidal_surge": {
        const spread = e.attackPattern === "tidal_surge" ? [-0.26, 0, 0.26] : [-0.22, 0, 0.22];
        const spd = e.attackPattern === "tidal_surge" ? 245 : 230;
        if (e.attackPattern === "tidal_surge") {
          this.slashEffects.push({
            x: e.x,
            y: e.y,
            angle: aimAng,
            arc: Math.PI * 2,
            radius: 44,
            color: "#38bdf8",
            life: 0.22,
            maxLife: 0.22,
            kind: "tidal",
          });
        }
        for (const off of spread) {
          const a = aimAng + off;
          this.projectiles.push({
            fromPlayer: false,
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: 6,
            dmg: e.atk * 0.78,
            aoe: 0,
            color: e.color,
            life: 1.75,
            visualKind: e.attackPattern === "tidal_surge" ? "water" : "arcane",
          });
        }
        break;
      }
      case "soul_slash":
        this.slashEffects.push({
          x: e.x,
          y: e.y,
          angle: aimAng,
          arc: 1.2,
          radius: 42,
          color: "#22d3ee",
          life: 0.2,
          maxLife: 0.2,
          kind: "enemy_slash",
        });
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 290,
          vy: ny * 290,
          radius: 8,
          dmg: e.atk,
          aoe: 0,
          color: "#22d3ee",
          life: 1.7,
          visualKind: "ice",
        });
        break;
      case "multi_element":
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 255,
          vy: ny * 255,
          radius: 7,
          dmg: e.atk,
          aoe: 0,
          color: "#f59e0b",
          life: 1.85,
          visualKind: "fire",
        });
        break;
      default:
        this.projectiles.push({
          fromPlayer: false,
          x: e.x,
          y: e.y,
          vx: nx * 245,
          vy: ny * 245,
          radius: 6,
          dmg: e.atk,
          aoe: 0,
          color: e.color,
          life: 1.8,
          visualKind: "enemy",
        });
        break;
    }
  }

  private performEnemyMeleeAttack(
    e: EnemyEntity,
    aimAng: number,
    targetComp: CompanionEntity | null
  ) {
    let dmg = e.atk;
    let status: "poison" | "freeze" | "mud" | "burn" | undefined;

    if (e.attackPattern === "poison") {
      status = "poison";
    } else if (e.attackPattern === "freeze") {
      status = "freeze";
    } else if (e.attackPattern === "mud_slow" || e.attackPattern === "root_snare") {
      status = "mud";
    } else if (e.attackPattern === "fire_aoe" || e.attackPattern === "fire_bolt" || e.attackPattern === "fire_breath") {
      status = "burn";
    } else if (e.attackPattern === "heavy_melee" || e.attackPattern === "slow_slam") {
      dmg = Math.round(e.atk * 1.18);
      this.slashEffects.push({
        x: e.x,
        y: e.y,
        angle: aimAng,
        arc: 1.5,
        radius: e.radius + 22,
        color: e.color,
        life: 0.18,
        maxLife: 0.18,
        kind: "enemy_slash",
      });
    } else if (e.attackPattern === "fast_melee" || e.attackPattern === "ambush") {
      this.slashEffects.push({
        x: e.x,
        y: e.y,
        angle: aimAng,
        arc: 0.9,
        radius: e.radius + 16,
        color: e.attackPattern === "ambush" ? "#facc15" : "#fef08a",
        life: 0.15,
        maxLife: 0.15,
        kind: "bite",
      });
    } else if (e.attackPattern === "rapid_combo" || e.attackPattern === "shadow_combo") {
      dmg = Math.round(e.atk * 1.15);
      this.slashEffects.push({
        x: e.x,
        y: e.y,
        angle: aimAng,
        arc: 1.3,
        radius: e.radius + 20,
        color: e.attackPattern === "shadow_combo" ? "#a855f7" : "#f87171",
        life: 0.16,
        maxLife: 0.16,
        kind: "enemy_slash",
      });
    }

    if (e.attackPattern === "drain" || e.attackPattern === "charm_bolt") {
      e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.08));
    }

    this.damageTarget(targetComp, dmg, status);
  }

  private update(dt: number) {
    if (this.mode !== "playing" || this.paused || !this.player) return;

    const p = this.player;
    this.elapsedTotal += dt;
    if (this.skillCooldown > 0) this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    if (this.potionCd > 0) this.potionCd = Math.max(0, this.potionCd - dt);
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.attackAnimTimer > 0) p.attackAnimTimer = Math.max(0, p.attackAnimTimer - dt);
    if (p.skillAnimTimer > 0) p.skillAnimTimer = Math.max(0, p.skillAnimTimer - dt);
    if (p.dashInvulnTimer > 0) p.dashInvulnTimer = Math.max(0, p.dashInvulnTimer - dt);
    if (p.guardFlashTimer > 0) p.guardFlashTimer = Math.max(0, p.guardFlashTimer - dt);
    if (p.slowTimer > 0) p.slowTimer = Math.max(0, p.slowTimer - dt);

    // Poison / burn DoT debuff
    if (p.poisonTimer > 0) {
      p.poisonTimer = Math.max(0, p.poisonTimer - dt);
      p.poisonTickTimer += dt;
      if (p.poisonTickTimer >= 0.75) {
        p.poisonTickTimer -= 0.75;
        const tickDmg = Math.max(1, Math.round(p.poisonDps * 0.75));
        p.hp -= tickDmg;
        this.spawnFloatingText(p.x, p.y - 28, `-${tickDmg}`, "#84cc16", 12);
        if (p.hp <= 0) {
          p.hp = 0;
          this.handlePlayerDeath();
          return;
        }
      }
    } else {
      p.poisonTickTimer = 0;
    }

    if (this.scheduledSwordWaves.length > 0) {
      const remaining: typeof this.scheduledSwordWaves = [];
      for (const w of this.scheduledSwordWaves) {
        w.delay -= dt;
        if (w.delay <= 0) {
          this.executeSwordSkillWave(w.angle, w.waveIdx);
        } else {
          remaining.push(w);
        }
      }
      this.scheduledSwordWaves = remaining;
    }

    // 1. プレイヤー移動（斜め正規化＆境界クランプ）
    let mx = 0;
    let my = 0;
    if (this.keys["KeyW"] || this.keys["ArrowUp"]) my -= 1;
    if (this.keys["KeyS"] || this.keys["ArrowDown"]) my += 1;
    if (this.keys["KeyA"] || this.keys["ArrowLeft"]) mx -= 1;
    if (this.keys["KeyD"] || this.keys["ArrowRight"]) mx += 1;
    if (this.joyActive) {
      mx += this.joyX;
      my += this.joyY;
    }

    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      const nx = mx / Math.max(1, len);
      const ny = my / Math.max(1, len);
      const slowMult = p.slowTimer > 0 ? 0.7 : 1;
      p.x += nx * p.moveSpeed * slowMult * dt;
      p.y += ny * p.moveSpeed * slowMult * dt;
      p.x = Math.max(32, Math.min(ARENA_SIZE - 32, p.x));
      p.y = Math.max(32, Math.min(ARENA_SIZE - 32, p.y));
      p.facingAngle = Math.atan2(ny, nx);
      if (Math.abs(nx) > 0.08) {
        p.facingX = nx >= 0 ? 1 : -1;
      }
      p.walkPhase += dt * 11 * slowMult;
    }

    // 自動回復
    if (p.hp < p.maxHp && p.regen > 0) {
      p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    }

    // 自動攻撃
    p.atkTimer -= dt;
    if (p.atkTimer <= 0) {
      if (this.performPlayerAutoAttack()) {
        p.atkTimer = 1 / p.atkSpeed;
      } else {
        p.atkTimer = 0.05;
      }
    }

    // 2. 日数・敵出現制御
    const isBossDay = this.day % 10 === 0;
    if (isBossDay) {
      if (!this.bossSpawnedThisDay) {
        this.bossSpawnedThisDay = true;
        this.spawnEnemy(this.day === 100 ? "boss_100" : "boss_mid");
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < 12) {
        this.spawnEnemy(this.pickEnemyTypeForDay(this.day));
        this.spawnTimer = 2.6;
      }
    } else {
      this.dayTimer += dt;
      this.tryTriggerMimicForDay();
      if (this.dayTimer >= DAY_DURATION) {
        this.onDayComplete(false);
      }
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const batch = Math.min(4, 1 + Math.floor(this.day / 8));
        for (let i = 0; i < batch; i++) {
          this.spawnEnemy(this.pickEnemyTypeForDay(this.day));
        }
        this.spawnTimer = Math.max(0.58, 1.85 - this.day * 0.025);
      }
    }

    // 3. 仲間AI
    for (const c of this.companions) {
      if (c.downed) continue;
      if (c.hitFlash > 0) c.hitFlash -= dt;
      if (c.attackAnimTimer > 0) c.attackAnimTimer = Math.max(0, c.attackAnimTimer - dt);
      c.atkTimer -= dt;

      if (c.role === "僧侶") {
        const distP = Math.hypot(p.x - c.x, p.y - c.y);
        if (distP > 75) {
          const a = Math.atan2(p.y - c.y, p.x - c.x);
          c.x = Math.max(32, Math.min(ARENA_SIZE - 32, c.x + Math.cos(a) * c.speed * dt));
          c.y = Math.max(32, Math.min(ARENA_SIZE - 32, c.y + Math.sin(a) * c.speed * dt));
          if (Math.abs(Math.cos(a)) > 0.15) c.facingX = Math.cos(a) >= 0 ? 1 : -1;
        }
        if (c.atkTimer <= 0 && p.hp < p.maxHp) {
          c.atkTimer = c.cd;
          c.attackAnimTimer = 0.25;
          const heal = Math.round(p.maxHp * 0.08 + 12);
          p.hp = Math.min(p.maxHp, p.hp + heal);
          this.spawnFloatingText(p.x, p.y - 24, `+${heal}`, "#f472b6", 13);
        }
      } else {
        let target: EnemyEntity | null = null;
        let best = Infinity;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - c.x, e.y - c.y);
          if (d < best) {
            best = d;
            target = e;
          }
        }
        if (target && best > c.range * 0.85) {
          const a = Math.atan2(target.y - c.y, target.x - c.x);
          c.x = Math.max(32, Math.min(ARENA_SIZE - 32, c.x + Math.cos(a) * c.speed * dt));
          c.y = Math.max(32, Math.min(ARENA_SIZE - 32, c.y + Math.sin(a) * c.speed * dt));
          if (Math.abs(Math.cos(a)) > 0.15) c.facingX = Math.cos(a) >= 0 ? 1 : -1;
        } else if (!target) {
          const distP = Math.hypot(p.x - c.x, p.y - c.y);
          if (distP > 85) {
            const a = Math.atan2(p.y - c.y, p.x - c.x);
            c.x = Math.max(32, Math.min(ARENA_SIZE - 32, c.x + Math.cos(a) * c.speed * dt));
            c.y = Math.max(32, Math.min(ARENA_SIZE - 32, c.y + Math.sin(a) * c.speed * dt));
            if (Math.abs(Math.cos(a)) > 0.15) c.facingX = Math.cos(a) >= 0 ? 1 : -1;
          }
        }
        if (target && best <= c.range + target.radius && c.atkTimer <= 0) {
          c.atkTimer = c.cd;
          c.attackAnimTimer = 0.22;
          const a = Math.atan2(target.y - c.y, target.x - c.x);
          if (Math.abs(Math.cos(a)) > 0.15) c.facingX = Math.cos(a) >= 0 ? 1 : -1;
          if (c.role === "弓使い" || c.role === "魔法使い") {
            this.projectiles.push({
              fromPlayer: true,
              x: c.x,
              y: c.y,
              vx: Math.cos(a) * 440,
              vy: Math.sin(a) * 440,
              radius: 6,
              dmg: c.atk,
              aoe: c.role === "魔法使い" ? 48 : 0,
              color: c.color,
              life: 1.0,
            });
          } else {
            this.damageEnemy(target, c.atk, a, 50);
          }
        }
      }
    }

    // 4. モンスターAI
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      this.updateEnemyAI(e, dt, p);
      if (this.paused || this.mode !== "playing") return;
    }

    // 敵同士の重なり防止
    const eCount = this.enemies.length;
    for (let i = 0; i < eCount; i++) {
      const a = this.enemies[i];
      for (let j = i + 1; j < eCount; j++) {
        const b = this.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.35;
          const px = (dx / d) * push;
          const py = (dy / d) * push;
          if (!a.isBoss) {
            a.x = Math.max(32, Math.min(ARENA_SIZE - 32, a.x - px));
            a.y = Math.max(32, Math.min(ARENA_SIZE - 32, a.y - py));
          }
          if (!b.isBoss) {
            b.x = Math.max(32, Math.min(ARENA_SIZE - 32, b.x + px));
            b.y = Math.max(32, Math.min(ARENA_SIZE - 32, b.y + py));
          }
        }
      }
    }

    // 5. 飛び道具
    for (const proj of this.projectiles) {
      if (proj.homing && !proj.fromPlayer) {
        const curSpd = Math.hypot(proj.vx, proj.vy) || 200;
        const curAng = Math.atan2(proj.vy, proj.vx);
        const targetAng = Math.atan2(p.y - proj.y, p.x - proj.x);
        const diff = Math.atan2(Math.sin(targetAng - curAng), Math.cos(targetAng - curAng));
        const maxTurn = (proj.homingTurn ?? 2.0) * dt;
        const nextAng = curAng + Math.max(-maxTurn, Math.min(maxTurn, diff));
        proj.vx = Math.cos(nextAng) * curSpd;
        proj.vy = Math.sin(nextAng) * curSpd;
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.life -= dt;
      if (proj.life <= 0) continue;

      if (proj.fromPlayer) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          if (proj.piercing && proj.hitTargets?.has(e)) continue;
          if (Math.hypot(e.x - proj.x, e.y - proj.y) <= e.radius + proj.radius) {
            if (proj.aoe > 0) {
              this.spawnParticles(proj.x, proj.y, proj.color, 10);
              for (const sub of [...this.enemies]) {
                if (sub.hp > 0 && Math.hypot(sub.x - proj.x, sub.y - proj.y) <= proj.aoe + sub.radius) {
                  this.damageEnemy(sub, proj.dmg, Math.atan2(sub.y - proj.y, sub.x - proj.x), 55);
                }
              }
            } else {
              this.damageEnemy(e, proj.dmg, Math.atan2(proj.vy, proj.vx), 45);
            }
            if (proj.piercing) {
              proj.hitTargets?.add(e);
              this.spawnParticles(proj.x, proj.y, proj.color, 3);
            } else {
              proj.life = 0;
              break;
            }
          }
        }
      } else {
        if (Math.hypot(p.x - proj.x, p.y - proj.y) <= p.radius + proj.radius) {
          this.damagePlayer(proj.dmg, proj.statusEffect);
          if (proj.lifesteal && proj.sourceEnemy && proj.sourceEnemy.hp > 0) {
            const heal = Math.max(2, Math.round(proj.dmg * proj.lifesteal));
            proj.sourceEnemy.hp = Math.min(proj.sourceEnemy.maxHp, proj.sourceEnemy.hp + heal);
          }
          proj.life = 0;
          if (this.paused || this.mode !== "playing") return;
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0);

    // 6. エフェクト
    for (const s of this.slashEffects) s.life -= dt;
    this.slashEffects = this.slashEffects.filter((s) => s.life > 0);

    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);

    for (const de of this.deathEffects) {
      de.life -= dt;
    }
    this.deathEffects = this.deathEffects.filter((de) => de.life > 0);

    for (const ft of this.floatingTexts) {
      ft.y -= 32 * dt;
      ft.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.life > 0);

    // カメラ追従
    this.camera.x += (p.x - this.camera.x) * Math.min(1, dt * 10);
    this.camera.y += (p.y - this.camera.y) * Math.min(1, dt * 10);
  }

  emitHud() {
    if (!this.player) return;
    const p = this.player;
    const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
    const skillDef = getWeaponSkillDef(p.weaponCategory);
    const bossEntity = this.enemies.find((e) => e.isStageBoss && e.hp > 0) || null;
    const mimicActive = this.enemies.some((e) => e.isMimic && e.hp > 0);
    const isBossDay = this.day % 10 === 0;

    this.callbacks.onHudUpdate({
      level: p.level,
      hp: p.hp,
      maxHp: p.maxHp,
      xp: p.xp,
      nextXp: p.nextXp,
      coins: SaveManager.data.coins,
      runCoins: this.runCoins,
      day: this.day,
      dayProgress: isBossDay ? 1 : Math.min(1, this.dayTimer / DAY_DURATION),
      isBossDay,
      areaName: getAreaForDay(this.day).name,
      elapsedTotal: this.elapsedTotal,
      gameSpeed: this.gameSpeed,
      mimicActive,
      playerDebuffs: {
        poisoned: p.poisonTimer > 0,
        slowed: p.slowTimer > 0,
      },
      weaponId: p.weaponId,
      weaponName: weapon?.name || "素手",
      weaponCategory: p.weaponCategory,
      weaponRarity: p.weaponRarity,
      shieldId: p.shieldId,
      skillName: skillDef.name,
      skillDesc: skillDef.desc,
      skillColor: skillDef.color,
      skillCooldown: this.skillCooldown,
      skillMaxCd: this.skillMaxCd,
      potionCharges: this.potionCharges,
      potionMaxCharges: this.potionMaxCharges,
      potionCooldown: this.potionCd,
      boss: bossEntity
        ? { name: bossEntity.name, hp: bossEntity.hp, maxHp: bossEntity.maxHp }
        : null,
      playerStats: {
        atk: p.atk,
        def: p.def,
        atkSpeed: p.atkSpeed,
        moveSpeed: p.moveSpeed,
        regen: p.regen,
        range: p.range,
      },
      companionCount: this.companions.length,
    });
  }

  private render() {
    const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
    renderWorld(this.ctx, this.canvas.width, this.canvas.height, {
      arenaSize: ARENA_SIZE,
      day: this.day,
      elapsedTotal: this.elapsedTotal,
      player: this.mode === "playing" ? this.player : null,
      enemies: this.enemies,
      companions: this.companions,
      projectiles: this.projectiles,
      slashEffects: this.slashEffects,
      particles: this.particles,
      deathEffects: this.deathEffects,
      floatingTexts: this.floatingTexts,
      groundProps: this.groundProps,
      camera: this.camera,
      screenShake: this.screenShake,
      weaponName: weapon?.name || "素手",
    });
  }
}
