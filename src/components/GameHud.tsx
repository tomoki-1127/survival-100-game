import { Coins, Menu, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { EQUIPMENT_ICON_MAP, HERO_PORTRAIT_PATH, SKILL_ICON_MAP } from "../data/assets";
import { getEquipmentById } from "../data/equipment";
import type { HudSnapshot } from "../types/game";
import { SaveManager } from "../utils/saveManager";
import { PixelSprite } from "./PixelSprite";

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  paused?: boolean;
  onToggleMute: () => void;
  onOpenMenu: (tab?: "stats" | "equip" | "shop" | "bestiary" | "system") => void;
  onUseSkill: () => void;
  onUsePotion: () => void;
  onJoystickMove: (x: number, y: number, active: boolean) => void;
}

function detectTouchLayout(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const touchPoints = typeof navigator !== "undefined" ? navigator.maxTouchPoints > 0 : false;
  return coarse || touchPoints || window.innerWidth < 768;
}

export function GameHud({
  hud,
  muted,
  paused = false,
  onToggleMute,
  onOpenMenu,
  onUseSkill,
  onUsePotion,
  onJoystickMove,
}: GameHudProps) {
  const joyAreaRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyMetricsRef = useRef<{ cx: number; cy: number; maxR: number } | null>(null);

  const skillPointerSkipClickRef = useRef(false);
  const potionPointerSkipClickRef = useRef(false);
  const equipPointerSkipClickRef = useRef(false);

  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [isTouchLayout, setIsTouchLayout] = useState<boolean>(() => detectTouchLayout());

  useEffect(() => {
    const updateMode = () => setIsTouchLayout(detectTouchLayout());
    updateMode();
    window.addEventListener("resize", updateMode);
    const mq = window.matchMedia?.("(pointer: coarse)");
    mq?.addEventListener?.("change", updateMode);
    return () => {
      window.removeEventListener("resize", updateMode);
      mq?.removeEventListener?.("change", updateMode);
    };
  }, []);

  const updateJoyFromClient = useCallback(
    (clientX: number, clientY: number) => {
      let metrics = joyMetricsRef.current;
      if (!metrics && joyAreaRef.current) {
        const rect = joyAreaRef.current.getBoundingClientRect();
        metrics = {
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          maxR: Math.max(24, rect.width * 0.36),
        };
        joyMetricsRef.current = metrics;
      }
      if (!metrics) return;

      const rawDx = clientX - metrics.cx;
      const rawDy = clientY - metrics.cy;
      const dist = Math.hypot(rawDx, rawDy);
      const maxR = metrics.maxR;

      const clampedDist = Math.min(dist, maxR);
      const angle = Math.atan2(rawDy, rawDx);
      const knobX = dist > 0.001 ? Math.cos(angle) * clampedDist : 0;
      const knobY = dist > 0.001 ? Math.sin(angle) * clampedDist : 0;
      setKnobOffset({ x: knobX, y: knobY });

      const deadzoneRatio = 0.08;
      const ratio = dist / maxR;
      if (ratio <= deadzoneRatio) {
        onJoystickMove(0, 0, true);
        return;
      }
      const normMag = Math.min(1, (ratio - deadzoneRatio) / (1 - deadzoneRatio));
      onJoystickMove(Math.cos(angle) * normMag, Math.sin(angle) * normMag, true);
    },
    [onJoystickMove]
  );

  const resetJoy = useCallback(() => {
    joyPointerIdRef.current = null;
    joyMetricsRef.current = null;
    setJoyActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0, false);
  }, [onJoystickMove]);

  useEffect(() => {
    if (paused && joyPointerIdRef.current !== null) {
      resetJoy();
    }
  }, [paused, resetJoy]);

  useEffect(() => {
    const onWinPointerMove = (e: PointerEvent) => {
      if (joyPointerIdRef.current !== null && e.pointerId === joyPointerIdRef.current) {
        updateJoyFromClient(e.clientX, e.clientY);
      }
    };
    const onWinPointerEnd = (e: PointerEvent) => {
      if (joyPointerIdRef.current !== null && e.pointerId === joyPointerIdRef.current) {
        resetJoy();
      }
    };
    const onBlurOrHide = () => {
      if (joyPointerIdRef.current !== null) {
        resetJoy();
      }
    };

    window.addEventListener("pointermove", onWinPointerMove, { passive: true });
    window.addEventListener("pointerup", onWinPointerEnd);
    window.addEventListener("pointercancel", onWinPointerEnd);
    window.addEventListener("blur", onBlurOrHide);
    document.addEventListener("visibilitychange", onBlurOrHide);

    return () => {
      window.removeEventListener("pointermove", onWinPointerMove);
      window.removeEventListener("pointerup", onWinPointerEnd);
      window.removeEventListener("pointercancel", onWinPointerEnd);
      window.removeEventListener("blur", onBlurOrHide);
      document.removeEventListener("visibilitychange", onBlurOrHide);
      if (joyPointerIdRef.current !== null) {
        resetJoy();
      }
    };
  }, [resetJoy, updateJoyFromClient]);

  const sec = Math.floor(hud.elapsedTotal);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.nextXp)) * 100));

  const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
  const weaponIcon = weapon ? EQUIPMENT_ICON_MAP[weapon.id] : SKILL_ICON_MAP.autoAttack;

  const skillReady = hud.skillCooldown <= 0;
  const skillCdRatio = Math.max(0, Math.min(1, hud.skillCooldown / Math.max(0.1, hud.skillMaxCd)));
  const potionReady = hud.potionCharges > 0 && hud.potionCooldown <= 0;

  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none combat-touch-surface"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top HUD Row (iPhone Safe-Area Aware) */}
      <div
        className="absolute flex items-start justify-between gap-2"
        style={{
          top: "max(0.5rem, env(safe-area-inset-top))",
          left: "max(0.5rem, env(safe-area-inset-left))",
          right: "max(0.5rem, env(safe-area-inset-right))",
        }}
      >
        {/* Top-Left: Hero Portrait + Lv / HP / EXP */}
        <div className="pointer-events-auto df-panel rounded-lg p-1.5 sm:p-2 flex items-center gap-2 sm:gap-2.5 w-[176px] sm:w-[258px]">
          <div className="relative w-10 h-10 sm:w-13 sm:h-13 shrink-0 rounded-md bg-slate-950 border-2 border-[#c89b3c] shadow-[inset_0_0_10px_rgba(200,155,60,0.28)] overflow-hidden flex items-center justify-center">
            <PixelSprite src={HERO_PORTRAIT_PATH} alt="勇者" className="w-9 h-9 sm:w-12 sm:h-12" fallbackText="勇" />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-extrabold font-mono-num">
              <span className="text-amber-300 truncate">Lv.{hud.level} 勇者</span>
              <span className="text-[10px] text-slate-300">{mm}:{ss}</span>
            </div>

            {/* HP Bar */}
            <div className="relative w-full h-3.5 bg-slate-950 rounded-sm overflow-hidden border border-[#8f6b24]">
              <div
                className="h-full bg-gradient-to-r from-red-700 via-red-500 to-rose-400 transition-[width] duration-100"
                style={{ width: `${hpPct}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[9px] sm:text-[10px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] font-mono-num">
                HP {Math.ceil(hud.hp)}/{hud.maxHp}
              </div>
            </div>

            {/* EXP Bar */}
            <div className="relative w-full h-2 sm:h-2.5 bg-slate-950 rounded-sm overflow-hidden border border-sky-700/70">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-300 transition-[width] duration-100"
                style={{ width: `${xpPct}%` }}
              />
              <div className="hidden sm:flex absolute inset-0 items-center justify-center text-[9px] font-bold text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.95)] font-mono-num">
                EXP {hud.xp}/{hud.nextXp}
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center Crest (Desktop/Tablet) */}
        <div className="hidden md:flex flex-col items-center df-panel px-5 py-1.5 rounded-lg min-w-[205px]">
          <div className="font-display text-xs tracking-[0.16em] text-amber-300 font-extrabold">
            SURVIVAL 100
          </div>
          <div className="flex items-center gap-2 text-xs font-extrabold font-mono-num mt-0.5">
            <span className="text-slate-100">
              {hud.day <= 100 ? `DAY ${hud.day} / 100` : `ENDLESS DAY ${hud.day}`}
            </span>
            <span className="text-amber-300/90 font-sans text-[11px] font-bold">· {hud.areaName}</span>
          </div>
          <div className="w-full h-1.5 mt-1 bg-slate-950 rounded-full overflow-hidden border border-[#8f6b24]/70">
            <div
              className={`h-full transition-[width] duration-150 ${
                hud.isBossDay ? "bg-rose-500" : "bg-gradient-to-r from-amber-500 to-yellow-300"
              }`}
              style={{ width: `${hud.dayProgress * 100}%` }}
            />
          </div>
        </div>

        {/* Top-Right: Coins + Day (Mobile) + Controls */}
        <div className="pointer-events-auto df-panel rounded-lg p-1.5 sm:p-2 flex flex-col items-end gap-1 min-w-[136px] sm:min-w-[146px]">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/90 border border-[#8f6b24]/80 font-mono-num">
            <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <strong className="text-xs sm:text-sm text-amber-300">{hud.coins.toLocaleString()}</strong>
            <span className="text-[10px] text-amber-400/80">G</span>
          </div>

          {/* Mobile compact day/area readout */}
          <div className="md:hidden w-full text-right space-y-0.5">
            <div className="text-[11px] font-extrabold text-amber-300 font-mono-num leading-tight">
              {hud.day}日目 {hud.day > 100 ? "∞" : "/ 100"} ·{" "}
              <span className="font-sans text-slate-200">{hud.areaName}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-[#8f6b24]/70">
              <div
                className={`h-full transition-[width] duration-150 ${
                  hud.isBossDay ? "bg-rose-500" : "bg-amber-400"
                }`}
                style={{ width: `${hud.dayProgress * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? "音声をオンにする" : "音声をオフにする"}
              className="p-1.5 sm:p-2 rounded bg-slate-900 hover:bg-slate-800 text-amber-200 border border-[#8f6b24]/80 cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenMenu("stats")}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-100 border border-[#c89b3c]/80 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5 text-amber-400" />
              メニュー
            </button>
          </div>
        </div>
      </div>

      {/* Boss HP Bar */}
      {hud.boss && (
        <div
          className="absolute left-1/2 -translate-x-1/2 w-[min(440px,88vw)] px-3 py-2 rounded-lg bg-[#140912]/95 border-2 border-rose-500/80 shadow-[0_0_24px_rgba(244,63,94,0.4)] text-center"
          style={{ top: "calc(max(0.5rem, env(safe-area-inset-top)) + 92px)" }}
        >
          <div className="text-xs font-extrabold text-rose-200 mb-1 font-mono-num tracking-wide">
            {hud.boss.name} · HP {Math.max(0, Math.ceil(hud.boss.hp)).toLocaleString()} /{" "}
            {hud.boss.maxHp.toLocaleString()}
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-sm overflow-hidden border border-rose-400/50">
            <div
              className="h-full bg-gradient-to-r from-rose-700 via-red-500 to-amber-400 transition-[width] duration-100"
              style={{
                width: `${Math.max(0, Math.min(100, (hud.boss.hp / Math.max(1, hud.boss.maxHp)) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile & Touch Controls: Bottom-Left Analog Joystick + Bottom-Right Vertical Skill Column */}
      {isTouchLayout ? (
        <>
          {/* Bottom-Left: Virtual Analog Joystick */}
          <div
            ref={joyAreaRef}
            onPointerDown={(e) => {
              if (joyPointerIdRef.current !== null) return;
              e.preventDefault();
              e.stopPropagation();
              joyPointerIdRef.current = e.pointerId;
              const rect = e.currentTarget.getBoundingClientRect();
              joyMetricsRef.current = {
                cx: rect.left + rect.width / 2,
                cy: rect.top + rect.height / 2,
                maxR: Math.max(24, rect.width * 0.36),
              };
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Fallback window listeners handle tracking
              }
              setJoyActive(true);
              updateJoyFromClient(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (joyPointerIdRef.current !== e.pointerId) return;
              e.preventDefault();
              updateJoyFromClient(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (joyPointerIdRef.current !== e.pointerId) return;
              e.preventDefault();
              resetJoy();
            }}
            onPointerCancel={(e) => {
              if (joyPointerIdRef.current !== e.pointerId) return;
              resetJoy();
            }}
            onLostPointerCapture={(e) => {
              if (joyPointerIdRef.current !== e.pointerId) return;
              resetJoy();
            }}
            style={{
              left: "max(0.75rem, env(safe-area-inset-left))",
              bottom: "max(0.875rem, env(safe-area-inset-bottom))",
            }}
            className={`pointer-events-auto combat-touch-surface absolute w-32 h-32 rounded-full flex items-center justify-center transition-shadow ${
              joyActive
                ? "bg-[#091020]/78 border-2 border-[#facc15] shadow-[0_0_22px_rgba(250,204,21,0.34),inset_0_0_18px_rgba(0,0,0,0.85)]"
                : "bg-[#090e1a]/66 border-2 border-[#c89b3c]/80 shadow-[0_6px_18px_rgba(0,0,0,0.65),inset_0_0_16px_rgba(0,0,0,0.8)]"
            }`}
            aria-label="移動用バーチャルアナログジョイスティック"
          >
            {/* Inner Gold Ring & Cardinal Guides */}
            <div className="pointer-events-none absolute inset-2.5 rounded-full border border-[#c89b3c]/30" />
            <div className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-2 rounded-full bg-[#c89b3c]/45" />
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-2 rounded-full bg-[#c89b3c]/45" />
            <div className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-1 rounded-full bg-[#c89b3c]/45" />
            <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-1 rounded-full bg-[#c89b3c]/45" />

            {/* Analog Stick Knob */}
            <div
              className={`pointer-events-none w-13 h-13 rounded-full border-2 shadow-[0_4px_12px_rgba(0,0,0,0.75)] ${
                joyActive
                  ? "border-[#fef08a] bg-[radial-gradient(circle_at_35%_30%,#fef08a,#d99b26_48%,#131c2e_92%)]"
                  : "border-[#c89b3c] bg-[radial-gradient(circle_at_35%_30%,#fde68a,#9a6510_48%,#0f172a_92%)] transition-transform duration-100"
              }`}
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
              }}
            />
          </div>

          {/* Bottom-Right: Vertical Skill Column (Large Thumb-Friendly Icons) */}
          <div
            style={{
              right: "max(0.75rem, env(safe-area-inset-right))",
              bottom: "max(0.875rem, env(safe-area-inset-bottom))",
            }}
            className="pointer-events-auto combat-touch-surface absolute flex flex-col items-end gap-2.5"
          >
            {/* Quick Equipment Slot */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                equipPointerSkipClickRef.current = true;
                onOpenMenu("equip");
              }}
              onClick={() => {
                if (equipPointerSkipClickRef.current) {
                  equipPointerSkipClickRef.current = false;
                  return;
                }
                onOpenMenu("equip");
              }}
              aria-label={`装備変更: ${hud.weaponName}`}
              className="combat-touch-surface relative w-12 h-12 rounded-xl bg-[#0b101b]/88 active:scale-95 border-2 border-[#c89b3c]/80 shadow-[0_4px_12px_rgba(0,0,0,0.65)] flex items-center justify-center cursor-pointer"
            >
              <PixelSprite src={weaponIcon} alt={hud.weaponName} className="w-8 h-8" fallbackText="武" />
              <span className="absolute -bottom-1.5 px-1.5 rounded bg-slate-950 border border-[#8f6b24] text-[9px] font-bold text-amber-200 leading-tight">
                装備
              </span>
            </button>

            {/* Recovery Potion Button */}
            <button
              type="button"
              disabled={!potionReady}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!potionReady) return;
                potionPointerSkipClickRef.current = true;
                onUsePotion();
              }}
              onClick={() => {
                if (potionPointerSkipClickRef.current) {
                  potionPointerSkipClickRef.current = false;
                  return;
                }
                if (potionReady) onUsePotion();
              }}
              aria-label={`回復薬 残り${hud.potionCharges}個`}
              className={`combat-touch-surface relative w-16 h-16 rounded-2xl flex items-center justify-center transition-transform active:scale-95 ${
                potionReady
                  ? "bg-[#091815]/90 border-2 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.34)] cursor-pointer"
                  : "bg-[#0b101b]/80 border-2 border-slate-700/90 opacity-55 cursor-not-allowed"
              }`}
            >
              <PixelSprite
                src={SKILL_ICON_MAP.potion}
                alt="回復薬"
                className={`w-11 h-11 ${potionReady ? "" : "grayscale opacity-60"}`}
                fallbackText="薬"
              />
              {hud.potionCooldown > 0 && hud.potionCharges > 0 && (
                <div className="absolute inset-0 rounded-2xl bg-slate-950/75 flex items-center justify-center text-sm font-extrabold text-amber-300 font-mono-num">
                  {Math.ceil(hud.potionCooldown)}s
                </div>
              )}
              <span
                className={`absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold font-mono-num border ${
                  hud.potionCharges > 0
                    ? "bg-slate-950 text-emerald-300 border-emerald-500/80"
                    : "bg-slate-950 text-slate-500 border-slate-700"
                }`}
              >
                x{hud.potionCharges}
              </span>
              <span className="absolute -bottom-1.5 px-1.5 rounded bg-slate-950 border border-[#8f6b24] text-[9px] font-bold text-emerald-200 leading-tight">
                回復
              </span>
            </button>

            {/* Primary Active Skill: Whirlwind */}
            <button
              type="button"
              disabled={!skillReady}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!skillReady) return;
                skillPointerSkipClickRef.current = true;
                onUseSkill();
              }}
              onClick={() => {
                if (skillPointerSkipClickRef.current) {
                  skillPointerSkipClickRef.current = false;
                  return;
                }
                if (skillReady) onUseSkill();
              }}
              aria-label={skillReady ? "旋風斬り 使用可能" : `旋風斬り クールダウン残り${Math.ceil(hud.skillCooldown)}秒`}
              className={`combat-touch-surface relative w-[74px] h-[74px] rounded-2xl flex items-center justify-center transition-transform active:scale-95 overflow-visible ${
                skillReady
                  ? "bg-[#0d1424]/92 border-2 border-[#facc15] shadow-[0_0_22px_rgba(250,204,21,0.42),inset_0_0_12px_rgba(250,204,21,0.22)] cursor-pointer"
                  : "bg-[#0b101b]/88 border-2 border-slate-600/80 cursor-not-allowed"
              }`}
            >
              <div className="relative w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center">
                <PixelSprite
                  src={SKILL_ICON_MAP.whirlwind}
                  alt="旋風斬り"
                  className={`w-13 h-13 ${skillReady ? "" : "grayscale opacity-45"}`}
                  fallbackText="斬"
                />
                {!skillReady && (
                  <>
                    <div
                      className="absolute inset-x-0 bottom-0 bg-slate-950/65"
                      style={{ height: `${Math.round(skillCdRatio * 100)}%` }}
                    />
                    <div className="absolute inset-0 bg-slate-950/45 flex items-center justify-center text-base font-extrabold text-amber-300 font-mono-num drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
                      {Math.ceil(hud.skillCooldown)}s
                    </div>
                  </>
                )}
              </div>
              <span
                className={`absolute -bottom-2 px-2 py-0.5 rounded text-[10px] font-extrabold border leading-tight whitespace-nowrap ${
                  skillReady
                    ? "bg-amber-950/95 text-amber-200 border-[#facc15]"
                    : "bg-slate-950 text-slate-400 border-slate-700"
                }`}
              >
                {skillReady ? "旋風斬り" : "待機中"}
              </span>
            </button>
          </div>
        </>
      ) : (
        /* Desktop PC Controls: Traditional Bottom-Center Action Bar + Keyboard */
        <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 flex items-end gap-2.5">
          <button
            type="button"
            onClick={() => onOpenMenu("equip")}
            className="group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 border-[#c89b3c]/80 shadow-lg cursor-pointer transition-transform active:scale-95 w-[78px]"
          >
            <div className="w-11 h-11 rounded bg-slate-950 border border-slate-700/80 flex items-center justify-center overflow-hidden">
              <PixelSprite src={weaponIcon} alt={hud.weaponName} className="w-10 h-10" fallbackText="武" />
            </div>
            <span className="mt-1 text-[10px] font-bold text-amber-200 truncate w-full text-center">
              {hud.weaponName}
            </span>
            <span className="absolute -top-2 right-1 px-1 rounded bg-slate-950 border border-[#8f6b24] text-[9px] font-bold text-sky-300">
              自動
            </span>
          </button>

          <button
            type="button"
            onClick={onUseSkill}
            disabled={!skillReady}
            className={`group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 transition-transform active:scale-95 w-[78px] ${
              skillReady
                ? "border-[#facc15] shadow-[0_0_16px_rgba(250,204,21,0.28)] cursor-pointer"
                : "border-slate-700 opacity-75 cursor-not-allowed"
            }`}
          >
            <div className="relative w-11 h-11 rounded bg-slate-950 border border-sky-400/50 flex items-center justify-center overflow-hidden">
              <PixelSprite
                src={SKILL_ICON_MAP.whirlwind}
                alt="旋風斬り"
                className={`w-11 h-11 ${skillReady ? "" : "grayscale opacity-50"}`}
                fallbackText="斬"
              />
              {!skillReady && (
                <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center text-sm font-extrabold text-amber-300 font-mono-num">
                  {Math.ceil(hud.skillCooldown)}s
                </div>
              )}
            </div>
            <span className="mt-1 text-[10px] font-bold text-slate-100 whitespace-nowrap">旋風斬り</span>
            <span className="absolute -top-2 right-1 px-1 rounded bg-slate-950 border border-[#c89b3c] text-[9px] font-bold text-amber-300 font-mono-num">
              E/Spc
            </span>
          </button>

          <button
            type="button"
            onClick={onUsePotion}
            disabled={!potionReady}
            className={`group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 transition-transform active:scale-95 w-[78px] ${
              potionReady
                ? "border-emerald-500/80 shadow-[0_0_14px_rgba(16,185,129,0.22)] cursor-pointer"
                : "border-slate-700 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="relative w-11 h-11 rounded bg-slate-950 border border-emerald-500/40 flex items-center justify-center overflow-hidden">
              <PixelSprite
                src={SKILL_ICON_MAP.potion}
                alt="回復薬"
                className={`w-11 h-11 ${potionReady ? "" : "grayscale opacity-55"}`}
                fallbackText="薬"
              />
              {hud.potionCooldown > 0 && hud.potionCharges > 0 && (
                <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center text-xs font-extrabold text-amber-300 font-mono-num">
                  {Math.ceil(hud.potionCooldown)}s
                </div>
              )}
              <span className="absolute bottom-0 right-0 px-1 bg-slate-950/90 text-[10px] font-extrabold text-emerald-300 font-mono-num rounded-tl">
                x{hud.potionCharges}
              </span>
            </div>
            <span className="mt-1 text-[10px] font-bold text-emerald-200 whitespace-nowrap">回復薬</span>
            <span className="absolute -top-2 right-1 px-1 rounded bg-slate-950 border border-emerald-500/70 text-[9px] font-bold text-emerald-300 font-mono-num">
              Q/F
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
