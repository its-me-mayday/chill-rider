import type { Theme } from "./GameView";

type PauseOverlayProps = {
  visible: boolean;
  level: number;
  distance: number;
  deliveries: number;
  coins: number;
  onResume: () => void;
  onEndRun: () => void;
  onNewMap: () => void;
  onToggleHelp: () => void;
  onOpenSettings: () => void;
  theme: Theme;
};

export function PauseOverlay({
  visible,
  level,
  distance,
  deliveries,
  coins,
  onResume,
  onEndRun,
  onNewMap,
  onToggleHelp,
  onOpenSettings,
  theme,
}: PauseOverlayProps) {
  if (!visible) return null;

  const isHawkins = theme === "hawkins";

  const panelClass = isHawkins
    ? "w-full max-w-md rounded-3xl border border-red-500/70 bg-slate-950/95 px-6 py-6 text-slate-100 shadow-2xl backdrop-blur"
    : "w-full max-w-md rounded-3xl border border-slate-300/80 bg-white/95 px-6 py-6 text-slate-900 shadow-2xl backdrop-blur";

  const titleClass = isHawkins
    ? "text-xs font-semibold uppercase tracking-[0.25em] text-red-300"
    : "text-xs font-semibold uppercase tracking-[0.25em] text-slate-500";

  const mainTitleClass = isHawkins
    ? "mt-1 text-2xl font-extrabold text-red-300"
    : "mt-1 text-2xl font-extrabold text-slate-900";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className={panelClass}>
        <div className="text-center">
          <div className={titleClass}>Session paused</div>
          <div className={mainTitleClass}>Chill break</div>
          <div className="mt-1 text-[0.75rem] text-slate-500">
            Press <span className="font-semibold">P</span> again to resume.
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3 text-center text-[0.7rem]">
          <StatBox label="Level" value={level} />
          <StatBox label="Distance" value={distance} />
          <StatBox label="Deliveries" value={deliveries} />
          <StatBox label="Coins" value={coins} />
        </div>

        <div className="mt-5 flex flex-col gap-2 text-[0.8rem]">
          <button
            className="w-full rounded-full bg-emerald-500 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            onClick={onResume}
          >
            Resume ride
          </button>

          <button
            className="w-full rounded-full bg-slate-200 px-4 py-2 font-semibold text-slate-900 shadow-sm transition hover:bg-slate-300"
            onClick={onNewMap}
          >
            New map
          </button>

          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              className="w-full rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-sky-700 shadow-sm transition hover:bg-white"
              onClick={onToggleHelp}
            >
              Help (H)
            </button>
            <button
              className="w-full rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              onClick={onOpenSettings}
            >
              Settings ⚙️
            </button>
          </div>

          <button
            className="mt-2 w-full rounded-full bg-red-500/90 px-4 py-1.5 text-[0.75rem] font-semibold text-white shadow-sm transition hover:bg-red-600"
            onClick={onEndRun}
          >
            End run & show summary
          </button>
        </div>
      </div>
    </div>
  );
}

type StatBoxProps = {
  label: string;
  value: number;
};

function StatBox({ label, value }: StatBoxProps) {
  return (
    <div className="rounded-2xl bg-slate-900/5 px-2 py-2">
      <div className="text-[0.6rem] uppercase text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800">
        {value}
      </div>
    </div>
  );
}
