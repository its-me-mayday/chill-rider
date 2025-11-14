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
      <>
        {popups.map((popup) => {
          let colorClasses = "";
  
          if (popup.variant === "coins") {
            colorClasses =
              "bg-amber-400/95 text-slate-900 border-amber-200";
          } else if (popup.variant === "coffee") {
            colorClasses =
              "bg-rose-500/95 text-white border-rose-200";
          } else if (popup.variant === "level") {
            colorClasses =
              "bg-sky-500/95 text-white border-sky-200";
          }
  
          const popupClass =
            "reward-popup absolute -translate-x-1/2 text-xs font-semibold px-2 py-1 rounded-full border shadow " +
            colorClasses;
  
          return (
            <div
              key={popup.id}
              className={popupClass}
              style={{
                left: popup.x,
                top: popup.y - 10,
              }}
            >
              {popup.text}
            </div>
          );
        })}
      </>
    );
  }
  