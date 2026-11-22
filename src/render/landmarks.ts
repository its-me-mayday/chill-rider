import type { Bridge, Landmark } from '../game/map';
import type { Painter } from './shops';

/**
 * Top-down drawings of the famous sights, in the same flat pastel style as
 * the houses. Coordinates are world meters; everything goes through the
 * painter's sx/sy so it follows the camera.
 */

const STONE = '#e9d6ad';
const STONE_D = '#cdb487';
const STONE_L = '#f6e8c6';
const LEAD = '#8e9aa6';
const LEAD_D = '#6f7b88';
const GOLD = '#f2c14e';
const GLASS = '#9cc7e0';
const GLASS_D = '#6b98b8';
const BRICK = '#b0674e';

export function drawLandmark(p: Painter, l: Landmark, time: number, night: number, hour: number) {
  const { ctx } = p;
  ctx.save();
  switch (l.def.kind) {
    case 'bigben': bigBen(p, l, night, hour); break;
    case 'parliament': parliament(p, l, night); break;
    case 'abbey': abbey(p, l, night); break;
    case 'trafalgar': trafalgar(p, l, time); break;
    case 'eye': eyeBase(p, l); break;
    case 'stpauls': stPauls(p, l, night); break;
    case 'tate': tate(p, l, night); break;
    case 'globe': globe(p, l); break;
    case 'shard': shard(p, l, night, time); break;
    case 'tower': tower(p, l, time); break;
    case 'gherkin': gherkin(p, l, night); break;
    case 'belfast': belfast(p, l, time); break;
  }
  ctx.restore();
}

/** Tall things drawn above riders and trees (the wheel of the Eye). */
export function drawLandmarkTop(p: Painter, l: Landmark, time: number, night: number) {
  if (l.def.kind === 'eye') eyeWheel(p, l, time, night);
}

/** Long shadows: tall buildings throw them across the streets. */
export function landmarkHeight(l: Landmark) {
  switch (l.def.kind) {
    case 'bigben': return 9;
    case 'shard': return 16;
    case 'gherkin': return 10;
    case 'stpauls': return 5;
    case 'tate': return 4;
    case 'parliament': case 'abbey': return 3;
    case 'tower': return 1.5;
    case 'trafalgar': return 0.6;
    default: return 0;
  }
}

// ------------------------------------------------------------------ helpers
function rect(p: Painter, x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  const { ctx, ppm } = p;
  ctx.fillStyle = fill;
  ctx.fillRect(p.sx(x), p.sy(y), w * ppm, h * ppm);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, ppm * 0.08);
    ctx.strokeRect(p.sx(x), p.sy(y), w * ppm, h * ppm);
  }
}

function circle(p: Painter, x: number, y: number, r: number, fill: string, stroke?: string) {
  const { ctx, ppm } = p;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(p.sx(x), p.sy(y), r * ppm, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, ppm * 0.08);
    ctx.stroke();
  }
}

