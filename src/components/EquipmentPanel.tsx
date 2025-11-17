import type { Theme } from "./GameView";

type EquipmentPanelProps = {
  theme: Theme;
};

const EQUIPMENT_SLOTS = 5;

export function EquipmentPanel({ theme }: EquipmentPanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/60 bg-slate-900/90 px-4 py-3 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm";

  const titleClass =
    theme === "hawkins"
      ? "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
      : "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const hintClass =
    theme === "hawkins"
      ? "text-[0.65rem] text-slate-400"
      : "text-[0.65rem] text-slate-500";

  const slotBaseClass =
    "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-2 text-[0.65rem]";

  const slotColorClass =
    theme === "hawkins"
      ? "border-slate-600/80 bg-slate-900/80 text-slate-300"
      : "border-slate-300/80 bg-slate-50 text-slate-600";

  return (
    <div className={panelClass}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className={titleClass}>Equipment</h2>
        <span className="text-[0.65rem] text-slate-500">
          {EQUIPMENT_SLOTS} slots
        </span>
      </div>

      <p className={hintClass}>
        Gear up your rider with helmets, jackets and more (coming soon).
      </p>

      <div className="mt-2 grid grid-cols-5 gap-2">
        {Array.from({ length: EQUIPMENT_SLOTS }).map((_, idx) => (
          <div
            key={idx}
            className={`${slotBaseClass} ${slotColorClass}`}
          >
            <span className="text-xs opacity-70">Empty</span>
          </div>
        ))}
      </div>
    </div>
  );
}
