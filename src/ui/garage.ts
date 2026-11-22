import {
  ACHIEVEMENTS, COSMETICS, UPGRADES, xpForLevel, type Profile, type UpgradeId,
} from '../game/profile';
import { THEMES } from '../game/themes';

type Tab = 'upgrades' | 'style' | 'album' | 'badges';
export type GarageMode = 'workshop' | 'boutique' | 'book';
const MODE_TABS: Record<GarageMode, Tab[]> = { workshop: ['upgrades'], boutique: ['style'], book: ['album', 'badges'] };
const MODE_TITLE: Record<GarageMode, string> = { workshop: 'Officina Ruota', boutique: 'Sartoria Sciarpa', book: 'Logbook' };

const $ = (id: string) => document.getElementById(id)!;

export class Garage {
  private el = $('garage');
  private body = $('g-body');
  private wallet = $('g-wallet');
  private tab: Tab = 'upgrades';
  isOpen = false;
  onClose: (() => void) | null = null;
  onBuy: (() => void) | null = null;

  constructor(private profile: Profile) {
    $('garage-close').addEventListener('click', () => this.close());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });
    $('g-tabs').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      this.tab = b.dataset.tab as Tab;
      this.render();
    });
    this.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-buy],[data-cos]');
      if (!b) return;
      if (b.dataset.buy) this.buyUpgrade(b.dataset.buy as UpgradeId);
      if (b.dataset.cos) this.cosmetic(b.dataset.cos);
    });
  }


  open(mode: GarageMode) {
    this.tab = MODE_TABS[mode][0];
    $('g-title').textContent = MODE_TITLE[mode];
    for (const b of $('g-tabs').querySelectorAll<HTMLElement>('button')) b.style.display = MODE_TABS[mode].includes(b.dataset.tab as Tab) ? '' : 'none';
    this.isOpen = true;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.onClose?.();
  }

  /** Is there anything affordable right now? Used for the dot on the HUD button. */
  hasAffordable() {
    const p = this.profile;
    return UPGRADES.some((u) => p.upgrades[u.id] < u.prices.length && p.wallet >= u.prices[p.upgrades[u.id]]);
  }

  private buyUpgrade(id: UpgradeId) {
    const p = this.profile;
    const def = UPGRADES.find((u) => u.id === id)!;
    const lvl = p.upgrades[id];
    const price = def.prices[lvl];
    if (price === undefined || p.wallet < price) return;
    p.wallet = Math.round((p.wallet - price) * 100) / 100;
    p.upgrades[id] = lvl + 1;
    this.onBuy?.();
    this.render();
  }

  private cosmetic(id: string) {
    const p = this.profile;
    const c = COSMETICS.find((x) => x.id === id)!;
    if (!p.owned.includes(id)) {
      if (p.wallet < c.price) return;
      p.wallet = Math.round((p.wallet - c.price) * 100) / 100;
      p.owned.push(id);
    }
    p.equipped[c.slot] = id;
    this.onBuy?.();
    this.render();
  }

  private render() {
    const p = this.profile;
    this.wallet.textContent = `${p.wallet.toFixed(2)} €`;
    for (const b of $('g-tabs').querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', b.dataset.tab === this.tab);

    if (this.tab === 'upgrades') {
      this.body.innerHTML = UPGRADES.map((u) => {
        const lvl = p.upgrades[u.id];
        const max = lvl >= u.prices.length;
        const price = u.prices[lvl];
        const pips = u.prices.map((_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
        return `<div class="g-item">
          <h3>${u.name}<span class="lv">${pips}</span></h3>
          <button class="buy" data-buy="${u.id}" ${max || p.wallet < price ? 'disabled' : ''}>${max ? 'Max' : `${price} €`}</button>
          <p>${max ? u.desc(lvl) : `${lvl ? u.desc(lvl) + ' → ' : ''}${u.desc(lvl + 1)}`}</p>
        </div>`;
      }).join('') + `<p class="g-sub">Tips are earned on every delivery — faster and gentler means more.</p>`;
    } else if (this.tab === 'style') {
      const slot = (s: 'frame' | 'beanie' | 'scarf', title: string) =>
        `<div class="g-sub">${title}</div><div class="swatches">${COSMETICS.filter((c) => c.slot === s)
          .map((c) => {
            const own = p.owned.includes(c.id);
            if (c.price < 0 && !own) {
              return `<button class="swatch locked" disabled title="${c.secret ?? ''}"><span class="dot" style="background:repeating-linear-gradient(45deg,#ecd9cf 0 4px,#fff 4px 8px)"></span>???<small>${c.secret ?? 'secret'}</small></button>`;
            }
            const on = p.equipped[s] === c.id;
            const bg = c.color === 'rainbow' ? 'linear-gradient(135deg,#ff8f8f,#ffd27a,#9fe3a8,#8fc8ff,#c9a3ff)' : c.color;
            return `<button class="swatch${on ? ' on' : ''}" data-cos="${c.id}" ${!own && p.wallet < c.price ? 'disabled' : ''}>
              <span class="dot" style="background:${bg}"></span>${c.name}<small>${on ? 'wearing' : own ? (c.price < 0 ? 'secret ✦' : 'owned') : `${c.price} €`}</small></button>`;
          })
          .join('')}</div>`;
      this.body.innerHTML = slot('frame', 'Bike paint') + slot('beanie', 'Beanie') + slot('scarf', 'Scarf');
    } else if (this.tab === 'album') {
      const towns = THEMES.map((t) => {
        const n = p.album[t.id] ?? 0;
        const shown = Math.min(n, 12);
        return `<div class="card-town"><b>${t.name}</b><span class="pcs">${'✉'.repeat(Math.min(shown, 6))}${shown > 6 ? '+' : ''}${n === 0 ? '<span style="opacity:.4">✉✉✉</span>' : ''}</span><div style="font-size:.78rem;color:#9a7a8c">${n} postcard${n === 1 ? '' : 's'} found</div></div>`;
      }).join('');
      const st = p.stats;
      const pct = st.deliveries ? Math.round((st.onTime / st.deliveries) * 100) : 0;
      const sec = (k: string, icon: string, name: string) => `<div class="card-town"><b>${icon} ${name}</b><div style="font-size:.78rem;color:#9a7a8c">${(p.secrets[k] ?? 0) ? `found ${p.secrets[k]}×` : 'not found yet'}</div></div>`;
      const secretsHtml = sec('chest', '🧰', 'Hidden chest') + sec('gnome', '🍄', 'Garden gnome') + sec('kitten', '🐱', 'Lost kitten') + sec('stargazer', '🔭', 'Stargazer (night)');
      this.body.innerHTML = `<div class="g-sub">Postcards</div><div class="album">${towns}</div>
        <div class="g-sub">Secrets</div><div class="album">${secretsHtml}</div>
        <div class="g-sub">Courier record</div>
        <div class="stats">
          <div>Level <b>${p.level} · ${Math.round(p.xp)}/${xpForLevel(p.level)} xp</b></div>
          <div>Deliveries <b>${st.deliveries}</b></div>
          <div>On time <b>${pct}%</b></div>
          <div>Best streak <b>${st.bestStreak}</b></div>
          <div>Distance <b>${(st.meters / 1000).toFixed(1)} km</b></div>
          <div>Towns <b>${st.towns}</b></div>
          <div>Tips earned <b>${st.tipsEarned.toFixed(2)} €</b></div>
          <div>VIP / rush <b>${st.vip} / ${st.rush}</b></div>
          <div>Night / rain <b>${st.night} / ${st.rain}</b></div>
          <div>Challenges <b>${st.challenges}</b></div>
          <div>Secrets <b>${st.secrets}</b></div>
        </div>`;
    } else {
      this.body.innerHTML = `<div class="g-sub">${p.achievements.length}/${ACHIEVEMENTS.length} unlocked</div><div class="badges">${ACHIEVEMENTS.map((a) => {
        const got = p.achievements.includes(a.id);
        return `<div class="bdg${got ? '' : ' locked'}"><b>${got ? '🏅' : '🔒'} ${a.name}</b>${a.desc}</div>`;
      }).join('')}</div>`;
    }
  }
}
