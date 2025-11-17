import type { Theme } from "./GameView";

export type EquipmentKey =
  | "helmet"
  | "bell"
  | "bikeFrame"
  | "coffeeThermos"
  | "backpack";

type EquipmentPanelProps = {
  theme: Theme;
  equipmentLevels?: Partial<Record<EquipmentKey, number>>;
  highlightedKey?: EquipmentKey | null;
};

const EQUIPMENT_SLOTS: {
  key: EquipmentKey;
  label: string;
  short: string;
  icon: string;
}[] = [
  {
    key: "helmet",
    label: "Helmet",
    short: "Reduces coin loss on expiry.",
    icon: "🪖",
  },
  {
    key: "bell",
    label: "Bell",
    short: "Adds extra coins on delivery.",
    icon: "🔔",
  },
  {
    key: "bikeFrame",
    label: "Bike frame",
    short: "Slows down perishable timer decay.",
    icon: "🚲",
  },
  {
    key: "coffeeThermos",
    label: "Coffee thermos",
    short: "Boosts coins from coffee tiles.",
    icon: "☕",
  },
  {
    key: "backpack",
    label: "Backpack",
    short: "Adds seconds to new perishable packages.",
    icon: "🎒",
  },
];

export function EquipmentPanel({
  theme,
  equipmentLevels,
  highlightedKey,
}: EquipmentPanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full h-full rounded-2xl border border-red-500/60 bg-slate-900/90 px-4 py-3 shadow-lg backdrop-blur-sm"
      : "w-full h-full rounded-2xl border border-slate-300/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm";

  const titleClass =
    theme === "hawkins"
      ? "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
      : "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const hintClass =
    theme === "hawkins"
      ? "text-[0.65rem] text-slate-400"
      : "text-[0.65rem] text-slate-500";

  const slotBaseClass =
    "flex min-w-0 flex-col rounded-xl border px-3 py-2 text-[0.65rem]";
  const slotColorClass =
    theme === "hawkins"
      ? "border-slate-700/80 bg-slate-900/80 text-slate-100"
      : "border-slate-300/80 bg-slate-50 text-slate-900";

  return (
    <div className={panelClass}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className={titleClass}>Equipment</h2>
        <span className="text-[0.65rem] text-slate-500">
          {EQUIPMENT_SLOTS.length} slots
        </span>
      </div>

      <p className={hintClass}>
        Permanent upgrades for this run. Choose wisely at each level up.
      </p>

      {/* VERTICAL LIST */}
      <div className="mt-3 flex h-full flex-col gap-2">
        {EQUIPMENT_SLOTS.map((slot) => {
          const level = equipmentLevels?.[slot.key] ?? 0;
          const hasLevel = level > 0;
          const isHighlighted = highlightedKey === slot.key;

          return (
            <div
              key={slot.key}
              className={`${slotBaseClass} ${slotColorClass} ${
                isHighlighted
                  ? "ring-2 ring-emerald-400/70 animate-pulse"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-[1px] text-sm">
                    {slot.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-[0.75rem] font-semibold">
                      {slot.label}
                    </span>
                    <span className="mt-0.5 text-[0.6rem] opacity-80">
                      {slot.short}
                    </span>
                  </div>
                </div>

                <span
                  className={
                    "shrink-0 rounded-full px-2 py-[2px] text-[0.6rem] uppercase tracking-wide " +
                    (hasLevel
                      ? theme === "hawkins"
                        ? "bg-emerald-900/80 text-emerald-200"
                        : "bg-emerald-100 text-emerald-700"
                      : theme === "hawkins"
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100 text-slate-500")
                  }
                >
                  {hasLevel ? `Lv. ${level}` : "Not equipped"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