/** a little gothic pinnacle seen from above */
function pinnacle(p: Painter, x: number, y: number, s: number) {
  const { ctx, ppm } = p;
  const px = p.sx(x);
  const py = p.sy(y);
  const r = s * ppm;
  ctx.fillStyle = STONE_D;
  ctx.fillRect(px - r, py - r, r * 2, r * 2);
  ctx.fillStyle = STONE_L;
  ctx.beginPath();
  ctx.moveTo(px - r, py - r);
  ctx.lineTo(px, py);
  ctx.lineTo(px + r, py - r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = GOLD;
  ctx.fillRect(px - r * 0.25, py - r * 0.25, r * 0.5, r * 0.5);
}

/** a pyramid roof: four shaded triangles */
function pyramid(p: Painter, x: number, y: number, w: number, h: number, base: string, light: string, dark: string) {
  const { ctx } = p;
  const x0 = p.sx(x);
  const y0 = p.sy(y);
  const x1 = p.sx(x + w);
  const y1 = p.sy(y + h);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const tri = (ax: number, ay: number, bx: number, by: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  };
  tri(x0, y0, x1, y0, light);
  tri(x1, y0, x1, y1, base);
  tri(x1, y1, x0, y1, dark);
  tri(x0, y1, x0, y0, base);
}

function windows(p: Painter, x: number, y: number, w: number, h: number, night: number, seed = 0) {
  if (night < 0.25) return;
  const { ctx, ppm } = p;
  ctx.fillStyle = `rgba(255,214,140,${0.35 + night * 0.5})`;
  for (let k = 0; k < Math.floor(w / 2.4); k++) {
    if ((k * 7 + seed) % 3 === 0) continue;
    ctx.fillRect(p.sx(x + 1 + k * 2.4), p.sy(y), ppm * 0.9, Math.max(1.5, h * ppm));
  }
}

// ------------------------------------------------------------------ London
function bigBen(p: Painter, l: Landmark, night: number, hour: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  // the tower body peeks out around the spire
  rect(p, x, y, w, h, STONE_D, 'rgba(60,40,30,0.4)');
  rect(p, x + 0.6, y + 0.6, w - 1.2, h - 1.2, STONE);
  // the belfry and the spire
  const m = w * 0.16;
  pyramid(p, x + m, y + m, w - m * 2, h - m * 2, '#59606d', '#7c8592', '#454b57');
  // corner pinnacles
  for (const [cx, cy] of [[x + 0.9, y + 0.9], [x + w - 0.9, y + 0.9], [x + 0.9, y + h - 0.9], [x + w - 0.9, y + h - 0.9]]) pinnacle(p, cx, cy, 0.7);
  circle(p, x + w / 2, y + h / 2, 0.6, GOLD);
  // four clock faces showing the game time
  const faces: [number, number][] = [[x + w / 2, y - 0.2], [x + w / 2, y + h + 0.2], [x - 0.2, y + h / 2], [x + w + 0.2, y + h / 2]];
  const lit = night > 0.25;
  for (const [fx, fy] of faces) {
    const r = Math.min(w, h) * 0.2;
    circle(p, fx, fy, r + 0.25, GOLD);
    circle(p, fx, fy, r, lit ? '#fff2c0' : '#fbf6ea');
    const px = p.sx(fx);
    const py = p.sy(fy);
    ctx.strokeStyle = '#2a2430';
    ctx.lineCap = 'round';
    const hh = ((hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    const mm = ((hour % 1) * Math.PI * 2) - Math.PI / 2;
    ctx.lineWidth = Math.max(1.4, ppm * 0.16);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(hh) * r * ppm * 0.55, py + Math.sin(hh) * r * ppm * 0.55);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, ppm * 0.1);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(mm) * r * ppm * 0.82, py + Math.sin(mm) * r * ppm * 0.82);
    ctx.stroke();
  }
}

