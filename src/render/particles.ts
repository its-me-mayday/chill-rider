import type { Bike } from '../game/bike';
import { css, mix } from '../game/math';
import type { Palette } from '../game/palette';
import { groundY } from '../game/terrain';

type Kind = 'petal' | 'firefly' | 'dust' | 'sparkle';

interface P {
  kind: Kind;
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

const MAX = 220;

export class Particles {
  private list: P[] = [];
  private spawnAcc = 0;

  burst(kind: 'dust' | 'sparkle', x: number, y: number, n: number, power = 1) {
    for (let i = 0; i < n && this.list.length < MAX; i++) {
      const a = kind === 'dust' ? Math.PI * (0.05 + Math.random() * 0.9) : Math.random() * Math.PI * 2;
      const s = (kind === 'dust' ? 1 + Math.random() * 2.5 : 2 + Math.random() * 3) * power;
      this.list.push({
        kind, x, y,
        vx: Math.cos(a) * s - (kind === 'dust' ? 1.2 : 0),
        vy: Math.sin(a) * s,
        life: 0,
        max: kind === 'dust' ? 0.6 + Math.random() * 0.5 : 0.7 + Math.random() * 0.6,
        size: kind === 'dust' ? 0.06 + Math.random() * 0.1 : 0.04 + Math.random() * 0.05,
        rot: 0,
        seed: Math.random() * 100,
      });
    }
  }

  update(dt: number, bike: Bike, pal: Palette, camX: number, camY: number, viewW: number, viewH: number) {
    // ambient spawns: petals in daylight, fireflies at night
    this.spawnAcc += dt;
    const rate = 0.12;
    while (this.spawnAcc > rate) {
      this.spawnAcc -= rate;
      if (this.list.length >= MAX) break;
      const night = pal.night;
      const kind: Kind = Math.random() < night ? 'firefly' : 'petal';
      if (kind === 'petal' && Math.random() < 0.45) continue;
      const x = camX + (Math.random() * 1.2 - 0.3) * viewW;
      const y =
        kind === 'firefly'
          ? groundY(x) + 0.4 + Math.random() * 3.5
          : camY + viewH * (0.1 + Math.random() * 0.45);
      this.list.push({
        kind, x, y,
        vx: kind === 'petal' ? -0.6 - Math.random() * 0.8 : (Math.random() - 0.5) * 0.4,
        vy: kind === 'petal' ? -0.3 - Math.random() * 0.4 : (Math.random() - 0.5) * 0.3,
        life: 0,
        max: kind === 'petal' ? 7 + Math.random() * 5 : 4 + Math.random() * 4,
        size: kind === 'petal' ? 0.06 + Math.random() * 0.05 : 0.05,
        rot: Math.random() * 6,
        seed: Math.random() * 100,
      });
    }

    // braking kicks up a little dust
    if (!bike.airborne && bike.displaySpeed > 4 && bike.braking) {
      if (Math.random() < 0.6) this.burst('dust', bike.x - 0.5, groundY(bike.x - 0.5), 1, 0.6);
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      if (p.life > p.max || p.x < camX - viewW) {
        this.list.splice(i, 1);
        continue;
      }
      if (p.kind === 'petal') {
        p.vx += Math.sin(p.life * 1.7 + p.seed) * 0.6 * dt;
        p.rot += dt * (1.5 + (p.seed % 2));
      } else if (p.kind === 'firefly') {
        p.vx += Math.sin(p.life * 2 + p.seed) * 0.5 * dt;
        p.vy += Math.cos(p.life * 1.6 + p.seed) * 0.5 * dt;
      } else if (p.kind === 'dust') {
        p.vy -= 1.5 * dt;
        p.vx *= 1 - dt * 2;
      } else {
        p.vy -= 3 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    pal: Palette,
    sx: (x: number) => number,
    sy: (y: number) => number,
    ppm: number,
    time: number,
  ) {
    for (const p of this.list) {
      const t = p.life / p.max;
      const fade = Math.min(1, p.life * 3) * Math.min(1, (1 - t) * 3);
      const x = sx(p.x);
      const y = sy(p.y);
      const r = Math.max(1, p.size * ppm);
      if (p.kind === 'petal') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.abs(Math.sin(p.rot * 1.3)) * 0.7 + 0.3);
        ctx.fillStyle = css(mix(pal.foliage2, [255, 220, 230], 0.5), 0.85 * fade);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.4, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'firefly') {
        const pulse = 0.4 + 0.6 * Math.max(0, Math.sin(time * 3 + p.seed * 7));
        const a = fade * pulse * pal.night;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
        g.addColorStop(0, `rgba(255,245,170,${a})`);
        g.addColorStop(1, 'rgba(255,245,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
      } else if (p.kind === 'dust') {
        ctx.fillStyle = css(mix(pal.road, pal.roadLine, 0.4), 0.5 * fade);
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + t * 2), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255,240,200,${fade})`;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 4 + p.seed);
        ctx.fillRect(-r * 1.5, -r * 0.3, r * 3, r * 0.6);
        ctx.fillRect(-r * 0.3, -r * 1.5, r * 0.6, r * 3);
        ctx.restore();
      }
    }
  }
}
