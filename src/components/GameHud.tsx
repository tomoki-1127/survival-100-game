import { FlaskConical, Menu, Sparkles, Sword, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import type { HudSnapshot } from "../types/game";

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
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-2.5">
        {/* Top-Left: HP / Lv / EXP */}
        <div className="pointer-events-auto w-[178px] sm:w-[230px] p-2.5 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold font-mono-num">
            <span className="text-slate-100">Lv.{hud.level}</span>
            <span className="text-amber-400">{hud.coins.toLocaleString()} G</span>
          </div>

          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-rose-400 transition-[width] duration-100"
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold font-mono-num">
            <span className="text-slate-400">HP</span>
            <span className="text-slate-100">
              {Math.ceil(hud.hp)} / {hud.maxHp}
            </span>
          </div>

          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 transition-[width] duration-100"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-num">
            <span>EXP</span>
            <span>
              {hud.xp} / {hud.nextXp}
            </span>
          </div>
        </div>

        {/* Top-Right: Day / Area / Time / Menu */}
        <div className="pointer-events-auto p-2.5 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 text-right flex flex-col items-end gap-1 min-w-[144px]">
          <div className="text-sm sm:text-base font-extrabold text-amber-400 font-mono-num leading-tight">
            {hud.day}日目
            {hud.day > 100 && <span className="ml-1 text-[11px] text-rose-400">無限</span>}
          </div>
          <div className="text-xs text-slate-200 font-medium">{hud.areaName}</div>
          <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className={`h-full transition-[width] duration-150 ${
                hud.isBossDay ? "bg-rose-500" : "bg-amber-400"
              }`}
              style={{ width: `${hud.dayProgress * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 font-mono-num">{mm}:{ss}</div>

          <div className="flex items-center gap-1.5 mt-0.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? "音声をオンにする" : "音声をオフにする"}
              className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onOpenMenu("stats")}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5" />
              メニュー
            </button>
          </div>
        </div>
      </div>

      {/* Boss HP Bar */}
      {hud.boss && (
        <div className="absolute top-[118px] sm:top-24 left-1/2 -translate-x-1/2 w-[min(420px,86vw)] p-2 rounded-lg bg-slate-950/90 border border-rose-500/70 text-center">
          <div className="text-xs font-extrabold text-rose-300 mb-1 font-mono-num">
            {hud.boss.name} · HP {Math.max(0, Math.ceil(hud.boss.hp)).toLocaleString()} /{" "}
            {hud.boss.maxHp.toLocaleString()}
          </div>
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-[width] duration-100"
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
        className="pointer-events-auto absolute left-3.5 bottom-4 sm:left-5 sm:bottom-5 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white/5 border-2 border-white/15 flex items-center justify-center touch-none"
        aria-label="移動用バーチャルジョイスティック"
      >
        <div
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-400/60 border-2 border-white/80 pointer-events-none"
          style={{
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
        />
      </div>

      {/* Bottom Action Bar: Weapon / Skill / Potion */}
      <div className="pointer-events-auto absolute bottom-4 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenMenu("equip")}
          className="min-w-[74px] sm:min-w-[92px] px-2.5 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-slate-700 text-center cursor-pointer transition-transform active:scale-95"
        >
          <Sword className="w-4 h-4 mx-auto text-sky-400 mb-0.5" />
          <div className="text-[11px] font-bold text-slate-100 truncate max-w-[82px]">
            {hud.weaponName}
          </div>
          <div className="text-[10px] text-slate-400">自動攻撃</div>
        </button>

        <button
          type="button"
          onClick={onUseSkill}
          disabled={hud.skillCooldown > 0}
          className="relative overflow-hidden min-w-[74px] sm:min-w-[92px] px-2.5 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-amber-500/50 text-center cursor-pointer transition-transform active:scale-95 disabled:opacity-65"
        >
          <Sparkles className="w-4 h-4 mx-auto text-amber-400 mb-0.5" />
          <div className="text-[11px] font-bold text-slate-100">旋風斬り</div>
          <div className="text-[10px] text-slate-400">Space / E</div>
          {hud.skillCooldown > 0 && (
            <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center text-sm font-extrabold text-amber-300 font-mono-num">
              {Math.ceil(hud.skillCooldown)}s
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onUsePotion}
          disabled={hud.potionCharges <= 0}
          className="min-w-[74px] sm:min-w-[92px] px-2.5 py-2 rounded-xl bg-slate-950/85 hover:bg-slate-900 border border-emerald-500/50 text-center cursor-pointer transition-transform active:scale-95 disabled:opacity-45"
        >
          <FlaskConical className="w-4 h-4 mx-auto text-emerald-400 mb-0.5" />
          <div className="text-[11px] font-bold text-slate-100">回復薬</div>
          <div className="text-[10px] text-slate-300 font-mono-num">
            残 {hud.potionCharges} (Q)
          </div>
        </button>
      </div>
    </div>
  );
}
