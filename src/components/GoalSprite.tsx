type GoalSpriteProps = {
    size?: number;
  };
  
  export function GoalSprite({ size = 24 }: GoalSpriteProps) {
    return (
      <div
        style={{
          width: size,
          height: size,
          imageRendering: "pixelated",
        }}
        className="rounded-sm border border-amber-200 bg-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.7)]"
      />
    );
  }
  