function parliament(p: Painter, l: Landmark, night: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  rect(p, x, y, w, h, STONE_D, 'rgba(60,40,30,0.4)');
  // lead roofs with courtyards
  rect(p, x + 0.8, y + 0.8, w - 1.6, h - 1.6, LEAD);
  const courts = Math.max(2, Math.floor(w / 10));
  for (let k = 0; k < courts; k++) {
    const cw = (w - 4) / courts;
    rect(p, x + 2 + k * cw + cw * 0.2, y + h * 0.3, cw * 0.6, h * 0.4, STONE_L);
  }
  // a ridge line and lots of pinnacles along the river front
  ctx.strokeStyle = LEAD_D;
  ctx.lineWidth = Math.max(1, ppm * 0.15);
  ctx.beginPath();
  ctx.moveTo(p.sx(x + 1), p.sy(y + h * 0.18));
  ctx.lineTo(p.sx(x + w - 1), p.sy(y + h * 0.18));
  ctx.moveTo(p.sx(x + 1), p.sy(y + h * 0.82));
  ctx.lineTo(p.sx(x + w - 1), p.sy(y + h * 0.82));
  ctx.stroke();
  for (let k = 0; k <= Math.floor(w / 3); k++) {
    pinnacle(p, x + 0.7 + k * ((w - 1.4) / Math.floor(w / 3)), y + 0.7, 0.45);
    pinnacle(p, x + 0.7 + k * ((w - 1.4) / Math.floor(w / 3)), y + h - 0.7, 0.45);
  }
  // Victoria Tower at the far end, with its flag
  const t = Math.min(h, 9);
  rect(p, x - 0.5, y + h / 2 - t / 2, t, t, STONE_D);
  pyramid(p, x, y + h / 2 - t / 2 + 0.5, t - 1, t - 1, LEAD, '#a9b4bf', LEAD_D);
  for (const [cx, cy] of [[x, y + h / 2 - t / 2 + 0.5], [x + t - 1, y + h / 2 - t / 2 + 0.5], [x, y + h / 2 + t / 2 - 0.5], [x + t - 1, y + h / 2 + t / 2 - 0.5]]) pinnacle(p, cx, cy, 0.55);
  const fx = p.sx(x + t / 2 - 0.5);
  const fy = p.sy(y + h / 2);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(fx, fy - ppm * 0.6, ppm * 2.2, ppm * 1.2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(fx, fy - ppm * 0.12, ppm * 2.2, ppm * 0.24);
  ctx.fillRect(fx + ppm * 0.95, fy - ppm * 0.6, ppm * 0.3, ppm * 1.2);
  windows(p, x + 2, y + h - 1.4, w - 4, 0.5, night, 3);
}

function abbey(p: Painter, l: Landmark, night: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  // cloister garth beside the church
  rect(p, x + w * 0.1, y + h * 0.72, w * 0.36, h * 0.28, STONE_D);
  rect(p, x + w * 0.13, y + h * 0.76, w * 0.3, h * 0.2, '#9cc07f');
  // nave and transept roofs
  const nave = { x, y: y + h * 0.3, w, h: h * 0.4 };
  const tr = { x: x + w * 0.56, y, w: w * 0.2, h };
  for (const r of [nave, tr]) rect(p, r.x, r.y, r.w, r.h, STONE_D, 'rgba(60,40,30,0.35)');
  rect(p, nave.x + 0.6, nave.y + 0.6, nave.w - 1.2, nave.h / 2 - 0.6, '#9aa3ad');
  rect(p, nave.x + 0.6, nave.y + nave.h / 2, nave.w - 1.2, nave.h / 2 - 0.6, LEAD_D);
  rect(p, tr.x + 0.6, tr.y + 0.6, tr.w / 2 - 0.6, tr.h - 1.2, '#9aa3ad');
  rect(p, tr.x + tr.w / 2, tr.y + 0.6, tr.w / 2 - 0.6, tr.h - 1.2, LEAD_D);
  // the two west towers
  const s = nave.h * 0.42;
  for (const ty of [nave.y - s * 0.15, nave.y + nave.h - s * 0.85]) {
    rect(p, x - 0.6, ty, s, s, STONE);
    for (const [cx, cy] of [[x - 0.2, ty + 0.4], [x + s - 1, ty + 0.4], [x - 0.2, ty + s - 0.4], [x + s - 1, ty + s - 0.4]]) pinnacle(p, cx, cy, 0.5);
  }
  // rose windows at the ends of the transept
  for (const ry of [tr.y + 1.4, tr.y + tr.h - 1.4]) {
    circle(p, tr.x + tr.w / 2, ry, tr.w * 0.3, night > 0.3 ? '#ffd88a' : '#c86a8a');
    ctx.strokeStyle = STONE_L;
    ctx.lineWidth = Math.max(1, ppm * 0.08);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(p.sx(tr.x + tr.w / 2), p.sy(ry));
      ctx.lineTo(p.sx(tr.x + tr.w / 2 + Math.cos(a) * tr.w * 0.3), p.sy(ry + Math.sin(a) * tr.w * 0.3));
      ctx.stroke();
    }
  }
  // lantern over the crossing
  rect(p, tr.x + tr.w * 0.15, nave.y + nave.h * 0.2, tr.w * 0.7, nave.h * 0.6, STONE);
}

