import { Coins, Menu, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import { EQUIPMENT_ICON_MAP, HERO_PORTRAIT_PATH, SKILL_ICON_MAP } from "../data/assets";
import { getEquipmentById } from "../data/equipment";
import type { HudSnapshot } from "../types/game";
import { SaveManager } from "../utils/saveManager";
import { PixelSprite } from "./PixelSprite";

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onOpenMenu: (tab?: "stats" | "equip" | "shop" | "bestiary" | "system") => void;
  onUseSkill: () => void;
  onUsePotion: () => void;
  onJoystickMove: (x: number, y: number, active: boolean) => void;
}

export function GameHud({
  hud,
  muted,
  onToggleMute,
  onOpenMenu,
  onUseSkill,
  onUsePotion,
  onJoystickMove,
}: GameHudProps) {
  const joyAreaRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const sec = Math.floor(hud.elapsedTotal);
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const xpPct = Math.max(0, Math.min(100, (hud.xp / Math.max(1, hud.nextXp)) * 100));

  const weapon = getEquipmentById(SaveManager.data.equipped.weapon);
  const weaponIcon = weapon ? EQUIPMENT_ICON_MAP[weapon.id] : SKILL_ICON_MAP.autoAttack;

  const updateJoy = (clientX: number, clientY: number) => {
    const el = joyAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.4;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnobOffset({ x: dx, y: dy });
    onJoystickMove(dx / maxR, dy / maxR, true);
  };

  const resetJoy = () => {
    pointerIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0, false);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Top HUD Row */}
      <div className="absolute top-2 left-2 right-2 sm:top-3 sm:left-3 sm:right-3 flex items-start justify-between gap-2">
        {/* Top-Left: Hero Portrait + Lv / HP / EXP */}
        <div className="pointer-events-auto df-panel rounded-lg p-1.5 sm:p-2 flex items-center gap-2 sm:gap-2.5 w-[184px] sm:w-[258px]">
          <div className="relative w-11 h-11 sm:w-13 sm:h-13 shrink-0 rounded-md bg-slate-950 border-2 border-[#c89b3c] shadow-[inset_0_0_10px_rgba(200,155,60,0.28)] overflow-hidden flex items-center justify-center">
            <PixelSprite src={HERO_PORTRAIT_PATH} alt="勇者" className="w-10 h-10 sm:w-12 sm:h-12" fallbackText="勇" />
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
            <div className="relative w-full h-2.5 bg-slate-950 rounded-sm overflow-hidden border border-sky-700/70">
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
        <div className="pointer-events-auto df-panel rounded-lg p-1.5 sm:p-2 flex flex-col items-end gap-1.5 min-w-[146px]">
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
        <div className="absolute top-[104px] md:top-[84px] left-1/2 -translate-x-1/2 w-[min(440px,88vw)] px-3 py-2 rounded-lg bg-[#140912]/95 border-2 border-rose-500/80 shadow-[0_0_24px_rgba(244,63,94,0.4)] text-center">
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

      {/* Bottom-Left: Virtual Joystick (Mobile & Touch) */}
      <div
        ref={joyAreaRef}
        onPointerDown={(e) => {
          e.preventDefault();
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateJoy(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateJoy(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current === e.pointerId) resetJoy();
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current === e.pointerId) resetJoy();
        }}
        className="pointer-events-auto absolute left-3.5 bottom-4 sm:left-5 sm:bottom-5 w-26 h-26 sm:w-30 sm:h-30 rounded-full bg-slate-950/55 border-2 border-[#c89b3c]/50 shadow-[inset_0_0_16px_rgba(0,0,0,0.8)] flex items-center justify-center touch-none"
        aria-label="移動用バーチャルジョイスティック"
      >
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-300/80 to-amber-600/80 border-2 border-amber-100/90 shadow-lg pointer-events-none"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Bottom Action Bar: Equipped Weapon / Whirlwind Skill / Recovery Potion */}
      <div className="pointer-events-auto absolute bottom-3.5 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-4 flex items-end gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => onOpenMenu("equip")}
          className="group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 border-[#c89b3c]/80 shadow-lg cursor-pointer transition-transform active:scale-95 w-[68px] sm:w-[78px]"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded bg-slate-950 border border-slate-700/80 flex items-center justify-center overflow-hidden">
            <PixelSprite src={weaponIcon} alt={hud.weaponName} className="w-9 h-9 sm:w-10 sm:h-10" fallbackText="武" />
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
          disabled={hud.skillCooldown > 0}
          className="group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 border-[#facc15] shadow-[0_0_16px_rgba(250,204,21,0.28)] cursor-pointer transition-transform active:scale-95 disabled:opacity-75 w-[68px] sm:w-[78px]"
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded bg-slate-950 border border-sky-400/50 flex items-center justify-center overflow-hidden">
            <PixelSprite
              src={SKILL_ICON_MAP.whirlwind}
              alt="旋風斬り"
              className="w-10 h-10 sm:w-11 sm:h-11"
              fallbackText="斬"
            />
            {hud.skillCooldown > 0 && (
              <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-xs sm:text-sm font-extrabold text-amber-300 font-mono-num">
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
          disabled={hud.potionCharges <= 0}
          className="group relative flex flex-col items-center p-1.5 rounded-lg bg-[#0b101b]/92 hover:bg-[#131c2e] border-2 border-emerald-500/80 shadow-[0_0_14px_rgba(16,185,129,0.22)] cursor-pointer transition-transform active:scale-95 disabled:opacity-45 w-[68px] sm:w-[78px]"
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded bg-slate-950 border border-emerald-500/40 flex items-center justify-center overflow-hidden">
            <PixelSprite
              src={SKILL_ICON_MAP.potion}
              alt="回復薬"
              className="w-10 h-10 sm:w-11 sm:h-11"
              fallbackText="薬"
            />
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
    </div>
  );
}
