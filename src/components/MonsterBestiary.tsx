import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Eye, Lock, Shield, Skull, Sparkles, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { MONSTER_SPRITE_MAP } from "../data/assets";
import { ALL_MONSTERS_LIST, AREA_NAME_MAP, getAreaNamesLabel } from "../data/monsters";
import { BESTIARY_COMPLETE_DEFEAT_REWARD, BESTIARY_COMPLETE_DISCOVER_REWARD } from "../data/upgrades";
import type { AreaId, MonsterDef, MonsterElement, SaveData } from "../types/game";
import {
  getBestiaryRecord,
  getBestiaryStats,
  isMonsterDefeated,
  isMonsterDiscovered,
} from "../utils/saveManager";
import { SoundFX } from "../utils/sound";
import { PixelSprite } from "./PixelSprite";

type BestiaryFilter = "all" | "discovered" | "undiscovered" | AreaId;

const ELEMENT_BADGE_STYLE: Record<MonsterElement, string> = {
  無: "bg-slate-800 text-slate-200 border-slate-600",
  毒: "bg-lime-950/90 text-lime-300 border-lime-600/70",
  炎: "bg-orange-950/90 text-orange-300 border-orange-500/70",
  氷: "bg-sky-950/90 text-sky-300 border-sky-500/70",
  雷: "bg-yellow-950/90 text-yellow-300 border-yellow-500/70",
  闇: "bg-purple-950/90 text-purple-300 border-purple-500/70",
  水: "bg-cyan-950/90 text-cyan-300 border-cyan-500/70",
  土: "bg-amber-950/90 text-amber-300 border-amber-600/70",
  植物: "bg-emerald-950/90 text-emerald-300 border-emerald-500/70",
  魔力: "bg-indigo-950/90 text-indigo-300 border-indigo-500/70",
  複合: "bg-rose-950/90 text-rose-300 border-rose-500/70",
};

function renderDangerStars(danger: 1 | 2 | 3 | 4 | 5) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-400 font-mono-num" aria-label={`危険度 ${danger}`}>
      {"★".repeat(danger)}
      <span className="text-slate-600">{"★".repeat(5 - danger)}</span>
    </span>
  );
}

