import type { Theme } from "./GameView";

type TimePanelProps = {
  theme: Theme;
  globalTime: number;
};

export function TimePanel({ theme, globalTime }: TimePanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/60 bg-slate-900/95 px-4 py-3 text-xs text-slate-100 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/80 bg-white/95 px-4 py-3 text-xs text-slate-900 shadow-lg backdrop-blur-sm";

  const labelClass =
    "text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const timeClass =
    theme === "hawkins"
      ? "text-2xl font-extrabold tabular-nums text-emerald-300"
      : "text-2xl font-extrabold tabular-nums text-sky-600";

  const pillClass =
    theme === "hawkins"
      ? "inline-flex items-center gap-1 rounded-full bg-slate-800/90 px-2 py-1 text-[0.6rem] text-emerald-200"
      : "inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-[0.6rem] text-sky-700";

  return (
    <div className={panelClass}>
      <div className="flex items-center justify-between">
        <div>
          <div className={labelClass}>Run timer</div>
          <div className={timeClass}>{globalTime}s</div>
        </div>
        <div className={pillClass}>
          <span>⏱</span>
          <span>Time left</span>
        </div>
      </div>
    </div>
  );
}
