import { type Direction } from "../engine/localEngine";

type RiderSpriteProps = {
  size?: number;
  direction: Direction;
};

export function RiderSprite({ size = 28, direction }: RiderSpriteProps) {
  const padding = Math.max(2, Math.floor(size * 0.08));

  const spriteByDirection: Record<Direction, string> = {
    up: "/chill-rider/sprites/rider-u.png",
    down: "/chill-rider/sprites/rider-d.png",
    left: "/chill-rider/sprites/rider-l.png",
    right: "/chill-rider/sprites/rider-r.png",
  };

  const src = spriteByDirection[direction];

  return (
    <div
      className="flex items-center justify-center rounded-lg bg-sky-100/90 shadow-[0_0_18px_rgba(56,189,248,0.9)]"
      style={{
        width: size,
        height: size,
        animation: "rider-bob 700ms ease-in-out infinite alternate",
      }}
    >
      <img
        src={src}
        alt="Rider"
        style={{
          width: size - padding * 2,
          height: size - padding * 2,
          imageRendering: "pixelated",
        }}
        className="block"
      />
    </div>
  );
}
