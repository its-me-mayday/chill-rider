import type { Track } from '../audio/radio';
import type { Challenge } from '../game/challenges';
import type { Orders } from '../game/orders';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

const fmt = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class Hud {
  private el = {
    hud: $('hud'),
    place: $('place'),
    phase: $('phase'),
    goal: $('goal'),
    orders: $('orders'),
    tips: $('tips'),
    speed: $('speed'),
    toast: $('toast'),
    radio: $('radio'),
    track: $('radio-track'),
    key: $('radio-key'),
    toggle: $<HTMLButtonElement>('radio-toggle'),
    lvl: $('lvl'),
    xpbar: $('xpbar'),
    xp: $('lvl'),
    xpLabel: $('xp-label'),
    gauge: $('gauge-fill'),
    gaugeState: $('gauge-state'),
    keys: $('hint'),
    goalMini: $('goal-mini'),
    finds: $('finds'),
    challenges: $('challenges'),
    streak: $('streak'),
    badge: $('badge'),
  };
  private badgeQueue: { title: string; desc: string; icon: string }[] = [];
  private badgeBusy = false;
  private lastChallenges = '';
  private lastStreak = -1;
  private last = '';
  private toastTimer = 0;

  setVisible(v: boolean) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  setPlace(name: string) {
    this.el.place.textContent = name;
  }

  update(s: { speed: number; phase: string; orders: Orders; time: number; tips: number; targetId: number | null; riderX: number; riderY: number; surface?: string; braking?: boolean }) {
    const kmh = Math.round(s.speed * 3.6);
    this.el.speed.textContent = String(kmh);
    const frac = Math.min(1, kmh / 40);
    this.el.gauge.style.strokeDasharray = `${(frac * 75).toFixed(1)} 100`;
    this.el.gauge.style.stroke = s.braking ? '#ff9aa8' : kmh > 30 ? '#ffd27a' : '#fff1b8';
    const state = s.braking ? 'braking' : s.surface ?? '';
    if (this.el.gaugeState.textContent !== state) this.el.gaugeState.textContent = state;
    if (s.time > 25 && !this.el.keys.classList.contains('fade')) this.el.keys.classList.add('fade');
    if (this.el.phase.textContent !== s.phase) this.el.phase.textContent = s.phase;

    const o = s.orders;
    const pips = Array.from({ length: o.goal }, (_, i) => `<i class="${i < o.delivered ? 'on' : ''}"></i>`).join('');
    const goal = `Deliveries ${o.delivered}/${o.goal}<span class="pips">${pips}</span>`;

    let rows: string;
    if (!o.carried.length) {
      const anyWaiting = [...o.waiting.values()].some(Boolean);
      rows = `<div class="order empty">${anyWaiting ? 'Ride to a shop with a 📦 to pick up an order' : 'Shops are preparing orders…'}</div>`;
    } else {
      const dist = (x: typeof o.carried[number]) => Math.hypot(x.house.stopX - s.riderX, x.house.stopY - s.riderY);
      rows = [...o.carried]
        .sort((a, b) => dist(a) - dist(b))
        .map((ord, i) => {
          const left = ord.deadline - s.time;
          const [r, g, b] = ord.color;
          const cls = left < 0 ? 'late' : left < 12 ? 'warn' : '';
          const cond = ord.fragile ? ` · <b>fragile</b><span class="cond"><i style="width:${Math.round(ord.condition * 100)}%"></i></span>` : '';
          const d = Math.round(dist(ord));
          return `<div class="order${i === 0 ? ' target' : ' small'}" style="--c:rgb(${r},${g},${b})">
            <span class="sw"></span>
            <span class="addr">${ord.kind === 'rush' ? '⚡ ' : ord.kind === 'vip' ? '★ ' : ''}${ord.house.no} ${esc(ord.house.street)}</span>
            <span class="timer ${cls}">${left < 0 ? 'late' : fmt(left)}</span>
            <span class="what">${i === 0 ? `${esc(ord.item)} · ${esc(ord.shop.shop!.name)}${cond} · ` : ''}${d} m</span>
          </div>`;
        })
        .join('');
    }
    if (o.carried.length > 1) {
      const dots = [...o.carried].slice(1).map((x) => `<i style="background:rgb(${x.color.join(',')})"></i>`).join('');
      rows += `<span class="more">${dots} +${o.carried.length - 1} more ▾</span>`;
    }
    const mini = `${o.delivered}/${o.goal}`;
    if (this.el.goalMini.textContent !== mini) this.el.goalMini.textContent = mini;
    const tips = `${s.tips.toFixed(2)} € <small>tips</small>`;
    const key = goal + rows + tips;
    if (key !== this.last) {
      this.last = key;
      this.el.goal.innerHTML = goal;
      this.el.orders.innerHTML = rows;
      this.el.tips.innerHTML = tips;
    }
  }

  setXp(level: number, xp: number, need: number, pulse = false) {
    this.el.lvl.textContent = `Lv ${level}`;
    this.el.xpbar.style.width = `${Math.round((xp / need) * 100)}%`;
    this.el.xpLabel.textContent = `${Math.round(xp)}/${need} xp`;
    if (pulse) {
      this.el.xp.classList.remove('pulse');
      void this.el.xp.offsetWidth;
      this.el.xp.classList.add('pulse');
    }
  }

  setChallenges(list: Challenge[]) {
    const html = list
      .map((c) => {
        const prog = c.target >= 100 ? `${(c.progress / 1000).toFixed(1)}/${(c.target / 1000).toFixed(1)} km` : `${c.progress}/${c.target}`;
        return `<div class="ch${c.done ? ' done' : ''}"><span class="box">${c.done ? '✓' : ''}</span><span>${esc(c.text)}</span><em>${c.done ? `+${c.reward}€` : prog}</em></div>`;
      })
      .join('');
    if (html !== this.lastChallenges) {
      this.lastChallenges = html;
      this.el.challenges.innerHTML = html;
    }
  }

  setFinds(cards: number, secrets: number, totalSecrets: number) {
    const t = `✉ ${cards}/3 · 🗝 ${secrets}/${totalSecrets}`;
    if (this.el.finds.textContent !== t) this.el.finds.textContent = t;
  }

  setStreak(streak: number, mul: number) {
    if (streak === this.lastStreak) return;
    const up = streak > this.lastStreak;
    this.lastStreak = streak;
    this.el.streak.textContent = streak >= 2 ? `🔥 ${streak} on time · tips ×${mul.toFixed(1)}` : '';
    if (up && streak >= 2) {
      this.el.streak.classList.remove('bump');
      void this.el.streak.offsetWidth;
      this.el.streak.classList.add('bump');
    }
  }

  badge(title: string, desc: string, icon = '🏅') {
    this.badgeQueue.push({ title, desc, icon });
    if (!this.badgeBusy) this.nextBadge();
  }

  private nextBadge() {
    const b = this.badgeQueue.shift();
    if (!b) {
      this.badgeBusy = false;
      return;
    }
    this.badgeBusy = true;
    this.el.badge.innerHTML = `<span class="medal">${b.icon}</span><span><b>${esc(b.title)}</b>${esc(b.desc)}</span>`;
    this.el.badge.classList.add('show');
    setTimeout(() => {
      this.el.badge.classList.remove('show');
      setTimeout(() => this.nextBadge(), 500);
    }, 2800);
  }

  clearToast() {
    clearTimeout(this.toastTimer);
    this.el.toast.classList.remove('show');
  }

  setRadio(on: boolean) {
    this.el.radio.classList.toggle('on', on);
    this.el.toggle.textContent = on ? '❚❚' : '▶';
  }

  setTrack(t: Track) {
    this.el.track.textContent = t.title;
    this.el.key.textContent = `· ${t.key} · ${t.bpm} bpm`;
  }

  toast(text: string, sub = '', ms = 2400, big = false) {
    this.el.toast.classList.toggle('big', big);
    this.el.toast.classList.remove('show');
    void this.el.toast.offsetWidth;
    this.el.toast.innerHTML = '';
    this.el.toast.append(text);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      this.el.toast.append(s);
    }
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.el.toast.classList.remove('show'), ms);
  }
}
