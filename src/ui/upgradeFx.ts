import { drawScene, type ArtStyle, type ArtUpgrades } from '../render/bikeArt';

export interface UpgradeShow {
  kicker: string;
  icon: string;
  name: string;
  from: string;
  to: string;
  /** level reached and the number of levels */
  level: number;
  levels: number;
  stat: string;
  before: { up: ArtUpgrades; style: ArtStyle };
  after: { up: ArtUpgrades; style: ArtStyle };
}

const DURATION = 4800;

/**
 * Full-screen celebration when the bike gets a new part: the old bike gets
 * worked on, a flash, then the new one pulls a wheelie under spotlight rays
 * while the tier, level pips and stat change slide in.
 */
export class UpgradeFx {
  private root = document.getElementById('upfx')!;
  private canvas = document.getElementById('upfx-art') as HTMLCanvasElement;
  private queue: UpgradeShow[] = [];
  private cur: UpgradeShow | null = null;
  private t0 = 0;
  private raf = 0;
  private timer = 0;
  onShow: ((s: UpgradeShow) => void) | null = null;

  constructor() {
    this.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      // ignore taps during the first second so it isn't skipped by the buy tap
      if (performance.now() - this.t0 > 900) this.next();
    });
  }

  get isOpen() {
    return !!this.cur;
  }

  show(s: UpgradeShow) {
    this.queue.push(s);
    if (!this.cur) this.next();
  }

  private next() {
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    const s = this.queue.shift();
    if (!s) {
      this.cur = null;
      this.root.classList.add('hidden');
      this.root.classList.remove('play');
      return;
    }
    this.cur = s;
    const $ = (id: string) => document.getElementById(id)!;
    $('upfx-kicker').textContent = s.kicker;
    $('upfx-icon').textContent = s.icon;
    $('upfx-name').textContent = s.name;
    $('upfx-old').textContent = s.from;
    $('upfx-new').textContent = s.to;
    $('upfx-stat').textContent = s.stat;
    $('upfx-pips').innerHTML = Array.from({ length: s.levels }, (_, i) =>
      `<i class="${i < s.level - 1 ? 'on' : i === s.level - 1 ? 'new' : ''}" style="--d:${1.5 + i * 0.08}s"></i>`).join('');
    this.root.classList.remove('hidden', 'play');
    void this.root.offsetWidth;
    this.root.classList.add('play');
    this.t0 = performance.now();
    this.onShow?.(s);
    const loop = () => {
      this.paint();
      if (this.cur) this.raf = requestAnimationFrame(loop);
    };
    loop();
    this.timer = window.setTimeout(() => this.next(), DURATION);
  }

  private paint() {
    const s = this.cur;
    if (!s) return;
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth || 400;
    const h = c.clientHeight || 220;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const el = (performance.now() - this.t0) / 1000;
    const after = el > 1.0;
    const pose = !after ? 'cruise' : el < 2.6 ? 'wheelie' : 'nohands';
    const scene = after ? s.after : s.before;
    ctx.save();
    // before the swap the bike shakes a little while the wrench works
    if (!after) ctx.translate(Math.sin(el * 60) * 1.5, Math.cos(el * 47) * 1);
    drawScene(ctx, w, h, {
      pose, t: (el / 1.6) % 1, up: scene.up, style: scene.style,
      sky: after ? ['#ffe3a8', '#ffc4d6'] : ['#d8dde6', '#f3efe9'], ground: after ? '#b8dca0' : '#c9cfc4',
      fx: after,
    });
    ctx.restore();
    // wrench sparks
    if (!after) {
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4 + el * 20;
        const r = ((el * 3 + k * 0.13) % 1) * h * 0.25;
        ctx.fillStyle = k % 2 ? '#ffd23f' : '#fff6c8';
        ctx.beginPath();
        ctx.arc(w * 0.5 + Math.cos(a) * r, h * 0.55 + Math.sin(a) * r * 0.7, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // a wrench turning in the middle
      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(Math.sin(el * 14) * 0.7);
      ctx.font = `${Math.round(h * 0.22)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔧', 0, 0);
      ctx.restore();
    }
    // the flash at the swap
    const flash = Math.max(0, 1 - Math.abs(el - 1.0) / 0.22);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, w, h);
    }
    // twinkles around the shiny new bike
    if (after) {
      for (let k = 0; k < 10; k++) {
        const life = ((el * 0.9 + k * 0.1) % 1);
        const x = w * (0.2 + ((k * 0.37) % 0.6));
        const y = h * (0.15 + ((k * 0.53) % 0.55));
        const r = Math.sin(life * Math.PI) * 7;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * Math.sin(life * Math.PI)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r);
        ctx.lineTo(x, y + r);
        ctx.stroke();
      }
    }
  }
}
