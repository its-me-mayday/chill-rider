type RiderSpriteProps = {
    size?: number;
  };
  
  export function RiderSprite({ size = 28 }: RiderSpriteProps) {
    return (
      <img
        src="/chill-rider/sprites/rider-l.png"
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
  