function trafalgar(p: Painter, l: Landmark, time: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  // the National Gallery with its little dome and portico
  const gy = y;
  const gh = h * 0.22;
  rect(p, x + w * 0.1, gy, w * 0.8, gh, STONE_D, 'rgba(60,40,30,0.35)');
  rect(p, x + w * 0.1 + 0.6, gy + 0.6, w * 0.8 - 1.2, gh - 1.2, '#a7b0ba');
  rect(p, x + w * 0.42, gy + gh - 1.6, w * 0.16, 2.4, STONE_L);
  for (let k = 0; k < 6; k++) circle(p, x + w * 0.43 + k * (w * 0.14) / 5, gy + gh + 0.4, 0.3, STONE);
  circle(p, x + w * 0.5, gy + gh * 0.45, gh * 0.3, '#7f8c99');
  circle(p, x + w * 0.5, gy + gh * 0.45, gh * 0.12, GOLD);
  // terrace steps
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(p.sx(x + w * 0.1), p.sy(gy + gh + 1), w * 0.8 * ppm, ppm * 0.4);
  // Nelson's Column: a column, a long shadow, Nelson on top
  const cx = x + w / 2;
  const cy = y + h * 0.58;
  ctx.fillStyle = 'rgba(40,30,50,0.22)';
  ctx.save();
  ctx.translate(p.sx(cx), p.sy(cy));
  ctx.rotate(0.6);
  ctx.fillRect(0, -ppm * 0.6, ppm * 14, ppm * 1.2);
  ctx.restore();
  rect(p, cx - 2.2, cy - 2.2, 4.4, 4.4, STONE_D);
  circle(p, cx, cy, 1.3, STONE_L);
  circle(p, cx, cy, 0.6, '#5b5560');
  // four lions
  for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const lx = p.sx(cx + dx);
    const ly = p.sy(cy + dy);
    ctx.fillStyle = '#4a4550';
    ctx.beginPath();
    ctx.ellipse(lx, ly, ppm * 1.0, ppm * 0.45, dx * dy > 0 ? 0.8 : -0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lx + Math.sign(dx) * ppm * 0.6, ly + Math.sign(dy) * ppm * 0.4, ppm * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  // pigeons
  for (let k = 0; k < 9; k++) {
    const a = k * 2.3 + Math.sin(time * 0.7 + k) * 0.3;
    const d = 5 + (k % 3) * 1.6;
    circle(p, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 + 2, 0.18, '#8a8794');
  }
}

function eyeBase(p: Painter, l: Landmark) {
  const { x, y, w, h } = l;
  // Jubilee Gardens style pier and the queue zig-zag
  rect(p, x + w * 0.2, y + h - 3.2, w * 0.6, 2.6, '#d7dde3', 'rgba(50,60,70,0.35)');
  const { ctx, ppm } = p;
  ctx.strokeStyle = 'rgba(80,90,110,0.5)';
  ctx.lineWidth = Math.max(1, ppm * 0.08);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    ctx.moveTo(p.sx(x + w * 0.22), p.sy(y + h - 5 - k * 0.9));
    ctx.lineTo(p.sx(x + w * 0.78), p.sy(y + h - 5 - k * 0.9));
  }
  ctx.stroke();
}

