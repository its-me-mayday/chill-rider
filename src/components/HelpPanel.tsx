type HelpPanelProps = {
  visible: boolean;
};

export function HelpPanel({ visible }: HelpPanelProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-300/70 bg-white/95 px-6 py-6 text-xs text-slate-700 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold tracking-[0.18em] uppercase text-slate-500">
            Controls
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem]">
            Press H to close
          </span>
        </div>

        <div className="mb-4 grid gap-2 text-[0.75rem]">
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
            <span>Start your ride from the intro screen</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              P
            </span>
            <span>Pause / resume the session</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
              H
            </span>
            <span>Toggle this help panel</span>
          </div>
        </div>

        <div className="mb-3 border-t border-slate-200 pt-3 text-[0.75rem]">
          <p className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
            Deliveries & levels
          </p>
          <ul className="ml-4 list-disc space-y-1 text-slate-700">
            <li>
              Ride into a <span className="font-semibold">shop</span> to pick up
              a colored package. It will appear in your inventory.
            </li>
            <li>
              A single <span className="font-semibold">building</span> on the
              map will be highlighted with the same color: that&apos;s your
              delivery house.
            </li>
            <li>
              Ride into that colored building to deliver the package, earn bonus
              coins and complete a delivery.
            </li>
            <li>
              After a delivery, the building becomes solid again and can&apos;t
              be crossed anymore.
            </li>
            <li>
              Every few deliveries the city levels up: new layouts, more roads,
              more chill chaos.
            </li>
          </ul>
        </div>

        <div className="mb-3 border-t border-slate-200 pt-3 text-[0.75rem]">
          <p className="mb-1 font-semibold uppercase tracking-[0.16em] text-slate-500">
            Tiles
          </p>
          <ul className="ml-4 list-disc space-y-1 text-slate-700">
            <li>
              <span className="font-semibold">Road</span>: fastest way to move
              around the city.
            </li>
            <li>
              <span className="font-semibold">Grass</span>: walkable, but just
              for exploration.
            </li>
            <li>
              <span className="font-semibold">Slow tile</span>: sandy ground
              that costs extra distance per step.
            </li>
            <li>
              <span className="font-semibold">Coffee spot</span>: reduces your
              distance and gives extra coins when you step on it.
            </li>
            <li>
              <span className="font-semibold">Shop</span>: the only place where
              you can pick up new packages.
            </li>
            <li>
              <span className="font-semibold">Colored building</span>: active
              delivery house for your current package.
            </li>
          </ul>
        </div>

        <div className="mt-1 text-[0.7rem] text-slate-500">
          Ride, grab packages, follow the color, deliver, level up. Stay chill
          on the bike. 🚲
        </div>
      </div>
    </div>
  );
}
