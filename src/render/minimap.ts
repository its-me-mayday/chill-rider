import { T, type GameMap } from '../game/map';
import { css, mix } from '../game/math';
import type { Orders } from '../game/orders';
import type { Rider } from '../game/rider';
import type { Target } from './renderer';

/** Small overview map in the HUD: static layer rendered once per map, markers on top. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private base = document.createElement('canvas');
  private scale = 1;
  private map: GameMap | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  setMap(map: GameMap) {
    this.map = map;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this.canvas.clientWidth || 150;
    const cssH = Math.round((cssW * map.height) / map.width);
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / map.width;
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    const g = this.base.getContext('2d')!;
    const th = map.theme;
    const ts = (this.canvas.width / map.cols);
    for (let ty = 0; ty < map.rows; ty++)
      for (let tx = 0; tx < map.cols; tx++) {
        const t = map.tiles[ty * map.cols + tx] as T;
        g.fillStyle = css(
          t === T.ROAD ? mix(th.roadEdge, [255, 255, 255], 0.3)
            : t === T.WATER ? th.water
            : t === T.SAND ? th.sand
            : t === T.PLAZA ? th.plaza
            : t === T.PATH ? th.path
            : t === T.CLOSED ? mix(th.roadEdge, th.grass, 0.6)
            : mix(th.grass, [60, 50, 70], 0.15),
        );
        g.fillRect(tx * ts, ty * ts, ts + 0.5, ts + 0.5);
      }
    g.fillStyle = 'rgba(70,50,80,0.25)';
    for (const tr of map.trees) {
      g.beginPath();
      g.arc(tr.x * this.scale, tr.y * this.scale, tr.r * this.scale, 0, Math.PI * 2);
      g.fill();
    }
    for (const b of map.buildings) {
      g.fillStyle = b.kind === 'shop' ? css(b.shop!.roof) : css(mix(th.roofs[b.style % th.roofs.length], [255, 255, 255], 0.25));
      g.fillRect(b.x * this.scale, b.y * this.scale, b.w * this.scale, b.h * this.scale);
    }
  }

  draw(r: Rider, orders: Orders, target: Target | null, time: number) {
    if (!this.map) return;
    const { ctx, scale } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    const k = this.canvas.width / 150;

    // shops with an order waiting blink softly
    for (const s of orders.shops) {
      if (!orders.waiting.get(s.id)) continue;
      const a = 0.6 + 0.4 * Math.sin(time * 4);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2 * k;
      ctx.beginPath();
      ctx.arc((s.x + s.w / 2) * scale, (s.y + s.h / 2) * scale, 5 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const o of orders.carried) {
      const isT = target?.order?.id === o.id;
      ctx.fillStyle = `rgb(${o.color.join(',')})`;
      ctx.beginPath();
      ctx.arc(o.house.stopX * scale, o.house.stopY * scale, (isT ? 4.5 : 3.2) * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,60,0.6)';
      ctx.lineWidth = 1 * k;
      ctx.stroke();
    }
    // rider arrow
    ctx.save();
    ctx.translate(r.x * scale, r.y * scale);
    ctx.rotate(r.heading);
    ctx.fillStyle = '#e4677b';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath();
    ctx.moveTo(6 * k, 0);
    ctx.lineTo(-4 * k, -4 * k);
    ctx.lineTo(-2 * k, 0);
    ctx.lineTo(-4 * k, 4 * k);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