function eyeWheel(p: Painter, l: Landmark, time: number, night: number) {
  const { ctx, ppm } = p;
  const cx = p.sx(l.x + l.w / 2);
  const baseY = p.sy(l.y + l.h - 2);
  const R = Math.min(l.w, l.h * 1.6) * 0.48 * ppm;
  const cy = baseY - R * 0.95;
  ctx.save();
  // A-frame legs
  ctx.strokeStyle = '#e8eef3';
  ctx.lineWidth = Math.max(2, ppm * 0.45);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - R * 0.45, baseY);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + R * 0.45, baseY);
  ctx.stroke();
  // rim and spokes, slowly turning
  const rot = time * 0.05;
  ctx.strokeStyle = night > 0.3 ? 'rgba(140,200,255,0.95)' : 'rgba(235,242,248,0.95)';
  ctx.lineWidth = Math.max(1.5, ppm * 0.28);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, ppm * 0.08);
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = rot + (k / 16) * Math.PI * 2;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  ctx.stroke();
  ctx.fillStyle = '#dfe6ec';
  ctx.beginPath();
  ctx.arc(cx, cy, ppm * 0.8, 0, Math.PI * 2);
  ctx.fill();
  // 32 capsules
  for (let k = 0; k < 32; k++) {
    const a = rot + (k / 32) * Math.PI * 2;
    const px = cx + Math.cos(a) * R * 1.04;
    const py = cy + Math.sin(a) * R * 1.04;
    ctx.fillStyle = night > 0.3 ? '#ffe2a0' : '#bfe0f2';
    ctx.strokeStyle = 'rgba(60,80,100,0.6)';
    ctx.beginPath();
    ctx.ellipse(px, py, ppm * 0.55, ppm * 0.32, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function stPauls(p: Painter, l: Landmark, night: number) {
  const { ctx } = p;
  const { x, y, w, h } = l;
  const nave = { x, y: y + h * 0.3, w, h: h * 0.4 };
  const tr = { x: x + w * 0.56, y, w: w * 0.2, h };
  for (const r of [nave, tr]) {
    rect(p, r.x, r.y, r.w, r.h, STONE_D, 'rgba(60,40,30,0.35)');
    rect(p, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, '#ddd2bb');
  }
  ctx.fillStyle = '#c9bea6';
  ctx.fillRect(p.sx(nave.x + 0.5), p.sy(nave.y + nave.h / 2), (nave.w - 1) * p.ppm, (nave.h / 2 - 0.5) * p.ppm);
  // apse
  circle(p, x + w, y + h / 2, nave.h * 0.45, '#ddd2bb', 'rgba(60,40,30,0.35)');
  // west towers and the portico
  const s = nave.h * 0.4;
  for (const ty of [nave.y - s * 0.3, nave.y + nave.h - s * 0.7]) {
    rect(p, x - 0.4, ty, s, s, STONE);
    circle(p, x - 0.4 + s / 2, ty + s / 2, s * 0.32, '#8fa59a');
    circle(p, x - 0.4 + s / 2, ty + s / 2, s * 0.1, GOLD);
  }
  for (let k = 0; k < 6; k++) circle(p, x - 1, nave.y + 1.4 + k * ((nave.h - 2.8) / 5), 0.35, STONE_L);
  // the great dome: lead green-grey rings, ribs and a golden lantern
  const dcx = x + w * 0.66;
  const dcy = y + h / 2;
  const R = h * 0.34;
  circle(p, dcx, dcy, R + 0.6, STONE_D);
  circle(p, dcx, dcy, R, '#8fa59a');
  circle(p, dcx - R * 0.15, dcy - R * 0.15, R * 0.75, '#a5b9ae');
  ctx.strokeStyle = 'rgba(70,90,80,0.55)';
  ctx.lineWidth = Math.max(1, p.ppm * 0.07);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(p.sx(dcx + Math.cos(a) * R * 0.3), p.sy(dcy + Math.sin(a) * R * 0.3));
    ctx.lineTo(p.sx(dcx + Math.cos(a) * R), p.sy(dcy + Math.sin(a) * R));
    ctx.stroke();
  }
  circle(p, dcx, dcy, R * 0.28, STONE_L);
  circle(p, dcx, dcy, R * 0.13, GOLD);
  if (night > 0.3) circle(p, dcx, dcy, R * 0.07, '#fff3c0');
}

function tate(p: Painter, l: Landmark, night: number) {
  const { ctx } = p;
  const { x, y, w, h } = l;
  rect(p, x, y, w, h, BRICK, 'rgba(60,30,20,0.4)');
  rect(p, x + 0.6, y + 0.6, w - 1.2, h - 1.2, '#9e5a45');
  // brick coursing
  ctx.strokeStyle = 'rgba(60,25,20,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let yy = y + 1.2; yy < y + h - 0.6; yy += 0.8) {
    ctx.moveTo(p.sx(x + 0.6), p.sy(yy));
    ctx.lineTo(p.sx(x + w - 0.6), p.sy(yy));
  }
  ctx.stroke();
  // the Turbine Hall's long glass roof
  rect(p, x + 1.5, y + h * 0.15, w - 3, h * 0.18, night > 0.3 ? '#ffe2a0' : GLASS, 'rgba(40,60,80,0.4)');
  // the light beam on top
  rect(p, x + w * 0.1, y + h * 0.55, w * 0.8, h * 0.22, night > 0.3 ? '#fff0c8' : '#d8e6ee');
  // the central chimney
  const s = Math.min(w, h) * 0.22;
  rect(p, x + w / 2 - s / 2, y + h * 0.42, s, s, '#8a4c3a', 'rgba(40,20,10,0.5)');
  rect(p, x + w / 2 - s * 0.3, y + h * 0.42 + s * 0.2, s * 0.6, s * 0.6, night > 0.3 ? '#ffd88a' : '#d2e4ee');
}

function globe(p: Painter, l: Landmark) {
  const { ctx, ppm } = p;
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const R = Math.min(l.w, l.h) / 2;
  const sides = 20;
  const poly = (r: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const px = p.sx(cx + Math.cos(a) * r);
      const py = p.sy(cy + Math.sin(a) * r);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
  };
  poly(R, '#d9c08a'); // thatch
  // straw texture
  ctx.strokeStyle = 'rgba(140,110,60,0.35)';
  ctx.lineWidth = 1;
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(p.sx(cx + Math.cos(a) * R * 0.66), p.sy(cy + Math.sin(a) * R * 0.66));
    ctx.lineTo(p.sx(cx + Math.cos(a) * R * 0.98), p.sy(cy + Math.sin(a) * R * 0.98));
    ctx.stroke();
  }
  poly(R * 0.64, '#f3ece0'); // white galleries
  poly(R * 0.56, '#d8c3a0'); // the yard
  // the stage with its painted roof
  ctx.fillStyle = '#7a3a2a';
  ctx.beginPath();
  ctx.arc(p.sx(cx), p.sy(cy - R * 0.4), R * 0.26 * ppm, 0, Math.PI);
  ctx.fill();
  // groundlings
  const cols = ['#c86a8a', '#6a9ac8', '#e8b85a', '#7cbf86', '#f6f1e4'];
  for (let k = 0; k < 14; k++) circle(p, cx + Math.sin(k * 2.1) * R * 0.32, cy + Math.cos(k * 1.7) * R * 0.25 + R * 0.08, 0.32, cols[k % cols.length]);
}

