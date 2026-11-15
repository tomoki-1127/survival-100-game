import { useCallback, useEffect, useRef, useState } from "react";
import { GameHud } from "./components/GameHud";
import { HubScreen } from "./components/HubScreen";
import {
  DeathModal,
  GameMenuModal,
  type GameMenuTab,
  LevelUpModal,
  VictoryEndlessModal,
} from "./components/Modals";
import { GameEngine } from "./engine/GameEngine";
import type { HudSnapshot, PerkDef, SaveData } from "./types/game";
import { SaveManager } from "./utils/saveManager";
import { SoundFX } from "./utils/sound";

interface ToastItem {
  id: number;
  text: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [saveSnapshot, setSaveSnapshot] = useState<SaveData>(() => SaveManager.load());
  const [screenMode, setScreenMode] = useState<"hub" | "playing">("hub");
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [muted, setMuted] = useState(() => SoundFX.muted);

  useEffect(() => {
    return SoundFX.subscribe((s) => {
      setMuted(s.bgmMuted && s.sfxMuted);
    });
  }, []);

  const [menuTab, setMenuTab] = useState<GameMenuTab | null>(null);
  const [levelUpState, setLevelUpState] = useState<{ level: number; choices: PerkDef[] } | null>(
    null
  );
  const [deathSummary, setDeathSummary] = useState<{
    reachedDay: number;
    bestDay: number;
    runCoins: number;
    totalCoins: number;
  } | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);

  const pushToast = useCallback((text: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2650);
  }, []);

  const refreshSave = useCallback(() => {
    setSaveSnapshot({
      ...SaveManager.data,
      equipped: { ...SaveManager.data.equipped },
      permUpgrades: { ...SaveManager.data.permUpgrades },
      bestiary: { ...SaveManager.data.bestiary },
      ownedEquipment: [...SaveManager.data.ownedEquipment],
      achievements: [...SaveManager.data.achievements],
      unlockedCompanions: [...SaveManager.data.unlockedCompanions],
      stats: { ...SaveManager.data.stats },
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onToast: pushToast,
      onLevelUp: (level, choices) => setLevelUpState({ level, choices }),
      onDeath: (summary) => setDeathSummary(summary),
      onVictory100: () => setShowVictory(true),
      onSaveChanged: refreshSave,
    });

    engineRef.current = engine;
    engine.resize(window.innerWidth, window.innerHeight);
    engine.startLoop();

    const handleResize = () => {
      const vw = window.visualViewport?.width ?? window.innerWidth;
      const vh = window.visualViewport?.height ?? window.innerHeight;
      engine.resize(Math.round(vw), Math.round(vh));
    };

    const handleBeforeUnload = () => {
      SaveManager.save();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      engine.stopLoop();
      engineRef.current = null;
    };
  }, [pushToast, refreshSave]);

  const handleOpenMenu = useCallback((tab: GameMenuTab = "stats") => {
    const engine = engineRef.current;
    if (!engine || engine.mode !== "playing") return;
    engine.paused = true;
    engine.clearKeys();
    engine.setInShopMenu(tab === "shop");
    setMenuTab(tab);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuTab(null);
    const engine = engineRef.current;
    if (engine) {
      engine.setInShopMenu(false);
    }
    if (engine && engine.mode === "playing" && !levelUpState && !deathSummary && !showVictory) {
      engine.paused = false;
    }
  }, [deathSummary, levelUpState, showVictory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setKey(e.code, true);

      if (engine.mode === "playing") {
        if (e.code === "Escape") {
          if (menuTab) {
            handleCloseMenu();
          } else if (!levelUpState && !deathSummary && !showVictory) {
            handleOpenMenu("stats");
          }
        } else if (!engine.paused) {
          if (e.code === "Space" || e.code === "KeyE") {
            e.preventDefault();
            engine.triggerActiveSkill();
          } else if (e.code === "KeyQ" || e.code === "KeyF") {
            e.preventDefault();
            engine.useRecoveryPotion();
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.setKey(e.code, false);
    };

    const onBlur = () => {
      engineRef.current?.clearKeys();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [deathSummary, handleCloseMenu, handleOpenMenu, levelUpState, menuTab, showVictory]);

  const handleStartAdventure = () => {
    setDeathSummary(null);
    setLevelUpState(null);
    setMenuTab(null);
    setShowVictory(false);
    setScreenMode("playing");
    engineRef.current?.startNewRun();
  };

  const handleReturnHub = () => {
    setDeathSummary(null);
    setLevelUpState(null);
    setMenuTab(null);
    setShowVictory(false);
    engineRef.current?.returnToHub();
    setScreenMode("hub");
    refreshSave();
  };

  const handleToggleMute = useCallback(() => {
    SoundFX.unlockFromUserGesture();
    const next = !SoundFX.muted;
    SoundFX.muted = next;
    setMuted(next);
    if (!next) SoundFX.playClick();
  }, []);

  const handleUseSkill = useCallback(() => {
    engineRef.current?.triggerActiveSkill();
  }, []);

  const handleUsePotion = useCallback(() => {
    engineRef.current?.useRecoveryPotion();
  }, []);

  const handleJoystickMove = useCallback((x: number, y: number, active: boolean) => {
    engineRef.current?.setJoystick(x, y, active);
  }, []);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-[#0b0f17] ${
        screenMode === "playing" ? "combat-touch-surface" : ""
      }`}
    >
      {/* 2D Game Canvas */}
      <canvas ref={canvasRef} className="block w-full h-full combat-touch-surface" />

      {/* Hub Screen */}
      {screenMode === "hub" && (
        <div className="absolute inset-0 z-20">
          <HubScreen
            save={saveSnapshot}
            muted={muted}
            onToggleMute={handleToggleMute}
            onStartRun={handleStartAdventure}
            onDataChange={refreshSave}
            onToast={pushToast}
          />
        </div>
      )}

      {/* In-Game HUD */}
      {screenMode === "playing" && hud && (
        <GameHud
          hud={hud}
          muted={muted}
          paused={Boolean(menuTab || levelUpState || deathSummary || showVictory)}
          onToggleMute={handleToggleMute}
          onOpenMenu={handleOpenMenu}
          onUseSkill={handleUseSkill}
          onUsePotion={handleUsePotion}
          onJoystickMove={handleJoystickMove}
        />
      )}

      {/* Level Up Modal */}
      {levelUpState && (
        <LevelUpModal
          level={levelUpState.level}
          choices={levelUpState.choices}
          onSelect={(perk) => {
            setLevelUpState(null);
            engineRef.current?.applyLevelUpPerk(perk);
          }}
        />
      )}

      {/* In-Game Menu Modal */}
      {menuTab && hud && (
        <GameMenuModal
          activeTab={menuTab}
          onTabChange={(nextTab) => {
            setMenuTab(nextTab);
            engineRef.current?.setInShopMenu(nextTab === "shop");
          }}
          onClose={handleCloseMenu}
          hud={hud}
          save={saveSnapshot}
          onDataChange={refreshSave}
          onEquipChanged={() => engineRef.current?.recalculatePlayerStats()}
          onAbandonToHub={handleReturnHub}
          onToast={pushToast}
        />
      )}

      {/* Death Summary Modal */}
      {deathSummary && (
        <DeathModal
          summary={deathSummary}
          onRetry={handleStartAdventure}
          onReturnHub={handleReturnHub}
        />
      )}

      {/* Day 100 Boss Clear -> Endless Mode */}
      {showVictory && (
        <VictoryEndlessModal
          onContinue={() => {
            setShowVictory(false);
            if (engineRef.current) engineRef.current.paused = false;
            pushToast("エンドレスモード突入！101日目以降へ");
          }}
        />
      )}

      {/* Toast Notifications */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-1.5 pointer-events-none w-[min(360px,90vw)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast df-panel px-4 py-2 rounded-lg text-center text-xs sm:text-sm font-bold text-amber-100"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
