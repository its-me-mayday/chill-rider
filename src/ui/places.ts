import { DISTRICTS } from '../game/cities';
import { CITY_THEMES, THEMES } from '../game/themes';
import type { Profile } from '../game/profile';

const TOWN_EMOJI: Record<string, string> = { village: '🍑', seaside: '🐚', woods: '🌲', oldtown: '🏛' };
const TOWN_BLURB: Record<string, string> = {
  village: 'orchards, gardens and quiet lanes',
  seaside: 'a beach, boats and sea breeze',
  woods: 'pine forest, logs and ponds',
  oldtown: 'cobbles, piazzas and fountains',
};

/** The destination picker: the town tour or a neighbourhood of a famous city. */
export class Places {
  isOpen = false;
  private root = document.getElementById('places')!;
  private body = document.getElementById('places-body')!;
  onPick: ((id: string, townIndex: number) => void) | null = null;

  constructor(private profile: Profile) {
    document.getElementById('places-close')!.addEventListener('click', () => this.close());
  }

  open() {
    this.isOpen = true;
    this.render();
    this.root.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.root.classList.add('hidden');
  }

  private render() {
    const p = this.profile;
    this.body.innerHTML = '';
    // famous cities first
    const cities = [...new Set(DISTRICTS.map((d) => d.city))];
    for (const city of cities) {
      const ds = DISTRICTS.filter((d) => d.city === city);
      const head = document.createElement('div');
      head.className = 'pl-city';
      head.innerHTML = `<b>${ds[0].flag} ${ds[0].cityName}</b><small>big city · cycle superhighways · traffic keeps left</small>`;
      this.body.append(head);
      const grid = document.createElement('div');
      grid.className = 'pl-grid';
      for (const d of ds) {
        const id = `london-${d.id}`;
        const th = CITY_THEMES.find((t) => t.id === id)!;
        const b = document.createElement('button');
        b.className = 'pl-card' + (p.place === id ? ' on' : '');
        const sights = d.landmarks.map((l) => `<span class="${p.seen.includes(l.name) ? 'seen' : ''}">${p.seen.includes(l.name) ? '📸 ' : ''}${l.name}</span>`).join('');
        b.innerHTML = `<span class="em">🎡</span><h3>${d.name}</h3><p>${d.blurb}</p><span class="tag">🚲 cycle tracks · ${d.bridges.length} bridges</span><div class="sights">${sights}</div>`;
        if (d.id === 'westminster') b.querySelector('.em')!.textContent = '🕰';
        if (d.id === 'city') b.querySelector('.em')!.textContent = '🏰';
        b.addEventListener('click', () => this.onPick?.(th.id, p.townIndex));
        grid.append(b);
      }
      this.body.append(grid);
    }
    // the town tour
    const head = document.createElement('div');
    head.className = 'pl-city';
    head.innerHTML = `<b>🚲 Town tour</b><small>small towns, one after the other</small>`;
    this.body.append(head);
    const grid = document.createElement('div');
    grid.className = 'pl-grid';
    THEMES.forEach((t, i) => {
      const b = document.createElement('button');
      const cur = !p.place && p.townIndex % THEMES.length === i;
      b.className = 'pl-card' + (cur ? ' on' : '');
      const cards = p.album[t.id] ?? 0;
      b.innerHTML = `<span class="em">${TOWN_EMOJI[t.id] ?? '🏡'}</span><h3>${t.name}</h3><p>${TOWN_BLURB[t.id] ?? ''}</p><span class="tag">✉ ${cards} postcards found</span>`;
      // keep the tour counter moving forward
      const idx = p.townIndex - (p.townIndex % THEMES.length) + i;
      b.addEventListener('click', () => this.onPick?.('', idx));
      grid.append(b);
    });
    this.body.append(grid);
  }
}