function MonsterDetailPage({
  monster,
  index,
  total,
  save,
  onBack,
  onPrev,
  onNext,
}: {
  monster: MonsterDef;
  index: number;
  total: number;
  save: SaveData;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const discovered = isMonsterDiscovered(save, monster.id);
  const defeated = isMonsterDefeated(save, monster.id);
  const rec = getBestiaryRecord(save, monster.id);
  const isMimic = monster.id === "exp_monster_26";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            SoundFX.playClick();
            onBack();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-200 border border-[#8f6b24] text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          図鑑一覧へ戻る
        </button>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono-num text-slate-400 mr-1">
            No.{String(index + 1).padStart(2, "0")} / {total}
          </span>
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              onPrev();
            }}
            aria-label="前のモンスター"
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              SoundFX.playClick();
              onNext();
            }}
            aria-label="次のモンスター"
            className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="df-card rounded-xl border-2 border-[#c89b3c]/70 p-4 sm:p-6 space-y-5">
        {/* Top Hero Block */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 shrink-0 rounded-xl bg-[radial-gradient(circle_at_center,_#172033_0%,_#060911_80%)] border-2 border-[#8f6b24] flex items-center justify-center p-2 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
            <PixelSprite
              src={MONSTER_SPRITE_MAP[monster.id]}
              alt={discovered ? monster.name : "未遭遇"}
              className={`w-28 h-28 sm:w-34 sm:h-34 ${discovered ? "" : "brightness-0 opacity-45"}`}
              fallbackText="?"
            />
            {!discovered && (
              <span className="absolute bottom-2 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-[10px] font-bold text-slate-400 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> 未遭遇
              </span>
            )}
          </div>

          <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300">
                {monster.type}
              </span>
              {discovered ? (
                <span
                  className={`px-2 py-0.5 rounded border text-[11px] font-bold ${ELEMENT_BADGE_STYLE[monster.element]}`}
                >
                  属性: {monster.element}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-500">
                  属性: ？？？
                </span>
              )}
              <span className="text-xs text-slate-300">
                危険度:{" "}
                {discovered ? (
                  renderDangerStars(monster.danger)
                ) : (
                  <span className="text-slate-500">？？？</span>
                )}
              </span>
            </div>

            <div>
              <h3
                className="text-xl sm:text-2xl font-extrabold"
                style={{ color: discovered ? monster.color : "#64748b" }}
              >
                {discovered ? monster.name : "？？？"}
              </h3>
              {discovered && monster.nameEn && (
                <div className="text-xs text-slate-400 font-display tracking-wider">
                  {monster.nameEn}
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {discovered
                ? monster.desc
                : "このモンスターにはまだ遭遇していません。冒険で出現するとシルエットが解除され、詳細情報と能力が閲覧できるようになります。"}
            </p>
          </div>
        </div>

        {/* Base Stats */}
        {discovered ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                <div className="text-[11px] text-slate-400">基礎HP</div>
                <div className="text-base font-extrabold text-emerald-300 font-mono-num">
                  {monster.hp}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                <div className="text-[11px] text-slate-400">基礎攻撃力</div>
                <div className="text-base font-extrabold text-rose-300 font-mono-num">
                  {monster.atk}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                <div className="text-[11px] text-slate-400">基礎防御力</div>
                <div className="text-base font-extrabold text-sky-300 font-mono-num">
                  {monster.def}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800">
                <div className="text-[11px] text-slate-400">移動速度</div>
                <div className="text-base font-extrabold text-amber-300 font-mono-num">
                  {monster.speed}
                </div>
              </div>
            </div>

            {/* Attack Method & Special Ability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-950/85 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Swords className="w-3.5 h-3.5" />
                  攻撃方法
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{monster.attackMethodDesc}</p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-950/85 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  特殊能力・特徴
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{monster.specialAbilityDesc}</p>
              </div>
            </div>

            {/* Spawn Area, Day & Rewards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-950/85 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                  <Shield className="w-3.5 h-3.5" />
                  出現エリア・出現日数
                </div>
                <div className="text-xs text-slate-200 font-semibold">
                  エリア: {getAreaNamesLabel(monster.areas)}
                </div>
                <div className="text-xs text-slate-400 font-mono-num">
                  {isMimic
                    ? "出現条件: 1〜50日 / 51〜100日 / 101〜150日… 各50日間につき1回のみ出現"
                    : monster.id === "boss_mid"
                      ? "出現日数: 10日ごと（10日目, 20日目, 30日目…）"
                      : monster.id === "boss_100"
                        ? "出現日数: 100日目（最終決戦）"
                        : `出現日数: ${monster.minDay}日目〜`}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-950/85 border border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <Coins className="w-3.5 h-3.5" />
                  撃破報酬（基礎値）
                </div>
                <div className="text-xs text-slate-200 font-mono-num">
                  基礎EXP: {monster.xp} · 基礎コイン: {monster.coins} G（日数・倍率で増加）
                </div>
                {isMimic && (
                  <div className="text-xs text-amber-300 font-semibold">
                    特別ドロップ: 70%でコイン10,000枚 / 30%で未取得装備1つ
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="p-5 rounded-lg bg-slate-950/85 border border-slate-800 text-center space-y-1.5">
            <Lock className="w-5 h-5 text-slate-500 mx-auto" />
            <div className="text-xs font-bold text-slate-400">詳細データ未解放</div>
            <p className="text-xs text-slate-500">
              ステータス・属性・攻撃方法・出現条件・撃破報酬は初遭遇後に解放されます。
            </p>
          </div>
        )}

        {/* Personal Hunt Records (Always visible & persistent across deaths) */}
        <div className="p-3.5 rounded-lg bg-slate-950/90 border border-[#8f6b24]/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-200 inline-flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5 text-amber-400" />
              個人の遭遇・討伐記録
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {defeated ? "討伐済み" : discovered ? "遭遇済み（未討伐）" : "未遭遇"}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono-num">
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">遭遇回数</div>
              <div className="text-sm font-bold text-sky-300">{rec.encounters.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">撃破回数</div>
              <div className="text-sm font-bold text-emerald-300">{rec.kills.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">最後に遭遇した日</div>
              <div className="text-sm font-bold text-amber-200">
                {rec.lastDay > 0 ? `${rec.lastDay}日目` : "—"}
              </div>
            </div>
            <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">討伐最高Lv(日)</div>
              <div className="text-sm font-bold text-rose-300">
                {rec.maxDefeatedLevel > 0 ? `${rec.maxDefeatedLevel}日目` : "—"}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 p-2 rounded bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">累計撃破数</div>
              <div className="text-sm font-bold text-slate-100">{rec.kills.toLocaleString()}体</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonsterBestiary({ save }: { save: SaveData }) {
  const [filter, setFilter] = useState<BestiaryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stats = useMemo(() => getBestiaryStats(save), [save]);

  const filteredList = useMemo(() => {
    return ALL_MONSTERS_LIST.filter((m) => {
      const discovered = isMonsterDiscovered(save, m.id);
      if (filter === "discovered") return discovered;
      if (filter === "undiscovered") return !discovered;
      if (filter === "forest" || filter === "cave" || filter === "wasteland" || filter === "abyss") {
        return m.areas.includes(filter);
      }
      return true;
    });
  }, [filter, save]);

  const selectedIndex = useMemo(
    () => (selectedId ? ALL_MONSTERS_LIST.findIndex((m) => m.id === selectedId) : -1),
    [selectedId]
  );

  if (selectedIndex >= 0) {
    const monster = ALL_MONSTERS_LIST[selectedIndex];
    return (
      <MonsterDetailPage
        monster={monster}
        index={selectedIndex}
        total={ALL_MONSTERS_LIST.length}
        save={save}
        onBack={() => setSelectedId(null)}
        onPrev={() => {
          const prevIdx = (selectedIndex - 1 + ALL_MONSTERS_LIST.length) % ALL_MONSTERS_LIST.length;
          setSelectedId(ALL_MONSTERS_LIST[prevIdx].id);
        }}
        onNext={() => {
          const nextIdx = (selectedIndex + 1) % ALL_MONSTERS_LIST.length;
          setSelectedId(ALL_MONSTERS_LIST[nextIdx].id);
        }}
      />
    );
  }

  const filterButtons: Array<{ id: BestiaryFilter; label: string }> = [
    { id: "all", label: `すべて (${ALL_MONSTERS_LIST.length})` },
    { id: "discovered", label: `発見済み (${stats.discoveredCount})` },
    { id: "undiscovered", label: `未発見 (${stats.totalCount - stats.discoveredCount})` },
    { id: "forest", label: AREA_NAME_MAP.forest },
    { id: "cave", label: AREA_NAME_MAP.cave },
    { id: "wasteland", label: AREA_NAME_MAP.wasteland },
    { id: "abyss", label: AREA_NAME_MAP.abyss },
  ];

  return (
    <div className="space-y-4">
      {/* Bestiary Completion Dashboard */}
      <div className="df-card p-3.5 sm:p-4 rounded-xl border border-[#c89b3c]/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-amber-200 flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              モンスター図鑑達成率
            </h3>
            <p className="text-[11px] text-slate-400">
              図鑑データは死亡や再起動でもリセットされません。モンスターをタップすると個別ページを開けます。
            </p>
          </div>
          <div className="text-right font-mono-num">
            <span className="text-xl font-extrabold text-amber-300">{stats.discoveryPct}%</span>
            <span className="text-xs text-slate-400 ml-1">発見率</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono-num text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/85 border border-slate-800">
            <div className="text-slate-400 text-[11px]">発見したモンスター</div>
            <div className="text-base font-bold text-sky-300">
              {stats.discoveredCount} / {stats.totalCount}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/85 border border-slate-800">
            <div className="text-slate-400 text-[11px]">撃破したモンスター</div>
            <div className="text-base font-bold text-emerald-300">
              {stats.defeatedCount} / {stats.totalCount}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-lg bg-slate-950/85 border border-slate-800">
            <div className="text-slate-400 text-[11px]">ミミック撃破数</div>
            <div className="text-base font-bold text-amber-300">
              {(save.mimicState?.totalMimicDefeated || 0).toLocaleString()}体
            </div>
          </div>
        </div>

        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-[#8f6b24]/60">
          <div
            className="h-full bg-gradient-to-r from-sky-500 via-amber-400 to-emerald-400 transition-[width] duration-300"
            style={{ width: `${stats.discoveryPct}%` }}
          />
        </div>

        {/* Completion Rewards Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div
            className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 ${
              save.bestiaryRewardsClaimed?.discoveredAll
                ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                : "bg-slate-950/80 border-slate-800 text-slate-300"
            }`}
          >
            <span>全{stats.totalCount}種発見報酬</span>
            <span className="font-mono-num font-bold text-amber-300">
              +{BESTIARY_COMPLETE_DISCOVER_REWARD.toLocaleString()} G{" "}
              {save.bestiaryRewardsClaimed?.discoveredAll ? "(受取済)" : "(自動付与)"}
            </span>
          </div>
          <div
            className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-2 ${
              save.bestiaryRewardsClaimed?.defeatedAll
                ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-200"
                : "bg-slate-950/80 border-slate-800 text-slate-300"
            }`}
          >
            <span>全{stats.totalCount}種討伐報酬</span>
            <span className="font-mono-num font-bold text-amber-300">
              +{BESTIARY_COMPLETE_DEFEAT_REWARD.toLocaleString()} G{" "}
              {save.bestiaryRewardsClaimed?.defeatedAll ? "(受取済)" : "(自動付与)"}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="図鑑フィルタ">
        {filterButtons.map((btn) => {
          const active = filter === btn.id;
          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setFilter(btn.id);
              }}
              className={`px-2.5 py-1.5 rounded-md text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? "bg-amber-500/20 text-amber-200 border-[#c89b3c]"
                  : "bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800"
              }`}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* Monster Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredList.map((m) => {
          const discovered = isMonsterDiscovered(save, m.id);
          const rec = getBestiaryRecord(save, m.id);
          const idx = ALL_MONSTERS_LIST.findIndex((x) => x.id === m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                SoundFX.playClick();
                setSelectedId(m.id);
              }}
              className={`df-card p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all cursor-pointer hover:border-[#c89b3c] ${
                discovered ? "border-slate-700/80" : "border-slate-800/80 opacity-85"
              }`}
            >
              <div className="relative w-16 h-16 shrink-0 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center p-1">
                <PixelSprite
                  src={MONSTER_SPRITE_MAP[m.id]}
                  alt={discovered ? m.name : "未発見"}
                  className={`w-13 h-13 ${discovered ? "" : "brightness-0 opacity-40"}`}
                  fallbackText="?"
                />
                <span className="absolute -top-1.5 -left-1.5 px-1 rounded bg-slate-950 border border-slate-700 text-[9px] font-mono-num text-slate-400">
                  #{String(idx + 1).padStart(2, "0")}
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h4
                    className="font-bold text-sm truncate"
                    style={{ color: discovered ? m.color : "#64748b" }}
                  >
                    {discovered ? m.name : "？？？"}
                  </h4>
                  <span className="text-[11px] text-slate-400 shrink-0">{m.type}</span>
                </div>

                {discovered ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className={`px-1.5 py-0.2 rounded border ${ELEMENT_BADGE_STYLE[m.element]}`}>
                        {m.element}
                      </span>
                      {renderDangerStars(m.danger)}
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono-num">
                      遭遇: {rec.encounters} · 撃破: {rec.kills}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{m.desc}</p>
                  </>
                ) : (
                  <>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      詳細非表示 · 遭遇で解放
                    </div>
                    <p className="text-xs text-slate-500">
                      未遭遇のモンスター。冒険で出会うと図鑑に登録されます。
                    </p>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
