type RewardPopup = {
  id: string;
  text: string;
  x: number;
  y: number;
  variant: "coins" | "coffee" | "level" | "lucky";
};

type RewardPopupsLayerProps = {
  popups: RewardPopup[];
};

export function RewardPopupsLayer({ popups }: RewardPopupsLayerProps) {
  if (!popups.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {popups.map((popup) => {
        const baseClass =
          "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold shadow-lg whitespace-nowrap";

        let variantClass = "";
        let extraAnim = "";

        switch (popup.variant) {
          case "coins":
            variantClass =
              "bg-amber-300/95 text-amber-950 border border-amber-500/70";
            extraAnim = "animate-bounce";
            break;
          case "coffee":
            variantClass =
              "bg-rose-300/95 text-rose-950 border border-rose-500/70";
            extraAnim = "animate-pulse";
            break;
          case "level":
            variantClass =
              "bg-sky-400/95 text-sky-950 border border-sky-600/70";
            extraAnim = "animate-[ping_0.7s_ease-out]";
            break;
          case "lucky":
            variantClass =
              "bg-emerald-300/95 text-emerald-950 border border-emerald-500/80";
            extraAnim = "animate-[pulse_0.7s_ease-in-out]";
            break;
        }

        return (
          <div
            key={popup.id}
            style={{ left: popup.x, top: popup.y }}
            className={`${baseClass} ${variantClass} ${extraAnim}`}
          >
            {popup.text}
          </div>
        );
      })}
    </div>
  );
}
