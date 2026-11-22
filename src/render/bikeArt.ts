/**
 * Side-view illustration of the courier on the bike, used for the delivery
 * snapshots and the workshop. The bike shows its upgrades (rack, motor,
 * tyres, suspension, light, thermal bag, helmet) and the rider strikes a pose.
 */

export type Pose = 'cruise' | 'wave' | 'wheelie' | 'handoff' | 'nohands' | 'sprint' | 'jump' | 'tired';

export const POSES: Pose[] = ['wave', 'wheelie', 'handoff', 'nohands', 'sprint', 'jump'];

export interface ArtStyle {
  frame: string;
  beanie: string;
  scarf: string;
}

export interface ArtUpgrades {
  gears: number;
  motor: number;
  tires: number;
  brakes: number;
  rack: number;
  suspension: number;
  thermo: number;
  light: number;
  helmet: number;
  bell: number;
}

export interface Scene {
  pose: Pose;
  style: ArtStyle;
  up: ArtUpgrades;
  /** 0..1 progress of the little animation loop */
  t: number;
  /** colour of the parcel held / carried */
  parcel?: string;
  sky?: [string, string];
  ground?: string;
  /** draw speed lines and confetti */
  fx?: boolean;
}

type V = [number, number];

const SKIN = '#f2c4a0';
const SHIRT = '#f4c063';
const PANTS = '#5a6fb0';
const TIRE = '#2a2233';
const INK = '#3a2a40';

function rainbow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  ['#ff8f8f', '#ffd27a', '#9fe3a8', '#8fc8ff', '#c9a3ff'].forEach((c, i) => g.addColorStop(i / 4, c));
  return g;
}

/** two-bone IK: from a to b with bone lengths l1, l2; the joint bends towards `side` */
function ik(a: V, b: V, l1: number, l2: number, side: number): V {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const ang = Math.atan2(dy, dx);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const off = Math.acos(Math.max(-1, Math.min(1, cos))) * side;
  return [a[0] + Math.cos(ang + off) * l1, a[1] + Math.sin(ang + off) * l1];
}

function limb(ctx: CanvasRenderingContext2D, pts: V[], w: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
}

