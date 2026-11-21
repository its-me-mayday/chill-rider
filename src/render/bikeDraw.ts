import type { Bike } from '../game/bike';
import { css, hex, mix, type RGB } from '../game/math';
import type { Palette } from '../game/palette';

type V = [number, number];

const R_WHEEL = 0.34;
const REAR: V = [-0.52, R_WHEEL];
const FRONT: V = [0.53, R_WHEEL];
const BB: V = [0, 0.3];
const SEAT_TOP: V = [-0.16, 0.86];
const HEAD_TOP: V = [0.4, 0.88];
const HEAD_BOT: V = [0.44, 0.74];
const SADDLE: V = [-0.2, 0.95];
const BARS: V = [0.43, 1.02];
const HIP: V = [-0.19, 1.0];
const CRANK = 0.17;
const THIGH = 0.47;
const SHIN = 0.45;
const UPPER_ARM = 0.3;
const FOREARM = 0.3;

const BASE = {
  frame: hex('#8fe0cc'),
  frameDark: hex('#5fb3a3'),
  tire: hex('#2a2233'),
  rim: hex('#d9d2e6'),
  shirt: hex('#f4c063'),
  shirtShade: hex('#d79c43'),
  pants: hex('#5a6fb0'),
  pantsFar: hex('#45568c'),
  skin: hex('#f2c4a0'),
  skinFar: hex('#d9a988'),
  beanie: hex('#e4677b'),
  scarf: hex('#ff8f8f'),
  shoe: hex('#fdf6ec'),
  basket: hex('#c8935d'),
  basketDark: hex('#9b6b3f'),
  flower1: hex('#ff9ab5'),
  flower2: hex('#fff1a8'),
  leaf: hex('#7cc79a'),
};

/** Solve a 2-bone chain; `bendSign` picks which side the joint bends to. */
function ik(root: V, target: V, l1: number, l2: number, bendSign: 1 | -1): { joint: V; end: V } {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  const max = (l1 + l2) * 0.999;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  const a0 = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cos)));
  const a = a0 + alpha * bendSign;
  return {
    joint: [root[0] + Math.cos(a) * l1, root[1] + Math.sin(a) * l1],
    end: [root[0] + dx, root[1] + dy],
  };
}

function line(ctx: CanvasRenderingContext2D, pts: V[], width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: V, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function wheel(ctx: CanvasRenderingContext2D, c: V, rot: number, tire: string, rim: string) {
  ctx.save();
  ctx.translate(c[0], c[1]);
  ctx.beginPath();
  ctx.arc(0, 0, R_WHEEL - 0.025, 0, Math.PI * 2);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = tire;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R_WHEEL - 0.065, 0, Math.PI * 2);
  ctx.lineWidth = 0.014;
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (R_WHEEL - 0.065), Math.sin(a) * (R_WHEEL - 0.065));
  }
  ctx.lineWidth = 0.006;
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
  dot(ctx, c, 0.03, rim);
}

export interface BikePose {
  time: number;
  speed: number;
}

/**
 * Draws the bike in local meters: origin on the ground between the wheels,
 * +x forward, +y up. Caller sets up the transform.
 */
