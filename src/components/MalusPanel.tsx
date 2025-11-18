import type { Theme } from "./GameView";

type MalusPanelProps = {
  theme: Theme;
  mudStepsRemaining: number;
  message: string;
};

export function MalusPanel({
  theme,
  mudStepsRemaining,
  message,
}: MalusPanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/50 bg-slate-900/90 px-4 py-3 text-[0.7rem] text-slate-100 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/70 bg-white/95 px-4 py-3 text-[0.7rem] text-slate-800 shadow-lg backdrop-blur-sm";

  const titleClass =
    "mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const active =
    mudStepsRemaining > 0
      ? `Controls inverted for ${mudStepsRemaining} step${
          mudStepsRemaining === 1 ? "" : "s"
        }.`
      : "No active maluses. Ride safe.";

  const safeMessage = "✅ No active maluses. Ride safe.";
  const showTileMessage =
    message && message.trim().length > 0 && message !== safeMessage;

  return (
    <div className={panelClass}>
      <div className={titleClass}>Status & malus</div>
      <div className="flex items-start gap-2">
        <span className="mt-[2px] text-base">🚲</span>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs leading-snug">{active}</p>

          {showTileMessage && (
            <p className="text-[0.7rem] leading-snug text-slate-500">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
