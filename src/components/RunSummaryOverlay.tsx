type RunSummary = {
    level: number;
    distance: number;
    deliveries: number;
    coins: number;
  };
  
  type RunSummaryOverlayProps = {
    visible: boolean;
    summary: RunSummary | null;
    onPlayAgain: () => void;
    onBackToTitle: () => void;
  };
  
  export function RunSummaryOverlay({
    visible,
    summary,
    onPlayAgain,
    onBackToTitle,
  }: RunSummaryOverlayProps) {
    if (!visible || !summary) return null;
  
    return (
      <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-slate-300/70 bg-white/95 px-6 py-6 text-sm text-slate-800 shadow-2xl">
          <h2 className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Run complete
          </h2>
          <h1 className="mb-4 text-center text-xl font-extrabold tracking-[0.25em] text-slate-900">
            SESSION SUMMARY
          </h1>
  
          <div className="mb-4 grid grid-cols-4 gap-3 text-center text-xs">
            <div>
              <div className="text-[0.65rem] uppercase text-slate-500">
                Level
              </div>
              <div className="text-lg font-semibold text-sky-600">
                {summary.level}
              </div>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase text-slate-500">
                Distance
              </div>
              <div className="text-lg font-semibold text-emerald-500">
                {summary.distance}
              </div>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase text-slate-500">
                Deliveries
              </div>
              <div className="text-lg font-semibold text-sky-500">
                {summary.deliveries}
              </div>
            </div>
            <div>
              <div className="text-[0.65rem] uppercase text-slate-500">
                Coins
              </div>
              <div className="text-lg font-semibold text-amber-500">
                {summary.coins}
              </div>
            </div>
          </div>
  
          <p className="mb-4 text-center text-[0.75rem] text-slate-600">
            Nice ride. Grab a new package and dive into another chill run, or
            head back to the title screen and take a break.
          </p>
  
          <div className="flex justify-center gap-3">
            <button
              className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-600"
              onClick={onPlayAgain}
            >
              Ride again
            </button>
            <button
              className="rounded-full bg-white px-4 py-2 text-[0.7rem] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={onBackToTitle}
            >
              Back to title
            </button>
          </div>
        </div>
      </div>
    );
  }
  