export function drawBike(ctx: CanvasRenderingContext2D, bike: Bike, pal: Palette, pose: BikePose) {
  // Tint everything slightly towards the ambient palette so the rider sits in the scene.
  const amb = pal.near;
  const tint = 0.18 + pal.night * 0.45;
  const C = (c: RGB) => css(mix(c, amb, tint));

  const lean = bike.lean;
  const wob = Math.sin(pose.time * 28) * bike.wobble * 0.06;
  ctx.rotate(wob);

  // Cranks/pedals: crank angle grows when pedalling; rotate clockwise when riding right.
  const ca = -bike.crank;
  const pedalNear: V = [BB[0] + Math.cos(ca) * CRANK, BB[1] + Math.sin(ca) * CRANK];
  const pedalFar: V = [BB[0] - Math.cos(ca) * CRANK, BB[1] - Math.sin(ca) * CRANK];

  // Upper body: lean forward (tuck) or back (sit up)
  const breathe = Math.sin(pose.time * 2.2) * 0.008;
  const hip: V = [HIP[0] + lean * 0.03, HIP[1]];
  const shoulder: V = [0.1 + lean * 0.1, 1.44 - lean * 0.07 + breathe];
  const neck: V = [shoulder[0] + 0.03, shoulder[1] + 0.07];
  const head: V = [neck[0] + 0.05 + lean * 0.03, neck[1] + 0.13];

  // ---- far side (behind frame) ----
  const legFar = ik(hip, pedalFar, THIGH, SHIN, 1);
  line(ctx, [hip, legFar.joint, legFar.end], 0.1, C(BASE.pantsFar));
  line(ctx, [legFar.end, [legFar.end[0] + 0.08, legFar.end[1] - 0.01]], 0.06, C(BASE.shoe));
  const armFar = ik(shoulder, [BARS[0] - 0.02, BARS[1]], UPPER_ARM, FOREARM, -1);
  line(ctx, [shoulder, armFar.joint, armFar.end], 0.065, C(BASE.skinFar));
  line(ctx, [BB, pedalFar], 0.025, C(BASE.frameDark));

  // ---- wheels ----
  const tire = C(BASE.tire);
  const rim = C(BASE.rim);
  wheel(ctx, REAR, bike.wheelRot, tire, rim);
  wheel(ctx, FRONT, bike.wheelRot, tire, rim);

  // ---- frame ----
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const frame = C(BASE.frame);
  const frameDark = C(BASE.frameDark);
  line(ctx, [REAR, BB, SEAT_TOP, REAR], 0.035, frameDark);
  line(ctx, [SEAT_TOP, HEAD_TOP], 0.045, frame);
  line(ctx, [BB, HEAD_BOT], 0.05, frame);
  line(ctx, [HEAD_TOP, HEAD_BOT], 0.06, frame);
  line(ctx, [HEAD_BOT, FRONT], 0.032, frameDark);
  line(ctx, [BB, SEAT_TOP], 0.045, frame);
  // chain
  line(ctx, [[BB[0], BB[1] + 0.07], [REAR[0], REAR[1] + 0.04]], 0.01, tire);
  line(ctx, [[BB[0], BB[1] - 0.07], [REAR[0], REAR[1] - 0.04]], 0.01, tire);
  ctx.beginPath();
  ctx.arc(BB[0], BB[1], 0.08, 0, Math.PI * 2);
  ctx.lineWidth = 0.02;
  ctx.strokeStyle = rim;
  ctx.stroke();
  // seatpost + saddle
  line(ctx, [SEAT_TOP, SADDLE], 0.03, rim);
  ctx.beginPath();
  ctx.ellipse(SADDLE[0] + 0.02, SADDLE[1] + 0.02, 0.13, 0.035, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = tire;
  ctx.fill();
  // stem + bars
  line(ctx, [HEAD_TOP, [BARS[0], BARS[1] - 0.03], [BARS[0] + 0.08, BARS[1]], [BARS[0] + 0.02, BARS[1] + 0.03]], 0.028, rim);

  // ---- basket with flowers ----
  ctx.save();
  ctx.translate(0.62, 0.86);
  ctx.beginPath();
  ctx.moveTo(-0.16, 0.16);
  ctx.lineTo(0.16, 0.16);
  ctx.lineTo(0.12, -0.04);
  ctx.lineTo(-0.12, -0.04);
  ctx.closePath();
  ctx.fillStyle = C(BASE.basket);
  ctx.fill();
  ctx.lineWidth = 0.012;
  ctx.strokeStyle = C(BASE.basketDark);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.06, 0.16);
    ctx.lineTo(i * 0.045, -0.04);
    ctx.stroke();
  }
  line(ctx, [[-0.155, 0.1], [0.155, 0.1]], 0.012, C(BASE.basketDark));
  line(ctx, [[-0.14, 0.04], [0.14, 0.04]], 0.012, C(BASE.basketDark));
  const sway = Math.sin(pose.time * 3 + pose.speed * 0.2) * 0.04 * Math.min(1, pose.speed / 6);
  const stems: [number, number, RGB][] = [
    [-0.08, 0.3, BASE.flower1],
    [0.0, 0.36, BASE.flower2],
    [0.08, 0.28, BASE.flower1],
  ];
  for (const [sx, sh, col] of stems) {
    const tip: V = [sx - sway * (sh / 0.3) - 0.02, 0.16 + sh];
    line(ctx, [[sx, 0.14], tip], 0.012, C(BASE.leaf));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + pose.time * 0.2;
      dot(ctx, [tip[0] + Math.cos(a) * 0.035, tip[1] + Math.sin(a) * 0.035], 0.028, C(col));
    }
    dot(ctx, tip, 0.022, C(BASE.flower2));
  }
  ctx.restore();

  // ---- near side ----
  line(ctx, [BB, pedalNear], 0.028, rim);
  const legNear = ik(hip, pedalNear, THIGH, SHIN, 1);

  // torso
  line(ctx, [hip, shoulder], 0.2, C(BASE.shirt));
  line(ctx, [[hip[0] - 0.02, hip[1] + 0.02], [shoulder[0] - 0.05, shoulder[1] - 0.02]], 0.07, C(BASE.shirtShade));

  // scarf flowing behind, longer and wavier with speed
  const s = Math.min(1, pose.speed / 12);
  const scarf: V[] = [[neck[0] + 0.02, neck[1] - 0.01]];
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    scarf.push([
      neck[0] - t * (0.16 + 0.45 * s),
      neck[1] - t * (0.28 - 0.22 * s) + Math.sin(pose.time * 9 - i * 1.1) * 0.03 * t * (0.3 + s),
    ]);
  }
  line(ctx, scarf, 0.06, C(BASE.scarf));

  line(ctx, [hip, legNear.joint, legNear.end], 0.11, C(BASE.pants));
  line(ctx, [legNear.end, [legNear.end[0] + 0.09, legNear.end[1] - 0.01]], 0.065, C(BASE.shoe));

  // head + beanie
  dot(ctx, head, 0.115, C(BASE.skin));
  ctx.beginPath();
  ctx.arc(head[0] - 0.005, head[1] + 0.02, 0.12, Math.PI * 0.05, Math.PI * 1.02);
  ctx.closePath();
  ctx.fillStyle = C(BASE.beanie);
  ctx.fill();
  dot(ctx, [head[0] - 0.06, head[1] + 0.15], 0.04, C(BASE.beanie));
  // tiny headphones band — it's a lofi game after all
  dot(ctx, [head[0] - 0.02, head[1] - 0.01], 0.045, C(BASE.tire));

  const armNear = ik(shoulder, BARS, UPPER_ARM, FOREARM, -1);
  line(ctx, [shoulder, armNear.joint, armNear.end], 0.075, C(BASE.shirt));
  line(ctx, [armNear.joint, armNear.end], 0.065, C(BASE.skin));
}
