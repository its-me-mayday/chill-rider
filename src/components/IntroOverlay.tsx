import type { Skin } from "./GameView";

type IntroOverlayProps = {
  visible: boolean;
  selectedSkin: Skin;
  onSelectSkin: (skin: Skin) => void;
  onStartRide: () => void;
};

export function IntroOverlay({
  visible,
  selectedSkin,
  onSelectSkin,
  onStartRide,
}: IntroOverlayProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-300/70 bg-white/95 px-6 py-6 text-sm text-slate-800 shadow-2xl">
        <h2 className="mb-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Welcome to
        </h2>
        <h1 className="mb-3 text-center text-2xl font-extrabold tracking-[0.35em] text-slate-900">
          CHILL RIDER
        </h1>
        <p className="mb-4 text-center text-xs text-slate-600">
          Ride across a pastel city, collect cozy coins, complete easy-going
          deliveries, and slowly climb the chill levels.
        </p>

        <div className="mb-4">
          <p className="mb-2 text-center text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Choose your rider
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onSelectSkin("rider")}
              className={`flex w-32 flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-[0.7rem] shadow-sm ${
                selectedSkin === "rider"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex h-10 items-center justify-center">
                <img
                  src="/chill-rider/sprites/rider-d.png"
                  alt="Classic rider"
                  className="h-8 w-8"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <span className="font-semibold">Classic rider</span>
              <span className="text-[0.65rem] text-slate-500">
                Chill city courier
              </span>
            </button>
            <button
              onClick={() => onSelectSkin("dustin")}
              className={`flex w-32 flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-[0.7rem] shadow-sm ${
                selectedSkin === "dustin"
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="flex h-10 items-center justify-center">
                <img
                  src="/chill-rider/sprites/dustin-d.png"
                  alt="Dustin"
                  className="h-8 w-8"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <span className="font-semibold">Dustin</span>
              <span className="text-[0.65rem] text-slate-500">
                Hawkins bike kid
              </span>
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-col items-center gap-2 text-[0.75rem] text-slate-600">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              Enter
            </span>
            <span>Start your ride</span>
          </div>
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
            <span>Move your rider</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              P
            </span>
            <span>Pause the session</span>
          </div>
        </div>
        <div className="flex justify-center gap-3">
          <button
            className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-emerald-600"
            onClick={onStartRide}
          >
            Start ride
          </button>
        </div>
      </div>
    </div>
  );
}
