import { STATIONS, type Radio, type Track } from '../audio/radio';

type Screen = 'menu' | 'now';

interface Item {
  label: string;
  hint?: string;
  run: () => void;
  station?: number;
}

/**
 * A little click-wheel music player for the radio. Spin the wheel to scroll
 * (or change volume on the Now Playing screen), press the hub to pick.
 * It never pauses the game.
 */
export class IPod {
  isOpen = false;
  private root = document.getElementById('ipod')!;
  private list = document.getElementById('ip-list')!;
  private wheel = document.getElementById('ip-wheel')!;
  private screen: Screen = 'now';
  private sel = 0;
  private items: Item[] = [];
  private spinId: number | null = null;
  private lastAngle = 0;
  private acc = 0;
  private moved = 0;
  private volTimer = 0;
  private el = {
    title: document.getElementById('ip-title')!,
    play: document.getElementById('ip-play')!,
    station: document.getElementById('ip-station')!,
    track: document.getElementById('ip-track')!,
    sub: document.getElementById('ip-sub')!,
    icon: document.getElementById('ip-icon')!,
    prog: document.getElementById('ip-prog')!,
    vol: document.getElementById('ip-vol-bar')!,
  };

  constructor(
    private radio: Radio,
    private hooks: {
      play: () => Promise<void> | void;
      volume: () => number;
      setVolume: (v: number) => void;
      click: () => void;
      onStation: () => void;
    },
  ) {
    this.wheel.addEventListener('pointerdown', (e) => this.spinStart(e));
    this.wheel.addEventListener('pointermove', (e) => this.spinMove(e));
    const end = (e: PointerEvent) => this.spinEnd(e);
    this.wheel.addEventListener('pointerup', end);
    this.wheel.addEventListener('pointercancel', end);
    this.wheel.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scroll(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    document.getElementById('ipod-close')!.addEventListener('click', () => this.close());
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('resize', () => this.isOpen && this.place());
  }

  private build() {
    const r = this.radio;
    this.items = STATIONS.map((st, i) => ({
      label: `${st.icon} ${st.name}`,
      hint: st.freq,
      station: i,
      run: () => this.tune(i),
    }));
    this.items.push(
      { label: '⏭ Skip this song', run: () => { r.next(); this.show('now'); } },
      { label: r.playing ? '❚❚ Pause' : '▶ Play', run: () => { void this.togglePlay(); } },
      { label: '♪ Now Playing', run: () => this.show('now') },
    );
  }

  private renderList() {
    this.build();
    this.list.innerHTML = '';
    // keep the selection in view: 5 rows fit
    const rows = 5;
    const first = Math.max(0, Math.min(this.items.length - rows, this.sel - 2));
    this.items.slice(first, first + rows).forEach((it, k) => {
      const li = document.createElement('li');
      const i = first + k;
      if (i === this.sel) li.className = 'sel';
      if (it.station === this.radio.stationIndex) li.classList.add('live');
      const a = document.createElement('span');
      a.textContent = it.label;
      li.append(a);
      const b = document.createElement('small');
      b.textContent = it.hint ?? (it.station === undefined ? '›' : '');
      li.append(b);
      li.addEventListener('click', () => {
        this.sel = i;
        this.select();
      });
      this.list.append(li);
    });
  }

  refresh(t: Track = this.radio.track) {
    const st = t.station;
    this.root.style.setProperty('--st-a', st.color[0]);
    this.root.style.setProperty('--st-b', st.color[1]);
    this.el.station.textContent = st.name;
    this.el.track.textContent = t.title;
    this.el.sub.textContent = `${st.freq} FM · ${t.key} · ${t.bpm} bpm · ${st.tagline}`;
    this.el.icon.textContent = st.icon;
    this.el.play.textContent = this.radio.playing ? '▶' : '❚❚';
    this.root.classList.toggle('playing', this.radio.playing);
    this.el.vol.style.width = `${Math.round(this.hooks.volume() * 100)}%`;
    if (this.screen === 'menu') this.renderList();
  }

  /** called every frame-ish from the game loop while open */
  tick() {
    if (!this.isOpen) return;
    this.el.prog.style.width = `${(this.radio.progress * 100).toFixed(1)}%`;
  }

  private show(s: Screen) {
    this.screen = s;
    this.root.classList.toggle('now', s === 'now');
    this.el.title.textContent = s === 'now' ? 'Now Playing' : 'Radio';
    if (s === 'menu') {
      this.sel = this.radio.stationIndex;
      this.renderList();
    }
    this.refresh();
  }

  open(screen: Screen = 'menu') {
    this.isOpen = true;
    this.place();
    this.root.classList.remove('hidden');
    this.show(screen);
  }

  /** sit right above the radio pill, wherever the layout put it */
  private place() {
    const pill = document.getElementById('radio')!.getBoundingClientRect();
    if (!pill.width) return;
    const w = this.root.offsetWidth || 210;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, pill.left));
    this.root.style.left = `${left}px`;
    this.root.style.bottom = `${Math.max(8, window.innerHeight - pill.top + 10)}px`;
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  private async togglePlay() {
    if (this.radio.playing) this.radio.stop();
    else await this.hooks.play();
    this.refresh();
  }