function shard(p: Painter, l: Landmark, night: number, time: number) {
  const { ctx } = p;
  const { x, y, w, h } = l;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // eight glass shards leaning in to a point
  const pts: [number, number][] = [
    [x + w * 0.05, y + h * 0.3], [x + w * 0.35, y], [x + w * 0.75, y + h * 0.08], [x + w, y + h * 0.45],
    [x + w * 0.88, y + h * 0.9], [x + w * 0.45, y + h], [x + w * 0.1, y + h * 0.82],
  ];
  const tip: [number, number] = [cx + w * 0.06, cy - h * 0.04];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const shade = 0.55 + 0.45 * Math.sin(i * 1.7 + 0.5);
    ctx.fillStyle = `rgb(${Math.round(120 + shade * 80)},${Math.round(160 + shade * 60)},${Math.round(190 + shade * 50)})`;
    ctx.beginPath();
    ctx.moveTo(p.sx(a[0]), p.sy(a[1]));
    ctx.lineTo(p.sx(b[0]), p.sy(b[1]));
    ctx.lineTo(p.sx(tip[0]), p.sy(tip[1]));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  // floor lines on the glass
  ctx.strokeStyle = 'rgba(40,70,100,0.18)';
  for (let k = 1; k < 7; k++) {
    const f = k / 7;
    ctx.beginPath();
    pts.forEach((a, i) => {
      const px = p.sx(a[0] + (tip[0] - a[0]) * f);
      const py = p.sy(a[1] + (tip[1] - a[1]) * f);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();
  }
  circle(p, tip[0], tip[1], 0.5, night > 0.3 ? `rgba(255,240,200,${0.7 + 0.3 * Math.sin(time * 2)})` : '#ffffff');
  void GLASS_D;
}

function tower(p: Painter, l: Landmark, time: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  // the dry moat is a lawn; the inner ward is gravel
  rect(p, x + 1.6, y + 1.6, w - 3.2, h - 3.2, '#d9ccb0');
  // curtain walls (the solids) with towers along them
  for (const s of l.solids.slice(0, 6)) rect(p, s.x, s.y, s.w, s.h, '#cdbd98', 'rgba(70,55,40,0.5)');
  const turret = (tx: number, ty: number, r: number) => {
    circle(p, tx, ty, r, '#d8c8a2', 'rgba(70,55,40,0.5)');
    circle(p, tx, ty, r * 0.55, '#bfae88');
  };
  for (const [tx, ty] of [[x + 0.8, y + 0.8], [x + w - 0.8, y + 0.8], [x + 0.8, y + h - 0.8], [x + w - 0.8, y + h - 0.8], [x + w / 2, y + 0.8], [x + w - 0.8, y + h / 2]]) turret(tx, ty, 1.5);
  // the White Tower: a square keep with four turrets, one of them round
  const ws = l.solids[6];
  if (ws) {
    rect(p, ws.x, ws.y, ws.w, ws.h, '#f2ede2', 'rgba(70,60,50,0.5)');
    rect(p, ws.x + 0.8, ws.y + 0.8, ws.w - 1.6, ws.h - 1.6, '#a9b2bc');
    ctx.strokeStyle = '#8e98a3';
    ctx.lineWidth = Math.max(1, ppm * 0.12);
    ctx.beginPath();
    ctx.moveTo(p.sx(ws.x + ws.w * 0.55), p.sy(ws.y + 0.8));
    ctx.lineTo(p.sx(ws.x + ws.w * 0.55), p.sy(ws.y + ws.h - 0.8));
    ctx.stroke();
    for (const [i, tx, ty] of [[0, ws.x, ws.y], [1, ws.x + ws.w, ws.y], [2, ws.x, ws.y + ws.h], [3, ws.x + ws.w, ws.y + ws.h]] as const) {
      if (i === 1) circle(p, tx, ty, 1.5, '#f2ede2', 'rgba(70,60,50,0.5)');
      else rect(p, tx - 1.3, ty - 1.3, 2.6, 2.6, '#f2ede2', 'rgba(70,60,50,0.5)');
      // little lead cupolas
      circle(p, tx, ty, 0.8, '#8e98a3');
      circle(p, tx, ty, 0.25, GOLD);
    }
  }
  // Beefeater by the gate and the ravens on the lawn
  const gx = x + w / 2;
  const gy = y + h - 3.2;
  p.person(gx - 2, gy, -Math.PI / 2, 0, '#9b1b2a', '#2a1a14');
  for (let k = 0; k < 6; k++) {
    const a = k * 1.9 + Math.sin(time * 0.6 + k) * 0.2;
    const rx = x + w * 0.28 + Math.cos(a) * 3.5;
    const ry = y + h * 0.3 + Math.sin(a) * 2.5;
    ctx.fillStyle = '#1e1b24';
    ctx.beginPath();
    ctx.ellipse(p.sx(rx), p.sy(ry), ppm * 0.35, ppm * 0.18, a, 0, Math.PI * 2);
    ctx.fill();
  }
}

function gherkin(p: Painter, l: Landmark, night: number) {
  const { ctx, ppm } = p;
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const R = Math.min(l.w, l.h) / 2;
  const px = p.sx(cx);
  const py = p.sy(cy);
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, R * ppm, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#7fa8b8';
  ctx.fillRect(px - R * ppm, py - R * ppm, R * 2 * ppm, R * 2 * ppm);
  // the dark spiral bands
  ctx.strokeStyle = '#2f4f5f';
  ctx.lineWidth = R * ppm * 0.16;
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const a = (k / 6) * Math.PI * 2 + t * 2.4;
      const rr = R * ppm * t;
      const x = px + Math.cos(a) * rr;
      const y = py + Math.sin(a) * rr;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // diamond glazing
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 5; k++) {
    ctx.beginPath();
    ctx.arc(px, py, (R * ppm * k) / 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  circle(p, cx, cy, R * 0.18, night > 0.3 ? '#ffe7a8' : '#cfe6ee');
}

function belfast(p: Painter, l: Landmark, time: number) {
  const { ctx, ppm } = p;
  const { x, y, w, h } = l;
  const bob = Math.sin(time * 0.8) * 0.08;
  const px = p.sx(x);
  const py = p.sy(y + bob);
  const W = w * ppm;
  const H = h * ppm;
  // wake ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(px + W / 2, py + H / 2, W * 0.55, H * 0.85, 0, 0, Math.PI * 2);
  ctx.stroke();
  // dazzle-camo hull, pointed bow to the east
  ctx.fillStyle = '#8b95a1';
  ctx.beginPath();
  ctx.moveTo(px, py + H * 0.2);
  ctx.lineTo(px + W * 0.82, py);
  ctx.lineTo(px + W, py + H / 2);
  ctx.lineTo(px + W * 0.82, py + H);
  ctx.lineTo(px, py + H * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#5e6a78';
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(px + W * (k / 6), py);
    ctx.lineTo(px + W * (k / 6 + 0.08), py);
    ctx.lineTo(px + W * (k / 6 + 0.02), py + H);
    ctx.lineTo(px + W * (k / 6 - 0.06), py + H);
    ctx.fill();
  }
  ctx.restore();
  // deck, turrets, bridge and funnels
  ctx.fillStyle = '#c9c3b5';
  ctx.fillRect(px + W * 0.08, py + H * 0.3, W * 0.72, H * 0.4);
  const turret = (u: number) => {
    ctx.fillStyle = '#7a8491';
    ctx.beginPath();
    ctx.arc(px + W * u, py + H / 2, H * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4c5560';
    ctx.lineWidth = Math.max(1, ppm * 0.15);
    ctx.beginPath();
    ctx.moveTo(px + W * u, py + H * 0.42);
    ctx.lineTo(px + W * u + H * 0.9, py + H * 0.42);
    ctx.moveTo(px + W * u, py + H * 0.58);
    ctx.lineTo(px + W * u + H * 0.9, py + H * 0.58);
    ctx.stroke();
  };
  turret(0.66);
  turret(0.76);
  ctx.fillStyle = '#9aa4b0';
  ctx.fillRect(px + W * 0.45, py + H * 0.28, W * 0.12, H * 0.44);
  for (const u of [0.32, 0.4]) {
    ctx.fillStyle = '#5a636e';
    ctx.beginPath();
    ctx.ellipse(px + W * u, py + H / 2, H * 0.18, H * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // ensign at the stern
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(px - ppm * 0.6, py + H / 2 - ppm * 0.4, ppm * 1.2, ppm * 0.8);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(px - ppm * 0.6, py + H / 2 - ppm * 0.08, ppm * 1.2, ppm * 0.16);
}

// ------------------------------------------------------------------ bridges
const BRIDGE_COLOR: Record<string, string> = {
  westminster: '#4f8a5f',
  blackfriars: '#c8402e',
  plain: '#a6a2a8',
  foot: '#c9d2da',
  towerbridge: '#5b8fc9',
};

/** parapets and piers; Tower Bridge gets its two towers and the high walkways */
export function drawBridge(p: Painter, b: Bridge, time: number) {
  const { ctx, ppm } = p;
  const x0 = b.c * 4;
  const x1 = (b.c + 2) * 4;
  const y0 = b.r0 * 4;
  const y1 = (b.r1 + 1) * 4;
  const col = BRIDGE_COLOR[b.kind] ?? '#a6a2a8';
  // piers in the water
  ctx.fillStyle = 'rgba(40,50,60,0.35)';
  for (const f of [0.33, 0.66]) ctx.fillRect(p.sx(x0 - 1.2), p.sy(y0 + (y1 - y0) * f - 0.7), (x1 - x0 + 2.4) * ppm, 1.4 * ppm);
  // parapets
  ctx.fillStyle = col;
  ctx.fillRect(p.sx(x0 - 0.6), p.sy(y0), 0.6 * ppm, (y1 - y0) * ppm);
  ctx.fillRect(p.sx(x1), p.sy(y0), 0.6 * ppm, (y1 - y0) * ppm);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let yy = y0 + 0.6; yy < y1; yy += 1.4) {
    ctx.fillRect(p.sx(x0 - 0.55), p.sy(yy), 0.5 * ppm, 0.3 * ppm);
    ctx.fillRect(p.sx(x1 + 0.05), p.sy(yy), 0.5 * ppm, 0.3 * ppm);
  }
  // lamps on the parapet
  for (let yy = y0 + 2; yy < y1; yy += 6) {
    circle(p, x0 - 0.3, yy, 0.3, '#2f3540');
    circle(p, x1 + 0.3, yy, 0.3, '#2f3540');
  }
  void time;
}

export function drawBridgeTop(p: Painter, b: Bridge) {
  if (b.kind !== 'towerbridge') return;
  const { ctx, ppm } = p;
  const x0 = b.c * 4;
  const x1 = (b.c + 2) * 4;
  const y0 = b.r0 * 4;
  const y1 = (b.r1 + 1) * 4;
  const towers = [y0 + (y1 - y0) * 0.22, y0 + (y1 - y0) * 0.78];
  // high-level walkways between the towers (pale blue, the road passes below)
  ctx.fillStyle = 'rgba(91,143,201,0.85)';
  ctx.fillRect(p.sx(x0 - 1), p.sy(towers[0]), 1.2 * ppm, (towers[1] - towers[0]) * ppm);
  ctx.fillRect(p.sx(x1 - 0.2), p.sy(towers[0]), 1.2 * ppm, (towers[1] - towers[0]) * ppm);
  // suspension chains to the banks
  ctx.strokeStyle = '#5b8fc9';
  ctx.lineWidth = Math.max(1.5, ppm * 0.3);
  ctx.beginPath();
  ctx.moveTo(p.sx(x0 - 0.4), p.sy(towers[0]));
  ctx.lineTo(p.sx(x0 - 0.4), p.sy(y0 - 2));
  ctx.moveTo(p.sx(x1 + 0.4), p.sy(towers[0]));
  ctx.lineTo(p.sx(x1 + 0.4), p.sy(y0 - 2));
  ctx.moveTo(p.sx(x0 - 0.4), p.sy(towers[1]));
  ctx.lineTo(p.sx(x0 - 0.4), p.sy(y1 + 2));
  ctx.moveTo(p.sx(x1 + 0.4), p.sy(towers[1]));
  ctx.lineTo(p.sx(x1 + 0.4), p.sy(y1 + 2));
  ctx.stroke();
  // the two gothic towers straddling the road
  for (const ty of towers) {
    const s = 3.2;
    for (const tx of [x0 - 1.8, x1 + 1.8]) {
      rect(p, tx - s / 2, ty - s / 2, s, s, STONE_L, 'rgba(70,60,50,0.5)');
      pyramid(p, tx - s / 2 + 0.3, ty - s / 2 + 0.3, s - 0.6, s - 0.6, '#5f6c7b', '#7d8a99', '#4b5663');
      for (const [cx, cy] of [[tx - s / 2, ty - s / 2], [tx + s / 2, ty - s / 2], [tx - s / 2, ty + s / 2], [tx + s / 2, ty + s / 2]]) pinnacle(p, cx, cy, 0.35);
    }
    // the arch over the road
    ctx.fillStyle = 'rgba(240,232,214,0.92)';
    ctx.fillRect(p.sx(x0 - 0.3), p.sy(ty - 0.7), (x1 - x0 + 0.6) * ppm, 1.4 * ppm);
  }
}
