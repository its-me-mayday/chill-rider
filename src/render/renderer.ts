import type { Light } from '../game/daylight';
import { T, TILE, type Building, type GameMap, type Tree } from '../game/map';
import { clamp, css, damp, hash, hash2, mix, type RGB } from '../game/math';
import type { Order, Orders } from '../game/orders';
import type { Rider } from '../game/rider';
import type { Joystick } from '../game/input';
import { drawRider, type Cargo } from './riderDraw';

interface Particle {
  kind: 'petal' | 'dust' | 'sparkle' | 'firefly' | 'leaf';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  seed: number;
}

const SHADOW = 'rgba(52,26,58,0.2)';

export interface Target {
  x: number;
  y: number;
  kind: 'house' | 'shop';
  order?: Order;
}

type View = { x0: number; x1: number; y0: number; y1: number };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private light: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  ppm = 20;
  camX = 0;
  camY = 0;
  private camInit = false;
  private grain: CanvasPattern | null = null;
  private vignette: CanvasGradient | null = null;
  private parts: Particle[] = [];
  private spawnAcc = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.makeGrain();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    for (const c of [this.canvas, this.light]) {
      c.width = Math.round(this.W * this.dpr);
      c.height = Math.round(this.H * this.dpr);
    }
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    const g = this.ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.4, this.W / 2, this.H / 2, Math.hypot(this.W, this.H) * 0.62);
    g.addColorStop(0, 'rgba(40,10,40,0)');
    g.addColorStop(1, 'rgba(40,10,40,0.35)');
    this.vignette = g;
  }

  private makeGrain() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 18;
    }
    g.putImageData(img, 0, 0);
    this.grain = this.ctx.createPattern(c, 'repeat');
  }

  sx(x: number) {
    return (x - this.camX) * this.ppm + this.W / 2;
  }
  sy(y: number) {
    return (y - this.camY) * this.ppm + this.H / 2;
  }

  reset() {
    this.camInit = false;
    this.parts = [];
  }

  updateCamera(r: Rider, map: GameMap, dt: number) {
    const portrait = this.H > this.W;
    const base = clamp(Math.min(this.W, this.H) / (portrait ? 20 : 32), 14, 40);
    const target = base * (1 - 0.12 * clamp(r.speed / 9, 0, 1));
    const look = 0.9 * r.speed;
    let tx = r.x + Math.cos(r.heading) * look;
    let ty = r.y + Math.sin(r.heading) * look;
    if (!this.camInit) this.ppm = target;
    this.ppm += (target - this.ppm) * damp(1.2, dt);
    // keep the camera inside the map
    const hw = this.W / 2 / this.ppm;
    const hh = this.H / 2 / this.ppm;
    tx = map.width > hw * 2 ? clamp(tx, hw, map.width - hw) : map.width / 2;
    ty = map.height > hh * 2 ? clamp(ty, hh, map.height - hh) : map.height / 2;
    if (!this.camInit) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
    }
    this.camX += (tx - this.camX) * damp(3.5, dt);
    this.camY += (ty - this.camY) * damp(3.5, dt);
  }

  // ======================================================================
  render(
    map: GameMap,
    r: Rider,
    orders: Orders | null,
    target: Target | null,
    light: Light,
    time: number,
    dt: number,
    joy: Joystick | null,
  ) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const view = this.view();
    this.drawTiles(map, view, time);
    this.drawShadows(map, view, light);
    this.drawMarkers(orders, target, time);
    this.drawRiderSprite(r, orders, time);
    this.updateParticles(map, r, light, dt, view);
    this.drawParticles(light, time, false);
    this.drawProps(map, view, time);
    this.drawBuildings(map, view, orders, time);
    this.drawTrees(map, view, time);
    this.drawParticles(light, time, true);
    this.drawLighting(map, r, view, light, time);
    this.drawGuides(r, orders, target, time);
    if (joy && joy.active) this.drawJoystick(joy);
    this.post();
  }

  private view(): View {
    const hw = this.W / 2 / this.ppm + 4;
    const hh = this.H / 2 / this.ppm + 4;
    return { x0: this.camX - hw, x1: this.camX + hw, y0: this.camY - hh, y1: this.camY + hh };
  }

  private inView(x: number, y: number, r: number, v: View) {
    return x + r > v.x0 && x - r < v.x1 && y + r > v.y0 && y - r < v.y1;
  }

  // ---------------------------------------------------------------- ground
  private drawTiles(map: GameMap, v: View, time: number) {
    const { ctx, ppm } = this;
    const th = map.theme;
    const tx0 = Math.max(0, Math.floor(v.x0 / TILE));
    const ty0 = Math.max(0, Math.floor(v.y0 / TILE));
    const tx1 = Math.min(map.cols - 1, Math.floor(v.x1 / TILE));
    const ty1 = Math.min(map.rows - 1, Math.floor(v.y1 / TILE));
    const ts = TILE * ppm;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? T.GRASS : (map.tiles[y * map.cols + x] as T));

    // beyond the map edge: a darker hedge
    ctx.fillStyle = css(mix(th.grass, [60, 40, 70], 0.3));
    ctx.fillRect(0, 0, this.W, this.H);

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = at(tx, ty);
        const px = this.sx(tx * TILE);
        const py = this.sy(ty * TILE);
        const h = hash2(tx, ty);
        let col: RGB;
        switch (t) {
          case T.ROAD: col = th.road; break;
          case T.WATER: col = mix(th.water, th.water2, 0.15 * Math.sin(time * 0.8 + tx * 0.6 + ty * 0.4) + 0.15); break;
          case T.SAND: col = mix(th.sand, [255, 255, 255], h * 0.08); break;
          case T.PLAZA: col = mix(th.plaza, [120, 80, 60], h * 0.06); break;
          case T.PATH: col = mix(th.path, [255, 240, 220], h * 0.08); break;
          default: col = mix(th.grass, th.grass2, h);
        }
        ctx.fillStyle = css(col);
        ctx.fillRect(px - 0.5, py - 0.5, ts + 1, ts + 1);

        if (t === T.GRASS && ppm > 9) {
          for (let k = 0; k < 3; k++) {
            const r = hash(tx * 131 + ty * 977 + k * 17);
            const fx = px + hash(tx * 7 + ty * 13 + k) * ts;
            const fy = py + hash(tx * 11 + ty * 3 + k * 5) * ts;
            if (r < 0.12) {
              ctx.fillStyle = ['#ffd1dc', '#fff3b0', '#ffffff', '#cdb4db'][k % 4];
              ctx.beginPath();
              ctx.arc(fx, fy, ppm * 0.12, 0, Math.PI * 2);
              ctx.fill();
            } else if (r < 0.6) {
              ctx.strokeStyle = css(mix(th.grass2, [40, 70, 40], 0.25), 0.55);
              ctx.lineWidth = Math.max(1, ppm * 0.06);
              ctx.beginPath();
              ctx.moveTo(fx - ppm * 0.15, fy);
              ctx.lineTo(fx - ppm * 0.05, fy - ppm * 0.3);
              ctx.moveTo(fx + ppm * 0.1, fy);
              ctx.lineTo(fx + ppm * 0.15, fy - ppm * 0.25);
              ctx.stroke();
            }
          }
        } else if (t === T.WATER) {
          const r = hash(tx * 31 + ty * 7);
          if (r < 0.5) {
            const wx = px + r * ts * 1.6;
            const wy = py + hash(tx + ty * 91) * ts;
            const off = Math.sin(time * 1.2 + r * 20) * ppm * 0.3;
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = Math.max(1, ppm * 0.07);
            ctx.beginPath();
            ctx.moveTo(wx + off, wy);
            ctx.quadraticCurveTo(wx + off + ppm * 0.5, wy - ppm * 0.25, wx + off + ppm, wy);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          const foam = ppm * (0.25 + 0.1 * Math.sin(time * 2 + tx));
          if (at(tx, ty - 1) !== T.WATER) ctx.fillRect(px, py, ts, foam);
          if (at(tx, ty + 1) !== T.WATER) ctx.fillRect(px, py + ts - foam, ts, foam);
          if (at(tx - 1, ty) !== T.WATER) ctx.fillRect(px, py, foam, ts);
          if (at(tx + 1, ty) !== T.WATER) ctx.fillRect(px + ts - foam, py, foam, ts);
        } else if (t === T.PLAZA) {
          ctx.strokeStyle = 'rgba(120,80,60,0.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let k = 1; k < 4; k++) {
            ctx.moveTo(px + (ts * k) / 4, py);
            ctx.lineTo(px + (ts * k) / 4, py + ts);
            ctx.moveTo(px, py + (ts * k) / 4);
            ctx.lineTo(px + ts, py + (ts * k) / 4);
          }
          ctx.stroke();
        } else if (t === T.PATH || t === T.SAND) {
          ctx.fillStyle = 'rgba(110,70,50,0.16)';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(px + hash(tx * 5 + k) * ts, py + hash(ty * 9 + k * 3) * ts, ppm * 0.09, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // road curbs and centre lines
    const cw = Math.max(1.5, ppm * 0.35);
    ctx.fillStyle = css(th.roadEdge);
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        if (at(tx, ty) !== T.ROAD) continue;
        const px = this.sx(tx * TILE);
        const py = this.sy(ty * TILE);
        if (at(tx, ty - 1) !== T.ROAD) ctx.fillRect(px, py, ts, cw);
        if (at(tx, ty + 1) !== T.ROAD) ctx.fillRect(px, py + ts - cw, ts, cw);
        if (at(tx - 1, ty) !== T.ROAD) ctx.fillRect(px, py, cw, ts);
        if (at(tx + 1, ty) !== T.ROAD) ctx.fillRect(px + ts - cw, py, cw, ts);
      }

    ctx.strokeStyle = css(th.line, 0.85);
    ctx.lineWidth = Math.max(1.2, ppm * 0.14);
    ctx.beginPath();
    for (const r of map.roadRows) {
      if (r + 1 < ty0 - 1 || r > ty1 + 1) continue;
      const y = this.sy((r + 1) * TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (at(tx, r) !== T.ROAD || at(tx, r + 1) !== T.ROAD) continue;
        if (at(tx, r - 1) === T.ROAD || at(tx, r + 2) === T.ROAD) continue;
        const px = this.sx(tx * TILE);
        ctx.moveTo(px + ts * 0.25, y);
        ctx.lineTo(px + ts * 0.75, y);
      }
    }
    for (const c of map.roadCols) {
      if (c + 1 < tx0 - 1 || c > tx1 + 1) continue;
      const x = this.sx((c + 1) * TILE);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (at(c, ty) !== T.ROAD || at(c + 1, ty) !== T.ROAD) continue;
        if (at(c - 1, ty) === T.ROAD || at(c + 2, ty) === T.ROAD) continue;
        const py = this.sy(ty * TILE);
        ctx.moveTo(x, py + ts * 0.25);
        ctx.lineTo(x, py + ts * 0.75);
      }
    }
    ctx.stroke();
  }

  private drawShadows(map: GameMap, v: View, light: Light) {
    const { ctx, ppm } = this;
    const s = light.shadow;
    ctx.fillStyle = SHADOW;
    for (const b of map.buildings) {
      if (!this.inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h), v)) continue;
      const x = this.sx(b.x);
      const y = this.sy(b.y);
      const w = b.w * ppm;
      const h = b.h * ppm;
      const ox = s * ppm * 0.9;
      const oy = s * ppm * 0.6;
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w + ox, y + oy);
      ctx.lineTo(x + w + ox, y + h + oy);
      ctx.lineTo(x + ox, y + h + oy);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      ctx.fill();
    }
    for (const t of map.trees) {
      if (!this.inView(t.x, t.y, t.r + 3, v)) continue;
      ctx.beginPath();
      ctx.ellipse(this.sx(t.x + s * 0.5), this.sy(t.y + s * 0.35), t.r * ppm * 1.05, t.r * ppm * 0.85, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ----------------------------------------------------- markers & guides
  private drawMarkers(orders: Orders | null, target: Target | null, time: number) {
    const { ctx, ppm } = this;
    if (!orders) return;
    for (const s of orders.shops) {
      const waiting = !!orders.waiting.get(s.id);
      ctx.strokeStyle = css(s.shop!.awning, waiting ? 0.95 : 0.3);
      ctx.lineWidth = Math.max(2, ppm * 0.18);
      ctx.setLineDash([ppm * 0.6, ppm * 0.35]);
      ctx.lineDashOffset = -time * ppm * 1.2;
      ctx.beginPath();
      ctx.arc(this.sx(s.stopX), this.sy(s.stopY), ppm * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const o of orders.carried) {
      const isT = target?.order?.id === o.id;
      const x = this.sx(o.house.stopX);
      const y = this.sy(o.house.stopY);
      const pulse = 0.75 + 0.25 * Math.sin(time * 4);
      const R = ppm * (isT ? 3.4 * pulse : 2.4);
      const c = o.late ? '255,140,140' : '255,236,170';
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(${c},${isT ? 0.75 : 0.4})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.strokeStyle = `rgba(${c},${isT ? 0.95 : 0.5})`;
      ctx.lineWidth = Math.max(2, ppm * 0.14);
      ctx.beginPath();
      ctx.arc(x, y, ppm * 1.6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawGuides(r: Rider, orders: Orders | null, target: Target | null, time: number) {
    const { ctx, ppm, W, H } = this;
    if (!orders) return;
    const rx = this.sx(r.x);
    const ry = this.sy(r.y);

    const p = Math.min(1, orders.progress);
    if (p > 0.02) {
      ctx.lineWidth = Math.max(3, ppm * 0.18);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(rx, ry, ppm * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,244,210,0.95)';
      ctx.beginPath();
      ctx.arc(rx, ry, ppm * 1.4, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }

    if (!target) return;
    const dx = target.x - r.x;
    const dy = target.y - r.y;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const col = target.kind === 'shop' ? 'rgba(255,255,255,0.95)' : target.order?.late ? 'rgba(255,150,150,0.95)' : 'rgba(255,240,190,0.98)';

    if (d > 6) {
      const R = ppm * 2.4;
      ctx.save();
      ctx.translate(rx + Math.cos(a) * R, ry + Math.sin(a) * R);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.shadowColor = 'rgba(60,20,50,0.35)';
      ctx.shadowBlur = 6;
      const s = Math.max(7, ppm * 0.45) * (1 + 0.08 * Math.sin(time * 5));
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.6, -s * 0.75);
      ctx.lineTo(-s * 0.25, 0);
      ctx.lineTo(-s * 0.6, s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const tx = this.sx(target.x);
    const ty = this.sy(target.y);
    const m = 34;
    if (tx < m || tx > W - m || ty < m + 40 || ty > H - m - 40) {
      const cx = W / 2;
      const cy = H / 2;
      const ddx = tx - cx;
      const ddy = ty - cy;
      const k = Math.min((W / 2 - m - 10) / Math.abs(ddx || 1), (H / 2 - m - 60) / Math.abs(ddy || 1));
      const ex = cx + ddx * k;
      const ey = cy + ddy * k;
      ctx.fillStyle = 'rgba(40,20,45,0.45)';
      ctx.beginPath();
      ctx.roundRect(ex - 34, ey - 14, 68, 28, 14);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.font = '600 13px Outfit, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(d)} m`, ex, ey + 1);
    }
  }

  private drawJoystick(j: Joystick) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(j.ox, j.oy, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    let dx = j.x - j.ox;
    let dy = j.y - j.oy;
    const d = Math.hypot(dx, dy);
    if (d > 60) {
      dx *= 60 / d;
      dy *= 60 / d;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(j.ox + dx, j.oy + dy, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // ------------------------------------------------------------- rider
  private drawRiderSprite(r: Rider, orders: Orders | null, time: number) {
    const { ctx, ppm } = this;
    const x = this.sx(r.x);
    const y = this.sy(r.y);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x + ppm * 0.35, y + ppm * 0.25, ppm * 1.0, ppm * 0.45, r.heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r.heading);
    ctx.scale(ppm * 1.15, ppm * 1.15);
    const cargo: Cargo[] = orders ? orders.carried.map((o) => ({ color: o.shop.shop!.roof, fragile: o.fragile })) : [];
    drawRider(ctx, r, time, cargo, (c) => css(c));
    ctx.restore();
  }

  // -------------------------------------------------------- buildings
  private drawBuildings(map: GameMap, v: View, orders: Orders | null, time: number) {
    const th = map.theme;
    const targets = new Set(orders ? orders.carried.map((o) => o.house.id) : []);
    for (const b of map.buildings) {
      if (!this.inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) + 3, v)) continue;
      if (b.kind === 'shop') this.shop(b, orders, time);
      else this.house(b, th.roofs[b.style % th.roofs.length], targets.has(b.id));
    }
  }

  private door(b: Building, col: string) {
    const { ctx, ppm } = this;
    const along = b.nx === 0;
    const dw = 1.3;
    const dd = 0.5;
    const x = along ? b.doorX - dw / 2 : b.nx > 0 ? b.doorX : b.doorX - dd;
    const y = along ? (b.ny > 0 ? b.doorY : b.doorY - dd) : b.doorY - dw / 2;
    ctx.fillStyle = col;
    ctx.fillRect(this.sx(x), this.sy(y), (along ? dw : dd) * ppm, (along ? dd : dw) * ppm);
    ctx.fillStyle = 'rgba(255,248,236,0.7)';
    const sx = along ? b.doorX - 0.9 : b.nx > 0 ? b.doorX + dd : b.doorX - dd - 0.4;
    const sy = along ? (b.ny > 0 ? b.doorY + dd : b.doorY - dd - 0.4) : b.doorY - 0.9;
    ctx.fillRect(this.sx(sx), this.sy(sy), (along ? 1.8 : 0.4) * ppm, (along ? 0.4 : 1.8) * ppm);
  }

  private house(b: Building, roof: RGB, isTarget: boolean) {
    const { ctx, ppm } = this;
    const x = this.sx(b.x);
    const y = this.sy(b.y);
    const w = b.w * ppm;
    const h = b.h * ppm;
    this.door(b, css(mix(roof, [40, 20, 30], 0.45)));
    const ridgeH = b.w >= b.h;
    ctx.fillStyle = css(mix(roof, [50, 20, 40], 0.18));
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = css(mix(roof, [255, 240, 220], 0.18));
    if (ridgeH) ctx.fillRect(x, y, w, h / 2);
    else ctx.fillRect(x, y, w / 2, h);
    ctx.strokeStyle = 'rgba(60,20,40,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const step = ppm * 0.7;
    if (ridgeH) for (let yy = y + step; yy < y + h; yy += step) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
    else for (let xx = x + step; xx < x + w; xx += step) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
    ctx.stroke();
    ctx.strokeStyle = css(mix(roof, [255, 250, 240], 0.45));
    ctx.lineWidth = Math.max(1.5, ppm * 0.18);
    ctx.beginPath();
    if (ridgeH) { ctx.moveTo(x + ppm * 0.3, y + h / 2); ctx.lineTo(x + w - ppm * 0.3, y + h / 2); }
    else { ctx.moveTo(x + w / 2, y + ppm * 0.3); ctx.lineTo(x + w / 2, y + h - ppm * 0.3); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(50,20,40,0.35)';
    ctx.lineWidth = Math.max(1, ppm * 0.08);
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = css(mix(roof, [80, 40, 50], 0.4));
    ctx.fillRect(x + w * (ridgeH ? 0.72 : 0.25), y + h * (ridgeH ? 0.22 : 0.7), ppm * 0.8, ppm * 0.8);

    // house number near the door
    const px = this.sx(b.doorX - b.nx * 1.4);
    const py = this.sy(b.doorY - b.ny * 1.4);
    const fs = Math.max(9, Math.round(ppm * (isTarget ? 0.95 : 0.75)));
    ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = String(b.no);
    const tw = ctx.measureText(label).width + fs * 0.6;
    ctx.fillStyle = isTarget ? 'rgba(255,240,180,1)' : 'rgba(255,248,236,0.85)';
    ctx.beginPath();
    ctx.roundRect(px - tw / 2, py - fs * 0.65, tw, fs * 1.3, fs * 0.3);
    ctx.fill();
    ctx.fillStyle = css(mix(roof, [40, 20, 30], 0.4));
    ctx.fillText(label, px, py + 1);
  }

  private shop(b: Building, orders: Orders | null, time: number) {
    const { ctx, ppm } = this;
    const st = b.shop!;
    const x = this.sx(b.x);
    const y = this.sy(b.y);
    const w = b.w * ppm;
    const h = b.h * ppm;
    this.door(b, css(mix(st.roof, [40, 20, 30], 0.5)));
    ctx.fillStyle = css(mix(st.roof, [50, 20, 40], 0.12));
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = css(mix(st.roof, [255, 245, 230], 0.12));
    ctx.fillRect(x + ppm * 0.4, y + ppm * 0.4, w - ppm * 0.8, h - ppm * 0.8);
    // striped awning over the door wall
    const n = 7;
    const along = b.nx === 0;
    const len = (along ? b.w : b.h) * 0.85;
    const depth = 1.3;
    const ax = along ? b.x + (b.w - len) / 2 : b.nx > 0 ? b.x + b.w : b.x - depth;
    const ay = along ? (b.ny > 0 ? b.y + b.h : b.y - depth) : b.y + (b.h - len) / 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,250,240,0.95)' : css(st.awning);
      if (along) ctx.fillRect(this.sx(ax + (len / n) * i), this.sy(ay), (len / n) * ppm + 0.5, depth * ppm);
      else ctx.fillRect(this.sx(ax), this.sy(ay + (len / n) * i), depth * ppm, (len / n) * ppm + 0.5);
    }
    // sign on the roof
    const fs = Math.max(10, Math.round(ppm * 0.78));
    ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(st.name).width + fs;
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = 'rgba(255,250,240,0.95)';
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, cy - fs * 0.8, tw, fs * 1.6, fs * 0.4);
    ctx.fill();
    ctx.fillStyle = css(mix(st.roof, [40, 20, 30], 0.35));
    ctx.fillText(st.name, cx, cy + 1);

    if (orders && orders.waiting.get(b.id)) {
      const bx = cx;
      const by = y - ppm * 1.4 + Math.sin(time * 3 + b.id) * ppm * 0.25;
      const r = ppm * 0.95;
      ctx.fillStyle = 'rgba(255,250,240,0.97)';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - r * 0.35, by + r * 0.8);
      ctx.lineTo(bx, by + r * 1.45);
      ctx.lineTo(bx + r * 0.35, by + r * 0.8);
      ctx.fill();
      ctx.fillStyle = '#d6a870';
      ctx.fillRect(bx - r * 0.5, by - r * 0.42, r, r * 0.84);
      ctx.fillStyle = 'rgba(110,70,40,0.4)';
      ctx.fillRect(bx - r * 0.08, by - r * 0.42, r * 0.16, r * 0.84);
    }
  }

  // ------------------------------------------------------------- trees
  private drawTrees(map: GameMap, v: View, time: number) {
    for (const t of map.trees) {
      if (!this.inView(t.x, t.y, t.r + 1, v)) continue;
      this.tree(t, map.theme.tree[t.color % map.theme.tree.length], time);
    }
  }

  private tree(t: Tree, base: RGB, time: number) {
    const { ctx, ppm } = this;
    const x = this.sx(t.x);
    const y = this.sy(t.y);
    const r = t.r * ppm;
    const sway = Math.sin(time * 1.1 + t.x * 0.3) * ppm * 0.05;
    if (t.kind === 1) {
      for (let k = 0; k < 3; k++) {
        const rr = r * (1 - k * 0.28);
        ctx.fillStyle = css(k === 2 ? mix(base, [255, 250, 230], 0.2) : mix(base, [20, 40, 30], 0.25 - k * 0.12));
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i <= pts * 2; i++) {
          const a = (i / (pts * 2)) * Math.PI * 2 + k * 0.3;
          const rad = i % 2 ? rr * 0.62 : rr;
          const px = x + sway * k + Math.cos(a) * rad;
          const py = y + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.fill();
      }
      return;
    }
    const col = t.kind === 2 ? mix(base, [255, 190, 210], 0.55) : base;
    ctx.fillStyle = css(mix(col, [30, 30, 40], 0.22));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(col);
    ctx.beginPath();
    ctx.arc(x - r * 0.12 + sway, y - r * 0.12, r * 0.82, 0, Math.PI * 2);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + t.x;
      const cx = x + Math.cos(a) * r * 0.55 + sway;
      const cy = y + Math.sin(a) * r * 0.55;
      ctx.moveTo(cx + r * 0.42, cy);
      ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = css(mix(col, [255, 245, 225], 0.3));
    ctx.beginPath();
    ctx.arc(x - r * 0.32 + sway, y - r * 0.32, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
    if (t.kind === 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.arc(x + (hash(k + t.x * 10) - 0.5) * r * 1.3, y + (hash(k * 3 + t.y * 10) - 0.5) * r * 1.3, ppm * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawProps(map: GameMap, v: View, time: number) {
    const { ctx, ppm } = this;
    for (const p of map.props) {
      if (!this.inView(p.x, p.y, 4, v)) continue;
      const x = this.sx(p.x);
      const y = this.sy(p.y);
      if (p.kind === 'fountain') {
        ctx.fillStyle = css(mix(map.theme.plaza, [80, 60, 60], 0.3));
        ctx.beginPath();
        ctx.arc(x, y, p.r * ppm, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(map.theme.water);
        ctx.beginPath();
        ctx.arc(x, y, (p.r - 0.45) * ppm, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = Math.max(1, ppm * 0.06);
        for (let k = 0; k < 2; k++) {
          const rr = (((time * 0.6 + k * 0.5) % 1) * (p.r - 0.6) + 0.3) * ppm;
          ctx.beginPath();
          ctx.arc(x, y, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'bench') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle + Math.PI / 2);
        ctx.fillStyle = '#9b6b4f';
        ctx.fillRect(-ppm * 0.9, -ppm * 0.3, ppm * 1.8, ppm * 0.6);
        ctx.fillStyle = 'rgba(255,240,220,0.3)';
        ctx.fillRect(-ppm * 0.9, -ppm * 0.3, ppm * 1.8, ppm * 0.15);
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(x, y + Math.sin(time + p.x) * ppm * 0.15);
        ctx.rotate(p.angle + Math.sin(time * 0.7 + p.x) * 0.05);
        ctx.fillStyle = '#f6f1e4';
        ctx.beginPath();
        ctx.ellipse(0, 0, ppm * 2, ppm * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e4677b';
        ctx.beginPath();
        ctx.ellipse(0, 0, ppm * 1.5, ppm * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------- particles
  burst(kind: 'dust' | 'sparkle', x: number, y: number, n: number) {
    for (let i = 0; i < n && this.parts.length < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = kind === 'dust' ? 1 + Math.random() * 2 : 2 + Math.random() * 3;
      this.parts.push({
        kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0,
        max: 0.5 + Math.random() * 0.6, size: kind === 'dust' ? 0.2 : 0.12, rot: 0, seed: Math.random() * 100,
      });
    }
  }

  private updateParticles(map: GameMap, r: Rider, light: Light, dt: number, v: View) {
    this.spawnAcc += dt;
    while (this.spawnAcc > 0.1) {
      this.spawnAcc -= 0.1;
      if (this.parts.length > 220) break;
      if (Math.random() < light.night * 0.8) {
        if (!map.trees.length) continue;
        const t = map.trees[Math.floor(Math.random() * map.trees.length)];
        if (!this.inView(t.x, t.y, 2, v)) continue;
        this.parts.push({ kind: 'firefly', x: t.x + (Math.random() - 0.5) * 6, y: t.y + (Math.random() - 0.5) * 6, vx: 0, vy: 0, life: 0, max: 4 + Math.random() * 4, size: 0.1, rot: 0, seed: Math.random() * 100 });
      } else if (Math.random() < 0.5) {
        this.parts.push({
          kind: Math.random() < 0.6 ? 'petal' : 'leaf',
          x: v.x0 + Math.random() * (v.x1 - v.x0),
          y: v.y0 + Math.random() * (v.y1 - v.y0) * 0.6,
          vx: 1.2 + Math.random(), vy: 0.6 + Math.random() * 0.6, life: 0, max: 6 + Math.random() * 4,
          size: 0.16 + Math.random() * 0.1, rot: Math.random() * 6, seed: Math.random() * 100,
        });
      }
    }
    if (r.braking && r.speed > 3 && Math.random() < 0.5) this.burst('dust', r.x - Math.cos(r.heading) * 0.8, r.y - Math.sin(r.heading) * 0.8, 1);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life > p.max) {
        this.parts.splice(i, 1);
        continue;
      }
      if (p.kind === 'petal' || p.kind === 'leaf') {
        p.vx += Math.sin(p.life * 1.7 + p.seed) * 0.8 * dt;
        p.rot += dt * 2;
      } else if (p.kind === 'firefly') {
        p.vx += Math.sin(p.life * 2 + p.seed) * 0.6 * dt;
        p.vy += Math.cos(p.life * 1.7 + p.seed) * 0.6 * dt;
      } else {
        p.vx *= 1 - dt * 3;
        p.vy *= 1 - dt * 3;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private drawParticles(light: Light, time: number, top: boolean) {
    const { ctx, ppm } = this;
    for (const p of this.parts) {
      const isTop = p.kind !== 'dust';
      if (isTop !== top) continue;
      const t = p.life / p.max;
      const fade = Math.min(1, p.life * 3) * Math.min(1, (1 - t) * 3);
      const x = this.sx(p.x);
      const y = this.sy(p.y);
      const r = Math.max(1.2, p.size * ppm);
      if (p.kind === 'petal' || p.kind === 'leaf') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.kind === 'petal' ? `rgba(255,205,220,${0.85 * fade})` : `rgba(240,170,110,${0.8 * fade})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.3, r * 0.7 * (0.4 + Math.abs(Math.sin(p.rot))), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'firefly') {
        const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(time * 3 + p.seed * 7));
        ctx.fillStyle = `rgba(255,245,170,${fade * pulse * light.night})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = `rgba(230,210,190,${0.5 * fade})`;
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + t * 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 4 + p.seed);
        ctx.fillStyle = `rgba(255,240,200,${fade})`;
        ctx.fillRect(-r * 1.5, -r * 0.3, r * 3, r * 0.6);
        ctx.fillRect(-r * 0.3, -r * 1.5, r * 0.6, r * 3);
        ctx.restore();
      }
    }
  }

  // ----------------------------------------------------------- lighting
  private drawLighting(map: GameMap, r: Rider, v: View, light: Light, time: number) {
    const { lctx, ppm, W, H, ctx } = this;
    lctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.fillStyle = css(mix([255, 255, 255], light.tint, light.amount));
    lctx.fillRect(0, 0, W, H);

    const n = light.night;
    if (n > 0.05) {
      lctx.globalCompositeOperation = 'lighter';
      const glow = (x: number, y: number, R: number, a: number, c = '255,214,150') => {
        const px = this.sx(x);
        const py = this.sy(y);
        const rr = R * ppm;
        const g = lctx.createRadialGradient(px, py, 0, px, py, rr);
        g.addColorStop(0, `rgba(${c},${a})`);
        g.addColorStop(1, `rgba(${c},0)`);
        lctx.fillStyle = g;
        lctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
      };
      for (const l of map.lamps) if (this.inView(l.x, l.y, 10, v)) glow(l.x, l.y, 9, 0.55 * n * (0.95 + 0.05 * Math.sin(time * 9 + l.x)));
      for (const b of map.buildings) {
        if (!this.inView(b.x, b.y, 12, v)) continue;
        const lit = b.kind === 'shop' ? 1 : hash(b.id * 7) < 0.7 ? 0.7 : 0;
        if (lit) glow(b.doorX + b.nx * 1.2, b.doorY + b.ny * 1.2, b.kind === 'shop' ? 6 : 4, 0.45 * n * lit);
      }
      glow(r.x + Math.cos(r.heading) * 5, r.y + Math.sin(r.heading) * 5, 6, 0.5 * n, '255,246,220');
      glow(r.x, r.y, 4, 0.4 * n, '255,240,220');
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.restore();

    ctx.fillStyle = n > 0.05 ? `rgba(255,236,190,${0.4 + 0.5 * n})` : 'rgba(70,60,80,0.8)';
    for (const l of map.lamps) {
      if (!this.inView(l.x, l.y, 2, v)) continue;
      ctx.beginPath();
      ctx.arc(this.sx(l.x), this.sy(l.y), Math.max(1.5, ppm * (n > 0.05 ? 0.35 : 0.22)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private post() {
    const { ctx, W, H } = this;
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.grain) {
      ctx.save();
      ctx.translate(Math.random() * 128, Math.random() * 128);
      ctx.fillStyle = this.grain;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
  }
}
