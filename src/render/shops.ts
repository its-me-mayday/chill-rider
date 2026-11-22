import type { Building } from '../game/map';
import { css, hash, mix, type RGB } from '../game/math';

/**
 * Detailed top-down storefronts: roof, signage with an icon, awning pattern,
 * street furniture in front, smoke/steam and a night-time glow.
 */

export interface Painter {
  ctx: CanvasRenderingContext2D;
  ppm: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  person: (x: number, y: number, facing: number, phase: number, shirt: string, hair: string, wave?: number) => void;
}

/** world point in front of a building: u along the door wall, v outwards */
function front(b: Building, u: number, v: number): [number, number] {
  const tx = -b.ny;
  const ty = b.nx;
  return [b.doorX + tx * u + b.nx * v, b.doorY + ty * u + b.ny * v];
}

const wallLen = (b: Building) => (b.nx === 0 ? b.w : b.h);

export function drawShop(p: Painter, b: Building, time: number, night: number, waiting: boolean, open = true, opens = '') {
  const st = b.shop!;
  const { ctx, ppm } = p;
  const x = p.sx(b.x);
  const y = p.sy(b.y);
  const w = b.w * ppm;
  const h = b.h * ppm;
  const L = wallLen(b);

  // ---- paved forecourt between the shop and the street
  const reach = Math.hypot(b.stopX - b.doorX, b.stopY - b.doorY) - 1.6;
  ctx.save();
  {
    const [ox, oy] = front(b, 0, 0);
    ctx.translate(p.sx(ox), p.sy(oy));
    ctx.rotate(Math.atan2(b.ny, b.nx) - Math.PI / 2);
    const fw = (L + 1.2) * ppm;
    const fd = reach * ppm;
    ctx.fillStyle = 'rgba(236,222,204,0.95)';
    ctx.fillRect(-fw / 2, 0, fw, fd);
    ctx.strokeStyle = 'rgba(150,120,110,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let u = -fw / 2 + ppm * 0.6; u < fw / 2; u += ppm * 0.6) {
      ctx.moveTo(u, 0);
      ctx.lineTo(u, fd);
    }
    for (let v = ppm * 0.6; v < fd; v += ppm * 0.6) {
      ctx.moveTo(-fw / 2, v);
      ctx.lineTo(fw / 2, v);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- street furniture on the forecourt (stacked away when closed)
  if (open) furniture(p, b, time, reach);

  // ---- door
  const [dx, dy] = front(b, 0, 0.25);
  ctx.save();
  ctx.translate(p.sx(dx), p.sy(dy));
  ctx.rotate(Math.atan2(b.ny, b.nx) + Math.PI / 2);
  ctx.fillStyle = css(mix(st.roof, [40, 20, 30], 0.5));
  ctx.fillRect(-ppm * 0.8, -ppm * 0.25, ppm * 1.6, ppm * 0.5);
  // shop windows either side of the door, lit at night
  const glass = !open ? '#8d8796' : night > 0.2 ? `rgba(255,214,140,${0.55 + night * 0.4})` : 'rgba(190,225,240,0.85)';
  ctx.fillStyle = glass;
  ctx.fillRect(-L * 0.42 * ppm, -ppm * 0.2, (L * 0.42 - 1.1) * ppm, ppm * 0.32);
  ctx.fillRect(ppm * 1.1, -ppm * 0.2, (L * 0.42 - 1.1) * ppm, ppm * 0.32);
  if (!open) {
    // roller shutters down over door and windows
    ctx.fillStyle = '#a7a1ad';
    ctx.fillRect(-L * 0.42 * ppm, -ppm * 0.28, L * 0.84 * ppm, ppm * 0.5);
    ctx.strokeStyle = 'rgba(60,50,70,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let u = -L * 0.42 * ppm; u < L * 0.42 * ppm; u += ppm * 0.22) {
      ctx.moveTo(u, -ppm * 0.28);
      ctx.lineTo(u, ppm * 0.22);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---- roof
  ctx.fillStyle = css(mix(st.roof, [50, 20, 40], 0.15));
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = css(mix(st.roof, [255, 245, 230], 0.1));
  ctx.fillRect(x + ppm * 0.45, y + ppm * 0.45, w - ppm * 0.9, h - ppm * 0.9);
  // roof clutter: AC unit + vent, positioned away from the sign
  const back = front(b, L * 0.3, -(b.nx === 0 ? b.h : b.w) + 1.6);
  ctx.fillStyle = 'rgba(235,235,240,0.9)';
  ctx.fillRect(p.sx(back[0]) - ppm * 0.6, p.sy(back[1]) - ppm * 0.45, ppm * 1.2, ppm * 0.9);
  ctx.strokeStyle = 'rgba(120,120,140,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.sx(back[0]), p.sy(back[1]), ppm * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(p.sx(back[0]), p.sy(back[1]));
  ctx.rotate(time * 6);
  ctx.beginPath();
  ctx.moveTo(-ppm * 0.25, 0);
  ctx.lineTo(ppm * 0.25, 0);
  ctx.moveTo(0, -ppm * 0.25);
  ctx.lineTo(0, ppm * 0.25);
  ctx.stroke();
  ctx.restore();

  // chimney + smoke for ovens
  if (st.id === 'pizza' || st.id === 'bakery' || st.id === 'cafe') {
    const ch = front(b, -L * 0.32, -(b.nx === 0 ? b.h : b.w) + 1.4);
    const cx = p.sx(ch[0]);
    const cy = p.sy(ch[1]);
    ctx.fillStyle = css(mix(st.roof, [70, 30, 30], 0.45));
    ctx.fillRect(cx - ppm * 0.55, cy - ppm * 0.55, ppm * 1.1, ppm * 1.1);
    ctx.fillStyle = 'rgba(40,20,20,0.6)';
    ctx.fillRect(cx - ppm * 0.3, cy - ppm * 0.3, ppm * 0.6, ppm * 0.6);
    smoke(ctx, cx, cy, ppm, time + b.id, st.id === 'pizza' ? 1.2 : 0.8);
  }

  // ---- awning over the front, pattern by shop (rolled up when closed)
  awning(p, b, time, open ? 1 : 0.3);

  // ---- sign plaque with icon
  const fs = Math.max(10, Math.round(ppm * 0.72));
  ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
  const label = st.name;
  const tw = ctx.measureText(label).width;
  const icon = fs * 1.5;
  const pw = tw + icon + fs * 1.2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (night > 0.2 && open) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, pw * 0.8);
    g.addColorStop(0, css(st.awning, 0.45 * night));
    g.addColorStop(1, css(st.awning, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - pw, cy - pw, pw * 2, pw * 2);
  }
  ctx.globalAlpha = open ? 1 : 0.7;
  ctx.fillStyle = 'rgba(255,250,240,0.96)';
  ctx.strokeStyle = css(st.awning);
  ctx.lineWidth = Math.max(1.5, ppm * 0.1);
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, cy - fs * 0.95, pw, fs * 1.9, fs * 0.5);
  ctx.fill();
  ctx.stroke();
  drawIcon(ctx, st.id, cx - pw / 2 + fs * 0.4 + icon / 2, cy, icon, time);
  ctx.fillStyle = css(mix(st.roof, [40, 20, 30], 0.45));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx - pw / 2 + fs * 0.6 + icon, cy + 1);
  ctx.globalAlpha = 1;
  if (!open) {
    // little "closed · opens at" tag hanging under the sign
    const tag = opens ? `CLOSED · opens ${opens}` : 'CLOSED';
    const ts = Math.max(9, Math.round(fs * 0.7));
    ctx.font = `700 ${ts}px Outfit, system-ui, sans-serif`;
    const w2 = ctx.measureText(tag).width + ts;
    ctx.fillStyle = '#d83a46';
    ctx.beginPath();
    ctx.roundRect(cx - w2 / 2, cy + fs * 1.1, w2, ts * 1.6, ts * 0.4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(tag, cx, cy + fs * 1.1 + ts * 0.82);
  }

  // ---- shopkeeper waits at the door with the parcel when an order is ready
  if (waiting && open) {
    const [kx, ky] = front(b, 1.3, 1.5);
    p.person(kx, ky, Math.atan2(b.ny, b.nx), 0, css(st.awning), '#4a3428', Math.sin(time * 0.8) > 0.6 ? time : 0);
    const [px2, py2] = front(b, 1.3, 1.95);
    ctx.fillStyle = '#d6a870';
    ctx.fillRect(p.sx(px2) - ppm * 0.22, p.sy(py2) - ppm * 0.22, ppm * 0.44, ppm * 0.44);
    ctx.fillStyle = 'rgba(110,70,40,0.4)';
    ctx.fillRect(p.sx(px2) - ppm * 0.04, p.sy(py2) - ppm * 0.22, ppm * 0.08, ppm * 0.44);
  }
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, ppm: number, t: number, amount: number) {
  for (let k = 0; k < 5; k++) {
    const life = (t * 0.5 + k / 5) % 1;
    const r = ppm * (0.35 + life * 1.1) * amount;
    ctx.fillStyle = `rgba(245,240,240,${0.45 * (1 - life)})`;
    ctx.beginPath();
    ctx.arc(x + life * ppm * 2.2 + Math.sin(t * 2 + k) * ppm * 0.25, y - life * ppm * 1.4, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function awning(p: Painter, b: Building, time: number, extend: number) {
  const { ctx, ppm } = p;
  const st = b.shop!;
  const L = wallLen(b) * 0.86;
  const depth = 1.0 * extend;
  ctx.save();
  const [ox, oy] = front(b, 0, 0);
  ctx.translate(p.sx(ox), p.sy(oy));
  ctx.rotate(Math.atan2(b.ny, b.nx) - Math.PI / 2); // +y now points away from the wall
  const a1 = css(st.awning);
  const a2 = css(st.awning2);
  const n = st.id === 'pizza' ? 10 : 8;
  const sw = (L / n) * ppm;
  for (let i = 0; i < n; i++) {
    const x0 = -L * ppm / 2 + i * sw;
    if (st.id === 'pizza') {
      // checkered
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? a2 : a1;
        ctx.fillRect(x0, j * depth * ppm / 2, sw + 0.5, (depth * ppm) / 2 + 0.5);
      }
    } else {
      ctx.fillStyle = i % 2 ? a2 : a1;
      ctx.fillRect(x0, 0, sw + 0.5, depth * ppm);
    }
    // scalloped edge, gently flapping
    ctx.fillStyle = i % 2 ? a2 : a1;
    ctx.beginPath();
    ctx.ellipse(x0 + sw / 2, depth * ppm, sw / 2, Math.min(sw / 2, ppm * 0.22), 0, 0, Math.PI);
    ctx.fill();
  }
  // fold shading
  ctx.fillStyle = 'rgba(40,20,40,0.12)';
  ctx.fillRect(-L * ppm / 2, depth * ppm * 0.55, L * ppm, depth * ppm * 0.45);
  ctx.restore();
  void time;
}

function furniture(p: Painter, b: Building, time: number, reach: number) {
  const { ctx, ppm } = p;
  const st = b.shop!;
  const L = wallLen(b);
  const side = L / 2 - 1.3;
  // keep everything outside the awning and clear of the pick-up ring
  const V = Math.max(1.0, Math.min(reach - 0.6, 2.2));
  const table = (u: number, v: number, umbrella: RGB | null) => {
    const [tx, ty] = front(b, u, v);
    const x = p.sx(tx);
    const y = p.sy(ty);
    // chairs
    ctx.fillStyle = 'rgba(120,80,60,0.85)';
    for (const a of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * ppm * 0.55, y + Math.sin(a) * ppm * 0.55, ppm * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff8ec';
    ctx.beginPath();
    ctx.arc(x, y, ppm * 0.32, 0, Math.PI * 2);
    ctx.fill();
    if (umbrella) {
      ctx.fillStyle = css(umbrella, 0.92);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        const r = ppm * 0.9;
        if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + 0.2;
        ctx.moveTo(x + Math.cos(a) * ppm * 0.9, y + Math.sin(a) * ppm * 0.9);
        ctx.lineTo(x - Math.cos(a) * ppm * 0.9, y - Math.sin(a) * ppm * 0.9);
      }
      ctx.stroke();
    } else {
      // coffee cups with steam
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - ppm * 0.12, y, ppm * 0.09, 0, Math.PI * 2);
      ctx.arc(x + ppm * 0.14, y + ppm * 0.05, ppm * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a4a32';
      ctx.beginPath();
      ctx.arc(x - ppm * 0.12, y, ppm * 0.05, 0, Math.PI * 2);
      ctx.arc(x + ppm * 0.14, y + ppm * 0.05, ppm * 0.05, 0, Math.PI * 2);
      ctx.fill();
      const t = (time * 0.7 + u) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - t)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - ppm * 0.12, y - ppm * 0.1);
      ctx.quadraticCurveTo(x - ppm * 0.25, y - ppm * (0.3 + t * 0.3), x - ppm * 0.1, y - ppm * (0.5 + t * 0.4));
      ctx.stroke();
    }
  };
  const plant = (u: number, v: number, col: RGB) => {
    const [tx, ty] = front(b, u, v);
    ctx.fillStyle = '#c98a5a';
    ctx.beginPath();
    ctx.arc(p.sx(tx), p.sy(ty), ppm * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(col);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + time * 0.3;
      ctx.beginPath();
      ctx.arc(p.sx(tx) + Math.cos(a) * ppm * 0.18, p.sy(ty) + Math.sin(a) * ppm * 0.18, ppm * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  const box = (u: number, v: number, s: number, col: string, rot = 0) => {
    const [tx, ty] = front(b, u, v);
    ctx.save();
    ctx.translate(p.sx(tx), p.sy(ty));
    ctx.rotate(rot);
    ctx.fillStyle = col;
    ctx.fillRect(-s * ppm / 2, -s * ppm / 2, s * ppm, s * ppm);
    ctx.restore();
  };

  switch (st.id) {
    case 'pizza': {
      table(-side, V, [217, 74, 61]);
      if (side > 2.5) table(-side + 2.0, V, [255, 246, 230]);
      // delivery scooter parked by the door
      const [sx2, sy2] = front(b, side, V);
      ctx.save();
      ctx.translate(p.sx(sx2), p.sy(sy2));
      ctx.rotate(Math.atan2(b.ny, b.nx));
      ctx.fillStyle = '#d94a3d';
      ctx.beginPath();
      ctx.roundRect(-ppm * 0.25, -ppm * 0.7, ppm * 0.5, ppm * 1.4, ppm * 0.2);
      ctx.fill();
      ctx.fillStyle = '#fff6e6';
      ctx.fillRect(-ppm * 0.3, ppm * 0.15, ppm * 0.6, ppm * 0.55);
      ctx.restore();
      break;
    }
    case 'cafe': {
      table(-side, V, null);
      if (side > 2.5) table(-side + 1.8, V, null);
      // chalkboard A-frame
      const [cx, cy] = front(b, side, V);
      ctx.save();
      ctx.translate(p.sx(cx), p.sy(cy));
      ctx.rotate(Math.atan2(b.ny, b.nx) + Math.PI / 2);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(-ppm * 0.45, -ppm * 0.2, ppm * 0.9, ppm * 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(-ppm * 0.3, -ppm * 0.08, ppm * 0.6, ppm * 0.05);
      ctx.fillRect(-ppm * 0.3, ppm * 0.04, ppm * 0.4, ppm * 0.05);
      ctx.restore();
      plant(side - 1.2, V, [124, 191, 134]);
      break;
    }
    case 'comics': {
      // poster stand + starburst sticker on the pavement
      const [cx, cy] = front(b, -side, V);
      const x = p.sx(cx);
      const y = p.sy(cy);
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + time * 0.4;
        const r = ppm * (k % 2 ? 0.45 : 0.85);
        if (k === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e4344a';
      ctx.font = `800 ${Math.max(8, Math.round(ppm * 0.42))}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POW!', x, y + 1);
      box(side, V, 0.9, '#3d3a8f', 0.1);
      box(side - 0.4, V - 0.2, 0.6, '#ff8fab', -0.2);
      break;
    }
    case 'gelato': {
      table(-side, V, [143, 214, 200]);
      if (side > 2.5) table(-side + 2.0, V, [247, 178, 196]);
      // giant cone sign on a stand
      const [cx, cy] = front(b, side, V);
      const x = p.sx(cx);
      const y = p.sy(cy);
      ctx.fillStyle = '#e8b06a';
      ctx.beginPath();
      ctx.moveTo(x - ppm * 0.3, y);
      ctx.lineTo(x + ppm * 0.3, y);
      ctx.lineTo(x, y + ppm * 0.8);
      ctx.fill();
      ['#f7b2c4', '#a8e68c', '#fff4f7'].forEach((c, k) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + (k - 1) * ppm * 0.18, y - ppm * (0.1 + (k === 1 ? 0.2 : 0)), ppm * 0.26, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case 'bakery': {
      for (let k = 0; k < 3; k++) {
        const [bx, by] = front(b, -side + k * 0.8, V);
        ctx.fillStyle = '#b0804f';
        ctx.beginPath();
        ctx.arc(p.sx(bx), p.sy(by), ppm * 0.38, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8b56b';
        ctx.beginPath();
        ctx.ellipse(p.sx(bx), p.sy(by), ppm * 0.26, ppm * 0.14, k, 0, Math.PI * 2);
        ctx.fill();
      }
      box(side, V, 0.7, '#f3ead8', 0.15);
      box(side - 0.7, V, 0.6, '#efe2c8', -0.1);
      break;
    }
    case 'florist': {
      const cols: RGB[] = [[255, 143, 171], [255, 209, 102], [195, 166, 255], [255, 255, 255], [255, 120, 90], [168, 230, 140]];
      const n = Math.max(4, Math.floor(side * 2));
      for (let k = 0; k < n; k++) {
        const u = -side + (k / (n - 1)) * side * 2;
        if (Math.abs(u) < 1.2) continue;
        const [fx, fy] = front(b, u, V - 0.3 + (k % 2) * 0.4);
        ctx.fillStyle = '#8a9aa8';
        ctx.beginPath();
        ctx.arc(p.sx(fx), p.sy(fy), ppm * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(cols[k % cols.length]);
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(p.sx(fx) + (hash(k * 7 + j) - 0.5) * ppm * 0.4, p.sy(fy) + (hash(k * 3 + j) - 0.5) * ppm * 0.4, ppm * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'records': {
      // crates of vinyl
      for (let k = 0; k < 2; k++) {
        const [cx, cy] = front(b, -side + k * 1.0, V);
        ctx.fillStyle = '#9b6b4f';
        ctx.fillRect(p.sx(cx) - ppm * 0.42, p.sy(cy) - ppm * 0.42, ppm * 0.84, ppm * 0.84);
        ctx.fillStyle = '#1f1d2a';
        ctx.beginPath();
        ctx.arc(p.sx(cx), p.sy(cy), ppm * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = k ? '#f4c063' : '#e4677b';
        ctx.beginPath();
        ctx.arc(p.sx(cx), p.sy(cy), ppm * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      plant(side, V, [124, 191, 134]);
      break;
    }
    case 'books': {
      const [cx, cy] = front(b, -side + 0.3, V);
      ctx.save();
      ctx.translate(p.sx(cx), p.sy(cy));
      ctx.rotate(Math.atan2(b.ny, b.nx) + Math.PI / 2);
      ctx.fillStyle = '#7a5236';
      ctx.fillRect(-ppm * 0.8, -ppm * 0.35, ppm * 1.6, ppm * 0.7);
      const bc = ['#e4677b', '#4f9a8a', '#f4c063', '#6f6ad1', '#f3e0b5', '#7cbf86'];
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = bc[k];
        ctx.fillRect(-ppm * 0.72 + k * ppm * 0.24, -ppm * 0.28, ppm * 0.2, ppm * 0.56);
      }
      ctx.restore();
      plant(side, V, [95, 166, 138]);
      break;
    }
  }
}

/** Small vector icons for the shop signs. */
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, s: number, time: number) {
  ctx.save();
  ctx.translate(x, y);
  const r = s / 2;
  switch (id) {
    case 'pizza': {
      ctx.fillStyle = '#f4c063';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.6);
      ctx.lineTo(r * 0.8, -r * 0.6);
      ctx.lineTo(0, r * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c98a5a';
      ctx.fillRect(-r * 0.85, -r * 0.8, r * 1.7, r * 0.3);
      ctx.fillStyle = '#d94a3d';
      for (const [px, py] of [[-0.3, -0.25], [0.25, -0.2], [0, 0.25]]) {
        ctx.beginPath();
        ctx.arc(px * r, py * r, r * 0.16, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cafe': {
      ctx.fillStyle = '#6b4a3a';
      ctx.beginPath();
      ctx.roundRect(-r * 0.6, -r * 0.2, r * 1.0, r * 0.85, r * 0.2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a3a';
      ctx.lineWidth = r * 0.15;
      ctx.beginPath();
      ctx.arc(r * 0.45, r * 0.2, r * 0.22, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(155,107,79,0.8)';
      ctx.lineWidth = r * 0.1;
      for (let k = 0; k < 2; k++) {
        const t = (time * 0.8 + k * 0.5) % 1;
        ctx.globalAlpha = 1 - t;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3 + k * r * 0.35, -r * 0.3);
        ctx.quadraticCurveTo(-r * 0.5 + k * r * 0.35, -r * (0.55 + t * 0.2), -r * 0.25 + k * r * 0.35, -r * (0.8 + t * 0.2));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'comics': {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#3d3a8f';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.1, r * 0.9, r * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, r * 0.45);
      ctx.lineTo(-r * 0.55, r * 0.95);
      ctx.lineTo(r * 0.05, r * 0.52);
      ctx.fill();
      ctx.fillStyle = '#e4344a';
      ctx.font = `800 ${Math.round(r * 0.8)}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -r * 0.05);
      break;
    }
    case 'gelato': {
      ctx.fillStyle = '#e8b06a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.42, 0);
      ctx.lineTo(r * 0.42, 0);
      ctx.lineTo(0, r);
      ctx.fill();
      ctx.fillStyle = '#f7b2c4';
      ctx.beginPath();
      ctx.arc(-r * 0.22, -r * 0.1, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8e68c';
      ctx.beginPath();
      ctx.arc(r * 0.22, -r * 0.1, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff4f7';
      ctx.beginPath();
      ctx.arc(0, -r * 0.5, r * 0.33, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bakery': {
      ctx.fillStyle = '#d99a4e';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.9, r * 0.55, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f6d9a8';
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(k * r * 0.35 - r * 0.12, -r * 0.3);
        ctx.lineTo(k * r * 0.35 + r * 0.12, r * 0.3);
      }
      ctx.stroke();
      break;
    }
    case 'florist': {
      const cols = ['#ff8fab', '#ffd166', '#c3a6ff'];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + time * 0.4;
        ctx.fillStyle = cols[k % 3];
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, r * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff1a8';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'records': {
      ctx.rotate(time * 2);
      ctx.fillStyle = '#1f1d2a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      for (const rr of [0.7, 0.55]) {
        ctx.beginPath();
        ctx.arc(0, 0, r * rr, 0, Math.PI * 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = '#f4c063';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f1d2a';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'books': {
      const bc = ['#e4677b', '#4f9a8a', '#f4c063'];
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = bc[k];
        ctx.fillRect(-r * 0.8 + k * r * 0.05, r * 0.45 - k * r * 0.42, r * 1.5 - k * r * 0.2, r * 0.36);
      }
      break;
    }
  }
  ctx.restore();
}
