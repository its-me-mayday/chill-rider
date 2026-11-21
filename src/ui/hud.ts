import type { Track } from '../audio/radio';

const PLACES = [
  'Sunset Boulevard', 'Peach Valley', 'Lavender Hills', 'Old Mill Road', 'Cassette Creek',
  'Marmalade Pass', 'Slow Lane', 'Honey Fields', 'Velvet Ridge', 'Postcard Point',
  'Quiet Orchard', 'Daydream Drive', 'Apricot Bend', 'Lantern Row', 'Near Eternity',
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private el = {
    hud: $('hud'),
    dist: $('dist'),
    phase: $('phase'),
    best: $('best'),
    place: $('place'),
    speed: $('speed'),
    cruise: $('cruise'),
    toast: $('toast'),
    radio: $('radio'),
    track: $('radio-track'),
    key: $('radio-key'),
    toggle: $<HTMLButtonElement>('radio-toggle'),
    tCruise: $('t-cruise'),
  };
  private placeIdx = -1;
  private toastTimer = 0;
  private acc = 0;

  constructor() {}

  setVisible(v: boolean) {
    this.el.hud.classList.toggle('hidden', !v);
  }

  update(dt: number, s: { distance: number; speed: number; phase: string; best: number }) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    this.el.speed.textContent = String(Math.round(s.speed * 3.6));
    this.el.dist.textContent = (s.distance / 1000).toFixed(2);
    if (this.el.phase.textContent !== s.phase) this.el.phase.textContent = s.phase;
    const best = s.best > 50 ? `best ${(s.best / 1000).toFixed(2)} km` : '';
    if (this.el.best.textContent !== best) this.el.best.textContent = best;

    const idx = Math.floor(s.distance / 1200);
    if (idx !== this.placeIdx) {
      const first = this.placeIdx === -1;
      this.placeIdx = idx;
      const name = PLACES[idx % PLACES.length];
      if (first) this.el.place.textContent = name;
      else {
        this.el.place.classList.add('fade');
        setTimeout(() => {
          this.el.place.textContent = name;
          this.el.place.classList.remove('fade');
        }, 900);
        this.toast(name, 'now entering');
      }
    }
  }

  setCruise(on: boolean) {
    this.el.cruise.classList.toggle('on', on);
    this.el.tCruise.classList.toggle('on', on);
  }

  setRadio(on: boolean) {
    this.el.radio.classList.toggle('on', on);
    this.el.toggle.textContent = on ? '❚❚' : '▶';
  }

  setTrack(t: Track) {
    this.el.track.textContent = t.title;
    this.el.key.textContent = `· ${t.key} · ${t.bpm} bpm`;
  }

  toast(text: string, sub = '') {
    this.el.toast.innerHTML = '';
    this.el.toast.append(text);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      this.el.toast.append(s);
    }
    this.el.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.el.toast.classList.remove('show'), 2200);
  }
}
