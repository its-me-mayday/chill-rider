import { css, hex, mix, type RGB } from '../game/math';
import type { Rider } from '../game/rider';

const C = {
  frame: hex('#8fe0cc'),
  tire: hex('#2a2233'),
  rim: hex('#d9d2e6'),
  shirt: hex('#f4c063'),
  shirtShade: hex('#d79c43'),
  pants: hex('#5a6fb0'),
  skin: hex('#f2c4a0'),
  beanie: hex('#e4677b'),
  scarf: hex('#ff8f8f'),
  basket: hex('#c8935d'),
  flower1: hex('#ff9ab5'),
  flower2: hex('#fff1a8'),
  phones: hex('#3a3045'),
};

export interface Cargo {
  color: RGB;
  fragile: boolean;
}

/**
 * Top-down bike + rider in local meters: +x is forward, +y is the rider's right.
 * The caller translates/rotates/scales the context.
 */
export function drawRider(ctx: CanvasRenderingContext2D, r: Rider, time: number, cargo: Cargo[], tint: (c: RGB) => string) {
  const steer = r.steerVis * 0.45;
  const wob = Math.sin(time * 30) * r.wobble * 0.12;
  ctx.rotate(wob);

  // wheels
  ctx.fillStyle = tint(C.tire);
  ctx.beginPath();
  ctx.roundRect(-0.88, -0.05, 0.62, 0.1, 0.05);
  ctx.fill();
  ctx.save();
  ctx.translate(0.6, 0);
  ctx.rotate(steer);
  ctx.beginPath();
  ctx.roundRect(-0.31, -0.05, 0.62, 0.1, 0.05);
  ctx.fill();
  // handlebar
  ctx.strokeStyle = tint(C.rim);
  ctx.lineWidth = 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.12, -0.32);
  ctx.lineTo(-0.08, 0.32);
  ctx.stroke();
  // basket with flowers
  ctx.fillStyle = tint(C.basket);
  ctx.beginPath();
  ctx.roundRect(0.0, -0.17, 0.3, 0.34, 0.05);
  ctx.fill();
  const fl: [number, number, RGB][] = [[0.1, -0.07, C.flower1], [0.2, 0.06, C.flower2], [0.08, 0.08, C.flower1]];
  for (const [fx, fy, col] of fl) {
    ctx.fillStyle = tint(col);
    ctx.beginPath();
    ctx.arc(fx, fy, 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // frame
  ctx.strokeStyle = tint(C.frame);
  ctx.lineWidth = 0.09;
  ctx.beginPath();
  ctx.moveTo(-0.6, 0);
  ctx.lineTo(0.5, 0);
  ctx.stroke();

  // rear rack + parcels
  ctx.fillStyle = tint(C.rim);
  ctx.fillRect(-0.95, -0.18, 0.5, 0.36);
  cargo.slice(0, 3).forEach((b, i) => {
    const s = 0.46 - i * 0.06;
    const ox = -0.72 + (i === 1 ? 0.03 : 0) - i * 0.02;
    const rot = (i - 1) * 0.12;
    ctx.save();
    ctx.translate(ox, 0);
    ctx.rotate(rot);
    ctx.fillStyle = tint(mix(b.color, [40, 20, 30], i * 0.08));
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = tint(mix(b.color, [90, 50, 40], 0.3));
    ctx.fillRect(-s / 2, -0.035, s, 0.07);
    if (b.fragile) {
      ctx.fillStyle = tint(C.beanie);
      ctx.fillRect(-0.035, -s / 2, 0.07, s);
    }
    ctx.restore();
  });

  // legs: knees bob forward alternately while pedalling
  const ph = r.crank;
  const kneeL = Math.sin(ph) * 0.12;
  const kneeR = -kneeL;
  ctx.fillStyle = tint(C.pants);
  ctx.beginPath();
  ctx.ellipse(0.12 + kneeL, -0.2, 0.2, 0.09, 0, 0, Math.PI * 2);
  ctx.ellipse(0.12 + kneeR, 0.2, 0.2, 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // scarf flutters behind
  const s = Math.min(1, r.speed / 8);
  ctx.strokeStyle = tint(C.scarf);
  ctx.lineWidth = 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.05, 0.05);
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    ctx.lineTo(-0.05 - t * (0.25 + 0.55 * s), 0.05 + Math.sin(time * 10 - i) * 0.06 * t * (0.4 + s) + t * 0.08);
  }
  ctx.stroke();

  // body + arms
  ctx.fillStyle = tint(C.shirt);
  ctx.beginPath();
  ctx.ellipse(-0.08, 0, 0.2, 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tint(C.shirt);
  ctx.lineWidth = 0.1;
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.24);
  ctx.lineTo(0.48 + steer * 0.05, -0.3);
  ctx.moveTo(-0.05, 0.24);
  ctx.lineTo(0.5 - steer * 0.05, 0.3);
  ctx.stroke();
  ctx.fillStyle = tint(C.skin);
  ctx.beginPath();
  ctx.arc(0.5, -0.3, 0.055, 0, Math.PI * 2);
  ctx.arc(0.52, 0.3, 0.055, 0, Math.PI * 2);
  ctx.fill();

  // head: beanie seen from above, headphones band
  ctx.fillStyle = tint(C.skin);
  ctx.beginPath();
  ctx.arc(0.02, 0, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint(C.beanie);
  ctx.beginPath();
  ctx.arc(-0.01, 0, 0.15, Math.PI * 0.35, Math.PI * 1.65);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-0.06, 0, 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tint(C.phones);
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(0.02, -0.16);
  ctx.lineTo(0.02, 0.16);
  ctx.stroke();
}

export const riderTint = (amount: number, toward: RGB) => (c: RGB) => css(mix(c, toward, amount));
