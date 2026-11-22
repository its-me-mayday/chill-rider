import type { Light } from '../game/daylight';
import { T, TILE, type Building, type GameMap, type Tree } from '../game/map';
import { clamp, css, damp, hash, hash2, mix, type RGB } from '../game/math';
import type { Order, Orders } from '../game/orders';
import type { Rider } from '../game/rider';
import type { Joystick } from '../game/input';
import type { Critters, Walker } from '../game/critters';
import type { Traffic, Vehicle } from '../game/traffic';
import type { Rider as RiderT } from '../game/rider';
import { drawRider, type Cargo, type RiderStyle } from './riderDraw';
import { drawShop, type Painter } from './shops';
import { drawBridge, drawBridgeTop, drawLandmark, drawLandmarkTop, landmarkHeight } from './landmarks';
import { isOpen } from '../game/themes';
import type { Secret } from '../game/map';
import { signal } from '../game/lights';
import { QUEST_COLOR, type Quests } from '../game/quests';
import { isService } from '../game/themes';

interface Particle {
  kind: 'petal' | 'dust' | 'sparkle' | 'firefly' | 'leaf' | 'butterfly' | 'confetti';
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

export interface Scene {
  map: GameMap;
  rider: Rider;
  orders: Orders | null;
  target: Target | null;
  light: Light;
  time: number;
  dt: number;
  joy: Joystick | null;
  critters: Critters | null;
  postcards: { x: number; y: number; got: boolean }[];
  style: RiderStyle;
  rain: boolean;
  headlight: number;
  traffic: Traffic | null;
  secrets: (Secret & { got: boolean })[];
  quests: Quests | null;
}

interface Floater { text: string; x: number; y: number; t: number; color: string; big: boolean }
interface Toss { x0: number; y0: number; x1: number; y1: number; t: number; dur: number; color: RGB }
interface Customer { b: Building; t: number; shirt: string; hearts: boolean }
interface Track { x: number; y: number; a: number; t: number }
interface Puddle { x: number; y: number; t: number }

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
  private floaters: Floater[] = [];
  private tosses: Toss[] = [];
  private customers: Customer[] = [];
  private tracks: Track[] = [];
  private puddles: Puddle[] = [];
  private trackAcc = 0;
  private shakeAmt = 0;
  private shakeX = 0;
  private shakeY = 0;

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
    return (x - this.camX) * this.ppm + this.W / 2 + this.shakeX;
  }
  sy(y: number) {
    return (y - this.camY) * this.ppm + this.H / 2 + this.shakeY;
  }

  reset() {
    this.camInit = false;
    this.parts = [];
    this.floaters = [];
    this.tosses = [];
    this.customers = [];
    this.tracks = [];
    this.puddles = [];
  }

  // ------------------------------------------------------------ effects API
  shake(amount: number) {
    this.shakeAmt = Math.min(1, this.shakeAmt + amount);
  }

  floatText(x: number, y: number, text: string, color = '#fff1b8', big = false) {
    this.floaters.push({ text, x, y, t: 0, color, big });
  }

  toss(x0: number, y0: number, x1: number, y1: number, color: RGB) {
    this.tosses.push({ x0, y0, x1, y1, t: 0, dur: 0.55, color });
  }

  customer(b: Building, hearts: boolean) {
    const shirts = ['#f4a6a6', '#9fd3c7', '#f6d186', '#b8b5ff', '#ffcfa3'];
    this.customers.push({ b, t: 0, shirt: shirts[b.id % shirts.length], hearts });
  }

  confetti(x: number, y: number) {
    const cols = 6;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 6;
      this.parts.push({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.2 + Math.random() * 0.8, size: 0.14, rot: Math.random() * 6, seed: i % cols });
    }
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
  render(sc: Scene) {
    const { ctx } = this;
    const { map, rider: r, orders, target, light, time, dt, joy } = sc;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // camera shake decays quickly
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    const sh = this.shakeAmt * this.shakeAmt * 9;
    this.shakeX = (Math.random() - 0.5) * sh;
    this.shakeY = (Math.random() - 0.5) * sh;

    const view = this.view();
    this.services = map.buildings.filter((b) => b.kind === 'shop' && isService(b.shop));
    this.night = light.night;
    this.hour = light.hour;
    this.lastTime = time;
    this.drawTiles(map, view, time);
    this.drawBikeTracks(map, view);
    for (const b of map.bridges) if (this.inView((b.c + 1) * TILE, ((b.r0 + b.r1) / 2) * TILE, 20, view)) drawBridge(this.painter(), b, time);
    this.drawRiverName(map, view);
    this.drawStreetDetails(map, view);
    this.drawStopLines(map, view);
    this.drawPotholes(map, view, sc.rain, time);
    this.updateTracks(r, dt);
    this.drawTracks();
    if (sc.rain) this.drawPuddles(map, view, dt);
    this.drawShadows(map, view, light);
    this.drawMarkers(orders, target, time);
    this.drawPostcards(sc.postcards, time, view);
    this.drawSecrets(sc.secrets, r, light, time, view);
    if (sc.quests) this.drawQuestWorld(sc.quests, time, view);
    if (sc.critters) this.drawDucks(sc.critters, time);
    if (sc.critters) this.drawCats(sc.critters, time, view);
    this.drawRiderSprite(r, orders, time, sc.style);
    if (sc.critters) this.drawWalkers(sc.critters, time, view);
    if (sc.traffic) this.drawVehicles(sc.traffic, time, view);
    this.updateParticles(map, r, light, dt, view);
    this.drawParticles(light, time, false);
    this.drawProps(map, view, time);
    this.drawBuildings(map, view, orders, time);
    for (const l of map.landmarks) if (this.inView(l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h) + 4, view)) drawLandmark(this.painter(), l, time, this.night, this.hour);
    this.drawCustomers(dt, time);
    this.drawTrees(map, view, time);
    for (const b of map.bridges) if (this.inView((b.c + 1) * TILE, ((b.r0 + b.r1) / 2) * TILE, 20, view)) drawBridgeTop(this.painter(), b);
    for (const l of map.landmarks) if (this.inView(l.x + l.w / 2, l.y, Math.max(l.w, l.h) + 20, view)) drawLandmarkTop(this.painter(), l, time, this.night);
    this.drawLandmarkLabels(map, sc.rider, view);
    this.drawTrafficLights(map, time, view);
    this.drawTosses(dt);
    this.drawParticles(light, time, true);
    this.drawCloudShadows(light, time);
    this.drawLighting(map, r, view, light, time, sc.headlight, sc.traffic);
    if (sc.rain) this.drawRain(time, dt, r);
    this.drawGuides(r, orders, target, time);
    if (sc.quests) this.drawQuestGuides(sc.quests, r, time, !!orders?.carried.length);
    this.drawFloaters(dt);
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
          case T.CLOSED: col = mix(th.road, th.grass, 0.28); break;
          case T.BIKE: col = th.city ? th.city.bike : [80, 130, 200]; break;
          default: col = mix(th.grass, th.grass2, h);
        }
        ctx.fillStyle = css(col);
        ctx.fillRect(px - 0.5, py - 0.5, ts + 1, ts + 1);
        if (t === T.ROAD) this.roadWear(tx, ty, px, py, ts, col);
        if (t === T.CLOSED) this.closedStub(tx, ty, px, py, ts, at, th.grass);

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
        const stub = (t2: T) => t2 === T.CLOSED;
        if (stub(at(tx, ty - 1)) || stub(at(tx, ty + 1)) || stub(at(tx - 1, ty)) || stub(at(tx + 1, ty))) {
          ctx.fillStyle = 'rgba(255,250,240,0.92)';
          const bw = Math.max(3, ppm * 0.45);
          if (stub(at(tx, ty - 1))) ctx.fillRect(px, py, ts, bw);
          if (stub(at(tx, ty + 1))) ctx.fillRect(px, py + ts - bw, ts, bw);
          if (stub(at(tx - 1, ty))) ctx.fillRect(px, py, bw, ts);
          if (stub(at(tx + 1, ty))) ctx.fillRect(px + ts - bw, py, bw, ts);
          ctx.fillStyle = css(th.roadEdge);
        }
        const curb = (t2: T) => t2 !== T.ROAD && t2 !== T.CLOSED;
        if (curb(at(tx, ty - 1))) ctx.fillRect(px, py, ts, cw);
        if (curb(at(tx, ty + 1))) ctx.fillRect(px, py + ts - cw, ts, cw);
        if (curb(at(tx - 1, ty))) ctx.fillRect(px, py, cw, ts);
        if (curb(at(tx + 1, ty))) ctx.fillRect(px + ts - cw, py, cw, ts);
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

  /** protected cycle tracks: kerbs, a dashed centre line, bike symbols and crossings over the road */
  private drawBikeTracks(map: GameMap, v: View) {
    if (!map.theme.city) return;
    const { ctx, ppm } = this;
    const tx0 = Math.max(0, Math.floor(v.x0 / TILE));
    const ty0 = Math.max(0, Math.floor(v.y0 / TILE));
    const tx1 = Math.min(map.cols - 1, Math.floor(v.x1 / TILE));
    const ty1 = Math.min(map.rows - 1, Math.floor(v.y1 / TILE));
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? T.GRASS : (map.tiles[y * map.cols + x] as T));
    const ts = TILE * ppm;
    const bike = map.theme.city.bike;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const t = at(tx, ty);
        const px = this.sx(tx * TILE);
        const py = this.sy(ty * TILE);
        if (t === T.BIKE) {
          const horiz = at(tx - 1, ty) === T.BIKE || at(tx + 1, ty) === T.BIKE || (at(tx - 1, ty) === T.ROAD && at(tx + 1, ty) !== T.ROAD) || at(tx + 1, ty) === T.ROAD;
          const vert = at(tx, ty - 1) === T.BIKE || at(tx, ty + 1) === T.BIKE;
          const h = horiz && !vert;
          // kerbs against the pavement / grass
          ctx.fillStyle = 'rgba(235,232,226,0.95)';
          const k = Math.max(1.5, ppm * 0.3);
          const edge = (n: T) => n !== T.BIKE && n !== T.ROAD;
          if (edge(at(tx, ty - 1))) ctx.fillRect(px, py, ts, k);
          if (edge(at(tx, ty + 1))) ctx.fillRect(px, py + ts - k, ts, k);
          if (edge(at(tx - 1, ty))) ctx.fillRect(px, py, k, ts);
          if (edge(at(tx + 1, ty))) ctx.fillRect(px + ts - k, py, k, ts);
          // separator island against the road
          ctx.fillStyle = 'rgba(200,196,190,0.95)';
          if (at(tx, ty - 1) === T.ROAD && h) ctx.fillRect(px, py, ts, k * 1.4);
          if (at(tx, ty + 1) === T.ROAD && h) ctx.fillRect(px, py + ts - k * 1.4, ts, k * 1.4);
          if (at(tx - 1, ty) === T.ROAD && !h) ctx.fillRect(px, py, k * 1.4, ts);
          if (at(tx + 1, ty) === T.ROAD && !h) ctx.fillRect(px + ts - k * 1.4, py, k * 1.4, ts);
          // dashed centre line for the two-way track
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          if (h) ctx.fillRect(px + ts * 0.1, py + ts / 2 - ppm * 0.06, ts * 0.4, ppm * 0.12);
          else ctx.fillRect(px + ts / 2 - ppm * 0.06, py + ts * 0.1, ppm * 0.12, ts * 0.4);
          // a bike symbol every few tiles
          if ((tx + ty) % 4 === 0) this.bikeGlyph(px + ts * (h ? 0.75 : 0.25), py + ts * (h ? 0.25 : 0.75), h);
        } else if (t === T.ROAD) {
          // the track continues across the road: blue paint between "elephant's footprints"
          const lr = at(tx - 1, ty) === T.BIKE || at(tx + 1, ty) === T.BIKE;
          const ud = at(tx, ty - 1) === T.BIKE || at(tx, ty + 1) === T.BIKE;
          const crossH = this.trackRun(at, tx, ty, 1, 0);
          const crossV = this.trackRun(at, tx, ty, 0, 1);
          if (!crossH && !crossV) continue;
          ctx.fillStyle = css(bike, 0.55);
          if (crossH) ctx.fillRect(px, py + ts * 0.08, ts, ts * 0.84);
          if (crossV) ctx.fillRect(px + ts * 0.08, py, ts * 0.84, ts);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          const sq = ppm * 0.45;
          for (let k2 = 0; k2 < 4; k2++) {
            const u = (k2 + 0.25) * (ts / 4);
            if (crossH) {
              ctx.fillRect(px + u, py + ts * 0.02, sq, sq);
              ctx.fillRect(px + u, py + ts * 0.98 - sq, sq, sq);
            }
            if (crossV) {
              ctx.fillRect(px + ts * 0.02, py + u, sq, sq);
              ctx.fillRect(px + ts * 0.98 - sq, py + u, sq, sq);
            }
          }
          void lr;
          void ud;
        }
      }
  }

  /** is this road tile on a straight line between two cycle-track tiles? */
  private trackRun(at: (x: number, y: number) => T, tx: number, ty: number, dx: number, dy: number) {
    const look = (s: number) => {
      for (let k = 1; k <= 3; k++) {
        const t = at(tx + dx * k * s, ty + dy * k * s);
        if (t === T.BIKE) return true;
        if (t !== T.ROAD) return false;
      }
      return false;
    };
    return look(1) && look(-1);
  }

  private bikeGlyph(x: number, y: number, horiz: boolean) {
    const { ctx, ppm } = this;
    ctx.save();
    ctx.translate(x, y);
    if (!horiz) ctx.rotate(Math.PI / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, ppm * 0.1);
    const r = ppm * 0.42;
    ctx.beginPath();
    ctx.arc(-ppm * 0.6, 0, r, 0, Math.PI * 2);
    ctx.moveTo(ppm * 0.6 + r, 0);
    ctx.arc(ppm * 0.6, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-ppm * 0.6, 0);
    ctx.lineTo(-ppm * 0.1, -ppm * 0.45);
    ctx.lineTo(ppm * 0.4, -ppm * 0.45);
    ctx.lineTo(ppm * 0.6, 0);
    ctx.moveTo(-ppm * 0.1, -ppm * 0.45);
    ctx.lineTo(0, 0);
    ctx.lineTo(ppm * 0.4, -ppm * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  private drawRiverName(map: GameMap, v: View) {
    if (!map.river) return;
    const { ctx, ppm } = this;
    const y = ((map.river.r0 + map.river.r1 + 1) / 2) * TILE;
    const fs = Math.max(12, Math.round(ppm * 1.6));
    ctx.font = `italic 600 ${fs}px Fraunces, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const span = 70;
    for (let x = span / 2; x < map.width; x += span) {
      if (!this.inView(x, y, 20, v)) continue;
      if (map.bridges.some((b) => Math.abs((b.c + 1) * TILE - x) < 16)) continue;
      ctx.fillText(map.river.name.toUpperCase().split('').join(' '), this.sx(x), this.sy(y));
    }
  }

  /** name plaques next to the sights, bigger when you're close */
  private drawLandmarkLabels(map: GameMap, r: Rider, v: View) {
    const { ctx, ppm } = this;
    for (const l of map.landmarks) {
      const cx = l.x + l.w / 2;
      if (!this.inView(cx, l.y, Math.max(l.w, l.h), v)) continue;
      const near = Math.hypot(r.x - cx, r.y - (l.y + l.h / 2)) < Math.max(l.w, l.h) / 2 + 18;
      const fs = Math.max(10, Math.round(ppm * (near ? 1.05 : 0.85)));
      ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `📍 ${l.def.name}`;
      const tw = ctx.measureText(label).width + fs;
      const px = this.sx(cx);
      const py = this.sy(l.def.kind === 'eye' ? l.y + l.h + 1.2 : l.y - 1.6);
      ctx.fillStyle = near ? 'rgba(255,241,184,0.96)' : 'rgba(255,250,240,0.85)';
      ctx.beginPath();
      ctx.roundRect(px - tw / 2, py - fs * 0.75, tw, fs * 1.5, fs * 0.75);
      ctx.fill();
      ctx.fillStyle = '#4a2d4a';
      ctx.fillText(label, px, py + 1);
    }
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
    for (const l of map.landmarks) {
      const hgt = landmarkHeight(l);
      if (!hgt || !this.inView(l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h) + hgt * 2, v)) continue;
      const ox = s * ppm * 0.9 * Math.sqrt(hgt) * 0.9;
      const oy = s * ppm * 0.6 * Math.sqrt(hgt) * 0.9;
      const shapes = l.def.kind === 'globe' || l.def.kind === 'gherkin' ? [] : l.solids;
      for (const b of shapes) {
        const x = this.sx(b.x);
        const y = this.sy(b.y);
        const w = b.w * ppm;
        const h = b.h * ppm;
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
      for (const c of l.circles) {
        ctx.beginPath();
        ctx.ellipse(this.sx(c.x) + ox / 2, this.sy(c.y) + oy / 2, c.r * ppm + Math.abs(ox) / 2, c.r * ppm + Math.abs(oy) / 2, 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
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
    for (const b of this.services) {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = Math.max(2, ppm * 0.16);
      ctx.setLineDash([ppm * 0.3, ppm * 0.3]);
      ctx.beginPath();
      ctx.arc(this.sx(b.stopX), this.sy(b.stopY), ppm * 2.0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
      const pulse = 0.75 + 0.25 * Math.sin(time * 4 + o.id);
      const R = ppm * (isT ? 3.6 * pulse : 2.6);
      const c = o.color.join(',');
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(${c},${isT ? 0.8 : 0.5})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.strokeStyle = `rgba(${c},${isT ? 1 : 0.75})`;
      ctx.lineWidth = Math.max(2, ppm * (isT ? 0.2 : 0.13));
      if (o.late) ctx.setLineDash([ppm * 0.4, ppm * 0.3]);
      ctx.beginPath();
      ctx.arc(x, y, ppm * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawGuides(r: Rider, orders: Orders | null, target: Target | null, time: number) {
    const { ctx, ppm } = this;
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

    // one arrow per carried delivery, each in its own colour; the nearest is the big one
    const nearestId = target?.order?.id ?? -1;
    if (orders.carried.length) {
      const list = orders.byDistance(r);
      // far ones first so the nearest is drawn on top
      for (let i = list.length - 1; i >= 0; i--) {
        const o = list[i];
        this.guide(r, o.house.stopX, o.house.stopY, `rgb(${o.color.join(',')})`, o.id === nearestId, time, o.late, i);
      }
      return;
    }
    if (target) this.guide(r, target.x, target.y, 'rgba(255,255,255,0.95)', true, time, false, 0);
  }

  private guide(r: Rider, gx: number, gy: number, col: string, main: boolean, time: number, late: boolean, slot: number) {
    const { ctx, ppm, W, H } = this;
    const rx = this.sx(r.x);
    const ry = this.sy(r.y);
    const dx = gx - r.x;
    const dy = gy - r.y;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);

    if (d > 5) {
      const R = ppm * (main ? 2.6 : 2.0 + slot * 0.25);
      ctx.save();
      ctx.translate(rx + Math.cos(a) * R, ry + Math.sin(a) * R);
      ctx.rotate(a);
      const s = Math.max(main ? 9 : 6, ppm * (main ? 0.62 : 0.38)) * (main ? 1 + 0.1 * Math.sin(time * 5) : 1);
      ctx.shadowColor = 'rgba(50,20,50,0.45)';
      ctx.shadowBlur = main ? 8 : 4;
      ctx.fillStyle = col;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = main ? 2 : 1.2;
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.6, -s * 0.75);
      ctx.lineTo(-s * 0.25, 0);
      ctx.lineTo(-s * 0.6, s * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      ctx.restore();
    }

    // edge pill with the distance when the door is off screen
    const tx = this.sx(gx);
    const ty = this.sy(gy);
    const m = 34;
    if (tx < m || tx > W - m || ty < m + 40 || ty > H - m - 40) {
      const cx = W / 2;
      const cy = H / 2;
      const ddx = tx - cx;
      const ddy = ty - cy;
      // keep the pills clear of the HUD panels and the thumb controls at the bottom
      const vLimit = ddy > 0 ? H / 2 - 140 : H / 2 - m - 60;
      const k = Math.min((W / 2 - m - 10) / Math.abs(ddx || 1), vLimit / Math.abs(ddy || 1));
      const ex = cx + ddx * k;
      const ey = cy + ddy * k;
      const w = main ? 74 : 58;
      const h = main ? 30 : 24;
      ctx.fillStyle = 'rgba(40,20,45,0.55)';
      ctx.strokeStyle = col;
      ctx.lineWidth = main ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.roundRect(ex - w / 2, ey - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = late ? '#ffb3b3' : '#fff8f0';
      ctx.font = `600 ${main ? 14 : 11}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(d)} m`, ex, ey + 1);
    } else if (!main) {
      // small coloured pin over the door when it is on screen
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(tx, ty - ppm * 2.4, Math.max(4, ppm * 0.35), 0, Math.PI * 2);
      ctx.fill();
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
  private drawRiderSprite(r: Rider, orders: Orders | null, time: number, style: RiderStyle) {
    const { ctx, ppm } = this;
    const x = this.sx(r.x);
    const y = this.sy(r.y);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x + ppm * 0.35, y + ppm * 0.25, ppm * 1.0, ppm * 0.45, r.heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    // after a slip the bike lies on its side and the rider sits beside it
    const fall = r.fallen > 0 ? Math.min(1, (1.3 - r.fallen) * 6) : 0;
    ctx.rotate(r.heading + fall * r.fallAngle * 0.9);
    ctx.scale(ppm * 1.15, ppm * 1.15 * (1 - fall * 0.35));
    if (fall > 0) ctx.translate(0, r.fallAngle * 0.35 * fall);
    const cargo: Cargo[] = orders ? orders.carried.map((o) => ({ color: o.shop.shop!.roof, fragile: o.fragile })) : [];
    drawRider(ctx, r, time, cargo, style);
    ctx.restore();
    // stars circling the head when dizzy or fallen
    if (r.dizzy > 0 || r.fallen > 0) {
      ctx.fillStyle = '#ffe08a';
      for (let k = 0; k < 3; k++) {
        const a = time * 5 + (k / 3) * Math.PI * 2;
        const sx = x + Math.cos(a) * ppm * 0.7;
        const sy = y - ppm * 0.9 + Math.sin(a) * ppm * 0.25;
        const rr = Math.max(3, ppm * 0.22);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const b = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const q = i % 2 ? rr * 0.45 : rr;
          if (i === 0) ctx.moveTo(sx + Math.cos(b) * q, sy + Math.sin(b) * q);
          else ctx.lineTo(sx + Math.cos(b) * q, sy + Math.sin(b) * q);
        }
        ctx.closePath();
        ctx.fill();
      }
    }
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
    const chx = x + w * (ridgeH ? 0.72 : 0.25);
    const chy = y + h * (ridgeH ? 0.22 : 0.7);
    ctx.fillStyle = css(mix(roof, [80, 40, 50], 0.4));
    ctx.fillRect(chx, chy, ppm * 0.8, ppm * 0.8);
    const dec = hash(b.id * 13);
    if (dec < 0.3) {
      // solar panels on the sunny half
      ctx.fillStyle = 'rgba(60,80,130,0.85)';
      const pw = ppm * 1.0;
      const ph = ppm * 0.7;
      const ox = ridgeH ? x + w * 0.15 : x + w * 0.58;
      const oy = ridgeH ? y + h * 0.58 : y + h * 0.15;
      for (let i = 0; i < 3; i++) {
        const px2 = ridgeH ? ox + i * (pw + 2) : ox;
        const py2 = ridgeH ? oy : oy + i * (ph + 2);
        ctx.fillRect(px2, py2, ridgeH ? pw : ph, ridgeH ? ph : pw);
      }
      ctx.strokeStyle = 'rgba(200,220,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(ox, oy, ridgeH ? pw * 3 + 4 : ph, ridgeH ? ph : pw * 3 + 4);
    } else if (dec < 0.55) {
      // skylights
      ctx.fillStyle = this.night > 0.3 ? `rgba(255,214,140,${0.4 + this.night * 0.5})` : 'rgba(180,215,235,0.85)';
      ctx.fillRect(x + w * 0.3, y + h * 0.62, ppm * 0.9, ppm * 0.7);
      ctx.fillRect(x + w * 0.55, y + h * 0.62, ppm * 0.9, ppm * 0.7);
    }
    // smoke from the chimney in the evening
    if (this.night > 0.25 && hash(b.id * 31) < 0.5) {
      for (let k = 0; k < 4; k++) {
        const life = (this.lastTime * 0.4 + k / 4 + b.id * 0.37) % 1;
        ctx.fillStyle = `rgba(235,230,240,${0.35 * (1 - life)})`;
        ctx.beginPath();
        ctx.arc(chx + ppm * 0.4 + life * ppm * 1.8, chy + ppm * 0.4 - life * ppm * 1.2, ppm * (0.3 + life * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // mailbox and a little flower bed by the door
    const mb = { x: b.doorX + b.nx * 1.3 - b.ny * 1.6, y: b.doorY + b.ny * 1.3 + b.nx * 1.6 };
    ctx.fillStyle = '#6b5a6a';
    ctx.fillRect(this.sx(mb.x) - ppm * 0.06, this.sy(mb.y) - ppm * 0.06, ppm * 0.12, ppm * 0.12);
    ctx.fillStyle = ['#e4677b', '#7fc4e6', '#f4c063', '#7cbf86'][b.id % 4];
    ctx.beginPath();
    ctx.roundRect(this.sx(mb.x) - ppm * 0.25, this.sy(mb.y) - ppm * 0.18, ppm * 0.5, ppm * 0.36, ppm * 0.1);
    ctx.fill();
    const fb = { x: b.doorX + b.nx * 0.6 + b.ny * 2.2, y: b.doorY + b.ny * 0.6 - b.nx * 2.2 };
    if (hash(b.id * 5) < 0.75) {
      ctx.fillStyle = '#8a6a4a';
      ctx.beginPath();
      ctx.ellipse(this.sx(fb.x), this.sy(fb.y), ppm * 0.9, ppm * 0.45, b.nx === 0 ? 0 : Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      const fc = ['#ff8fab', '#ffd166', '#ffffff', '#c3a6ff'];
      for (let k = 0; k < 6; k++) {
        const u = (k / 5 - 0.5) * 1.4;
        const fx = fb.x - b.ny * u;
        const fy = fb.y + b.nx * u;
        ctx.fillStyle = fc[(k + b.id) % 4];
        ctx.beginPath();
        ctx.arc(this.sx(fx), this.sy(fy), ppm * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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

  private night = 0;
  private services: Building[] = [];
  private lastTime = 0;

  private painter(): Painter {
    return {
      ctx: this.ctx,
      ppm: this.ppm,
      sx: (x) => this.sx(x),
      sy: (y) => this.sy(y),
      person: (x, y, f, ph, shirt, hair, wave) => this.person(x, y, f, ph, shirt, hair, wave),
    };
  }

  hour = 9;

  private shop(b: Building, orders: Orders | null, time: number) {
    const st = b.shop!;
    const open = isOpen(st, this.hour);
    let opens = '';
    if (!open) {
      // next opening time
      const starts = st.hours.map(([o]) => o % 24).sort((a, c) => ((a - this.hour + 24) % 24) - ((c - this.hour + 24) % 24));
      const h = starts[0];
      opens = `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    }
    drawShop(this.painter(), b, time, this.night, !!orders && !!orders.waiting.get(b.id), open, opens);
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
      if (this.extraProp(p, x, y, time)) continue;
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
      } else if (Math.random() < 0.08 && light.night < 0.3) {
        this.parts.push({
          kind: 'butterfly',
          x: v.x0 + Math.random() * (v.x1 - v.x0),
          y: v.y0 + Math.random() * (v.y1 - v.y0),
          vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, life: 0, max: 8 + Math.random() * 6,
          size: 0.22, rot: 0, seed: Math.random() * 100,
        });
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
      } else if (p.kind === 'butterfly') {
        p.vx += Math.sin(p.life * 1.3 + p.seed) * 3 * dt;
        p.vy += Math.cos(p.life * 1.1 + p.seed * 2) * 3 * dt;
        p.vx *= 1 - dt;
        p.vy *= 1 - dt;
      } else if (p.kind === 'confetti') {
        p.vx *= 1 - dt * 2.5;
        p.vy *= 1 - dt * 2.5;
        p.rot += dt * 8;
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
      } else if (p.kind === 'butterfly') {
        const flap = Math.abs(Math.sin(time * 14 + p.seed));
        const col = ['#ffd1dc', '#fff3b0', '#cdb4db', '#ffffff'][Math.floor(p.seed) % 4];
        ctx.fillStyle = col;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.ellipse(x - r * flap * 0.8, y, r * flap, r * 0.8, 0, 0, Math.PI * 2);
        ctx.ellipse(x + r * flap * 0.8, y, r * flap, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (p.kind === 'confetti') {
        const cols = ['#ff8f8f', '#ffd27a', '#9fe3a8', '#8fc8ff', '#c9a3ff', '#fff1b8'];
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.sin(p.rot)) + 0.2);
        ctx.fillStyle = cols[p.seed % cols.length];
        ctx.globalAlpha = fade;
        ctx.fillRect(-r, -r * 0.5, r * 2, r);
        ctx.restore();
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
  private drawLighting(map: GameMap, r: Rider, v: View, light: Light, time: number, headlight: number, traffic: Traffic | null) {
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
      // floodlit landmarks
      for (const l of map.landmarks) {
        if (!this.inView(l.x + l.w / 2, l.y + l.h / 2, Math.max(l.w, l.h) + 10, v)) continue;
        const R = Math.max(l.w, l.h) * 0.75 + 4;
        const c = l.def.kind === 'eye' ? '150,200,255' : l.def.kind === 'shard' || l.def.kind === 'gherkin' ? '200,230,255' : '255,220,160';
        glow(l.x + l.w / 2, l.y + l.h / 2, R, 0.5 * n, c);
      }
      for (const b of map.bridges) for (let yy = b.r0 * TILE + 2; yy < (b.r1 + 1) * TILE; yy += 6) {
        glow(b.c * TILE - 0.3, yy, 4, 0.5 * n);
        glow((b.c + 2) * TILE + 0.3, yy, 4, 0.5 * n);
      }
      for (const b of map.buildings) {
        if (!this.inView(b.x, b.y, 12, v)) continue;
        const lit = b.kind === 'shop' ? 1 : hash(b.id * 7) < 0.7 ? 0.7 : 0;
        if (lit) glow(b.doorX + b.nx * 1.2, b.doorY + b.ny * 1.2, b.kind === 'shop' ? 6 : 4, 0.45 * n * lit);
      }
      glow(r.x + Math.cos(r.heading) * 5 * headlight, r.y + Math.sin(r.heading) * 5 * headlight, 6 * headlight, 0.5 * n, '255,246,220');
      glow(r.x, r.y, 4, 0.4 * n, '255,240,220');
      for (const l of map.lights) {
        if (!this.inView(l.x0, l.y0, 12, v)) continue;
        for (const [cx, cy, ax] of this.lightHeads(l)) {
          const sg = signal(l, time, ax);
          glow(cx, cy, 1.6, 0.5 * n, sg === 'green' ? '120,255,160' : sg === 'yellow' ? '255,210,80' : '255,80,80');
        }
      }
      if (traffic) {
        for (const c of traffic.vehicles) {
          if (!c.active || !this.inView(c.x, c.y, 12, v)) continue;
          const ax = Math.cos(c.heading);
          const ay = Math.sin(c.heading);
          if (c.kind === 'rider') glow(c.x + ax * 3, c.y + ay * 3, 3.5, 0.4 * n, '255,246,220');
          else {
            glow(c.x + ax * (c.half + 4), c.y + ay * (c.half + 4), 6.5, 0.55 * n, '255,246,220');
            glow(c.x - ax * c.half, c.y - ay * c.half, 1.8, (c.braking ? 0.6 : 0.3) * n, '255,90,90');
          }
        }
      }
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

  // ------------------------------------------------------ extra obstacles
  private extraProp(p: GameMap['props'][number], x: number, y: number, time: number): boolean {
    const { ctx, ppm } = this;
    const sh = (w: number, h: number, a = 0) => {
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(x + ppm * 0.25, y + ppm * 0.18, w, h, a, 0, Math.PI * 2);
      ctx.fill();
    };
    switch (p.kind) {
      case 'cone': {
        sh(ppm * 0.35, ppm * 0.3);
        ctx.fillStyle = '#ff7a3d';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff7a3d';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.09, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      case 'barrier': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        const L = ((p.len ?? 1) + p.r) * ppm;
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-L + ppm * 0.2, -ppm * 0.1, L * 2, ppm * 0.5);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = i % 2 ? '#ffffff' : '#e4344a';
          ctx.fillRect(-L + (i * L * 2) / 6, -ppm * 0.22, (L * 2) / 6 + 0.5, ppm * 0.44);
        }
        // blinking warning lamp
        ctx.fillStyle = Math.sin(time * 6) > 0 ? '#ffd23f' : 'rgba(255,210,63,0.35)';
        ctx.beginPath();
        ctx.arc(-L, 0, ppm * 0.18, 0, Math.PI * 2);
        ctx.arc(L, 0, ppm * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      }
      case 'roadblock': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        const L = ((p.len ?? 3) + p.r) * ppm;
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-L + ppm * 0.25, -ppm * 0.15, L * 2, ppm * 0.75);
        // two rails of red/white boards on little feet
        ctx.fillStyle = '#8a7a86';
        for (const u of [-0.8, 0, 0.8]) ctx.fillRect(u * L - ppm * 0.12, -ppm * 0.42, ppm * 0.24, ppm * 0.84);
        const n = 10;
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = i % 2 ? '#ffffff' : '#e4344a';
          ctx.fillRect(-L + (i * L * 2) / n, -ppm * 0.3, (L * 2) / n + 0.5, ppm * 0.6);
        }
        ctx.strokeStyle = 'rgba(60,20,40,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-L, -ppm * 0.3, L * 2, ppm * 0.6);
        // amber warning lamps blinking in turn
        for (let k = 0; k < 3; k++) {
          const on = Math.floor(time * 3 + k) % 3 === 0;
          ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,210,63,0.3)';
          ctx.beginPath();
          ctx.arc((k - 1) * L * 0.8, 0, ppm * 0.2, 0, Math.PI * 2);
          ctx.fill();
          if (on) {
            const g = ctx.createRadialGradient((k - 1) * L * 0.8, 0, 0, (k - 1) * L * 0.8, 0, ppm * 1.2);
            g.addColorStop(0, 'rgba(255,210,63,0.45)');
            g.addColorStop(1, 'rgba(255,210,63,0)');
            ctx.fillStyle = g;
            ctx.fillRect((k - 1) * L * 0.8 - ppm * 1.2, -ppm * 1.2, ppm * 2.4, ppm * 2.4);
          }
        }
        ctx.restore();
        return true;
      }
      case 'noEntry': {
        // round no-entry sign on a pole, plus a "ROAD CLOSED" plate
        sh(ppm * 0.6, ppm * 0.45);
        const R = Math.max(7, ppm * 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, R + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d83a46';
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - R * 0.62, y - R * 0.18, R * 1.24, R * 0.36);
        const fs = Math.max(8, Math.round(ppm * 0.42));
        ctx.font = `700 ${fs}px Outfit, system-ui, sans-serif`;
        const label = 'ROAD CLOSED';
        const tw = ctx.measureText(label).width + fs;
        ctx.fillStyle = 'rgba(255,250,240,0.95)';
        ctx.strokeStyle = '#d83a46';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2, y + R + 4, tw, fs * 1.6, fs * 0.3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#d83a46';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y + R + 4 + fs * 0.82);
        return true;
      }
      case 'workSign': {
        sh(ppm * 0.4, ppm * 0.3);
        ctx.fillStyle = '#ffd23f';
        ctx.strokeStyle = '#e4344a';
        ctx.lineWidth = Math.max(1.5, ppm * 0.1);
        ctx.beginPath();
        ctx.moveTo(x, y - ppm * 0.45);
        ctx.lineTo(x + ppm * 0.45, y + ppm * 0.35);
        ctx.lineTo(x - ppm * 0.45, y + ppm * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3a3045';
        ctx.fillRect(x - ppm * 0.04, y - ppm * 0.15, ppm * 0.08, ppm * 0.28);
        return true;
      }
      case 'phonebox': {
        sh(ppm * 0.8, ppm * 0.7);
        ctx.fillStyle = '#c8202e';
        ctx.beginPath();
        ctx.roundRect(x - ppm * 0.62, y - ppm * 0.62, ppm * 1.24, ppm * 1.24, ppm * 0.18);
        ctx.fill();
        ctx.fillStyle = '#e23a45';
        ctx.beginPath();
        ctx.roundRect(x - ppm * 0.45, y - ppm * 0.45, ppm * 0.9, ppm * 0.9, ppm * 0.3);
        ctx.fill();
        ctx.fillStyle = '#f6e7b0';
        ctx.fillRect(x - ppm * 0.12, y - ppm * 0.12, ppm * 0.24, ppm * 0.24);
        if (this.night > 0.3) {
          ctx.fillStyle = `rgba(255,240,190,${this.night * 0.7})`;
          ctx.fillRect(x - ppm * 0.62, y - ppm * 0.08, ppm * 1.24, ppm * 0.16);
        }
        return true;
      }
      case 'postbox': {
        sh(ppm * 0.36, ppm * 0.3);
        ctx.fillStyle = '#b31b26';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e04a52';
        ctx.beginPath();
        ctx.arc(x - ppm * 0.07, y - ppm * 0.07, ppm * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(x - ppm * 0.05, y - ppm * 0.05, ppm * 0.1, ppm * 0.1);
        return true;
      }
      case 'bin': {
        sh(ppm * 0.38, ppm * 0.32);
        ctx.fillStyle = p.color ?? '#5a8f6a';
        ctx.beginPath();
        ctx.roundRect(x - ppm * 0.35, y - ppm * 0.35, ppm * 0.7, ppm * 0.7, ppm * 0.12);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x - ppm * 0.35, y - ppm * 0.35, ppm * 0.7, ppm * 0.16);
        return true;
      }
      case 'pcar': {
        this.carBody(p.x, p.y, p.angle, (p.len ?? 1) + p.r, p.r * 2, p.color ?? '#e86a5a', false, false, time);
        return true;
      }
      case 'picnic': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-ppm * 1.1, -ppm * 0.6, ppm * 2.4, ppm * 1.4);
        ctx.fillStyle = '#9b6b4f';
        ctx.fillRect(-ppm * 1.2, -ppm * 0.95, ppm * 2.4, ppm * 0.35);
        ctx.fillRect(-ppm * 1.2, ppm * 0.6, ppm * 2.4, ppm * 0.35);
        ctx.fillStyle = '#b8835f';
        ctx.fillRect(-ppm * 1.2, -ppm * 0.45, ppm * 2.4, ppm * 0.9);
        ctx.fillStyle = '#e4677b';
        ctx.fillRect(-ppm * 0.5, -ppm * 0.35, ppm * 1.0, ppm * 0.7);
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) ctx.fillRect(-ppm * 0.5 + k * ppm * 0.34, -ppm * 0.35 + j * ppm * 0.35, ppm * 0.17, ppm * 0.17);
        ctx.restore();
        return true;
      }
      case 'bench': {
        if (!p.len) return false; // plaza benches keep the original look
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-ppm * 0.9, -ppm * 0.2, ppm * 2, ppm * 0.8);
        ctx.fillStyle = '#9b6b4f';
        ctx.fillRect(-ppm * 1.0, -ppm * 0.4, ppm * 2, ppm * 0.8);
        ctx.fillStyle = 'rgba(255,240,220,0.3)';
        for (let k = 0; k < 3; k++) ctx.fillRect(-ppm * 1.0, -ppm * 0.4 + k * ppm * 0.28, ppm * 2, ppm * 0.08);
        ctx.restore();
        return true;
      }
      case 'bale': {
        sh(ppm * 0.95, ppm * 0.8);
        ctx.fillStyle = '#e8c36a';
        ctx.beginPath();
        ctx.arc(x, y, ppm * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,120,50,0.6)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(x, y, ppm * 0.2 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
        return true;
      }
      case 'log': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.angle);
        const L = (p.len ?? 1) * ppm;
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-L + ppm * 0.2, -ppm * 0.2, L * 2, ppm * 0.7);
        ctx.fillStyle = '#7a5236';
        ctx.beginPath();
        ctx.roundRect(-L - ppm * 0.38, -ppm * 0.38, L * 2 + ppm * 0.76, ppm * 0.76, ppm * 0.38);
        ctx.fill();
        ctx.fillStyle = '#c9a27a';
        ctx.beginPath();
        ctx.arc(L + ppm * 0.1, 0, ppm * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7cbf86';
        ctx.beginPath();
        ctx.arc(-L * 0.3, -ppm * 0.2, ppm * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      }
      case 'umbrella': {
        ctx.fillStyle = SHADOW;
        ctx.beginPath();
        ctx.arc(x + ppm * 0.6, y + ppm * 0.4, ppm * 1.3, 0, Math.PI * 2);
        ctx.fill();
        // towel underneath
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - ppm * 0.4, y + ppm * 0.4, ppm * 0.9, ppm * 1.7);
        const col = p.color ?? '#e4677b';
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = k % 2 ? '#ffffff' : col;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.arc(x, y, ppm * 1.25, (k / 8) * Math.PI * 2 + time * 0.1, ((k + 1) / 8) * Math.PI * 2 + time * 0.1);
          ctx.closePath();
          ctx.fill();
        }
        return true;
      }
      case 'sandcastle': {
        sh(ppm * 0.7, ppm * 0.55);
        ctx.fillStyle = '#e6c88e';
        ctx.fillRect(x - ppm * 0.6, y - ppm * 0.6, ppm * 1.2, ppm * 1.2);
        ctx.fillStyle = '#d9b87a';
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath();
          ctx.arc(x + dx * ppm * 0.6, y + dy * ppm * 0.6, ppm * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e4677b';
        ctx.fillRect(x - ppm * 0.02, y - ppm * 0.6, ppm * 0.3, ppm * 0.2);
        return true;
      }
    }
    return false;
  }

  /** Top-down car body centred on (x, y) in world units, facing `angle`. */
  private carBody(wx: number, wy: number, angle: number, half: number, width: number, color: string, lights: boolean, braking: boolean, time: number) {
    const { ctx, ppm } = this;
    const L = half * ppm;
    const W = (width / 2) * ppm;
    ctx.save();
    ctx.translate(this.sx(wx), this.sy(wy));
    ctx.rotate(angle);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.roundRect(-L + ppm * 0.3, -W + ppm * 0.3, L * 2, W * 2, W * 0.6);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-L, -W, L * 2, W * 2, W * 0.55);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,40,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // cabin glass + roof
    ctx.fillStyle = 'rgba(70,90,120,0.85)';
    ctx.beginPath();
    ctx.roundRect(-L * 0.45, -W * 0.82, L * 1.05, W * 1.64, W * 0.3);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-L * 0.32, -W * 0.72, L * 0.62, W * 1.44, W * 0.25);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-L * 0.28, -W * 0.66, L * 0.54, W * 0.35);
    // lights
    ctx.fillStyle = lights ? '#fff6d0' : 'rgba(255,250,230,0.85)';
    ctx.fillRect(L - ppm * 0.18, -W * 0.8, ppm * 0.16, W * 0.45);
    ctx.fillRect(L - ppm * 0.18, W * 0.35, ppm * 0.16, W * 0.45);
    ctx.fillStyle = braking ? '#ff4b4b' : 'rgba(200,60,60,0.8)';
    ctx.fillRect(-L + ppm * 0.02, -W * 0.8, ppm * 0.14, W * 0.4);
    ctx.fillRect(-L + ppm * 0.02, W * 0.4, ppm * 0.14, W * 0.4);
    // mirrors
    ctx.fillStyle = color;
    ctx.fillRect(L * 0.3, -W - ppm * 0.12, ppm * 0.2, ppm * 0.14);
    ctx.fillRect(L * 0.3, W - ppm * 0.02, ppm * 0.2, ppm * 0.14);
    ctx.restore();
    void time;
  }

  private drawVehicles(t: Traffic, time: number, v: View) {
    const { ctx, ppm } = this;
    for (const c of t.vehicles) {
      if (!c.active || !this.inView(c.x, c.y, 4, v)) continue;
      if (c.kind === 'rider') {
        this.npcRider(c, time);
        continue;
      }
      if (c.kind === 'bus') {
        this.bus(c);
        if (c.honk > 3.4) this.bubble(c.x, c.y - 0.5, '📯');
        continue;
      }
      if (c.kind === 'cab') {
        this.cab(c, time);
        if (c.honk > 3.4) this.bubble(c.x, c.y - 0.5, '📯');
        continue;
      }
      this.carBody(c.x, c.y, c.heading, c.half, c.width, c.color, this.night > 0.3, c.braking, time);
      if (c.kind === 'van') {
        // delivery van roof stripe
        ctx.save();
        ctx.translate(this.sx(c.x), this.sy(c.y));
        ctx.rotate(c.heading);
        ctx.fillStyle = c.color2;
        ctx.fillRect(-c.half * ppm * 0.9, -ppm * 0.15, c.half * ppm * 1.2, ppm * 0.3);
        ctx.restore();
      }
      if (c.honk > 3.4) this.bubble(c.x, c.y - 0.5, '📯');
    }
  }

  /**
   * A red London double-decker seen from above: you can tell it's two storeys
   * from the long shadow, the band of upper-deck windows running all round,
   * the white roof roundel with the route number and the destination blind.
   */
  private bus(c: Vehicle) {
    const { ctx, ppm } = this;
    const L = c.half * ppm;
    const W = (c.width / 2) * ppm;
    const night = this.night > 0.3;
    ctx.save();
    ctx.translate(this.sx(c.x), this.sy(c.y));
    ctx.rotate(c.heading);
    // tall vehicle, long shadow
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.roundRect(-L + ppm * 1.4, -W + ppm * 0.9, L * 2, W * 2, W * 0.35);
    ctx.fill();
    // lower deck skirt
    ctx.fillStyle = '#a3141c';
    ctx.beginPath();
    ctx.roundRect(-L, -W, L * 2, W * 2, W * 0.4);
    ctx.fill();
    // wheel arches peeking out
    ctx.fillStyle = '#1e1b24';
    for (const u of [-0.62, 0.58]) {
      ctx.fillRect(L * u - ppm * 0.45, -W - ppm * 0.06, ppm * 0.9, ppm * 0.14);
      ctx.fillRect(L * u - ppm * 0.45, W - ppm * 0.08, ppm * 0.9, ppm * 0.14);
    }
    // upper deck: a band of glass all round with red pillars
    const iw = ppm * 0.16;
    ctx.fillStyle = night ? '#ffe2a0' : '#3c4658';
    ctx.beginPath();
    ctx.roundRect(-L + iw, -W + iw, L * 2 - iw * 2, W * 2 - iw * 2, W * 0.32);
    ctx.fill();
    ctx.fillStyle = '#d8262e';
    const pillars = Math.max(6, Math.round((c.half * 2) / 1.25));
    for (let k = 1; k < pillars; k++) {
      const x = -L + (k / pillars) * L * 2;
      ctx.fillRect(x - ppm * 0.07, -W + iw, ppm * 0.14, ppm * 0.42);
      ctx.fillRect(x - ppm * 0.07, W - iw - ppm * 0.42, ppm * 0.14, ppm * 0.42);
    }
    // the roof
    const rw = ppm * 0.48;
    const roof = ctx.createLinearGradient(0, -W, 0, W);
    roof.addColorStop(0, '#f0434b');
    roof.addColorStop(1, '#c81d26');
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.roundRect(-L + rw, -W + rw, L * 2 - rw * 2, W * 2 - rw * 2, W * 0.25);
    ctx.fill();
    // roof vents and the emergency hatch
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(-L * 0.62, -W * 0.28, L * 0.32, W * 0.56);
    ctx.fillStyle = '#9a1c24';
    ctx.fillRect(L * 0.38, -W * 0.22, ppm * 0.55, W * 0.44);
    // front destination blind
    ctx.fillStyle = '#1e1b24';
    ctx.fillRect(L - ppm * 0.22, -W * 0.7, ppm * 0.2, W * 1.4);
    ctx.fillStyle = '#ffcf3f';
    ctx.fillRect(L - ppm * 0.18, -W * 0.55, ppm * 0.1, W * 1.1);
    // route number on the roof, readable side-on
    ctx.save();
    ctx.translate(-L * 0.05, 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-ppm * 1.0, -W * 0.48, ppm * 2.0, W * 0.96, ppm * 0.25);
    ctx.fill();
    ctx.fillStyle = '#c81d26';
    ctx.font = `800 ${Math.max(8, Math.round(W * 0.78))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.color2, 0, W * 0.04);
    ctx.restore();
    // lights
    ctx.fillStyle = night ? '#fff6d0' : 'rgba(255,250,230,0.9)';
    ctx.fillRect(L - ppm * 0.12, -W * 0.85, ppm * 0.12, W * 0.3);
    ctx.fillRect(L - ppm * 0.12, W * 0.55, ppm * 0.12, W * 0.3);
    ctx.fillStyle = c.braking ? '#ff4b4b' : 'rgba(200,60,60,0.85)';
    ctx.fillRect(-L, -W * 0.85, ppm * 0.12, W * 0.3);
    ctx.fillRect(-L, W * 0.55, ppm * 0.12, W * 0.3);
    ctx.restore();
  }

  /** The black cab: a tall rounded body, chrome grille, and the yellow TAXI sign lit when it's free. */
  private cab(c: Vehicle, time: number) {
    const { ctx, ppm } = this;
    const L = c.half * ppm;
    const W = (c.width / 2) * ppm;
    const night = this.night > 0.3;
    ctx.save();
    ctx.translate(this.sx(c.x), this.sy(c.y));
    ctx.rotate(c.heading);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.roundRect(-L + ppm * 0.5, -W + ppm * 0.4, L * 2, W * 2, W * 0.8);
    ctx.fill();
    // body: rounded bonnet and boot, glossy black
    const body = ctx.createLinearGradient(0, -W, 0, W);
    body.addColorStop(0, '#3a3a44');
    body.addColorStop(0.5, '#1c1c22');
    body.addColorStop(1, '#2a2a32');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(-L, -W, L * 2, W * 2, [W * 0.55, W * 0.95, W * 0.95, W * 0.55]);
    ctx.fill();
    // chrome bumpers and the grille
    ctx.fillStyle = '#d9dde3';
    ctx.fillRect(L - ppm * 0.14, -W * 0.7, ppm * 0.14, W * 1.4);
    ctx.fillRect(-L, -W * 0.7, ppm * 0.12, W * 1.4);
    ctx.fillStyle = '#9aa1ab';
    for (let k = -2; k <= 2; k++) ctx.fillRect(L - ppm * 0.42, k * W * 0.16 - ppm * 0.03, ppm * 0.24, ppm * 0.06);
    // bonnet crease
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L * 0.45, -W * 0.3);
    ctx.lineTo(L * 0.85, -W * 0.25);
    ctx.moveTo(L * 0.45, W * 0.3);
    ctx.lineTo(L * 0.85, W * 0.25);
    ctx.stroke();
    // big glass cabin and a tall roof
    ctx.fillStyle = night ? 'rgba(255,226,160,0.8)' : 'rgba(90,110,140,0.9)';
    ctx.beginPath();
    ctx.roundRect(-L * 0.55, -W * 0.86, L * 1.0, W * 1.72, W * 0.3);
    ctx.fill();
    ctx.fillStyle = '#18181e';
    ctx.beginPath();
    ctx.roundRect(-L * 0.42, -W * 0.74, L * 0.72, W * 1.48, W * 0.25);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-L * 0.38, -W * 0.68, L * 0.64, W * 0.3);
    // the TAXI sign
    const free = Math.sin(c.x * 0.01 + c.max) > -0.3;
    ctx.fillStyle = free ? (night ? '#ffd23f' : '#f2c14e') : '#6b6250';
    ctx.beginPath();
    ctx.roundRect(L * 0.12, -W * 0.42, ppm * 0.42, W * 0.84, ppm * 0.08);
    ctx.fill();
    ctx.save();
    ctx.translate(L * 0.12 + ppm * 0.21, 0);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#1c1c22';
    ctx.font = `800 ${Math.max(6, Math.round(ppm * 0.3))}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0);
    ctx.restore();
    // mirrors and lights
    ctx.fillStyle = '#1c1c22';
    ctx.fillRect(L * 0.32, -W - ppm * 0.14, ppm * 0.22, ppm * 0.16);
    ctx.fillRect(L * 0.32, W - ppm * 0.02, ppm * 0.22, ppm * 0.16);
    ctx.fillStyle = night ? '#fff6d0' : 'rgba(255,250,230,0.9)';
    ctx.beginPath();
    ctx.arc(L - ppm * 0.22, -W * 0.68, ppm * 0.13, 0, Math.PI * 2);
    ctx.arc(L - ppm * 0.22, W * 0.68, ppm * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.braking ? '#ff4b4b' : 'rgba(200,60,60,0.85)';
    ctx.fillRect(-L + ppm * 0.04, -W * 0.8, ppm * 0.12, W * 0.35);
    ctx.fillRect(-L + ppm * 0.04, W * 0.45, ppm * 0.12, W * 0.35);
    ctx.restore();
    void time;
  }

  private npcRider(c: Vehicle, time: number) {
    const { ctx, ppm } = this;
    const x = this.sx(c.x);
    const y = this.sy(c.y);
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.ellipse(x + ppm * 0.35, y + ppm * 0.25, ppm * 1.0, ppm * 0.45, c.heading, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(c.heading);
    ctx.scale(ppm * 1.1, ppm * 1.1);
    const cargo = c.parcel ? [{ color: [214, 168, 112] as RGB, fragile: false }] : [];
    drawRider(ctx, c as unknown as RiderT, time, cargo, { frame: c.frame, beanie: c.beanie, scarf: c.scarf });
    ctx.restore();
    if (c.wave > 4.8) this.bubble(c.x, c.y, '👋');
    else if (c.honk > 3.4) this.bubble(c.x, c.y, '🔔');
  }

  /** an abandoned stub of road: faded asphalt, hatching and grass pushing through the cracks */
  private closedStub(tx: number, ty: number, px: number, py: number, ts: number, at: (x: number, y: number) => T, grass: RGB) {
    const { ctx, ppm } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, ts, ts);
    ctx.clip();
    // diagonal yellow/white hatching: "no traffic here"
    ctx.strokeStyle = 'rgba(255,214,90,0.55)';
    ctx.lineWidth = Math.max(2, ppm * 0.3);
    ctx.beginPath();
    for (let k = -ts; k < ts * 2; k += ppm * 1.1) {
      ctx.moveTo(px + k, py);
      ctx.lineTo(px + k - ts, py + ts);
    }
    ctx.stroke();
    // grass tufts in the cracks
    ctx.fillStyle = css(grass, 0.85);
    for (let k = 0; k < 7; k++) {
      const gx = px + hash(tx * 13 + ty * 7 + k) * ts;
      const gy = py + hash(tx * 3 + ty * 17 + k * 5) * ts;
      ctx.beginPath();
      ctx.ellipse(gx, gy, ppm * (0.2 + hash(k + tx) * 0.3), ppm * 0.14, hash(k * 3 + ty) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // crumbling edge where the stub meets the grass
    ctx.fillStyle = css(grass);
    const e = ppm * 0.25;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
      const n = at(tx + dx, ty + dy);
      if (n === T.ROAD || n === T.CLOSED) continue;
      for (let k = 0; k < 5; k++) {
        const u = (k + 0.5) / 5;
        const r = e * (0.6 + hash(tx * 5 + ty * 3 + k + dx * 7 + dy * 11) * 0.9);
        const cx = dx === 0 ? px + u * ts : dx < 0 ? px : px + ts;
        const cy = dy === 0 ? py + u * ts : dy < 0 ? py : py + ts;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** patched asphalt and cracks, deterministic per tile */
  private roadWear(tx: number, ty: number, px: number, py: number, ts: number, road: RGB) {
    const { ctx, ppm } = this;
    const h1 = hash(tx * 7919 + ty * 104729);
    const h2 = hash(tx * 31 + ty * 1237 + 5);
    if (h1 < 0.2) {
      // a repair patch: slightly different shade with a sealed seam
      const w = ts * (0.35 + hash(tx + ty * 3) * 0.45);
      const hgt = ts * (0.25 + hash(tx * 5 + ty) * 0.4);
      const x = px + hash(tx * 9 + ty) * (ts - w);
      const y = py + hash(tx + ty * 11) * (ts - hgt);
      ctx.fillStyle = css(mix(road, h1 < 0.1 ? [20, 15, 30] : [255, 240, 230], 0.09));
      ctx.fillRect(x, y, w, hgt);
      ctx.strokeStyle = css(mix(road, [10, 5, 15], 0.3), 0.6);
      ctx.lineWidth = Math.max(1, ppm * 0.05);
      ctx.strokeRect(x, y, w, hgt);
    }
    if (h2 < 0.22) {
      // a branching crack
      ctx.strokeStyle = css(mix(road, [10, 5, 15], 0.5), 0.85);
      ctx.lineWidth = Math.max(1, ppm * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      let x = px + hash(tx * 3 + ty * 7) * ts;
      let y = py + hash(tx * 13 + ty * 5) * ts;
      let a = hash(tx + ty) * Math.PI * 2;
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        a += (hash(tx * 17 + ty * 19 + k) - 0.5) * 1.6;
        x += Math.cos(a) * ppm * 0.45;
        y += Math.sin(a) * ppm * 0.45;
        ctx.lineTo(x, y);
        if (k === 2) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a + 1.2) * ppm * 0.5, y + Math.sin(a + 1.2) * ppm * 0.5);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  private drawPotholes(map: GameMap, v: View, wet: boolean, time: number) {
    const { ctx, ppm } = this;
    for (const h of map.potholes) {
      if (!this.inView(h.x, h.y, 2, v)) continue;
      const x = this.sx(h.x);
      const y = this.sy(h.y);
      const r = h.r * ppm;
      const rot = h.x * 0.7;
      // broken rim
      ctx.fillStyle = 'rgba(150,130,140,0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.35, r * 1.05, rot, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = wet ? 'rgba(90,110,160,0.85)' : 'rgba(35,25,40,0.82)';
      ctx.beginPath();
      for (let k = 0; k <= 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = r * (0.8 + hash(h.x * 10 + k) * 0.35);
        const px = x + Math.cos(a + rot) * rr * 1.2;
        const py = y + Math.sin(a + rot) * rr * 0.9;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      if (wet) {
        const t = (time * 0.8 + h.y) % 1;
        ctx.strokeStyle = `rgba(230,240,255,${0.5 * (1 - t)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x, y, r * t, r * t * 0.7, rot, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // loose gravel
        ctx.fillStyle = 'rgba(200,185,180,0.7)';
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(x + (hash(h.y * 10 + k) - 0.5) * r * 3, y + (hash(h.x * 7 + k) - 0.5) * r * 2.4, Math.max(1, ppm * 0.06), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // ------------------------------------------------------ street details
  private drawStreetDetails(map: GameMap, v: View) {
    const { ctx, ppm } = this;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? T.GRASS : (map.tiles[y * map.cols + x] as T));
    const nodeOn = (i: number, j: number) => at(map.roadCols[i], map.roadRows[j]) === T.ROAD;

    // zebra crossings on each road arm leaving an intersection
    ctx.fillStyle = 'rgba(255,250,240,0.75)';
    for (let j = 0; j < map.roadRows.length; j++)
      for (let i = 0; i < map.roadCols.length; i++) {
        if (!nodeOn(i, j)) continue;
        const cx = map.roadCols[i] * TILE;
        const cy = map.roadRows[j] * TILE;
        if (!this.inView(cx + TILE, cy + TILE, 14, v)) continue;
        const S = TILE * 2;
        const stripes = (x0: number, y0: number, horiz: boolean) => {
          for (let k = 0; k < 6; k++) {
            const o = 0.5 + k * 1.2;
            if (horiz) ctx.fillRect(this.sx(x0 + o), this.sy(y0), ppm * 0.6, ppm * 1.4);
            else ctx.fillRect(this.sx(x0), this.sy(y0 + o), ppm * 1.4, ppm * 0.6);
          }
        };
        const tx = map.roadCols[i];
        const ty = map.roadRows[j];
        if (at(tx, ty - 1) === T.ROAD) stripes(cx, cy - 1.8, true);
        if (at(tx, ty + 2) === T.ROAD) stripes(cx, cy + S + 0.4, true);
        if (at(tx - 1, ty) === T.ROAD) stripes(cx - 1.8, cy, false);
        if (at(tx + 2, ty) === T.ROAD) stripes(cx + S + 0.4, cy, false);
        // manhole
        ctx.fillStyle = 'rgba(60,50,70,0.35)';
        ctx.beginPath();
        ctx.arc(this.sx(cx + S * 0.7), this.sy(cy + S * 0.3), ppm * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,250,240,0.75)';
      }

    // street names painted along the roads, between intersections
    const fs = Math.max(10, Math.round(ppm * 0.85));
    ctx.font = `600 ${fs}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,248,236,0.5)';
    const streets = this.streetNames(map);
    for (const s of streets) {
      if (!this.inView(s.x, s.y, 20, v)) continue;
      ctx.save();
      ctx.translate(this.sx(s.x), this.sy(s.y));
      if (s.vertical) ctx.rotate(-Math.PI / 2);
      ctx.fillText(s.name.toUpperCase(), 0, 0);
      ctx.restore();
    }
  }

  private streetCache: { seed: number; list: { x: number; y: number; name: string; vertical: boolean }[] } | null = null;

  private streetNames(map: GameMap) {
    if (this.streetCache && this.streetCache.seed === map.seed) return this.streetCache.list;
    const list: { x: number; y: number; name: string; vertical: boolean }[] = [];
    // read names back from the houses that face each road
    const byRow = new Map<number, string>();
    const byCol = new Map<number, string>();
    for (const b of map.buildings) {
      if (!b.street) continue;
      if (b.nx === 0) {
        const r = Math.floor((b.stopY + b.ny * 1.5) / TILE);
        const row = map.roadRows.find((rr) => rr === r || rr + 1 === r);
        if (row !== undefined) byRow.set(row, b.street);
      } else {
        const c = Math.floor((b.stopX + b.nx * 1.5) / TILE);
        const col = map.roadCols.find((cc) => cc === c || cc + 1 === c);
        if (col !== undefined) byCol.set(col, b.street);
      }
    }
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? T.GRASS : (map.tiles[y * map.cols + x] as T));
    for (const [row, name] of byRow) {
      for (let i = 0; i < map.roadCols.length - 1; i++) {
        const mid = Math.floor((map.roadCols[i] + map.roadCols[i + 1] + 2) / 2);
        if (at(mid, row) !== T.ROAD || at(mid, row + 1) !== T.ROAD) continue;
        list.push({ x: mid * TILE, y: (row + 1) * TILE - TILE * 0.5, name, vertical: false });
      }
    }
    for (const [col, name] of byCol) {
      for (let j = 0; j < map.roadRows.length - 1; j++) {
        const mid = Math.floor((map.roadRows[j] + map.roadRows[j + 1] + 2) / 2);
        if (at(col, mid) !== T.ROAD || at(col + 1, mid) !== T.ROAD) continue;
        list.push({ x: (col + 1) * TILE - TILE * 0.5, y: mid * TILE, name, vertical: true });
      }
    }
    this.streetCache = { seed: map.seed, list };
    return list;
  }

  // ------------------------------------------------------- tracks & rain
  private updateTracks(r: Rider, dt: number) {
    for (const t of this.tracks) t.t += dt;
    while (this.tracks.length && this.tracks[0].t > 7) this.tracks.shift();
    const soft = r.surface === T.GRASS || r.surface === T.SAND || r.surface === T.PATH;
    this.trackAcc += dt;
    if (soft && r.speed > 1 && this.trackAcc > 0.06) {
      this.trackAcc = 0;
      this.tracks.push({ x: r.x - Math.cos(r.heading) * 0.6, y: r.y - Math.sin(r.heading) * 0.6, a: r.heading, t: 0 });
      if (this.tracks.length > 400) this.tracks.shift();
    }
  }

  private drawTracks() {
    const { ctx, ppm } = this;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, ppm * 0.09);
    for (let i = 1; i < this.tracks.length; i++) {
      const a = this.tracks[i - 1];
      const b = this.tracks[i];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 2) continue;
      ctx.strokeStyle = `rgba(70,50,40,${0.22 * (1 - b.t / 7)})`;
      ctx.beginPath();
      ctx.moveTo(this.sx(a.x), this.sy(a.y));
      ctx.lineTo(this.sx(b.x), this.sy(b.y));
      ctx.stroke();
    }
  }

  private drawPuddles(map: GameMap, v: View, dt: number) {
    const { ctx, ppm } = this;
    // static puddles on the road
    for (let ty = Math.max(0, Math.floor(v.y0 / TILE)); ty <= Math.min(map.rows - 1, v.y1 / TILE); ty++)
      for (let tx = Math.max(0, Math.floor(v.x0 / TILE)); tx <= Math.min(map.cols - 1, v.x1 / TILE); tx++) {
        if (map.tiles[ty * map.cols + tx] !== T.ROAD || hash2(tx * 3, ty * 7) > 0.18) continue;
        const x = this.sx(tx * TILE + hash(tx + ty * 17) * TILE);
        const y = this.sy(ty * TILE + hash(tx * 5 + ty) * TILE);
        ctx.fillStyle = 'rgba(170,190,230,0.22)';
        ctx.beginPath();
        ctx.ellipse(x, y, ppm * 1.1, ppm * 0.6, hash(tx) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    // ripples
    for (let k = 0; k < 4; k++) this.puddles.push({ x: v.x0 + Math.random() * (v.x1 - v.x0), y: v.y0 + Math.random() * (v.y1 - v.y0), t: 0 });
    ctx.lineWidth = 1;
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.t += dt;
      if (p.t > 0.6) {
        this.puddles.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(230,240,255,${0.35 * (1 - p.t / 0.6)})`;
      ctx.beginPath();
      ctx.ellipse(this.sx(p.x), this.sy(p.y), ppm * p.t * 0.9, ppm * p.t * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawRain(time: number, dt: number, r: Rider) {
    const { ctx, W, H } = this;
    void dt;
    ctx.fillStyle = 'rgba(80,90,130,0.12)';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(220,230,255,0.38)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = Math.round((W * H) / 9000);
    const drift = r.speed * 2;
    for (let i = 0; i < n; i++) {
      const sp = 900 + hash(i) * 500;
      const x = ((hash(i * 7) * (W + 200) - time * (90 + drift * 10)) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((hash(i * 13) * H + time * sp) % H);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
    }
    ctx.stroke();
  }

  private drawCloudShadows(light: Light, time: number) {
    if (light.night > 0.6) return;
    const { ctx, ppm } = this;
    ctx.fillStyle = `rgba(60,40,80,${0.07 * (1 - light.night)})`;
    for (let i = 0; i < 5; i++) {
      const span = 260;
      const wx = (((hash(i * 3) * span + time * (1.2 + hash(i) * 0.8)) % span) + span) % span - 40;
      const wy = hash(i * 5 + 1) * 160;
      const rx = (14 + hash(i * 9) * 16) * ppm;
      const x = this.sx(wx);
      const y = this.sy(wy);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.55, 0.2, 0, Math.PI * 2);
      ctx.ellipse(x + rx * 0.5, y - rx * 0.2, rx * 0.6, rx * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ------------------------------------------------------ collectibles
  private drawPostcards(cards: { x: number; y: number; got: boolean }[], time: number, v: View) {
    const { ctx, ppm } = this;
    for (const c of cards) {
      if (c.got || !this.inView(c.x, c.y, 3, v)) continue;
      const x = this.sx(c.x);
      const y = this.sy(c.y) - Math.sin(time * 2.5 + c.x) * ppm * 0.25;
      const g = ctx.createRadialGradient(x, y, 0, x, y, ppm * 2.2);
      g.addColorStop(0, 'rgba(255,245,200,0.55)');
      g.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - ppm * 2.2, y - ppm * 2.2, ppm * 4.4, ppm * 4.4);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 1.8 + c.y) * 0.15);
      const w = ppm * 1.3;
      const h = ppm * 0.9;
      ctx.fillStyle = '#fff8ec';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = '#e4677b';
      ctx.lineWidth = Math.max(1, ppm * 0.08);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(0, h * 0.1);
      ctx.lineTo(w / 2, -h / 2);
      ctx.stroke();
      ctx.fillStyle = '#7cbf86';
      ctx.fillRect(w * 0.18, -h * 0.36, w * 0.22, h * 0.3);
      ctx.restore();
      // twinkle
      const tw = (time * 1.5 + c.x) % 1;
      ctx.fillStyle = `rgba(255,255,255,${1 - tw})`;
      ctx.save();
      ctx.translate(x + ppm * 0.8, y - ppm * 0.7);
      ctx.rotate(tw * 3);
      const r = ppm * 0.25 * (0.5 + tw);
      ctx.fillRect(-r, -r * 0.18, r * 2, r * 0.36);
      ctx.fillRect(-r * 0.18, -r, r * 0.36, r * 2);
      ctx.restore();
    }
  }

  // ------------------------------------------------------- traffic lights
  /** light heads: one per approach, on the right-hand side, with the axis it controls */
  private lightHeads(l: { x0: number; y0: number; x1: number; y1: number }): [number, number, 'h' | 'v'][] {
    const o = 0.7;
    return [
      [l.x0 - o, l.y1 + o, 'h'], // eastbound traffic
      [l.x1 + o, l.y0 - o, 'h'], // westbound
      [l.x0 - o, l.y0 - o, 'v'], // southbound
      [l.x1 + o, l.y1 + o, 'v'], // northbound
    ];
  }

  private drawStopLines(map: GameMap, v: View) {
    const { ctx, ppm } = this;
    ctx.fillStyle = 'rgba(255,250,240,0.85)';
    const w = Math.max(2, ppm * 0.4);
    for (const l of map.lights) {
      if (!this.inView((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 12, v)) continue;
      const mx = (l.x0 + l.x1) / 2;
      const my = (l.y0 + l.y1) / 2;
      // only the lane that drives into the junction gets a line
      ctx.fillRect(this.sx(l.x0 - 0.6), this.sy(my), w, (l.y1 - my) * ppm);
      ctx.fillRect(this.sx(l.x1 + 0.6) - w, this.sy(l.y0), w, (my - l.y0) * ppm);
      ctx.fillRect(this.sx(l.x0), this.sy(l.y0 - 0.6), (mx - l.x0) * ppm, w);
      ctx.fillRect(this.sx(mx), this.sy(l.y1 + 0.6) - w, (l.x1 - mx) * ppm, w);
    }
  }

  private drawTrafficLights(map: GameMap, time: number, v: View) {
    const { ctx, ppm } = this;
    for (const l of map.lights) {
      if (!this.inView((l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2, 12, v)) continue;
      for (const [x, y, ax] of this.lightHeads(l)) {
        const sg = signal(l, time, ax);
        const px = this.sx(x);
        const py = this.sy(y);
        ctx.fillStyle = SHADOW;
        ctx.beginPath();
        ctx.arc(px + ppm * 0.25, py + ppm * 0.2, ppm * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // housing with three lamps, laid out across the approach
        const vertical = ax === 'h';
        const L = ppm * 1.25;
        const W = ppm * 0.5;
        ctx.fillStyle = '#2e2a36';
        ctx.beginPath();
        if (vertical) ctx.roundRect(px - W / 2, py - L / 2, W, L, W * 0.4);
        else ctx.roundRect(px - L / 2, py - W / 2, L, W, W * 0.4);
        ctx.fill();
        const cols: ['red' | 'yellow' | 'green', string, string][] = [['red', '#ff4b4b', '#5a2a2a'], ['yellow', '#ffd23f', '#5a4a2a'], ['green', '#5cf08a', '#2a4a34']];
        cols.forEach(([name, on, off], i) => {
          const k = (i - 1) * L * 0.32;
          const cx = vertical ? px : px + k;
          const cy = vertical ? py + k : py;
          const lit = name === sg;
          ctx.fillStyle = lit ? on : off;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1.5, W * 0.3), 0, Math.PI * 2);
          ctx.fill();
          if (lit) {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ppm * 0.9);
            g.addColorStop(0, on + '88');
            g.addColorStop(1, on + '00');
            ctx.fillStyle = g;
            ctx.fillRect(cx - ppm * 0.9, cy - ppm * 0.9, ppm * 1.8, ppm * 1.8);
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------- quests
  private drawQuestWorld(q: Quests, time: number, v: View) {
    const { ctx, ppm } = this;
    const qc = QUEST_COLOR.join(',');
    // townsfolk waiting at their door with something to ask
    for (const giver of q.givers) {
      if (!this.inView(giver.stopX, giver.stopY, 3, v)) continue;
      const fx = giver.doorX + giver.nx * 1.2;
      const fy = giver.doorY + giver.ny * 1.2;
      this.person(fx, fy, Math.atan2(giver.ny, giver.nx), 0, '#c9a3ff', '#4a3428', Math.sin(time * 1.2 + giver.id) > 0.4 ? time : 0);
      const bob = Math.sin(time * 3 + giver.id) * ppm * 0.2;
      const bx = this.sx(fx);
      const by = this.sy(fy) - ppm * 1.6 + bob;
      const r = Math.max(9, ppm * 0.55);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#5a3550';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5a3550';
      ctx.font = `800 ${Math.round(r * 1.3)}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', bx, by + 1);
      // talk ring
      ctx.strokeStyle = `rgba(${qc},0.8)`;
      ctx.setLineDash([ppm * 0.4, ppm * 0.3]);
      ctx.lineDashOffset = -time * ppm;
      ctx.beginPath();
      ctx.arc(this.sx(giver.stopX), this.sy(giver.stopY), ppm * 2.0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // active quest objectives
    for (const quest of q.active) {
      quest.steps.forEach((st, i) => {
        if (i < quest.step) return;
        if (!this.inView(st.x, st.y, 4, v)) return;
        const cur = i === quest.step;
        const x = this.sx(st.x);
        const y = this.sy(st.y);
        if (st.ring) {
          // checkpoint arch
          const R = ppm * 3.2;
          ctx.strokeStyle = cur ? `rgba(${qc},0.95)` : `rgba(${qc},0.3)`;
          ctx.lineWidth = Math.max(3, ppm * (cur ? 0.35 : 0.2));
          ctx.beginPath();
          ctx.arc(x, y, R * (cur ? 1 + 0.06 * Math.sin(time * 6) : 1), 0, Math.PI * 2);
          ctx.stroke();
          if (cur) {
            ctx.fillStyle = `rgba(${qc},0.15)`;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = `700 ${Math.round(ppm * 0.9)}px Outfit, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), x, y);
          }
          return;
        }
        if (!cur) return;
        const g = ctx.createRadialGradient(x, y, 0, x, y, ppm * 3);
        g.addColorStop(0, `rgba(${qc},${0.55 + 0.2 * Math.sin(time * 4)})`);
        g.addColorStop(1, `rgba(${qc},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - ppm * 3, y - ppm * 3, ppm * 6, ppm * 6);
        if (st.icon && quest.kind === 'lost' && i === 0) {
          // the lost item lying in the grass
          ctx.font = `${Math.round(ppm * 1.1)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(st.icon, x, y + Math.sin(time * 3) * ppm * 0.1);
        }
      });
    }
  }

  private drawQuestGuides(q: Quests, r: Rider, time: number, hasOrders: boolean) {
    const col = `rgb(${QUEST_COLOR.join(',')})`;
    q.active.forEach((quest, i) => {
      const st = q.current(quest);
      if (st) this.guide(r, st.x, st.y, col, !hasOrders && i === 0, time, false, 4 + i);
    });
  }

  // ------------------------------------------------------------ secrets
  private drawSecrets(list: (Secret & { got: boolean })[], r: Rider, light: Light, time: number, v: View) {
    const { ctx, ppm } = this;
    for (const s of list) {
      if (s.got || !this.inView(s.x, s.y, 3, v)) continue;
      if (s.night && light.night < 0.6) continue;
      const x = this.sx(s.x);
      const y = this.sy(s.y);
      const near = Math.hypot(r.x - s.x, r.y - s.y);
      // a faint twinkle when you're getting close
      if (near < 12) {
        const tw = (time * 1.2 + s.x) % 1;
        ctx.fillStyle = `rgba(255,250,220,${0.8 * (1 - tw) * (1 - near / 12)})`;
        for (let k = 0; k < 3; k++) {
          const a = time * 1.5 + (k / 3) * Math.PI * 2;
          const rr = Math.max(2, ppm * 0.14);
          ctx.fillRect(x + Math.cos(a) * ppm * 1.1 - rr / 2, y + Math.sin(a) * ppm * 0.8 - rr / 2, rr, rr);
        }
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(ppm, ppm);
      switch (s.kind) {
        case 'chest': {
          ctx.fillStyle = 'rgba(50,25,50,0.25)';
          ctx.fillRect(-0.4, -0.2, 1.0, 0.7);
          ctx.fillStyle = '#8a5a34';
          ctx.fillRect(-0.5, -0.35, 1.0, 0.7);
          ctx.fillStyle = '#a86e40';
          ctx.fillRect(-0.5, -0.35, 1.0, 0.25);
          ctx.fillStyle = '#d9a441';
          ctx.fillRect(-0.5, -0.12, 1.0, 0.07);
          ctx.fillRect(-0.08, -0.2, 0.16, 0.22);
          break;
        }
        case 'kitten': {
          const wig = Math.sin(time * 6) * 0.1;
          ctx.fillStyle = '#f0a25e';
          ctx.beginPath();
          ctx.ellipse(0, 0, 0.26, 0.18, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0.24, -0.05, 0.13, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0.18, -0.15);
          ctx.lineTo(0.22, -0.28);
          ctx.lineTo(0.28, -0.16);
          ctx.moveTo(0.28, -0.14);
          ctx.lineTo(0.35, -0.26);
          ctx.lineTo(0.37, -0.12);
          ctx.fill();
          ctx.strokeStyle = '#f0a25e';
          ctx.lineWidth = 0.06;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-0.25, 0);
          ctx.quadraticCurveTo(-0.4, -0.1 + wig, -0.42, -0.25 + wig);
          ctx.stroke();
          break;
        }
        case 'gnome': {
          ctx.fillStyle = 'rgba(50,25,50,0.25)';
          ctx.beginPath();
          ctx.arc(0.08, 0.08, 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4f7fbf';
          ctx.beginPath();
          ctx.arc(0, 0.05, 0.24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f6f1e4';
          ctx.beginPath();
          ctx.arc(0, 0.1, 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e4344a';
          ctx.beginPath();
          ctx.moveTo(-0.17, -0.05);
          ctx.lineTo(0.17, -0.05);
          ctx.lineTo(0.02, -0.45);
          ctx.fill();
          break;
        }
        case 'stargazer': {
          // blanket, telescope on a tripod, and its owner looking up
          ctx.fillStyle = '#6f6ad1';
          ctx.fillRect(-0.9, -0.6, 1.4, 1.2);
          ctx.strokeStyle = '#d9d2e6';
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.moveTo(0.6, 0);
          ctx.lineTo(1.4, -0.5);
          ctx.stroke();
          ctx.fillStyle = '#c9b3f2';
          ctx.save();
          ctx.translate(1.1, -0.3);
          ctx.rotate(-0.55);
          ctx.fillRect(-0.45, -0.1, 0.9, 0.2);
          ctx.restore();
          break;
        }
      }
      ctx.restore();
      if (s.kind === 'stargazer') {
        this.person(s.x - 0.2, s.y, -Math.PI / 2, 0, '#c9b3f2', '#e9d3a3');
        // a faint glow and a shooting star overhead
        const g = ctx.createRadialGradient(x, y, 0, x, y, ppm * 3);
        g.addColorStop(0, 'rgba(200,190,255,0.25)');
        g.addColorStop(1, 'rgba(200,190,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - ppm * 3, y - ppm * 3, ppm * 6, ppm * 6);
      }
      if (s.kind === 'kitten' && near < 9 && Math.sin(time * 1.7 + s.x) > 0.7) this.bubble(s.x, s.y, '?');
    }
  }

  // ----------------------------------------------------------- critters
  private person(x: number, y: number, facing: number, phase: number, shirt: string, hair: string, wave = 0) {
    const { ctx, ppm } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    ctx.rotate(facing);
    ctx.scale(ppm * 1.3, ppm * 1.3);
    const leg = Math.sin(phase) * 0.18;
    ctx.fillStyle = '#4b4a7a';
    ctx.beginPath();
    ctx.ellipse(leg, -0.12, 0.13, 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(-leg, 0.12, 0.13, 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.17, 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    if (wave) {
      ctx.strokeStyle = '#f2c4a0';
      ctx.lineWidth = 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0.22);
      ctx.lineTo(0.25 + Math.sin(wave * 9) * 0.12, 0.5);
      ctx.stroke();
    }
    ctx.fillStyle = '#f2c4a0';
    ctx.beginPath();
    ctx.arc(0.02, 0, 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(-0.02, 0, 0.13, Math.PI * 0.4, Math.PI * 1.6);
    ctx.fill();
    ctx.restore();
  }

  private bubble(x: number, y: number, text: string) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const py = this.sy(y) - ppm * 1.2;
    const r = Math.max(8, ppm * 0.45);
    ctx.fillStyle = 'rgba(255,250,240,0.95)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b35d72';
    ctx.font = `600 ${Math.round(r * 1.2)}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px, py + 1);
  }

  private drawWalkers(c: Critters, time: number, v: View) {
    const { ctx, ppm } = this;
    for (const w of c.walkers) {
      if (!w.active || !this.inView(w.x, w.y, 3, v)) continue;
      const facing = this.walkerFacing(w);
      if (w.dog) {
        // leash
        ctx.strokeStyle = 'rgba(60,40,50,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.sx(w.x), this.sy(w.y));
        ctx.lineTo(this.sx(w.dog.x), this.sy(w.dog.y));
        ctx.stroke();
        ctx.save();
        ctx.translate(this.sx(w.dog.x), this.sy(w.dog.y));
        ctx.rotate(facing);
        ctx.scale(ppm, ppm);
        ctx.fillStyle = w.dog.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.3, 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0.3, 0, 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = w.dog.color;
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(-0.28, 0);
        ctx.lineTo(-0.45, Math.sin(w.dog.wag) * 0.12);
        ctx.stroke();
        ctx.fillStyle = 'rgba(60,40,40,0.6)';
        ctx.beginPath();
        ctx.ellipse(0.32, -0.1, 0.06, 0.04, 0, 0, Math.PI * 2);
        ctx.ellipse(0.32, 0.1, 0.06, 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      this.person(w.x, w.y, facing, w.pause > 0 ? 0 : w.phase, w.shirt, w.hair, w.happy > 0 ? time : 0);
      if (w.bumped > 0) this.bubble(w.x, w.y, '!');
      else if (w.happy > 0) this.bubble(w.x, w.y, '♪');
    }
  }

  private walkerFacing(w: Walker) {
    if (w.happy > 0 || w.pause > 0) return w.axis === 'x' ? (w.side > 0 ? -Math.PI / 2 : Math.PI / 2) : w.side > 0 ? Math.PI : 0;
    return w.axis === 'x' ? (w.dir > 0 ? 0 : Math.PI) : w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private drawCats(c: Critters, time: number, v: View) {
    const { ctx, ppm } = this;
    for (const cat of c.cats) {
      if (!this.inView(cat.x, cat.y, 2, v)) continue;
      ctx.save();
      ctx.translate(this.sx(cat.x), this.sy(cat.y));
      ctx.scale(ppm, ppm);
      ctx.fillStyle = cat.color;
      if (cat.awake > 0) {
        ctx.rotate(Math.atan2(cat.vy, cat.vx));
        ctx.beginPath();
        ctx.ellipse(0, 0, 0.32, 0.13, 0, 0, Math.PI * 2);
        ctx.arc(0.32, 0, 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = cat.color;
        ctx.lineWidth = 0.06;
        ctx.beginPath();
        ctx.moveTo(-0.3, 0);
        ctx.quadraticCurveTo(-0.5, 0.2, -0.55, Math.sin(time * 12) * 0.15);
        ctx.stroke();
      } else {
        // curled up asleep, tail swishing, z z z
        ctx.beginPath();
        ctx.arc(0, 0, 0.26, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0.18, -0.12, 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = cat.color;
        ctx.lineWidth = 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, 0.32, Math.PI * 0.2, Math.PI * (0.9 + Math.sin(time * 1.5 + cat.homeX) * 0.15));
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '600 0.3px Outfit, system-ui, sans-serif';
        const z = (time * 0.6 + cat.homeY) % 1;
        ctx.globalAlpha = 1 - z;
        ctx.fillText('z', 0.2 + z * 0.3, -0.4 - z * 0.5);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  private drawDucks(c: Critters, time: number) {
    const { ctx, ppm } = this;
    for (const d of c.ducks) {
      const x = d.cx + Math.cos(d.a) * d.r;
      const y = d.cy + Math.sin(d.a) * d.r;
      const head = d.a + (d.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.save();
      ctx.translate(this.sx(x), this.sy(y));
      ctx.rotate(head);
      ctx.scale(ppm * (d.baby ? 0.6 : 1), ppm * (d.baby ? 0.6 : 1));
      // wake
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.15);
      ctx.lineTo(-0.8, -0.35 - Math.sin(time * 3) * 0.05);
      ctx.moveTo(-0.3, 0.15);
      ctx.lineTo(-0.8, 0.35 + Math.sin(time * 3) * 0.05);
      ctx.stroke();
      ctx.fillStyle = d.baby ? '#ffe08a' : '#f6f1e4';
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.32, 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = d.baby ? '#ffd060' : '#4f9a6a';
      ctx.beginPath();
      ctx.arc(0.25, 0, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a03d';
      ctx.fillRect(0.34, -0.04, 0.1, 0.08);
      ctx.restore();
    }
  }

  // --------------------------------------------------------- animations
  private drawCustomers(dt: number, time: number) {
    const { ctx, ppm } = this;
    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      c.t += dt;
      if (c.t > 4.2) {
        this.customers.splice(i, 1);
        continue;
      }
      const b = c.b;
      // pop out of the door, wave, then step back in
      const out = c.t < 0.4 ? c.t / 0.4 : c.t > 3.7 ? Math.max(0, (4.2 - c.t) / 0.5) : 1;
      const x = b.doorX + b.nx * (0.3 + out * 0.9);
      const y = b.doorY + b.ny * (0.3 + out * 0.9);
      const facing = Math.atan2(b.ny, b.nx);
      const pop = 1 + Math.max(0, 0.25 - Math.abs(c.t - 0.45)) * 1.2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, out * 1.5);
      const px = this.sx(x);
      const py = this.sy(y);
      ctx.translate(px, py);
      ctx.scale(pop, pop);
      ctx.translate(-px, -py);
      this.person(x, y, facing, 0, c.shirt, '#4a3428', c.t > 0.4 && c.t < 3.7 ? time : 0);
      // the parcel they're holding
      ctx.fillStyle = '#d6a870';
      ctx.fillRect(this.sx(x + b.nx * 0.3) - ppm * 0.2, this.sy(y + b.ny * 0.3) - ppm * 0.2, ppm * 0.4, ppm * 0.4);
      ctx.restore();
      if (c.hearts) {
        for (let k = 0; k < 3; k++) {
          const ht = c.t - 0.4 - k * 0.35;
          if (ht < 0 || ht > 1.6) continue;
          const hx = this.sx(x) + Math.sin(ht * 4 + k) * ppm * 0.4 + (k - 1) * ppm * 0.4;
          const hy = this.sy(y) - ppm * (0.8 + ht * 1.6);
          this.heart(hx, hy, ppm * 0.28, `rgba(255,120,150,${1 - ht / 1.6})`);
        }
      }
    }
  }

  private heart(cx: number, cy: number, s: number, fill: string) {
    const { ctx } = this;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.4, cy, cx - s * 0.7, cy - s, cx, cy - s * 0.3);
    ctx.bezierCurveTo(cx + s * 0.7, cy - s, cx + s * 1.4, cy, cx, cy + s * 0.9);
    ctx.fill();
  }

  private drawTosses(dt: number) {
    const { ctx, ppm } = this;
    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const t = this.tosses[i];
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      if (t.t > t.dur + 0.05) {
        this.tosses.splice(i, 1);
        continue;
      }
      const x = t.x0 + (t.x1 - t.x0) * k;
      const y = t.y0 + (t.y1 - t.y0) * k;
      const h = Math.sin(k * Math.PI); // height of the arc → scale + shadow offset
      const s = ppm * 0.5 * (1 + h * 0.8);
      ctx.fillStyle = 'rgba(50,25,50,0.2)';
      ctx.beginPath();
      ctx.ellipse(this.sx(x), this.sy(y), s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(this.sx(x), this.sy(y) - h * ppm * 1.6);
      ctx.rotate(k * Math.PI * 2);
      ctx.fillStyle = css(t.color);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.fillStyle = 'rgba(90,50,40,0.35)';
      ctx.fillRect(-s * 0.08, -s / 2, s * 0.16, s);
      ctx.restore();
    }
  }

  private drawFloaters(dt: number) {
    const { ctx } = this;
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const dur = f.big ? 2.2 : 1.6;
      if (f.t > dur) {
        this.floaters.splice(i, 1);
        continue;
      }
      const k = f.t / dur;
      const pop = f.t < 0.15 ? 0.6 + (f.t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (f.t - 0.15) * 1.5);
      const x = this.sx(f.x);
      const y = this.sy(f.y) - k * 50 - 20;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.font = `600 ${f.big ? 22 : 17}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(60,25,60,0.55)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
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
