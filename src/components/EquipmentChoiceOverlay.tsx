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
    tagline: string;
    effect: string;
  }
> = {
  helmet: {
    icon: "🪖",
    label: "Helmet",
    tagline: "Safer fails, smaller losses.",
    effect:
      "Reduces coin loss on expired packages by 1 coin per level (down to a minimum of 1 coin loss).",
  },
  bell: {
    icon: "🔔",
    label: "Bell",
    tagline: "Ring for extra tips.",
    effect:
      "Adds bonus coins on every delivery. Roughly +1 extra coin every 2 levels.",
  },
  bikeFrame: {
    icon: "🚲",
    label: "Bike frame",
    tagline: "Smoother ride, slower decay.",
    effect:
      "Slows perishable timer decay by 5% per level, up to 50% at high levels.",
  },
  coffeeThermos: {
    icon: "☕",
    label: "Coffee thermos",
    tagline: "Stronger coffee, stronger income.",
    effect:
      "Coffee tiles grant +1 extra coin per level when you ride over them.",
  },
  backpack: {
    icon: "🎒",
    label: "Backpack",
    tagline: "More room for mistakes.",
    effect:
      "New perishable packages start with +1 extra second per level before they expire.",
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
    : "bg-slate-900/60";

  const panelClass = isHawkins
    ? "max-w-2xl rounded-3xl border border-red-500/70 bg-slate-950/95 px-6 py-5 text-slate-50 shadow-2xl backdrop-blur-md"
    : "max-w-2xl rounded-3xl border border-slate-300/80 bg-white/95 px-6 py-5 text-slate-900 shadow-2xl backdrop-blur-md";

  const titleClass = isHawkins
    ? "text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-red-300"
    : "text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-slate-500";

  const subtitleClass = isHawkins
    ? "mt-1 text-sm text-slate-200"
    : "mt-1 text-sm text-slate-700";

  const cardBase =
    "group flex cursor-pointer flex-col justify-between rounded-2xl border px-4 py-4 text-left transition-transform transition-colors hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";

  const cardTheme = isHawkins
    ? "border-slate-700/80 bg-slate-900/80 hover:border-emerald-400/70"
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
        <div className="mb-3 text-center">
          <div className={titleClass}>Level up reward</div>
          <h2 className="mt-1 text-xl font-extrabold tracking-wide">
            Choose your next upgrade
          </h2>
          <p className={subtitleClass}>
            Each equipment changes how this run behaves. Pick one to level up, or skip if you want to stay as you are.
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
                <div className="flex items-start gap-3">
                  {/* icon */}
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/5 text-2xl">
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
                    <span className="mt-0.5 text-[0.75rem] opacity-80">
                      {meta.tagline}
                    </span>
                    <span className="mt-1 text-[0.7rem] opacity-90">
                      {meta.effect}
                    </span>
                  </div>
                </div>

                {/* hint footer */}
                <div className="mt-3 flex items-center justify-between text-[0.6rem] opacity-70">
                  <span>
                    Click to equip <span className="font-semibold">{meta.label}</span>.
                  </span>
                  <span className="hidden text-[0.6rem] md:inline">
                    This choice lasts for the whole run.
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* footer actions */}
        <div className="mt-4 flex items-center justify-between gap-3 text-[0.7rem]">
          <span className="opacity-70">
            Upgrades stack across levels. Some combinations can be very strong.
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
            Skip this level up
          </button>
        </div>
      </div>
    </div>
  );
}