/** Draws the whole snapshot into a canvas of size w×h (CSS pixels, already scaled for DPR). */
export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, sc: Scene) {
  const { pose, style, up, t } = sc;
  ctx.save();
  // ---- backdrop
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, sc.sky?.[0] ?? '#ffd9c2');
  sky.addColorStop(1, sc.sky?.[1] ?? '#ffeedd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // sun and soft hills
  ctx.fillStyle = 'rgba(255,240,200,0.8)';
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.26, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let k = 0; k < 3; k++) {
    const cx = ((k * 0.37 + 0.15 - t * 0.2) % 1 + 1) % 1;
    ctx.beginPath();
    ctx.ellipse(cx * w * 1.2 - w * 0.1, h * (0.18 + k * 0.08), w * 0.09, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const groundY = h * 0.84;
  ctx.fillStyle = sc.ground ?? '#a9c98a';
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, groundY - 6 - Math.sin(x * 0.03 + t * 4) * 3);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // the road
  ctx.fillStyle = '#6f6577';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = 'rgba(255,241,208,0.8)';
  for (let k = 0; k < 6; k++) {
    const x = ((k / 6 - t * 1.5) % 1 + 1) % 1;
    ctx.fillRect(x * w * 1.2 - w * 0.1, groundY + (h - groundY) * 0.55, w * 0.08, 2.5);
  }

  // ---- the bike and rider, in "bike units" (wheelbase ≈ 60)
  const S = Math.min(w / 170, h / 142);
  const ox = w * 0.46;
  let oy = groundY - 17 * S - 1;
  let rot = 0;
  const bounce = Math.sin(t * Math.PI * 4) * 0.6;
  if (pose === 'jump') {
    const hop = Math.sin(t * Math.PI);
    oy -= hop * 16 * S;
    rot = -0.12 * hop;
    // shadow on the road
    ctx.fillStyle = 'rgba(40,20,50,0.25)';
    ctx.beginPath();
    ctx.ellipse(ox, groundY + 3, 40 * S * (1 - hop * 0.3), 4 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(40,20,50,0.25)';
    ctx.beginPath();
    ctx.ellipse(ox, groundY + 2, 44 * S, 4 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(ox, oy + (pose === 'jump' ? 0 : bounce * S * 0.4));
  ctx.scale(S, S);
  if (pose === 'wheelie') {
    // pivot round the rear contact patch
    ctx.translate(-30, 17);
    ctx.rotate(-0.42 + Math.sin(t * Math.PI * 2) * 0.04);
    ctx.translate(30, -17);
  }
  ctx.rotate(rot);

  // speed lines behind
  if (sc.fx !== false && pose !== 'tired') {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const yy = -40 + k * 13;
      const off = ((t * 3 + k * 0.37) % 1) * 20;
      ctx.beginPath();
      ctx.moveTo(-60 - off, yy);
      ctx.lineTo(-48 - off - k * 3, yy);
      ctx.stroke();
    }
  }

  const rearHub: V = [-30, 0];
  const frontHub: V = [30, 0];
  const bb: V = [-3, 1];
  const seatTop: V = [-11, -26];
  const headTop: V = [21, -27];
  const headBot: V = [24, -17];
  const R = 17;
  const frame = style.frame === 'rainbow' ? rainbow(ctx, -30, 0, 60) : style.frame;
  const spin = t * Math.PI * 8;

  // ---- wheels
  const tireW = 2.6 + up.tires * 0.9;
  for (const hub of [rearHub, frontHub]) {
    ctx.strokeStyle = TIRE;
    ctx.lineWidth = tireW;
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], R - tireW / 2, 0, Math.PI * 2);
    ctx.stroke();
    if (up.tires >= 2) {
      // knobbly tread
      ctx.fillStyle = TIRE;
      for (let k = 0; k < 18; k++) {
        const a = spin + (k / 18) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(hub[0] + Math.cos(a) * R, hub[1] + Math.sin(a) * R, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#d9d2e6';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], R - tireW - 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(217,210,230,0.8)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = spin + (k / 12) * Math.PI * 2;
      ctx.moveTo(hub[0], hub[1]);
      ctx.lineTo(hub[0] + Math.cos(a) * (R - tireW - 0.6), hub[1] + Math.sin(a) * (R - tireW - 0.6));
    }
    ctx.stroke();
    ctx.fillStyle = '#b9b0c6';
    ctx.beginPath();
    ctx.arc(hub[0], hub[1], up.motor > 0 && hub === rearHub ? 4.2 : 1.8, 0, Math.PI * 2);
    ctx.fill();
    // disc rotors
    if (up.brakes >= 2) {
      ctx.strokeStyle = '#8e98a3';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(hub[0], hub[1], 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---- frame
  limb(ctx, [rearHub, bb, headBot], 3.2, frame as string);
  limb(ctx, [rearHub, seatTop, headTop], 3.2, frame as string);
  limb(ctx, [seatTop, bb], 3.2, frame as string);
  limb(ctx, [headTop, headBot], 3.8, frame as string);
  // fork (suspension fork is chunky with stanchions)
  if (up.suspension >= 2) {
    limb(ctx, [headBot, [27, -8]], 4.6, '#3a3045');
    limb(ctx, [[27, -8], frontHub], 3, '#c9cfd6');
  } else limb(ctx, [headBot, frontHub], 2.6, frame as string);
  if (up.suspension >= 3) {
    // rear shock
    ctx.fillStyle = '#e4677b';
    ctx.save();
    ctx.translate(-8, -14);
    ctx.rotate(-0.9);
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();
  }
  // e-bike battery on the down tube
  if (up.motor > 0) {
    ctx.save();
    ctx.translate(11, -7);
    ctx.rotate(Math.atan2(headBot[1] - bb[1], headBot[0] - bb[0]));
    ctx.fillStyle = '#2f3540';
    ctx.beginPath();
    ctx.roundRect(-8, -3.4, 16, 6.8, 2.5);
    ctx.fill();
    ctx.fillStyle = up.motor >= 3 ? '#ffd23f' : '#7cdf9a';
    for (let k = 0; k < up.motor + 1; k++) ctx.fillRect(-6 + k * 3.2, -1, 2.2, 2);
    ctx.restore();
  }
  // chainring, chain and gears
  ctx.strokeStyle = '#8a8296';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bb[0], bb[1] - 5);
  ctx.lineTo(rearHub[0], rearHub[1] - 3);
  ctx.moveTo(bb[0], bb[1] + 5);
  ctx.lineTo(rearHub[0], rearHub[1] + 3);
  ctx.stroke();
  ctx.fillStyle = '#b9b0c6';
  ctx.beginPath();
  ctx.arc(bb[0], bb[1], 5.2, 0, Math.PI * 2);
  ctx.fill();
  if (up.gears >= 2) {
    // cassette and derailleur
    for (let k = 0; k < Math.min(5, up.gears); k++) {
      ctx.strokeStyle = 'rgba(80,70,90,0.6)';
      ctx.beginPath();
      ctx.arc(rearHub[0], rearHub[1], 3 + k * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    limb(ctx, [[-30, 2], [-27, 8]], 1.6, '#4b4a5a');
  }
  // saddle, seat post, handlebar
  limb(ctx, [seatTop, [-12, -31]], 2.4, '#4b4a5a');
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(-19, -34, 14, 4, 2);
  ctx.fill();
  limb(ctx, [headTop, [20, -33], [25, -34]], 2.4, '#4b4a5a');
  // headlight
  ctx.fillStyle = '#f6f1e4';
  ctx.beginPath();
  ctx.roundRect(26, -27 - up.light * 0.4, 4 + up.light, 3.2 + up.light * 0.7, 1.4);
  ctx.fill();
  if (up.light > 0) {
    const beam = ctx.createLinearGradient(30, -26, 64, -20);
    beam.addColorStop(0, `rgba(255,246,200,${0.25 + up.light * 0.12})`);
    beam.addColorStop(1, 'rgba(255,246,200,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(30, -27);
    ctx.lineTo(70, -36 - up.light * 3);
    ctx.lineTo(70, -10 + up.light * 3);
    ctx.lineTo(30, -24);
    ctx.fill();
  }
  // bell
  ctx.fillStyle = up.bell >= 2 ? '#f2c14e' : up.bell === 1 ? '#d9a441' : '#c9cfd6';
  ctx.beginPath();
  ctx.arc(18, -34.5, 1.8 + up.bell * 0.3, Math.PI, 0);
  ctx.fill();

  // ---- cargo: basket, rear rack, cargo box
  const parcel = sc.parcel ?? '#d6a870';
  const box = (x: number, y: number, bw: number, bh: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,40,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + bw / 2, y);
    ctx.lineTo(x + bw / 2, y + bh);
    ctx.stroke();
  };
  const holding = pose === 'handoff';
  if (up.rack >= 3) {
    // cargo-bike box over the front wheel
    ctx.fillStyle = '#c8935d';
    ctx.beginPath();
    ctx.roundRect(24, -30, 20, 14, 2);
    ctx.fill();
    ctx.strokeStyle = '#8a5f3a';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(24, -30 + k * 3.5);
      ctx.lineTo(44, -30 + k * 3.5);
      ctx.stroke();
    }
    if (!holding) box(28, -38, 10, 8, parcel);
  } else {
    // a front basket
    ctx.fillStyle = '#c8935d';
    ctx.beginPath();
    ctx.moveTo(25, -36);
    ctx.lineTo(38, -36);
    ctx.lineTo(36, -26);
    ctx.lineTo(27, -26);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a5f3a';
    ctx.lineWidth = 0.7;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(25 + k * 0.6, -36 + k * 2.5);
      ctx.lineTo(38 - k * 0.6, -36 + k * 2.5);
      ctx.stroke();
    }
    if (!holding) box(28, -42, 7, 6, parcel);
  }
  if (up.rack >= 1) {
    // rear rack with a crate
    limb(ctx, [[-14, -26], [-36, -26], [-30, 0]], 1.4, '#4b4a5a');
    box(-37, -35, 15, 9, up.rack >= 2 ? '#e8b85a' : '#d6a870');
  }

  // ---- rider
  const crank = t * Math.PI * 2 * (pose === 'sprint' ? 3 : pose === 'tired' ? 1 : 2);
  const pedal = (a: number): V => [bb[0] + Math.cos(a) * 8, bb[1] + Math.sin(a) * 8];
  const standing = pose === 'sprint' || pose === 'jump';
  const hip: V = standing ? [-6, -40] : pose === 'tired' ? [-13, -33] : [-12, -35];
  const lean = pose === 'tired' ? 0.95 : pose === 'sprint' ? 0.55 : pose === 'nohands' ? -0.05 : pose === 'wheelie' ? 0.1 : 0.35;
  const torsoL = 24;
  const shoulder: V = [hip[0] + Math.sin(lean) * torsoL, hip[1] - Math.cos(lean) * torsoL];
  const headC: V = [shoulder[0] + 4 + (pose === 'tired' ? 3 : 0), shoulder[1] - 9 + (pose === 'tired' ? 3 : 0)];
  const grip: V = [23, -34];

  // far leg (darker), then the body, then the near leg
  const pFar = pedal(crank + Math.PI);
  const pNear = pedal(crank);
  const legFar = ik(hip, pFar, 19, 19, -1);
  limb(ctx, [hip, legFar, pFar], 5.2, '#47578f');
  limb(ctx, [pFar, [pFar[0] + 4, pFar[1]]], 3.4, INK);

  // far arm (to the bars unless the pose frees it)
  const wavePhase = Math.sin(t * Math.PI * 6);
  let farHand: V = grip;
  if (pose === 'nohands') farHand = [shoulder[0] - 6, shoulder[1] - 20];
  const farElbow = ik(shoulder, farHand, 12, 12, pose === 'nohands' ? -1 : 1);
  limb(ctx, [shoulder, farElbow, farHand], 4, '#d79c43');

  // thermal bag on the back
  if (up.thermo > 0) {
    ctx.save();
    ctx.translate(hip[0] + Math.sin(lean) * 14 - 6, hip[1] - Math.cos(lean) * 14);
    ctx.rotate(lean);
    ctx.fillStyle = up.thermo >= 3 ? '#e4677b' : up.thermo === 2 ? '#7fc4e6' : '#9fd3c7';
    ctx.beginPath();
    ctx.roundRect(-7, -9, 9, 18, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(-6, -2, 7, 2);
    ctx.restore();
  }
  // torso
  limb(ctx, [hip, shoulder], 9, SHIRT);
  // scarf trailing in the wind
  const scarf = style.scarf === 'rainbow' ? rainbow(ctx, shoulder[0] - 20, 0, 20) : style.scarf;
  ctx.strokeStyle = scarf as string;
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(shoulder[0] + 2, shoulder[1] - 1);
  const flap = Math.sin(t * Math.PI * 10) * 2.5;
  ctx.quadraticCurveTo(shoulder[0] - 8, shoulder[1] - 3 + flap, shoulder[0] - 17, shoulder[1] + 1 - flap);
  ctx.stroke();

  // near leg
  const legNear = ik(hip, pNear, 19, 19, -1);
  limb(ctx, [hip, legNear, pNear], 5.6, PANTS);
  limb(ctx, [pNear, [pNear[0] + 4.5, pNear[1]]], 3.6, INK);
  // crank arm
  limb(ctx, [bb, pNear], 1.6, '#8a8296');

  // head
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(headC[0], headC[1], 7, 0, Math.PI * 2);
  ctx.fill();
  // face: eye + mouth by mood
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(headC[0] + 3.4, headC[1] - 0.5, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  if (pose === 'tired') {
    ctx.moveTo(headC[0] + 2.5, headC[1] + 3.6);
    ctx.lineTo(headC[0] + 5, headC[1] + 3.3);
  } else ctx.arc(headC[0] + 3.4, headC[1] + 2.2, 2, 0.1, Math.PI * 0.8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,150,0.45)';
  ctx.beginPath();
  ctx.arc(headC[0] + 1.2, headC[1] + 1.8, 1.4, 0, Math.PI * 2);
  ctx.fill();
  if (pose === 'tired') {
    // a drop of sweat
    ctx.fillStyle = '#8fc8ff';
    ctx.beginPath();
    ctx.ellipse(headC[0] - 6, headC[1] - 2 + (t * 6) % 4, 1, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // helmet or beanie
  if (up.helmet > 0) {
    ctx.fillStyle = up.helmet >= 3 ? '#2f3540' : style.beanie;
    ctx.beginPath();
    ctx.ellipse(headC[0] - 0.5, headC[1] - 2.5, 8.6, 6.4, -0.15, Math.PI, Math.PI * 2.05);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let k = 0; k < 3; k++) ctx.fillRect(headC[0] - 5 + k * 3.4, headC[1] - 7.6, 1.8, 2.4);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(headC[0] - 2, headC[1] - 2);
    ctx.lineTo(headC[0] + 1, headC[1] + 6);
    ctx.stroke();
  } else {
    ctx.fillStyle = style.beanie;
    ctx.beginPath();
    ctx.arc(headC[0], headC[1] - 1.5, 7.4, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headC[0] - 2, headC[1] - 9, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // headphones
  ctx.fillStyle = '#3a3045';
  ctx.beginPath();
  ctx.arc(headC[0] - 1.5, headC[1] + 0.5, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // near arm: on the bars, waving, raised, or handing over the parcel
  let hand: V = grip;
  let elbowSide = 1;
  if (pose === 'wave') {
    hand = [shoulder[0] + 6 + wavePhase * 4, shoulder[1] - 17];
    elbowSide = -1;
  } else if (pose === 'nohands') {
    hand = [shoulder[0] + 4, shoulder[1] - 21];
    elbowSide = -1;
  } else if (pose === 'handoff') {
    hand = [shoulder[0] + 21, shoulder[1] - 4 + Math.sin(t * Math.PI * 2) * 1.5];
    elbowSide = 1;
  }
  const elbow = ik(shoulder, hand, 12, 12, elbowSide);
  limb(ctx, [shoulder, elbow, hand], 4.4, SHIRT);
  ctx.fillStyle = up.helmet >= 2 ? '#3a3045' : SKIN;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 2.4, 0, Math.PI * 2);
  ctx.fill();
  if (pose === 'handoff') {
    box(hand[0] - 2, hand[1] - 9, 11, 9, parcel);
    // a little heart from the customer
    ctx.fillStyle = '#ff8fab';
    ctx.font = '9px sans-serif';
    ctx.fillText('♥', hand[0] + 12, hand[1] - 12 - Math.sin(t * Math.PI * 2) * 2);
  }
  if (pose === 'wave') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 5, -2.4, -1.2);
    ctx.stroke();
  }
  ctx.restore();

  // ---- confetti for the happy poses
  if (sc.fx !== false && (pose === 'nohands' || pose === 'wheelie' || pose === 'jump')) {
    const cols = ['#ff8fab', '#ffd166', '#9fe3a8', '#8fc8ff', '#c9a3ff'];
    for (let k = 0; k < 18; k++) {
      const x = ((k * 0.173 + t * 0.15) % 1) * w;
      const y = ((k * 0.311 + t * 0.9) % 1) * groundY;
      ctx.fillStyle = cols[k % cols.length];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k + t * 8);
      ctx.fillRect(-2, -1, 4, 2);
      ctx.restore();
    }
  }
}