  private tune(i: number) {
    if (i !== this.radio.stationIndex || !this.radio.playing) {
      if (!this.radio.playing) void this.hooks.play();
      this.radio.setStation(i);
      this.hooks.onStation();
    }
    this.show('now');
  }

  /** ⏮ / ⏭ on the wheel, also , and . on the keyboard */
  step(dir: number) {
    this.radio.setStation(this.radio.stationIndex + dir);
    if (!this.radio.playing) void this.hooks.play();
    this.hooks.onStation();
    if (this.isOpen && this.screen === 'menu') this.sel = this.radio.stationIndex;
    this.refresh();
  }

  private flash(which: string) {
    const b = this.root.querySelector(`[data-ip="${which}"]`);
    b?.classList.add('flash');
    setTimeout(() => b?.classList.remove('flash'), 140);
  }

  private press(which: string) {
    this.hooks.click();
    this.flash(which);
    switch (which) {
      case 'menu':
        if (this.screen === 'now') this.show('menu');
        else this.close();
        break;
      case 'prev': this.step(-1); break;
      case 'next': this.step(1); break;
      case 'play': void this.togglePlay(); break;
      case 'select': this.select(); break;
    }
  }

  private select() {
    if (this.screen === 'menu') this.items[this.sel]?.run();
    else this.show('menu');
  }

  private scroll(dir: number) {
    this.hooks.click();
    if (this.screen === 'menu') {
      this.sel = Math.max(0, Math.min(this.items.length - 1, this.sel + dir));
      this.renderList();
    } else {
      const v = Math.max(0, Math.min(1, this.hooks.volume() + dir * 0.05));
      this.hooks.setVolume(v);
      this.el.vol.style.width = `${Math.round(v * 100)}%`;
      this.root.classList.add('vol');
      clearTimeout(this.volTimer);
      this.volTimer = window.setTimeout(() => this.root.classList.remove('vol'), 1400);
    }
  }

  // ------------------------------------------------------------ wheel
  private angle(e: PointerEvent) {
    const r = this.wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }

  private spinStart(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.spinId = e.pointerId;
    this.lastAngle = this.angle(e);
    this.acc = 0;
    this.moved = 0;
    try {
      this.wheel.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.wheel.classList.add('spin');
  }

  private spinMove(e: PointerEvent) {
    if (e.pointerId !== this.spinId) return;
    const a = this.angle(e);
    let d = a - this.lastAngle;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    this.lastAngle = a;
    this.acc += d;
    this.moved += Math.abs(d);
    const STEP = Math.PI / 6; // one notch every 30°
    while (this.acc > STEP) {
      this.acc -= STEP;
      this.scroll(1);
    }
    while (this.acc < -STEP) {
      this.acc += STEP;
      this.scroll(-1);
    }
  }

  private spinEnd(e: PointerEvent) {
    if (e.pointerId !== this.spinId) return;
    this.spinId = null;
    this.wheel.classList.remove('spin');
    if (this.moved < 0.25) {
      // a tap, not a spin: which button is under the finger?
      const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const which = t?.closest<HTMLElement>('[data-ip]')?.dataset.ip;
      if (which) this.press(which);
    }
  }
}
