type RiderSpriteProps = {
    size?: number;
  };
  
  export function RiderSprite({ size = 28 }: RiderSpriteProps) {
    return (
      <img
        src="/sprites/rider-down.png"
        alt="Rider"
        style={{
          width: size,
          height: size,
          imageRendering: "pixelated",
        }}
        className="block"
      />
    );
  }
  