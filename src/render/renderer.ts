import type { Bike } from '../game/bike';
import type { Deliveries, House } from '../game/delivery';
import { clamp, css, damp, fbm1, hash, hash2, hex, lerp, mix, type RGB } from '../game/math';
import type { Palette } from '../game/palette';
import { groundY } from '../game/terrain';
import { drawBike } from './bikeDraw';
import { Particles } from './particles';

interface Layer {
  parallax: number;
  base: number; // layer meters above the horizon line
  amp: number;
  freq: number;
  seed: number;
  color: keyof Palette;
  haze: number; // blend towards horizon colour
  deco: 'peaks' | 'trees' | 'houses';
}

const LAYERS: Layer[] = [
  { parallax: 0.06, base: 5, amp: 16, freq: 0.012, seed: 11, color: 'far', haze: 0.45, deco: 'peaks' },
  { parallax: 0.16, base: 1, amp: 10, freq: 0.02, seed: 23, color: 'mid', haze: 0.25, deco: 'trees' },
  { parallax: 0.36, base: -3, amp: 7, freq: 0.03, seed: 37, color: 'near', haze: 0.1, deco: 'houses' },
];

const ROAD_THICK = 0.42;
const PROP_CELL = 9;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private dpr = 1;
  ppm = 40; // pixels per meter
  camX = 0;
  camY = 0;
  private grain: CanvasPattern | null = null;
  private vignette: CanvasGradient | null = null;
  particles = new Particles();
  private camInit = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.makeGrain();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.canvas.style.width = `${this.W}px`;
    this.canvas.style.height = `${this.H}px`;
    const g = this.ctx.createRadialGradient(
      this.W / 2, this.H * 0.48, Math.min(this.W, this.H) * 0.35,
      this.W / 2, this.H * 0.5, Math.hypot(this.W, this.H) * 0.62,
    );
    g.addColorStop(0, 'rgba(40,10,40,0)');
    g.addColorStop(1, 'rgba(40,10,40,0.42)');
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
      img.data[i + 3] = 22;
    }
    g.putImageData(img, 0, 0);
    this.grain = this.ctx.createPattern(c, 'repeat');
  }

  private sx(x: number) {
    return (x - this.camX) * this.ppm + this.W / 2;
  }
  private sy(y: number) {
    return this.H * 0.58 - (y - this.camY) * this.ppm;
  }

  updateCamera(bike: Bike, dt: number) {
    const speed = bike.displaySpeed;
    const portrait = this.H > this.W;
    const base = clamp(Math.min(this.H / 12.5, this.W / (portrait ? 9.5 : 15)), 28, 82);
    const targetPpm = base * (1 - 0.14 * clamp(speed / 14, 0, 1)) * (bike.airborne ? 0.94 : 1);
    const viewW = this.W / this.ppm;
    const ahead = viewW * (0.1 + 0.1 * clamp(speed / 14, 0, 1));
    const tx = bike.x + ahead;
    const ty = (bike.airborne ? lerp(bike.y, groundY(bike.x), 0.4) : bike.y) + 1.2;
    if (!this.camInit) {
      this.camX = tx;
      this.camY = ty;
      this.ppm = targetPpm;
      this.camInit = true;
    }
    this.ppm += (targetPpm - this.ppm) * damp(1.5, dt);
    this.camX += (tx - this.camX) * damp(4, dt);
    this.camY += (ty - this.camY) * damp(2.5, dt);
  }

  private reserved: number[] = [];

  render(bike: Bike, pal: Palette, time: number, dt: number, del: Deliveries | null) {
    this.reserved = del ? del.reserved() : [];
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    const sky = this.drawSky(pal, time);
    this.drawSun(pal, sky, time);
    this.drawClouds(pal, time);
    this.drawBirds(pal, time);
    for (const l of LAYERS) this.drawLayer(l, pal, time);
    this.drawProps(pal, time, false);
    if (del) this.drawDeliveryWorld(del, pal, time);
    this.drawGround(pal);
    this.drawProps(pal, time, true);
    this.drawRider(bike, pal, time, del);
    this.particles.update(dt, bike, pal, this.camX, this.camY, this.W / this.ppm, this.H / this.ppm);
    this.particles.draw(ctx, pal, (x) => this.sx(x), (y) => this.sy(y), this.ppm, time);
    this.drawForegroundGrass(pal, time);
    this.post(pal);
  }

  // ---------------------------------------------------------------- sky
  private drawSky(pal: Palette, time: number): CanvasGradient {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.78);
    g.addColorStop(0, css(pal.skyTop));
    g.addColorStop(0.55, css(pal.skyMid));
    g.addColorStop(1, css(pal.skyHorizon));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (pal.night > 0.25) {
      const a = clamp((pal.night - 0.25) / 0.6, 0, 1);
      const drift = this.camX * 0.01;
      for (let i = 0; i < 140; i++) {
        const x = ((hash(i * 3) * W * 1.5 - drift * 8) % (W * 1.5) + W * 1.5) % (W * 1.5) - W * 0.25;
        const y = hash(i * 3 + 1) * H * 0.6;
        const tw = 0.55 + 0.45 * Math.sin(time * (1 + hash(i) * 2) + i);
        const r = hash(i * 3 + 2) < 0.08 ? 1.6 : 0.9;
        ctx.fillStyle = `rgba(255,250,240,${a * tw * (1 - y / (H * 0.7))})`;
        ctx.fillRect(x, y, r, r);
      }
    }
    return g;
  }

  private drawSun(pal: Palette, sky: CanvasGradient, time: number) {
    const { ctx, W, H } = this;
    const minDim = Math.min(W, H);
    const night = pal.night;

    // Sun sinks as night falls
    const sunR = minDim * 0.16;
    const sunX = W * 0.68;
    const sunY = H * 0.43 + night * H * 0.45;
    const sunA = clamp(1 - night * 1.3, 0, 1);
    if (sunA > 0) {
      const glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.4, sunX, sunY, sunR * 3.4);
      glow.addColorStop(0, css(pal.sunGlow, 0.55 * sunA));
      glow.addColorStop(1, css(pal.sunGlow, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      const disc = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
      disc.addColorStop(0, css(pal.sun, sunA));
      disc.addColorStop(1, css(pal.sunGlow, sunA));
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = disc;
      ctx.fill();

      // retro horizontal cut-outs, slowly scrolling
      ctx.save();
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunR + 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = sky;
      const scroll = (time * 6) % (sunR * 0.22);
      for (let i = 0; i < 7; i++) {
        const y = sunY + sunR * 0.08 + i * sunR * 0.22 + scroll;
        const h = (sunR * 0.02) * (1 + i * 0.9);
        ctx.fillRect(sunX - sunR - 2, y, sunR * 2 + 4, h);
      }
      ctx.restore();
    }

    // Moon
    const moonA = clamp((night - 0.45) / 0.4, 0, 1);
    if (moonA > 0) {
      const mx = W * 0.24;
      const my = H * 0.2 + (1 - moonA) * H * 0.15;
      const mr = minDim * 0.055;
      const glow = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 5);
      glow.addColorStop(0, `rgba(200,210,255,${0.25 * moonA})`);
      glow.addColorStop(1, 'rgba(200,210,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(250,246,235,${moonA})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.92, 0, Math.PI * 2);
      ctx.globalAlpha = moonA;
      ctx.fillStyle = sky;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawClouds(pal: Palette, time: number) {
    const { ctx, W, H } = this;
    const span = W + 600;
    for (let i = 0; i < 7; i++) {
      const speed = 6 + hash(i * 5) * 10;
      const par = 0.02 + hash(i * 5 + 1) * 0.04;
      const raw = hash(i * 5 + 2) * span - time * speed - this.camX * this.ppm * par;
      const x = ((raw % span) + span) % span - 300;
      const y = H * (0.08 + hash(i * 5 + 3) * 0.32);
      const s = (0.6 + hash(i * 5 + 4) * 0.9) * Math.min(W, H) * 0.0016;
      ctx.fillStyle = css(pal.cloud, 0.55 - pal.night * 0.25);
      ctx.beginPath();
      ctx.ellipse(x, y, 90 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 40 * s, y - 10 * s, 40 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 18 * s, y - 18 * s, 50 * s, 28 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 62 * s, y - 6 * s, 32 * s, 16 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBirds(pal: Palette, time: number) {
    if (pal.night > 0.6) return;
    const { ctx, W, H } = this;
    const period = 38;
    const flock = Math.floor(time / period);
    if (hash(flock * 11) < 0.35) return;
    const t = (time % period) / period;
    const baseX = W * 1.1 - t * W * 1.4;
    const baseY = H * (0.15 + hash(flock * 11 + 1) * 0.2);
    ctx.strokeStyle = css(mix(pal.near, pal.skyTop, 0.3), 0.75);
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    const n = 3 + Math.floor(hash(flock * 11 + 2) * 4);
    for (let i = 0; i < n; i++) {
      const row = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const bx = baseX + row * 16;
      const by = baseY + row * 9 * side + Math.sin(time * 1.3 + i) * 3;
      const flap = Math.sin(time * 8 + i * 1.7) * 3.5;
      ctx.beginPath();
      ctx.moveTo(bx - 7, by - flap);
      ctx.quadraticCurveTo(bx - 3, by - 2, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 2, bx + 7, by - flap);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------- parallax
  private drawLayer(l: Layer, pal: Palette, time: number) {
    const { ctx, W, H } = this;
    // Layers scroll at a fraction of the camera and use a fixed pixel scale.
    const scale = (H / 100) * (0.6 + l.parallax);
    const offset = this.camX * l.parallax * this.ppm;
    const horizon = H * 0.62 + (this.camY * this.ppm * l.parallax * 0.35);
    const color = mix(pal[l.color] as RGB, pal.skyHorizon, l.haze);
    const ridge = (px: number) => {
      const wx = (px + offset) / scale;
      const n = fbm1(wx * l.freq, l.seed, 4);
      const peaky = l.deco === 'peaks' ? Math.pow(n, 1.6) * 1.5 : n;
      return horizon - (l.base + peaky * l.amp) * scale;
    };

    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = -8; px <= W + 8; px += 8) ctx.lineTo(px, ridge(px));
    ctx.lineTo(W, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, horizon - l.amp * scale, 0, H);
    g.addColorStop(0, css(color));
    g.addColorStop(1, css(mix(color, pal.groundDeep, 0.35)));
    ctx.fillStyle = g;
    ctx.fill();

    if (l.deco === 'peaks') {
      // soft snow-ish highlights catching the sun
      ctx.strokeStyle = css(mix(color, pal.sun, 0.35), 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let px = -8; px <= W + 8; px += 8) {
        const y = ridge(px);
        if (px === -8) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      return;
    }

    // Decorations sit on the ridge, placed in this layer's own world space
    const cell = l.deco === 'trees' ? 26 : 70;
    const first = Math.floor((offset - 40) / cell);
    const last = Math.ceil((offset + W + 40) / cell);
    const deco = mix(color, pal.groundDeep, 0.12);
    for (let c = first; c <= last; c++) {
      const r = hash2(c, l.seed);
      if (l.deco === 'trees') {
        if (r < 0.25) continue;
        const px = c * cell - offset + hash2(c, 3) * cell * 0.6;
        const y = ridge(px) + 2;
        const h = (14 + r * 18) * (scale / 9);
        ctx.fillStyle = css(deco);
        ctx.beginPath();
        if (r > 0.6) {
          ctx.moveTo(px - h * 0.28, y);
          ctx.lineTo(px, y - h);
          ctx.lineTo(px + h * 0.28, y);
        } else {
          ctx.moveTo(px + h * 0.36, y - h * 0.55);
          ctx.arc(px, y - h * 0.55, h * 0.36, 0, Math.PI * 2);
          ctx.rect(px - 1, y - h * 0.3, 2, h * 0.3);
        }
        ctx.fill();
      } else {
        if (r < 0.45) continue;
        const px = c * cell - offset + hash2(c, 5) * cell * 0.4;
        const y = ridge(px) + 3;
        const s = scale / 9;
        const w = (22 + hash2(c, 7) * 16) * s;
        const h = (16 + hash2(c, 9) * 10) * s;
        ctx.fillStyle = css(deco);
        ctx.beginPath();
        ctx.rect(px - w / 2, y - h, w, h);
        ctx.moveTo(px - w / 2 - 3 * s, y - h);
        ctx.lineTo(px, y - h - w * 0.45);
        ctx.lineTo(px + w / 2 + 3 * s, y - h);
        ctx.fill();
        // window lights come on at dusk
        const lit = clamp((pal.night - 0.2) / 0.4, 0, 1);
        const win = hash2(c, 13) > 0.3;
        const glowCol = `rgba(255,214,140,${0.25 + 0.7 * lit})`;
        ctx.fillStyle = win && lit > 0 ? glowCol : css(mix(deco, pal.skyHorizon, 0.25));
        const ws = 5 * s;
        ctx.fillRect(px - w * 0.25 - ws / 2, y - h * 0.62, ws, ws);
        if (hash2(c, 17) > 0.4) ctx.fillRect(px + w * 0.25 - ws / 2, y - h * 0.62, ws, ws);
        if (lit > 0 && win) {
          const gl = ctx.createRadialGradient(px, y - h * 0.6, 0, px, y - h * 0.6, w);
          gl.addColorStop(0, `rgba(255,200,120,${0.18 * lit})`);
          gl.addColorStop(1, 'rgba(255,200,120,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(px - w, y - h * 0.6 - w, w * 2, w * 2);
        }
      }
    }
    void time;
  }

  // ------------------------------------------------------------- ground
  private drawGround(pal: Palette) {
    const { ctx, W, H, ppm } = this;
    const x0 = this.camX - W / 2 / ppm - 1;
    const x1 = this.camX + W / 2 / ppm + 1;
    const step = Math.max(0.25, 6 / ppm);

    const top: [number, number][] = [];
    for (let x = x0; x <= x1 + step; x += step) top.push([this.sx(x), this.sy(groundY(x))]);

    // earth under the road
    ctx.beginPath();
    ctx.moveTo(top[0][0], H);
    for (const [px, py] of top) ctx.lineTo(px, py);
    ctx.lineTo(top[top.length - 1][0], H);
    ctx.closePath();
    const minY = Math.min(...top.map((p) => p[1]));
    const g = ctx.createLinearGradient(0, minY, 0, H);
    g.addColorStop(0, css(mix(pal.ground, pal.foliage, 0.12)));
    g.addColorStop(1, css(pal.ground));
    ctx.fillStyle = g;
    ctx.fill();

    // soil strata following the road profile, for a cut-away look
    const strata: [number, number][] = [
      [1.6, 0.22],
      [4.2, 0.42],
      [8, 0.62],
      [13, 0.8],
    ];
    for (const [depth, k] of strata) {
      ctx.beginPath();
      ctx.moveTo(top[0][0], H);
      top.forEach(([px, py], i) => {
        const wav = Math.sin((x0 + i * step) * 0.21 + depth) * 0.35 * ppm;
        ctx.lineTo(px, py + depth * ppm + wav);
      });
      ctx.lineTo(top[top.length - 1][0], H);
      ctx.closePath();
      ctx.fillStyle = css(mix(pal.ground, pal.groundDeep, k));
      ctx.fill();
    }

    // road band
    const t = ROAD_THICK * ppm;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (const [px, py] of top) ctx.lineTo(px, py);
    for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + t);
    ctx.closePath();
    ctx.fillStyle = css(pal.road);
    ctx.fill();

    // curb highlight
    ctx.beginPath();
    top.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.strokeStyle = css(mix(pal.road, pal.roadLine, 0.45));
    ctx.lineWidth = Math.max(1.5, ppm * 0.045);
    ctx.stroke();

    // dashed centre line, drawn along the surface
    ctx.strokeStyle = css(pal.roadLine, 0.85);
    ctx.lineWidth = Math.max(1.2, ppm * 0.05);
    ctx.beginPath();
    const dash = 2.4;
    for (let d = Math.floor(x0 / (dash * 2)) * dash * 2; d < x1; d += dash * 2) {
      const a = d;
      const b = d + dash;
      ctx.moveTo(this.sx(a), this.sy(groundY(a)) + t * 0.5);
      for (let x = a + 0.4; x <= b; x += 0.4) ctx.lineTo(this.sx(x), this.sy(groundY(x)) + t * 0.5);
    }
    ctx.stroke();

    // grass lip below the road and little tufts in the earth
    ctx.fillStyle = css(mix(pal.ground, pal.foliage, 0.35));
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1] + t);
    for (const [px, py] of top) ctx.lineTo(px, py + t);
    for (let i = top.length - 1; i >= 0; i--) ctx.lineTo(top[i][0], top[i][1] + t + ppm * 0.12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = css(mix(pal.ground, pal.groundDeep, 0.4), 0.6);
    for (let c = Math.floor(x0 / 1.3); c < x1 / 1.3; c++) {
      const r = hash(c * 19 + 7);
      if (r < 0.5) continue;
      const x = c * 1.3 + r;
      const px = this.sx(x);
      const py = this.sy(groundY(x)) + t + ppm * (0.5 + hash(c * 19 + 3) * 2.5);
      ctx.beginPath();
      ctx.ellipse(px, py, ppm * (0.15 + r * 0.25), ppm * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // -------------------------------------------------------------- props
  private drawProps(pal: Palette, time: number, front: boolean) {
    const { ppm, W } = this;
    const x0 = this.camX - W / 2 / ppm - 8;
    const x1 = this.camX + W / 2 / ppm + 8;
    for (let c = Math.floor(x0 / PROP_CELL); c <= Math.ceil(x1 / PROP_CELL); c++) {
      if (c < 1) continue;
      const r = hash(c * 101 + 17);
      const x = c * PROP_CELL + hash(c * 101 + 3) * PROP_CELL * 0.6;
      const isFront = hash(c * 101 + 29) < 0.18;
      if (front !== isFront) continue;
      if (!front && this.reserved.some((r) => Math.abs(r - x) < 9 || Math.abs(r - c * PROP_CELL) < 9)) continue;
      const kmMark = c % Math.round(1000 / PROP_CELL) === 0;
      if (kmMark && !front) this.kmSign(c * PROP_CELL, pal, Math.round((c * PROP_CELL) / 1000));
      else if (c % 5 === 0 && !front) this.lamp(x, pal, time);
      else if (r < 0.32) this.tree(x, pal, r, time, front);
      else if (r < 0.44) this.fence(x, pal);
      else if (r < 0.62) this.flowers(x, pal, r, time);
      else if (r < 0.66 && !front) this.mailbox(x, pal);
    }
  }

  private base(x: number, front: boolean) {
    // back props sit a touch behind the road edge, front ones overlap it
    return this.sy(groundY(x)) + (front ? ROAD_THICK * this.ppm * 1.25 : 2);
  }

  private tree(x: number, pal: Palette, r: number, time: number, front: boolean) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const by = this.base(x, front);
    const h = (3.2 + r * 9) * ppm * (front ? 1.15 : 1);
    const sway = Math.sin(time * 0.9 + x) * ppm * 0.06;
    const shade = front ? 0.35 : 0;
    const fol = mix(r < 0.16 ? pal.foliage : pal.foliage2, pal.groundDeep, shade);
    ctx.fillStyle = css(mix(pal.trunk, pal.groundDeep, shade));
    ctx.fillRect(px - ppm * 0.12, by - h * 0.45, ppm * 0.24, h * 0.45);
    ctx.fillStyle = css(fol);
    ctx.beginPath();
    if (r < 0.12) {
      // tall cypress
      ctx.ellipse(px + sway * 0.5, by - h * 0.62, h * 0.13, h * 0.42, 0, 0, Math.PI * 2);
    } else if (r < 0.22) {
      // layered pine
      for (let k = 0; k < 3; k++) {
        const w = h * (0.32 - k * 0.07);
        const yb = by - h * (0.3 + k * 0.2);
        ctx.moveTo(px - w, yb);
        ctx.lineTo(px + sway * (k + 1) * 0.4, yb - h * 0.34);
        ctx.lineTo(px + w, yb);
      }
    } else {
      // fluffy round tree
      const blobs: [number, number, number][] = [
        [sway * 0.4, -0.68, 0.24],
        [-h * 0.15 + sway * 0.3, -0.55, 0.18],
        [h * 0.16 + sway * 0.3, -0.52, 0.19],
      ];
      for (const [dx, dy, rr] of blobs) {
        ctx.moveTo(px + dx + h * rr, by + h * dy);
        ctx.arc(px + dx, by + h * dy, h * rr, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    // sun-side rim light
    if (!front && pal.night < 0.7) {
      ctx.fillStyle = css(pal.sunGlow, 0.18 * (1 - pal.night));
      ctx.beginPath();
      ctx.arc(px + h * 0.08 + sway * 0.4, by - h * 0.74, h * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private lamp(x: number, pal: Palette, time: number) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const by = this.base(x, false);
    const h = 4.2 * ppm;
    ctx.strokeStyle = css(mix(pal.trunk, pal.road, 0.4));
    ctx.lineWidth = Math.max(2, ppm * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, by);
    ctx.lineTo(px, by - h);
    ctx.quadraticCurveTo(px, by - h - ppm * 0.4, px + ppm * 0.6, by - h - ppm * 0.3);
    ctx.stroke();
    const lx = px + ppm * 0.65;
    const ly = by - h - ppm * 0.1;
    const on = clamp((pal.night - 0.15) / 0.35, 0, 1);
    const flicker = 0.93 + 0.07 * Math.sin(time * 13 + x);
    ctx.fillStyle = on > 0 ? `rgba(255,224,160,${0.5 + 0.5 * on})` : css(mix(pal.roadLine, pal.road, 0.4));
    ctx.beginPath();
    ctx.ellipse(lx, ly, ppm * 0.22, ppm * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (on > 0) {
      const R = ppm * 3.2;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
      g.addColorStop(0, `rgba(255,215,150,${0.45 * on * flicker})`);
      g.addColorStop(1, 'rgba(255,215,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - R, ly - R, R * 2, R * 2);
      // pool of light on the road
      const pool = ctx.createRadialGradient(lx, by, 0, lx, by, ppm * 3);
      pool.addColorStop(0, `rgba(255,210,140,${0.22 * on})`);
      pool.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(lx - ppm * 3, by - ppm * 1.5, ppm * 6, ppm * 2.2);
    }
  }

  private fence(x: number, pal: Palette) {
    const { ctx, ppm } = this;
    ctx.strokeStyle = css(mix(pal.roadLine, pal.ground, 0.55));
    ctx.lineWidth = Math.max(1.5, ppm * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const fx = x + i * 0.9;
      const px = this.sx(fx);
      const by = this.base(fx, false);
      ctx.moveTo(px, by);
      ctx.lineTo(px, by - ppm * 0.9);
    }
    for (const hgt of [0.35, 0.7]) {
      for (let i = 0; i < n; i++) {
        const fx = x + i * 0.9;
        const px = this.sx(fx);
        const py = this.base(fx, false) - ppm * hgt;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  private flowers(x: number, pal: Palette, r: number, time: number) {
    const { ctx, ppm } = this;
    const cols = ['#ffd1dc', '#fff3b0', '#ffb4a2', '#cdb4db'];
    for (let i = 0; i < 6; i++) {
      const fx = x + i * 0.35 + hash(i + r * 1000) * 0.2;
      const px = this.sx(fx);
      const by = this.base(fx, false);
      const h = ppm * (0.25 + hash(i * 7 + r * 1000) * 0.35);
      const sway = Math.sin(time * 2 + fx * 3) * ppm * 0.04;
      ctx.strokeStyle = css(mix(pal.foliage, pal.ground, 0.4));
      ctx.lineWidth = Math.max(1, ppm * 0.025);
      ctx.beginPath();
      ctx.moveTo(px, by);
      ctx.lineTo(px + sway, by - h);
      ctx.stroke();
      ctx.fillStyle = cols[(i + Math.floor(r * 10)) % cols.length];
      ctx.globalAlpha = 1 - pal.night * 0.5;
      ctx.beginPath();
      ctx.arc(px + sway, by - h, Math.max(1.5, ppm * 0.07), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private mailbox(x: number, pal: Palette) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const by = this.base(x, false);
    ctx.fillStyle = css(pal.trunk);
    ctx.fillRect(px - ppm * 0.04, by - ppm * 1.1, ppm * 0.08, ppm * 1.1);
    ctx.fillStyle = css(mix(hex('#7fb7e0'), pal.near, 0.3));
    ctx.beginPath();
    ctx.roundRect(px - ppm * 0.25, by - ppm * 1.4, ppm * 0.5, ppm * 0.32, ppm * 0.12);
    ctx.fill();
    ctx.fillStyle = '#ff7a7a';
    ctx.fillRect(px + ppm * 0.2, by - ppm * 1.55, ppm * 0.05, ppm * 0.22);
  }

  private kmSign(x: number, pal: Palette, km: number) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const by = this.base(x, false);
    ctx.fillStyle = css(pal.trunk);
    ctx.fillRect(px - ppm * 0.05, by - ppm * 1.7, ppm * 0.1, ppm * 1.7);
    ctx.fillStyle = css(mix(pal.roadLine, pal.near, 0.15));
    ctx.beginPath();
    ctx.roundRect(px - ppm * 0.55, by - ppm * 2.2, ppm * 1.1, ppm * 0.6, ppm * 0.1);
    ctx.fill();
    ctx.fillStyle = css(pal.road);
    ctx.font = `600 ${Math.round(ppm * 0.34)}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${km} km`, px, by - ppm * 1.9);
  }

  // -------------------------------------------------------------- rider
  private drawRider(bike: Bike, pal: Palette, time: number, del: Deliveries | null) {
    const { ctx, ppm } = this;
    const gx = bike.x;
    const gy = groundY(gx);
    // contact shadow
    const height = Math.max(0, bike.y - gy);
    const sa = clamp(0.35 - height * 0.08, 0.06, 0.35);
    ctx.fillStyle = `rgba(30,10,30,${sa})`;
    ctx.beginPath();
    ctx.ellipse(this.sx(gx), this.sy(gy) + ppm * 0.08, ppm * (0.85 + height * 0.1), ppm * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // bike headlight at night
    if (pal.night > 0.3) {
      const a = clamp((pal.night - 0.3) / 0.4, 0, 1);
      ctx.save();
      ctx.translate(this.sx(bike.x), this.sy(bike.y));
      ctx.rotate(-bike.angle);
      const beam = ctx.createLinearGradient(ppm * 0.6, 0, ppm * 6, 0);
      beam.addColorStop(0, `rgba(255,240,200,${0.3 * a})`);
      beam.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(ppm * 0.6, -ppm * 0.95);
      ctx.lineTo(ppm * 6, -ppm * 0.2);
      ctx.lineTo(ppm * 6, ppm * 0.4);
      ctx.lineTo(ppm * 0.6, -ppm * 0.8);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.sx(bike.x), this.sy(bike.y));
    ctx.scale(ppm, -ppm);
    ctx.rotate(bike.angle);
    const cargo = del ? del.orders.slice(0, 3).map((o) => ({ color: o.color, fragile: o.fragile })) : [];
    drawBike(ctx, bike, pal, { time, speed: bike.displaySpeed, cargo });
    ctx.restore();

    if (del) this.drawDeliveryOverlay(bike, del, pal, time);
  }

  // ---------------------------------------------------------- deliveries
  private drawDeliveryWorld(del: Deliveries, pal: Palette, time: number) {
    const { W, ppm } = this;
    const x0 = this.camX - W / 2 / ppm - 12;
    const x1 = this.camX + W / 2 / ppm + 12;
    for (const dx of [del.depot?.x, del.lastDepotX]) {
      if (dx !== undefined && dx > x0 && dx < x1) this.postOffice(dx, pal, time);
    }
    const target = del.target;
    for (const h of del.houses) {
      if (h.x < x0 || h.x > x1) continue;
      const isTarget = !!target && target.id === h.orderId && Math.abs(target.houseX - h.x) < 0.01;
      const waiting = !h.delivered && del.orders.some((o) => o.id === h.orderId && Math.abs(o.houseX - h.x) < 0.01);
      this.house(h, pal, time, isTarget, waiting);
    }
  }

  private postOffice(x: number, pal: Palette, time: number) {
    const { ctx, ppm } = this;
    const px = this.sx(x);
    const by = this.base(x, false);
    const w = 7.5 * ppm;
    const h = 4 * ppm;
    const wall = mix(hex('#f6d7b0'), pal.near, 0.25 + pal.night * 0.4);
    const trim = mix(hex('#e4677b'), pal.near, 0.2 + pal.night * 0.4);
    // building
    ctx.fillStyle = css(wall);
    ctx.fillRect(px - w / 2, by - h, w, h);
    ctx.fillStyle = css(mix(trim, pal.groundDeep, 0.25));
    ctx.fillRect(px - w / 2 - ppm * 0.3, by - h - ppm * 0.5, w + ppm * 0.6, ppm * 0.55);
    // sign
    ctx.fillStyle = css(mix(hex('#fff6e6'), pal.near, pal.night * 0.3));
    ctx.beginPath();
    ctx.roundRect(px - ppm * 2.2, by - h - ppm * 1.6, ppm * 4.4, ppm * 1.05, ppm * 0.2);
    ctx.fill();
    ctx.fillStyle = css(trim);
    ctx.font = `600 ${Math.round(ppm * 0.55)}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHILL POST', px + ppm * 0.25, by - h - ppm * 1.07);
    this.envelope(px - ppm * 1.75, by - h - ppm * 1.07, ppm * 0.45, trim);
    // striped awning
    const aw = w * 0.9;
    const ay = by - h * 0.62;
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? css(mix(hex('#fff6e6'), pal.near, 0.2 + pal.night * 0.3)) : css(trim);
      ctx.beginPath();
      const sx0 = px - aw / 2 + (aw / 9) * i;
      ctx.moveTo(sx0, ay);
      ctx.lineTo(sx0 + aw / 9, ay);
      ctx.lineTo(sx0 + aw / 9, ay + ppm * 0.5);
      ctx.arc(sx0 + aw / 18, ay + ppm * 0.5, aw / 18, 0, Math.PI);
      ctx.fill();
    }
    // door + windows
    const lit = clamp((pal.night - 0.15) / 0.4, 0, 1);
    const glass = lit > 0 ? `rgba(255,214,140,${0.5 + lit * 0.5})` : css(mix(pal.skyHorizon, pal.near, 0.3));
    ctx.fillStyle = css(mix(trim, pal.groundDeep, 0.45));
    ctx.fillRect(px - ppm * 0.6, by - ppm * 2.1, ppm * 1.2, ppm * 2.1);
    ctx.fillStyle = glass;
    ctx.fillRect(px - w / 2 + ppm * 0.6, by - ppm * 2.0, ppm * 2.0, ppm * 1.2);
    ctx.fillRect(px + w / 2 - ppm * 2.6, by - ppm * 2.0, ppm * 2.0, ppm * 1.2);
    // parcels piled by the door
    const boxes: [number, number, number][] = [[-1.5, 0, 0.7], [-0.95, 0, 0.5], [-1.25, 0.5, 0.45], [1.0, 0, 0.6]];
    for (const [bx, byy, s] of boxes) {
      this.parcel(px + bx * ppm, by - byy * ppm, s * ppm, mix(hex('#d6a870'), pal.near, 0.2 + pal.night * 0.4), false);
    }
    // little flag waving on the roof
    const fx = px + w / 2 - ppm * 0.4;
    const fy = by - h - ppm * 0.5;
    ctx.strokeStyle = css(pal.trunk);
    ctx.lineWidth = Math.max(1.5, ppm * 0.05);
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx, fy - ppm * 1.6);
    ctx.stroke();
    ctx.fillStyle = css(trim);
    ctx.beginPath();
    ctx.moveTo(fx, fy - ppm * 1.6);
    const wave = Math.sin(time * 4) * ppm * 0.1;
    ctx.quadraticCurveTo(fx + ppm * 0.4, fy - ppm * 1.5 + wave, fx + ppm * 0.8, fy - ppm * 1.4);
    ctx.lineTo(fx, fy - ppm * 1.15);
    ctx.fill();
  }

  private envelope(cx: number, cy: number, s: number, col: RGB) {
    const { ctx } = this;
    ctx.strokeStyle = css(col);
    ctx.lineWidth = Math.max(1.2, s * 0.12);
    ctx.strokeRect(cx - s / 2, cy - s * 0.35, s, s * 0.7);
    ctx.beginPath();
    ctx.moveTo(cx - s / 2, cy - s * 0.35);
    ctx.lineTo(cx, cy + s * 0.05);
    ctx.lineTo(cx + s / 2, cy - s * 0.35);
    ctx.stroke();
  }

  private parcel(cx: number, by: number, s: number, col: RGB, fragile: boolean) {
    const { ctx } = this;
    ctx.fillStyle = css(col);
    ctx.fillRect(cx - s / 2, by - s * 0.8, s, s * 0.8);
    ctx.fillStyle = css(mix(col, [90, 50, 40], 0.25));
    ctx.fillRect(cx - s * 0.08, by - s * 0.8, s * 0.16, s * 0.8);
    if (fragile) {
      ctx.fillStyle = '#e4677b';
      ctx.fillRect(cx - s / 2, by - s * 0.45, s, s * 0.12);
    }
  }

  private house(h: House, pal: Palette, time: number, isTarget: boolean, waiting: boolean) {
    const { ctx, ppm } = this;
    const px = this.sx(h.x);
    const by = this.base(h.x, false);
    const walls = ['#ffd6c9', '#cfe7d6', '#d9d1f2', '#fbe7a6'];
    const roofs = ['#c45d6e', '#5f8f8a', '#7a6aa8', '#d98a54'];
    const tint = 0.2 + pal.night * 0.45;
    const wall = mix(hex(walls[h.style]), pal.near, tint);
    const roof = mix(hex(roofs[h.style]), pal.near, tint);
    const w = 5.6 * ppm;
    const hh = 3.2 * ppm;
    ctx.fillStyle = css(wall);
    ctx.fillRect(px - w / 2, by - hh, w, hh);
    ctx.fillStyle = css(roof);
    ctx.beginPath();
    ctx.moveTo(px - w / 2 - ppm * 0.5, by - hh);
    ctx.lineTo(px, by - hh - ppm * 2.2);
    ctx.lineTo(px + w / 2 + ppm * 0.5, by - hh);
    ctx.closePath();
    ctx.fill();
    // chimney
    ctx.fillRect(px + w * 0.22, by - hh - ppm * 1.9, ppm * 0.5, ppm * 1.0);

    // windows: lit at night, or when someone's waiting for a parcel
    const night = clamp((pal.night - 0.15) / 0.4, 0, 1);
    const glow = waiting ? Math.max(0.6, night) : h.delivered ? night : night * 0.4;
    const glass = glow > 0.05 ? `rgba(255,214,140,${0.35 + glow * 0.65})` : css(mix(pal.skyHorizon, wall, 0.4));
    ctx.fillStyle = glass;
    ctx.fillRect(px - w / 2 + ppm * 0.5, by - hh + ppm * 0.7, ppm * 1.2, ppm * 1.0);
    ctx.fillRect(px + w / 2 - ppm * 1.7, by - hh + ppm * 0.7, ppm * 1.2, ppm * 1.0);
    // door
    ctx.fillStyle = css(mix(roof, pal.groundDeep, 0.3));
    ctx.beginPath();
    ctx.roundRect(px - ppm * 0.55, by - ppm * 2.0, ppm * 1.1, ppm * 2.0, [ppm * 0.5, ppm * 0.5, 0, 0]);
    ctx.fill();
    // house number plate
    ctx.fillStyle = css(mix(hex('#fff6e6'), pal.near, pal.night * 0.3));
    ctx.beginPath();
    ctx.roundRect(px - ppm * 0.42, by - hh - ppm * 0.95, ppm * 0.84, ppm * 0.6, ppm * 0.12);
    ctx.fill();
    ctx.fillStyle = css(roof);
    ctx.font = `600 ${Math.round(ppm * 0.42)}px Outfit, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(h.no), px, by - hh - ppm * 0.63);

    if (isTarget) {
      // warm welcome mat glow marking the drop zone
      const g = ctx.createRadialGradient(px, by, 0, px, by, ppm * 3.6);
      g.addColorStop(0, `rgba(255,236,170,${0.45 + 0.15 * Math.sin(time * 4)})`);
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - ppm * 3.6, by - ppm * 3.6, ppm * 7.2, ppm * 4.2);
      // bouncing pin above the roof
      const pinY = by - hh - ppm * 3.2 + Math.sin(time * 3) * ppm * 0.2;
      this.pin(px, pinY, ppm * 0.55, time);
    }

    if (h.delivered) {
      const t = time - h.deliveredAt;
      // the customer waves from the door for a while
      if (t < 9) {
        const skin = css(mix(hex('#f2c4a0'), pal.near, tint));
        const shirt = css(mix(hex(roofs[(h.style + 1) % 4]), pal.near, tint));
        const hx = px + ppm * 0.95;
        ctx.fillStyle = shirt;
        ctx.beginPath();
        ctx.roundRect(hx - ppm * 0.25, by - ppm * 1.25, ppm * 0.5, ppm * 0.85, ppm * 0.18);
        ctx.fill();
        ctx.fillStyle = css(mix(hex('#5a6fb0'), pal.near, tint));
        ctx.fillRect(hx - ppm * 0.2, by - ppm * 0.45, ppm * 0.4, ppm * 0.45);
        ctx.fillStyle = skin;
        ctx.beginPath();
        ctx.arc(hx, by - ppm * 1.45, ppm * 0.22, 0, Math.PI * 2);
        ctx.fill();
        const wave = Math.sin(time * 9) * 0.5;
        ctx.strokeStyle = skin;
        ctx.lineWidth = Math.max(2, ppm * 0.1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(hx + ppm * 0.2, by - ppm * 1.1);
        ctx.lineTo(hx + ppm * (0.45 + wave * 0.2), by - ppm * 1.7);
        ctx.stroke();
        // parcel at their feet
        this.parcel(hx - ppm * 0.6, by, ppm * 0.45, hex('#d6a870'), false);
      }
      if (t < 2.5) {
        // a little heart floats up
        const a = 1 - t / 2.5;
        const hy = by - hh - ppm * (1 + t * 1.2);
        this.heart(px, hy, ppm * 0.35, `rgba(255,120,150,${a})`);
      }
    } else if (!waiting) {
      // nobody home any more — curtains drawn
      ctx.fillStyle = css(mix(wall, pal.groundDeep, 0.2), 0.6);
      ctx.fillRect(px - w / 2 + ppm * 0.5, by - hh + ppm * 0.7, ppm * 1.2, ppm * 1.0);
      ctx.fillRect(px + w / 2 - ppm * 1.7, by - hh + ppm * 0.7, ppm * 1.2, ppm * 1.0);
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

  private pin(cx: number, cy: number, r: number, time: number) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255,248,236,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 0.85, Math.PI * 2.15);
    ctx.lineTo(cx, cy + r * 1.7);
    ctx.closePath();
    ctx.fill();
    this.parcel(cx, cy + r * 0.38, r * 1.05, hex('#d6a870'), false);
    void time;
  }

  private drawDeliveryOverlay(bike: Bike, del: Deliveries, pal: Palette, time: number) {
    const { ctx, W, ppm } = this;
    const t = del.target;
    // hand-over ring above the rider
    const p = del.handover;
    if (p > 0) {
      const cx = this.sx(bike.x);
      const cy = this.sy(bike.y) - ppm * 2.3;
      ctx.lineWidth = Math.max(3, ppm * 0.09);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, ppm * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, ppm * 0.4, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.stroke();
    }

    // edge arrow towards the next stop (house or post office)
    const goal = t ? t.houseX : del.depot?.x;
    if (goal === undefined) return;
    const gx = this.sx(goal);
    if (gx < W - 24) return;
    const dist = Math.max(0, goal - bike.x);
    const ay = this.sy(groundY(Math.min(goal, this.camX + W / 2 / ppm))) - ppm * 3.4;
    const ax = W - 26;
    const bob = Math.sin(time * 4) * 4;
    ctx.fillStyle = 'rgba(255,248,236,0.92)';
    ctx.beginPath();
    ctx.moveTo(ax + 14 + bob, ay);
    ctx.lineTo(ax - 4 + bob, ay - 12);
    ctx.lineTo(ax - 4 + bob, ay + 12);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 14px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,248,236,0.95)';
    ctx.shadowColor = 'rgba(60,20,50,0.35)';
    ctx.shadowBlur = 8;
    const label = t ? `n° ${t.houseNo} · ${Math.round(dist)} m` : `Chill Post · ${Math.round(dist)} m`;
    ctx.fillText(label, ax - 12 + bob, ay);
    ctx.shadowBlur = 0;
    void pal;
  }

  private drawForegroundGrass(pal: Palette, time: number) {
    const { ctx, W, H, ppm } = this;
    const par = 1.35;
    const col = css(mix(pal.groundDeep, pal.foliage, 0.12));
    ctx.fillStyle = col;
    const offset = this.camX * ppm * par;
    const cell = 46;
    const first = Math.floor(offset / cell) - 1;
    const last = Math.ceil((offset + W) / cell) + 1;
    for (let c = first; c <= last; c++) {
      if (hash(c * 7 + 1) < 0.55) continue;
      const px = c * cell - offset + hash(c * 7 + 2) * cell;
      const h = (30 + hash(c * 7 + 3) * 70) * (ppm / 50);
      const sway = Math.sin(time * 1.4 + c) * 6;
      ctx.beginPath();
      for (let b = -2; b <= 2; b++) {
        const bx = px + b * 5;
        ctx.moveTo(bx - 3, H + 2);
        ctx.quadraticCurveTo(bx + sway * 0.3, H - h * 0.5, bx + sway + b * 4, H - h * (1 - Math.abs(b) * 0.15));
        ctx.quadraticCurveTo(bx + sway * 0.3 + 2, H - h * 0.5, bx + 3, H + 2);
      }
      ctx.fill();
    }
  }

  private post(pal: Palette) {
    const { ctx, W, H } = this;
    // warm colour grade
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css(mix(pal.sunGlow, pal.skyTop, 0.5), 0.22);
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
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
