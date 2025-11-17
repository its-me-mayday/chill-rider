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

const EQUIPMENT_TEXT: Record<
  EquipmentKey,
  { name: string; tagline: string; effect: string }
> = {
  helmet: {
    name: "Helmet",
    tagline: "Stay safe, keep rolling.",
    effect: "Reduces coin loss when perishable packages expire.",
  },
  bell: {
    name: "Bell",
    tagline: "Ring your way through town.",
    effect: "Adds extra coins on each successful delivery.",
  },
  bikeFrame: {
    name: "Bike frame",
    tagline: "Light, smooth, efficient.",
    effect: "Slows down how fast perishable timers decay while you ride.",
  },
  coffeeThermos: {
    name: "Coffee thermos",
    tagline: "Warm coffee, sharp focus.",
    effect: "Gives extra coins whenever you hit a coffee tile.",
  },
  backpack: {
    name: "Backpack",
    tagline: "More room for fresh stuff.",
    effect: "Adds extra seconds to new perishable deliveries.",
  },
};

export function EquipmentChoiceOverlay({
  visible,
  theme,
  choices,
  onPick,
  onSkip,
}: EquipmentChoiceOverlayProps) {
  if (!visible || choices.length === 0) return null;

  const containerClass =
    theme === "hawkins"
      ? "bg-slate-950/90 border-red-500/70 text-slate-100"
      : "bg-white/95 border-slate-300/80 text-slate-900";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className={`max-w-xl rounded-3xl border px-6 py-5 shadow-2xl ${containerClass}`}
      >
        <div className="mb-3 text-center">
          <div className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Level up reward
          </div>
          <div className="mt-1 text-xl font-bold">
            Choose one upgrade
          </div>
          <div className="mt-1 text-[0.75rem] text-slate-500">
            Your rider keeps this equipment level for the whole run.
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          {choices.map((choice) => {
            const meta = EQUIPMENT_TEXT[choice.key];
            return (
              <button
                key={choice.id}
                onClick={() => onPick(choice)}
                className={
                  "flex-1 rounded-2xl border px-4 py-3 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " +
                  (theme === "hawkins"
                    ? "border-slate-600/80 bg-slate-900/80 hover:border-red-400/80"
                    : "border-slate-200 bg-slate-50 hover:border-emerald-300")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold">
                    {meta.name}
                  </div>
                  <div className="rounded-full bg-black/10 px-2 py-[1px] text-[0.6rem] uppercase tracking-wide">
                    Lv. {choice.nextLevel}
                  </div>
                </div>
                <div className="mt-1 text-[0.7rem] italic text-slate-500">
                  {meta.tagline}
                </div>
                <div className="mt-2 text-[0.7rem] text-slate-400">
                  {meta.effect}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[0.7rem] text-slate-500">
          <span>Tip: Try different builds to find your favorite ride style.</span>
          <button
            className="rounded-full bg-transparent px-3 py-1 text-[0.7rem] underline-offset-2 hover:underline"
            onClick={onSkip}
          >
            Skip (no upgrade)
          </button>
        </div>
      </div>
    </div>
  );
}
