import { Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameHud } from "./components/GameHud";
import { HubScreen } from "./components/HubScreen";
import {
  DeathModal,
  GameMenuModal,
  type GameMenuTab,
  LevelUpModal,
  MimicRewardModal,
  VictoryEndlessModal,
} from "./components/Modals";
import { GameEngine } from "./engine/GameEngine";
import type {
  AchievementDef,
  GameSpeed,
  HudSnapshot,
  MimicRewardSummary,
  PerkDef,
  SaveData,
} from "./types/game";
import { equipEquipmentItem, SaveManager } from "./utils/saveManager";
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
  const [mimicReward, setMimicReward] = useState<MimicRewardSummary | null>(null);
  const [achBanner, setAchBanner] = useState<AchievementDef | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(1);
  const achTimerRef = useRef<number | null>(null);

  const pushToast = useCallback((text: string) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2650);
  }, []);

  const showAchievementUnlock = useCallback((ach: AchievementDef) => {
    setAchBanner(ach);
    if (achTimerRef.current !== null) {
      window.clearTimeout(achTimerRef.current);
    }
    achTimerRef.current = window.setTimeout(() => {
      setAchBanner(null);
      achTimerRef.current = null;
    }, 3400);
  }, []);

  const refreshSave = useCallback(() => {
    const d = SaveManager.data;
    setSaveSnapshot({
      ...d,
      equipped: { ...d.equipped },
      permUpgrades: { ...d.permUpgrades },
      bestiary: { ...d.bestiary },
      bestiaryRecords: { ...d.bestiaryRecords },
      mimicState: {
        plannedDayByBlock: { ...d.mimicState.plannedDayByBlock },
        spawnedBlocks: [...d.mimicState.spawnedBlocks],
        defeatedBlocks: [...d.mimicState.defeatedBlocks],
        rewardedBlocks: [...d.mimicState.rewardedBlocks],
        totalMimicDefeated: d.mimicState.totalMimicDefeated,
      },
      bestiaryRewardsClaimed: { ...d.bestiaryRewardsClaimed },
      ownedEquipment: [...d.ownedEquipment],
      achievements: [...d.achievements],
      unlockedCompanions: [...d.unlockedCompanions],
      stats: { ...d.stats },
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
      onMimicReward: (summary) => setMimicReward(summary),
      onAchievementUnlock: showAchievementUnlock,
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
      if (achTimerRef.current !== null) window.clearTimeout(achTimerRef.current);
      engine.stopLoop();
      engineRef.current = null;
    };
  }, [pushToast, refreshSave, showAchievementUnlock]);

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
    if (
      engine &&
      engine.mode === "playing" &&
      !levelUpState &&
      !deathSummary &&
      !showVictory &&
      !mimicReward
    ) {
      engine.paused = false;
    }
  }, [deathSummary, levelUpState, mimicReward, showVictory]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setKey(e.code, true);

      if (engine.mode === "playing") {
        if (e.code === "Escape") {
          if (menuTab) {
            handleCloseMenu();
          } else if (!levelUpState && !deathSummary && !showVictory && !mimicReward) {
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
  }, [deathSummary, handleCloseMenu, handleOpenMenu, levelUpState, menuTab, mimicReward, showVictory]);

  const handleStartAdventure = () => {
    setDeathSummary(null);
    setLevelUpState(null);
    setMenuTab(null);
    setShowVictory(false);
    setMimicReward(null);
    setScreenMode("playing");
    engineRef.current?.startNewRun();
  };

  const handleReturnHub = () => {
    setDeathSummary(null);
    setLevelUpState(null);
    setMenuTab(null);
    setShowVictory(false);
    setMimicReward(null);
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

  const handleChangeSpeed = useCallback((speed: GameSpeed) => {
    SoundFX.playClick();
    engineRef.current?.setGameSpeed(speed);
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

  const closeMimicModalAndResume = (equipItemId?: string) => {
    if (equipItemId) {
      const equipped = equipEquipmentItem(equipItemId);
      if (equipped) {
        engineRef.current?.recalculatePlayerStats();
        pushToast(`${equipped.name}を装備しました`);
      }
    }
    setMimicReward(null);
    refreshSave();
    engineRef.current?.resumeAfterMimicReward();
  };

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
          paused={Boolean(menuTab || levelUpState || deathSummary || showVictory || mimicReward)}
          onToggleMute={handleToggleMute}
          onChangeSpeed={handleChangeSpeed}
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

      {/* Mimic Reward Modal */}
      {mimicReward && (
        <MimicRewardModal
          summary={mimicReward}
          onEquipAndContinue={(itemId) => closeMimicModalAndResume(itemId)}
          onContinue={() => closeMimicModalAndResume()}
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

      {/* Achievement Unlock Celebration Banner */}
      {achBanner && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-[min(380px,92vw)]">
          <div className="df-panel px-4 py-2.5 rounded-xl border-2 border-[#facc15] shadow-[0_0_24px_rgba(250,204,21,0.4)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-[#facc15] flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-display font-extrabold text-amber-300 tracking-widest">
                ACHIEVEMENT UNLOCKED
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-100 truncate">
                {achBanner.name}
                {achBanner.rewardCoins > 0 && (
                  <span className="ml-2 text-amber-300 font-mono-num">
                    +{achBanner.rewardCoins.toLocaleString()}G
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
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
