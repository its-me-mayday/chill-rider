import { formatHour } from '../game/daylight';

/**
 * A 24-hour dial: the sky colour around the ring shows day and night, a sun or
 * moon travels around it and a hand points at the current hour (noon at the top).
 */
export class DayClock {
  private ctx: CanvasRenderingContext2D;
  private size: number;
  private label: HTMLElement;
  private ring: HTMLCanvasElement;
  private lastMinute = -1;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = canvas.clientWidth || 64;
    canvas.width = Math.round(this.size * dpr);
    canvas.height = Math.round(this.size * dpr);
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.label = document.getElementById('clock-time')!;
    this.ring = this.makeRing(dpr);
  }

  private angle(h: number) {
    // noon at the top, clockwise
    return ((h - 12) / 24) * Math.PI * 2 - Math.PI / 2;
  }

  /** pre-render the coloured sky ring once */
  private makeRing(dpr: number) {
    const S = this.size;
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(S * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const cx = S / 2;
    const R = S / 2 - 2;
    const stops: [number, string][] = [
      [0, '#1f2a5c'], [4.5, '#1f2a5c'], [6, '#c9a6d8'], [7.5, '#ffd9a8'], [9, '#9fd3f2'], [15, '#9fd3f2'],
      [17.5, '#ffd27a'], [19, '#ff9a8b'], [20.5, '#8a6ab0'], [22, '#1f2a5c'], [24, '#1f2a5c'],
    ];
    const lerp = (a: string, b: string, t: number) => {
      const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
      const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
      return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`;
    };
    const steps = 96;
    for (let i = 0; i < steps; i++) {
      const h = (i / steps) * 24;
      let k = 0;
      while (k < stops.length - 2 && stops[k + 1][0] <= h) k++;
      const [h0, c0] = stops[k];
      const [h1, c1] = stops[k + 1];
      g.strokeStyle = lerp(c0, c1, (h - h0) / (h1 - h0));
      g.lineWidth = 7;
      g.beginPath();
      g.arc(cx, cx, R - 4, this.angle(h), this.angle(h + 24 / steps) + 0.02);
      g.stroke();
    }
    // hour ticks every 3 h
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1;
    for (let h = 0; h < 24; h += 3) {
      const a = this.angle(h);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 12), cx + Math.sin(a) * (R - 12));
      g.lineTo(cx + Math.cos(a) * (R - 9), cx + Math.sin(a) * (R - 9));
      g.stroke();
    }
    return c;
  }

  draw(hour: number, night: number) {
    const { ctx } = this;
    const S = this.size;
    const cx = S / 2;
    const R = S / 2 - 2;
    ctx.clearRect(0, 0, S, S);
    // face
    ctx.fillStyle = night > 0.5 ? 'rgba(25,22,50,0.92)' : 'rgba(255,250,240,0.95)';
    ctx.beginPath();
    ctx.arc(cx, cx, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(this.ring, 0, 0, S, S);

    // sun or moon riding the ring
    const a = this.angle(hour);
    const bx = cx + Math.cos(a) * (R - 4);
    const by = cx + Math.sin(a) * (R - 4);
    const day = hour >= 6 && hour < 20;
    ctx.fillStyle = day ? '#ffd23f' : '#f4f1ff';
    ctx.shadowColor = day ? 'rgba(255,200,60,0.9)' : 'rgba(200,200,255,0.9)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(bx, by, S * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!day) {
      ctx.fillStyle = 'rgba(25,22,50,0.92)';
      ctx.beginPath();
      ctx.arc(bx + S * 0.035, by - S * 0.02, S * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }

    // hand
    ctx.strokeStyle = night > 0.5 ? '#fff8f0' : '#5a3550';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cx);
    ctx.lineTo(cx + Math.cos(a) * (R - 14), cx + Math.sin(a) * (R - 14));
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(cx, cx, 2.5, 0, Math.PI * 2);
    ctx.fill();

    const minute = Math.floor(hour * 6);
    if (minute !== this.lastMinute) {
      this.lastMinute = minute;
      this.label.textContent = formatHour(hour);
    }
  }
}
