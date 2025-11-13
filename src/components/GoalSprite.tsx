type GoalSpriteProps = {
    size?: number;
  };
  
  export function GoalSprite({ size = 24 }: GoalSpriteProps) {
    return (
      <div
        className="relative flex items-center justify-center animate-pulse"
        style={{ width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-amber-200 to-orange-300 shadow-[0_0_16px_rgba(250,204,21,0.9)]" />
        <div className="absolute bottom-[10%] h-[55%] w-[60%] rounded-md bg-white/85" />
        <div className="absolute top-[15%] h-[35%] w-[55%] rounded-md bg-emerald-400/85" />
      </div>
    );
  }
  