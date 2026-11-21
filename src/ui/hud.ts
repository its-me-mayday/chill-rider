import type { Track } from '../audio/radio';
import { MAP_GOAL, type Orders } from '../game/orders';

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
  };
  private last = '';
  private toastTimer = 0;

  setVisible(v: boolean) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  setPlace(name: string) {
    this.el.place.textContent = name;
  }

  update(s: { speed: number; phase: string; orders: Orders; time: number; tips: number; targetId: number | null; riderX: number; riderY: number }) {
    this.el.speed.textContent = String(Math.round(s.speed * 3.6));
    if (this.el.phase.textContent !== s.phase) this.el.phase.textContent = s.phase;

    const o = s.orders;
    const pips = Array.from({ length: MAP_GOAL }, (_, i) => `<i class="${i < o.delivered ? 'on' : ''}"></i>`).join('');
    const goal = `Deliveries ${o.delivered}/${MAP_GOAL}<span class="pips">${pips}</span>`;

    let rows: string;
    if (!o.carried.length) {
      const anyWaiting = [...o.waiting.values()].some(Boolean);
      rows = `<div class="order empty">${anyWaiting ? 'Ride to a shop with a 📦 to pick up an order' : 'Shops are preparing orders…'}</div>`;
    } else {
      rows = [...o.carried]
        .sort((a, b) => a.deadline - b.deadline)
        .map((ord) => {
          const left = ord.deadline - s.time;
          const [r, g, b] = ord.shop.shop!.roof;
          const cls = left < 0 ? 'late' : left < 12 ? 'warn' : '';
          const cond = ord.fragile ? ` · <b>fragile</b><span class="cond"><i style="width:${Math.round(ord.condition * 100)}%"></i></span>` : '';
          const d = Math.round(Math.hypot(ord.house.stopX - s.riderX, ord.house.stopY - s.riderY));
          return `<div class="order${s.targetId === ord.id ? ' target' : ''}">
            <span class="sw" style="background:rgb(${r},${g},${b})"></span>
            <span class="addr">${ord.house.no} ${esc(ord.house.street)}</span>
            <span class="timer ${cls}">${left < 0 ? 'late' : fmt(left)}</span>
            <span class="what">${esc(ord.item)} · ${esc(ord.shop.shop!.name)}${cond} · ${d} m</span>
          </div>`;
        })
        .join('');
    }
    const tips = `${s.tips.toFixed(2)} € <small>tips</small>`;
    const key = goal + rows + tips;
    if (key !== this.last) {
      this.last = key;
      this.el.goal.innerHTML = goal;
      this.el.orders.innerHTML = rows;
      this.el.tips.innerHTML = tips;
    }
  }

  setRadio(on: boolean) {
    this.el.radio.classList.toggle('on', on);
    this.el.toggle.textContent = on ? '❚❚' : '▶';
  }

  setTrack(t: Track) {
    this.el.track.textContent = t.title;
    this.el.key.textContent = `· ${t.key} · ${t.bpm} bpm`;
  }

  toast(text: string, sub = '', ms = 2400) {
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
