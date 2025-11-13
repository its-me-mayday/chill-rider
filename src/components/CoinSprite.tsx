type CoinSpriteProps = {
    size?: number;
  };
  
  export function CoinSprite({ size = 20 }: CoinSpriteProps) {
    return (
      <div
        className="flex items-center justify-center animate-bounce"
        style={{ width: size, height: size }}
      >
        <div className="h-[70%] w-[70%] rounded-full bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-400 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
      </div>
    );
  }
  