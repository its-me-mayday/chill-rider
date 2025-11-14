type HelpPanelProps = {
  visible: boolean;
};

export function HelpPanel({ visible }: HelpPanelProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-300/70 bg-white/95 px-5 py-4 text-xs text-slate-700 shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Controls
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] text-slate-500">
            Press H to close
          </span>
        </div>

        <div className="space-y-2 text-[0.75rem]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                ↑ ↓ ← →
              </span>
              <span>Move around the city</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                W A S D
              </span>
              <span>Alternative movement keys</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                Enter
              </span>
              <span>Start your ride</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                P
              </span>
              <span>Pause or resume the ride</span>
            </div>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-200 pt-2 text-[0.7rem] text-slate-600">
          <p>Ride to the glowing goal marker, collect coins, avoid slow tiles, and level up every 5 deliveries.</p>
        </div>
      </div>
    </div>
  );
}
