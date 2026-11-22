import { drawScene, type ArtStyle, type ArtUpgrades, type Pose } from '../render/bikeArt';
import type { TipPart } from '../game/orders';

export interface Snap {
  pose: Pose;
  item: string;
  shop: string;
  icon: string;
  customer: string;
  address: string;
  town: string;
  tip: number;
  onTime: boolean;
  /** 1..3 */
  stars: number;
  parts: TipPart[];
  parcel: string;
  sky: [string, string];
}

/**
 * The polaroid that pops up after a delivery: the courier in a pose, what was
 * delivered to whom, and the receipt of what it paid.
 */
export class SnapshotCard {
  private root = document.getElementById('snap')!;
  private canvas = document.getElementById('snap-art') as HTMLCanvasElement;
  private queue: Snap[] = [];
  private current: Snap | null = null;
  private t0 = 0;
  private hideTimer = 0;
  private raf = 0;

  constructor(private style: () => ArtStyle, private upgrades: () => ArtUpgrades) {
    this.root.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.next();
    });
  }

  show(s: Snap) {
    this.queue.push(s);
    if (!this.current) this.next();
  }

  private next() {
    clearTimeout(this.hideTimer);
    const s = this.queue.shift();
    if (!s) {
      this.current = null;
      this.root.classList.remove('show');
      cancelAnimationFrame(this.raf);
      return;
    }
    this.current = s;
    this.fill(s);
    this.root.classList.remove('show');
    void this.root.offsetWidth;
    this.root.classList.add('show');
    this.t0 = performance.now();
    cancelAnimationFrame(this.raf);
    const loop = () => {
      this.paint();
      if (this.current) this.raf = requestAnimationFrame(loop);
    };
    loop();
    this.hideTimer = window.setTimeout(() => this.next(), this.queue.length ? 2600 : 4600);
  }

  private fill(s: Snap) {
    const $ = (id: string) => document.getElementById(id)!;
    $('snap-title').textContent = s.onTime ? 'Delivered!' : 'Delivered… late';
    $('snap-stars').textContent = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars);
    $('snap-item').textContent = `${s.icon} ${s.item}`;
    $('snap-route').textContent = `${s.shop} → ${s.customer}, ${s.address}`;
    $('snap-total').textContent = `+${s.tip.toFixed(2)} €`;
    $('snap-total').classList.toggle('late', !s.onTime);
    $('snap-caption').textContent = `${s.town}`;
    const list = $('snap-parts');
    list.innerHTML = '';
    for (const p of s.parts) {
      const li = document.createElement('li');
      const a = document.createElement('span');
      a.textContent = p.label;
      const b = document.createElement('b');
      b.textContent = `${p.amount >= 0 ? '+' : '−'}${Math.abs(p.amount).toFixed(2)}`;
      if (p.amount < 0) b.className = 'neg';
      li.append(a, b);
      list.append(li);
    }
  }

  private paint() {
    const s = this.current;
    if (!s) return;
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth || 200;
    const h = c.clientHeight || 130;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = ((performance.now() - this.t0) / 1600) % 1;
    drawScene(ctx, w, h, { pose: s.pose, style: this.style(), up: this.upgrades(), t, parcel: s.parcel, sky: s.sky });
  }
}

/** Renders a still snapshot into any canvas (the journal in the logbook). */
export function paintStill(c: HTMLCanvasElement, s: Pick<Snap, 'pose' | 'parcel' | 'sky'>, style: ArtStyle, up: ArtUpgrades, t = 0.3) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth || 160;
  const h = c.clientHeight || 104;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene(ctx, w, h, { pose: s.pose, style, up, t, parcel: s.parcel, sky: s.sky, fx: false });
}
