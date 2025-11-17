import type { Theme } from "./GameView";
import type { EquipmentKey } from "./EquipmentPanel";

export type EquipmentChoice = {
  id: string;
  key: EquipmentKey;
  nextLevel: number;
};

type EquipmentChoiceOverlayProps = {
  visible: boolean;
  theme: Theme;
  choices: EquipmentChoice[];
  onPick: (choice: EquipmentChoice) => void;
  onSkip: () => void;
};

const EQUIPMENT_META: Record<
  EquipmentKey,
  {
    label: string;
    icon: string;
    effect: string;
  }
> = {
  helmet: {
    icon: "🪖",
    label: "Helmet",
    effect: "Reduces coin loss when a package expires.",
  },
  bell: {
    icon: "🔔",
    label: "Bell",
    effect: "Adds bonus coins on each delivery.",
  },
  bikeFrame: {
    icon: "🚲",
    label: "Bike frame",
    effect: "Slows down perishable timer decay.",
  },
  coffeeThermos: {
    icon: "☕",
    label: "Coffee thermos",
    effect: "Coffee tiles give extra coins.",
  },
  backpack: {
    icon: "🎒",
    label: "Backpack",
    effect: "New perishable packages start with extra seconds.",
  },
};

export function EquipmentChoiceOverlay({
  visible,
  theme,
  choices,
  onPick,
  onSkip,
}: EquipmentChoiceOverlayProps) {
  if (!visible) return null;
  if (!choices.length) return null;

  const isHawkins = theme === "hawkins";

  const backdropClass = isHawkins
    ? "bg-black/70"
    : "bg-slate-900/50";

  const panelClass = isHawkins
    ? "max-w-xl rounded-2xl border border-red-500/60 bg-slate-950/95 px-5 py-4 text-slate-50 shadow-2xl backdrop-blur-md"
    : "max-w-xl rounded-2xl border border-slate-300/80 bg-white/95 px-5 py-4 text-slate-900 shadow-2xl backdrop-blur-md";

  const titleClass = isHawkins
    ? "text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-red-300"
    : "text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-500";

  const subtitleClass = isHawkins
    ? "mt-1 text-xs text-slate-300"
    : "mt-1 text-xs text-slate-600";

  const cardBase =
    "group flex cursor-pointer flex-col rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";

  const cardTheme = isHawkins
    ? "border-slate-700/80 bg-slate-900/85 hover:border-emerald-400/70"
    : "border-slate-200/80 bg-slate-50 hover:border-emerald-400/80 hover:bg-emerald-50/40";

  const badgeTheme = isHawkins
    ? "bg-emerald-900/80 text-emerald-200"
    : "bg-emerald-100 text-emerald-700";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div className={`absolute inset-0 ${backdropClass}`} />

      {/* panel */}
      <div className={panelClass}>
        <div className="mb-2 text-center">
          <div className={titleClass}>Level up</div>
          <h2 className="mt-1 text-lg font-bold tracking-wide">
            Choose one upgrade
          </h2>
          <p className={subtitleClass}>
            Upgrades stack for this run. Click a card to select it.
          </p>
        </div>

        {/* cards */}
        <div
          className={`mt-3 grid gap-3 ${
            choices.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"
          }`}
        >
          {choices.map((choice) => {
            const meta = EQUIPMENT_META[choice.key];
            const currentLevel = Math.max(0, choice.nextLevel - 1);

            return (
              <button
                key={choice.id}
                type="button"
                className={`${cardBase} ${cardTheme}`}
                onClick={() => onPick(choice)}
              >
                <div className="flex items-start gap-2">
                  {/* icon */}
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 text-xl">
                    {meta.icon}
                  </div>

                  {/* text */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {meta.label}
                      </span>
                      <span
                        className={`rounded-full px-2 py-[1px] text-[0.6rem] font-semibold uppercase tracking-wide ${badgeTheme}`}
                      >
                        Lv. {currentLevel} → {choice.nextLevel}
                      </span>
                    </div>
                    <span className="mt-1 text-[0.7rem] opacity-85">
                      {meta.effect}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div className="mt-3 flex items-center justify-between text-[0.7rem]">
          <span className="opacity-70">
            You can also skip and keep your current build.
          </span>
          <button
            type="button"
            className={
              "rounded-full px-4 py-1 text-[0.7rem] font-semibold shadow-sm transition " +
              (isHawkins
                ? "bg-slate-800 text-slate-100 hover:bg-slate-700"
                : "bg-slate-200 text-slate-800 hover:bg-slate-300")
            }
            onClick={onSkip}
          >
            Skip upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
