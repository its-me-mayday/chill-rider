type HelpPanelProps = {
    visible: boolean;
  };
  
  export function HelpPanel({ visible }: HelpPanelProps) {
    if (!visible) return null;
  
    return (
      <div className="z-20 mt-3 w-full max-w-xl rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-lg backdrop-blur">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-semibold tracking-[0.18em] uppercase text-slate-500">
            Controls
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem]">
            Press H to hide
          </span>
        </div>
        <div className="mb-2 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                ↑
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                ↓
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                ←
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                →
              </span>
            </div>
            <span>Move around the city</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                W
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                A
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                S
              </span>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                D
              </span>
            </div>
            <span>Alternative movement keys</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              Enter
            </span>
            <span>Start your ride</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              P
            </span>
            <span>Pause or resume the ride</span>
          </div>
        </div>
        <div className="mt-1 grid gap-1 text-[0.7rem] text-slate-600">
          <span>
            Goal: ride to the glowing delivery marker on the road.
          </span>
          <span>
            Collect bouncing coins on the road to increase your coin score.
          </span>
          <span>
            Avoid sandy slow tiles if you want to keep your distance low they
            cost extra distance per move.
          </span>
          <span>
            Every 5 deliveries you level up and the city becomes denser, but
            still chill.
          </span>
        </div>
      </div>
    );
  }
  