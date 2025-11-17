type RunSummary = {
    level: number;
    distance: number;
    deliveries: number;
    coins: number;
  };
  
  type GameOverOverlayProps = {
    visible: boolean;
    summary: RunSummary | null;
    onPlayAgain: () => void;
    onBackToTitle: () => void;
  };
  
  export function GameOverOverlay({
    visible,
    summary,
    onPlayAgain,
    onBackToTitle,
  }: GameOverOverlayProps) {
    if (!visible || !summary) return null;
  
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-sm" />
        <div className="relative w-full max-w-md rounded-3xl border border-slate-300/80 bg-white/95 px-6 py-6 text-slate-900 shadow-2xl">
          <div className="text-center">
            <div className="text-[0.75rem] font-semibold uppercase tracking-[0.25em] text-rose-500">
              Game over
            </div>
            <h2 className="mt-1 text-xl font-extrabold tracking-wide">
              Time is up!
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Your delivery shift has ended. Here is your final run.
            </p>
          </div>
  
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-100 px-3 py-2">
              <div className="text-[0.6rem] uppercase text-slate-500">
                Level reached
              </div>
              <div className="text-base font-semibold text-slate-900">
                {summary.level}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2">
              <div className="text-[0.6rem] uppercase text-slate-500">
                Deliveries
              </div>
              <div className="text-base font-semibold text-slate-900">
                {summary.deliveries}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2">
              <div className="text-[0.6rem] uppercase text-slate-500">
                Distance
              </div>
              <div className="text-base font-semibold text-slate-900">
                {summary.distance}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2">
              <div className="text-[0.6rem] uppercase text-slate-500">
                Coins collected
              </div>
              <div className="text-base font-semibold text-slate-900">
                {summary.coins}
              </div>
            </div>
          </div>
  
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              className="w-full rounded-full bg-slate-200 px-4 py-2 text-[0.8rem] font-semibold text-slate-800 hover:bg-slate-300 sm:w-auto"
              onClick={onBackToTitle}
            >
              Back to title
            </button>
            <button
              className="w-full rounded-full bg-emerald-500 px-4 py-2 text-[0.8rem] font-semibold text-white shadow-sm hover:bg-emerald-600 sm:w-auto"
              onClick={onPlayAgain}
            >
              Play again
            </button>
          </div>
        </div>
      </div>
    );
  }
  