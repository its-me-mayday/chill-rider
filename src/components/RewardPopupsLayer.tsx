type RewardPopup = {
  id: string;
  text: string;
  x: number;
  y: number;
  variant: "coins" | "coffee" | "level";
};

type RewardPopupsLayerProps = {
  popups: RewardPopup[];
};

export function RewardPopupsLayer({ popups }: RewardPopupsLayerProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {popups.map((popup, index) => {
        const verticalOffset = index * -18; // ogni popup sale un po'

        let colorClass =
          "bg-slate-800/90 text-slate-50 border border-slate-500/60";
        if (popup.variant === "coins") {
          colorClass =
            "bg-amber-300 text-amber-950 border border-amber-500/70";
        } else if (popup.variant === "coffee") {
          colorClass =
            "bg-emerald-300 text-emerald-950 border border-emerald-500/70";
        } else if (popup.variant === "level") {
          colorClass =
            "bg-sky-300 text-sky-950 border border-sky-500/70";
        }

        return (
          <div
            key={popup.id}
            className={
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold shadow-md backdrop-blur-sm animate-bounce " +
              colorClass
            }
            style={{
              left: popup.x,
              top: popup.y + verticalOffset,
              whiteSpace: "nowrap",
            }}
          >
            {popup.text}
          </div>
        );
      })}
    </div>
  );
}
