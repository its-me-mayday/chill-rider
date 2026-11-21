import type { Mood, Rider } from '../game/rider';

/**
 * The rider's face in the HUD: expression follows bumps, slips, dizziness and
 * how bruised they are. A health bar and a short status sit next to it.
 */
export class Portrait {
  private ctx: CanvasRenderingContext2D;
  private size = 64;
  private bar: HTMLElement;
  private label: HTMLElement;
  private card: HTMLElement;
  private lastMood: Mood | '' = '';

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = canvas.clientWidth || 64;
    canvas.width = Math.round(this.size * dpr);
    canvas.height = Math.round(this.size * dpr);
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.bar = document.getElementById('hp-bar')!;
    this.label = document.getElementById('hp-label')!;
    this.card = document.getElementById('rider-card')!;
  }

  draw(r: Rider, time: number, style: { beanie: string; scarf: string }, wet: boolean) {
    const { ctx } = this;
    const S = this.size;
    const mood = r.mood;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    const shake = r.hurtFlash > 0 ? Math.sin(time * 60) * r.hurtFlash * 4 : 0;
    const tilt = mood === 'fallen' ? 0.5 : mood === 'dizzy' ? Math.sin(time * 4) * 0.12 : mood === 'resting' ? -0.08 : 0;
    ctx.translate(S / 2 + shake, S / 2 + 1 + (mood === 'happy' ? Math.sin(time * 2.4) * 0.8 : 0));
    ctx.rotate(tilt);

    // background disc tinted by health
    const hp = r.health / 100;
    ctx.fillStyle = mood === 'fallen' || mood === 'hurt' ? 'rgba(255,140,150,0.35)' : 'rgba(255,248,236,0.22)';
    ctx.beginPath();
    ctx.arc(0, -3, S * 0.47, 0, Math.PI * 2);
    ctx.fill();

    // scarf + shoulders
    ctx.fillStyle = '#f4c063';
    ctx.beginPath();
    ctx.ellipse(0, S * 0.36, S * 0.3, S * 0.16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = style.scarf === 'rainbow' ? '#ff8f8f' : style.scarf;
    ctx.beginPath();
    ctx.roundRect(-S * 0.17, S * 0.17, S * 0.34, S * 0.08, S * 0.04);
    ctx.fill();

    // face
    const face = S * 0.25;
    const flush = mood === 'focused' ? 0.25 : mood === 'hurt' ? 0.1 : 0;
    ctx.fillStyle = '#f2c4a0';
    ctx.beginPath();
    ctx.arc(0, 0, face, 0, Math.PI * 2);
    ctx.fill();
    if (flush > 0 || mood === 'happy') {
      ctx.fillStyle = `rgba(255,130,140,${0.35 + flush})`;
      ctx.beginPath();
      ctx.arc(-face * 0.55, face * 0.3, face * 0.17, 0, Math.PI * 2);
      ctx.arc(face * 0.55, face * 0.3, face * 0.17, 0, Math.PI * 2);
      ctx.fill();
    }

    // beanie + headphones
    ctx.fillStyle = style.beanie;
    ctx.beginPath();
    ctx.arc(0, -face * 0.15, face * 1.05, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-face * 1.05, -face * 0.45, face * 2.1, face * 0.32);
    ctx.beginPath();
    ctx.arc(0, -face * 1.2, face * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3045';
    ctx.beginPath();
    ctx.roundRect(-face * 1.18, -face * 0.1, face * 0.3, face * 0.6, face * 0.12);
    ctx.roundRect(face * 0.88, -face * 0.1, face * 0.3, face * 0.6, face * 0.12);
    ctx.fill();

    // eyes
    const ey = -face * 0.02;
    const ex = face * 0.38;
    ctx.strokeStyle = '#3a2a35';
    ctx.fillStyle = '#3a2a35';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    const blink = Math.sin(time * 1.3) > 0.985;
    if (mood === 'dizzy' || mood === 'fallen') {
      for (const sx of [-ex, ex]) {
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.4) {
          const rr = (a / (Math.PI * 4)) * face * 0.2;
          const px = sx + Math.cos(a + time * 8) * rr;
          const py = ey + Math.sin(a + time * 8) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (mood === 'hurt') {
      for (const sx of [-ex, ex]) {
        ctx.beginPath();
        ctx.moveTo(sx - face * 0.12, ey - face * 0.1);
        ctx.lineTo(sx + face * 0.12, ey + face * 0.02);
        ctx.lineTo(sx - face * 0.12, ey + face * 0.12);
        ctx.stroke();
      }
    } else if (mood === 'resting' || blink) {
      for (const sx of [-ex, ex]) {
        ctx.beginPath();
        ctx.arc(sx, ey, face * 0.13, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
      }
    } else {
      for (const sx of [-ex, ex]) {
        ctx.beginPath();
        ctx.arc(sx, ey, face * (mood === 'focused' ? 0.09 : 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
      if (mood === 'focused') {
        ctx.beginPath();
        ctx.moveTo(-ex - face * 0.15, ey - face * 0.25);
        ctx.lineTo(-ex + face * 0.12, ey - face * 0.17);
        ctx.moveTo(ex + face * 0.15, ey - face * 0.25);
        ctx.lineTo(ex - face * 0.12, ey - face * 0.17);
        ctx.stroke();
      }
    }

    // mouth
    const my = face * 0.45;
    ctx.beginPath();
    if (mood === 'happy' || mood === 'resting') ctx.arc(0, my - face * 0.12, face * 0.22, Math.PI * 0.15, Math.PI * 0.85);
    else if (mood === 'focused') {
      ctx.moveTo(-face * 0.15, my);
      ctx.lineTo(face * 0.15, my);
    } else if (mood === 'tired') {
      ctx.moveTo(-face * 0.16, my + face * 0.02);
      ctx.quadraticCurveTo(0, my - face * 0.06, face * 0.16, my + face * 0.04);
    } else if (mood === 'dizzy' || mood === 'fallen') {
      ctx.ellipse(0, my, face * 0.1, face * 0.13, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(0, my + face * 0.2, face * 0.2, Math.PI * 1.2, Math.PI * 1.8);
    }
    ctx.stroke();

    // bruises & plasters, more as health drops
    if (hp < 0.75) this.plaster(face * 0.62, -face * 0.42, face * 0.38, 0.6);
    if (hp < 0.5) this.plaster(-face * 0.55, face * 0.35, face * 0.32, -0.5);
    if (hp < 0.3) {
      ctx.fillStyle = 'rgba(140,110,190,0.45)';
      ctx.beginPath();
      ctx.arc(-face * 0.38, -face * 0.02, face * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
    // sweat drop when pushing hard, rain drop when wet
    if (mood === 'focused' || wet) {
      const t = (time * 0.8) % 1;
      ctx.fillStyle = wet ? 'rgba(140,190,255,0.9)' : 'rgba(170,215,255,0.9)';
      ctx.beginPath();
      const dx = face * 0.95;
      const dy = -face * 0.4 + t * face * 0.5;
      ctx.moveTo(dx, dy - face * 0.18);
      ctx.quadraticCurveTo(dx + face * 0.12, dy, dx, dy + face * 0.06);
      ctx.quadraticCurveTo(dx - face * 0.12, dy, dx, dy - face * 0.18);
      ctx.fill();
    }
    // stars orbiting when dizzy
    if (mood === 'dizzy' || mood === 'fallen') {
      ctx.fillStyle = '#ffe08a';
      for (let k = 0; k < 3; k++) {
        const a = time * 4 + (k / 3) * Math.PI * 2;
        this.star(Math.cos(a) * face * 1.1, -face * 1.25 + Math.sin(a) * face * 0.3, face * 0.18);
      }
    }
    // steam cup while resting at the café
    if (mood === 'resting') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(face * 0.7, face * 0.6, face * 0.4, face * 0.36);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      const t = (time * 0.9) % 1;
      ctx.beginPath();
      ctx.moveTo(face * 0.9, face * 0.55);
      ctx.quadraticCurveTo(face * 0.75, face * (0.35 - t * 0.2), face * 0.95, face * (0.15 - t * 0.2));
      ctx.stroke();
    }
    ctx.restore();

    // ---- bar + label
    this.bar.style.width = `${Math.round(hp * 100)}%`;
    this.bar.style.background = hp > 0.65 ? 'linear-gradient(90deg,#9fe3a8,#c9f2d0)' : hp > 0.35 ? 'linear-gradient(90deg,#ffd27a,#ffe7a8)' : 'linear-gradient(90deg,#ff8f8f,#ffb3b3)';
    if (mood !== this.lastMood) {
      this.lastMood = mood;
      const text: Record<Mood, string> = {
        happy: 'feeling good',
        focused: 'in the flow',
        tired: 'a bit bruised',
        hurt: 'ouch — slower until healed',
        dizzy: 'seeing stars',
        fallen: 'slipped!',
        resting: 'resting at the café ☕',
      };
      this.label.textContent = text[mood];
      this.card.classList.remove('hit');
      if (mood === 'dizzy' || mood === 'fallen') {
        void this.card.offsetWidth;
        this.card.classList.add('hit');
      }
    }
  }

  private plaster(x: number, y: number, s: number, rot: number) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#f6d7b0';
    ctx.beginPath();
    ctx.roundRect(-s, -s * 0.32, s * 2, s * 0.64, s * 0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,110,80,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 0.32);
    ctx.lineTo(-s * 0.25, s * 0.32);
    ctx.moveTo(s * 0.25, -s * 0.32);
    ctx.lineTo(s * 0.25, s * 0.32);
    ctx.stroke();
    ctx.restore();
  }

  private star(x: number, y: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
}
