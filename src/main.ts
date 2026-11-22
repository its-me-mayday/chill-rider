import './styles.css';
import { AudioEngine } from './audio/audio';
import { advance, pickChallenges, reset, type Challenge, type ChallengeId } from './game/challenges';
import { Critters } from './game/critters';
import { busyness, lightAt } from './game/daylight';
import type { Secret } from './game/map';
import { Input } from './game/input';
import { generateMap, type GameMap } from './game/map';
import { Orders, type OrderEvent } from './game/orders';
import {
  addXp, bikeStats, checkAchievements, cosmeticColor, LEVEL_UNLOCKS, loadProfile, saveProfile, xpForLevel,
} from './game/profile';
import { Rider, type BumpEvent, type Mover } from './game/rider';
import { THEMES } from './game/themes';
import { Traffic, type TrafficEvent } from './game/traffic';
import { Minimap } from './render/minimap';
import { Renderer } from './render/renderer';
import { IPod } from './ui/ipod';
import { Garage, type GarageMode } from './ui/garage';
import { Quests, type Quest, type QuestEvent } from './game/quests';
import { signal } from './game/lights';
import { isService } from './game/themes';
import { Hud } from './ui/hud';
import { Portrait } from './ui/portrait';
import { DayClock } from './ui/clock';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement);
const input = new Input(canvas);
const hud = new Hud();
const audio = new AudioEngine();
const rider = new Rider();
const profile = loadProfile();
const garage = new Garage(profile);
const portrait = new Portrait(document.getElementById('portrait') as HTMLCanvasElement);
let restingToast = false;
const dayClock = new DayClock(document.getElementById('clock') as HTMLCanvasElement);
let potholeTip = false;

// one-time migration of tips from the previous version
try {
  const old = localStorage.getItem('chill-rider:tips2');
  if (old && !localStorage.getItem('chill-rider:migrated')) {
    profile.wallet += Number(old) || 0;
    localStorage.setItem('chill-rider:migrated', '1');
  }
} catch {
  /* ignore */
}

let map: GameMap;
let orders: Orders;
let critters: Critters;
let traffic: Traffic;
let quests: Quests;
let challenges: Challenge[] = [];
let postcards: { x: number; y: number; got: boolean }[] = [];
let secrets: (Secret & { got: boolean })[] = [];
let rain = false;
let townMeters = 0;
let started = false;
let paused = false;
let hudVisible = true;
let time = 0;

const save = () => saveProfile(profile);

function applyBike() {
  const st = bikeStats(profile);
  rider.stats = st;
  if (orders) orders.capacity = st.capacity;
}

function loadMap() {
  const theme = THEMES[profile.townIndex % THEMES.length];
  const seed = (Math.random() * 1e9) | 0;
  map = generateMap(theme, seed);
  rain = profile.townIndex > 0 && Math.random() < 0.3;
  const st = bikeStats(profile);
  orders = new Orders(map, { level: profile.level, town: profile.stats.towns, stats: st, rain });
  quests = new Quests(map, new Set());
  orders.exclude = new Set(quests.list.map((q) => q.giver.id));
  critters = new Critters(map, 8 + Math.min(10, profile.level));
  const woods = theme.id === 'woods';
  traffic = new Traffic(map, (woods ? 2 : 4) + Math.min(5, profile.stats.towns), 4 + Math.min(4, profile.level), map.spawn);
  challenges = pickChallenges(seed, profile.level);
  postcards = map.postcards.map((p) => ({ ...p, got: false }));
  secrets = map.secrets.map((p) => ({ ...p, got: false }));
  townMeters = 0;
  rider.place(map.spawn.x, map.spawn.y, map.spawn.heading);
  rider.wet = rain;
  applyBike();
  renderer.reset();
  minimap.setMap(map);
  hud.setPlace(`${theme.name}${rain ? ' ☂' : ''}`);
  hud.setChallenges(challenges);
  audio.setRain(rain);
}
loadMap();

let volume = 0.8;
try {
  volume = Number(localStorage.getItem('chill-rider:volume') ?? '0.8');
  const st = Number(localStorage.getItem('chill-rider:station') ?? '0');
  if (st > 0) audio.radio.setStation(st);
} catch {
  /* ignore */
}
audio.setVolume(volume);

// ------------------------------------------------------------ wiring
const ipod = new IPod(audio.radio, {
  play: async () => {
    await audio.start();
    await audio.radio.play();
    hud.setRadio(true);
  },
  volume: () => volume,
  setVolume: (v) => {
    volume = v;
    audio.setVolume(v);
    try {
      localStorage.setItem('chill-rider:volume', String(v));
    } catch {
      /* ignore */
    }
  },
  click: () => audio.wheelClick(),
  onStation: () => {
    hud.setRadio(audio.radio.playing);
    try {
      localStorage.setItem('chill-rider:station', String(audio.radio.stationIndex));
    } catch {
      /* ignore */
    }
  },
});
audio.radio.onTrack = (t) => {
  hud.setTrack(t);
  ipod.refresh(t);
};
hud.setTrack(audio.radio.track);
hud.setXp(profile.level, profile.xp, xpForLevel(profile.level));

const toggleRadio = async () => {
  await audio.start();
  audio.radio.toggle();
  hud.setRadio(audio.radio.playing);
  ipod.refresh();
};

function ringBell() {
  audio.bell();
  if (!started) return;
  profile.stats.bells++;
  const n = critters.bell(rider.x, rider.y);
  if (n > 0) onChallenge(advance(challenges, 'bell', n));
  checkBadges();
}

input.onToggle = (what) => {
  switch (what) {
    case 'radio': void toggleRadio(); break;
    case 'next': audio.radio.next(); break;
    case 'ipod': ipod.toggle(); break;
    case 'stPrev': ipod.step(-1); break;
    case 'stNext': ipod.step(1); break;
    case 'hud': hudVisible = !hudVisible; hud.setVisible(hudVisible); break;
    case 'pause': setPaused(!paused); break;
    case 'bell': ringBell(); break;
  }
};
window.addEventListener('keydown', (e) => {
  if ((e.code === 'KeyL' || e.code === 'KeyG') && started && !dialogQuest) openGarage('book');
  if (dialogQuest && (e.code === 'Enter' || e.code === 'KeyY')) answerDialog(true);
  if (dialogQuest && (e.code === 'Escape' || e.code === 'KeyN')) answerDialog(false);
});

document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => input.bindButton(el, el.dataset.act as 'brake' | 'pedal'));
document.getElementById('t-bell')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  ringBell();
});
document.getElementById('radio')!.addEventListener('click', () => ipod.toggle());

const startEl = document.getElementById('start')!;
const pauseEl = document.getElementById('pause')!;
const completeEl = document.getElementById('complete')!;
const touchHint = document.getElementById('touch-hint')!;
const bookBtn = document.getElementById('book-btn')!;
const pedalBtn = document.querySelector<HTMLElement>('.tbtn.pedal')!;

document.getElementById('start-profile')!.textContent =
  profile.stats.deliveries > 0
    ? `Welcome back · level ${profile.level} · ${profile.wallet.toFixed(2)} € · ${profile.stats.towns} towns done`
    : '';

async function start() {
  if (started) return;
  started = true;
  startEl.classList.add('hidden');
  hud.toast(map.theme.name, rain ? 'a rainy day — tips are better' : 'pick up your first order at a shop', 2800);
  await audio.start();
  await audio.radio.play();
  hud.setRadio(true);
  ipod.refresh();
}

function setPaused(p: boolean) {
  if (!started || !completeEl.classList.contains('hidden') || garage.isOpen) return;
  paused = p;
  pauseEl.classList.toggle('hidden', !p);
}

let pausedBeforeGarage = false;
function openGarage(mode: GarageMode) {
  if (garage.isOpen) return;
  pausedBeforeGarage = paused;
  paused = true;
  garage.open(mode);
}
garage.onClose = () => {
  paused = pausedBeforeGarage || !completeEl.classList.contains('hidden');
};
garage.onBuy = () => {
  applyBike();
  checkBadges();
  save();
  audio.pop();
};
bookBtn.addEventListener('click', () => started && openGarage('book'));
document.getElementById('rider-card')!.parentElement!.addEventListener('click', () => started && !paused && openGarage('book'));
document.getElementById('complete-garage')!.addEventListener('click', () => openGarage('book'));

// ---- quest dialog
const dialogEl = document.getElementById('dialog')!;
let dialogQuest: Quest | null = null;
function showDialog(q: Quest) {
  dialogQuest = q;
  document.getElementById('dlg-who')!.textContent = q.name;
  document.getElementById('dlg-text')!.textContent = q.intro;
  const limit = q.limit ? ` · ⏱ ${q.limit}s` : '';
  document.getElementById('dlg-reward')!.textContent = `${q.title} · reward ${q.reward} € + ${q.xp} xp${limit}`;
  dialogEl.classList.remove('hidden');
  paused = true;
}
function answerDialog(yes: boolean) {
  const q = dialogQuest;
  if (!q) return;
  dialogQuest = null;
  dialogEl.classList.add('hidden');
  paused = false;
  if (!yes) {
    hud.toast('Maybe later', `${q.name} will wait at the door`);
    return;
  }
  quests.accept(q, time);
  audio.pop();
  hud.toast(q.title, q.steps[0].text, 3200);
}
document.getElementById('dlg-yes')!.addEventListener('click', () => answerDialog(true));
document.getElementById('dlg-no')!.addEventListener('click', () => answerDialog(false));

function handleQuest(ev: QuestEvent) {
  const q = ev.quest;
  switch (ev.type) {
    case 'offer':
      showDialog(q);
      break;
    case 'step': {
      const st = q.steps[q.step];
      const prev = q.steps[q.step - 1];
      if (prev.ring) audio.pop();
      else audio.collect();
      renderer.burst('sparkle', prev.x, prev.y, 12);
      hud.toast(prev.ring ? `Checkpoint ${q.step}!` : 'Got it!', st.text, 2600);
      break;
    }
    case 'done': {
      profile.wallet = Math.round((profile.wallet + q.reward) * 100) / 100;
      profile.stats.quests++;
      const last = q.steps[q.steps.length - 1];
      renderer.confetti(last.x, last.y);
      renderer.floatText(last.x, last.y, `+${q.reward} €`, '#e0ccff', true);
      hud.badge('Quest complete!', q.thanks || `${q.title} · +${q.reward} €`, '📜');
      audio.fanfare();
      gainXp(q.xp);
      checkBadges();
      save();
      break;
    }
    case 'failed':
      hud.toast('Out of time!', `${q.name} says you can try again — stop by the door`, 3200);
      break;
    case 'closed':
      hud.toast(`${ev.shop.shop!.name} is closed`, 'come back when it opens');
      break;
  }
}

// ---- services: bike workshop and tailor
const serviceNear = new Set<number>();
let upgradeHinted = false;
function visitServices(hour: number) {
  for (const b of map.buildings) {
    if (b.kind !== 'shop' || !isService(b.shop)) continue;
    const d = Math.hypot(b.stopX - rider.x, b.stopY - rider.y);
    if (d > 6) serviceNear.delete(b.id);
    if (d > 3.2 || rider.speed > 1.4 || serviceNear.has(b.id)) continue;
    serviceNear.add(b.id);
    const open = b.shop!.hours.some(([o, c]) => (hour >= o && hour < c) || (hour + 24 >= o && hour + 24 < c));
    if (!open) {
      hud.toast(`${b.shop!.name} is closed`, `open ${b.shop!.hours.map(([o, c]) => `${o}–${c}`).join(', ')}`);
      continue;
    }
    openGarage(b.shop!.id === 'bikeshop' ? 'workshop' : 'boutique');
  }
  if (!upgradeHinted && garage.hasAffordable()) {
    upgradeHinted = true;
    hud.toast('You can afford an upgrade', 'ride to Officina Ruota 🔧 (see the minimap)', 3200);
  }
}

// ---- red lights
const lightInside = new Set<number>();
let redCooldown = 0;
function checkRedLights() {
  redCooldown = Math.max(0, redCooldown - 1 / 60);
  map.lights.forEach((l, i) => {
    const inside = rider.x > l.x0 && rider.x < l.x1 && rider.y > l.y0 && rider.y < l.y1;
    const was = lightInside.has(i);
    if (inside && !was) {
      lightInside.add(i);
      const axis = Math.abs(Math.cos(rider.heading)) > Math.abs(Math.sin(rider.heading)) ? 'h' : 'v';
      if (signal(l, time, axis) === 'red' && rider.speed > 2.5 && redCooldown <= 0) {
        redCooldown = 4;
        profile.stats.redLights++;
        profile.wallet = Math.max(0, Math.round((profile.wallet - 1) * 100) / 100);
        hud.toast('🚦 Red light!', 'the vigile saw you · -1 € fine', 2600);
        renderer.floatText(rider.x, rider.y, '-1 €', '#ff9a9a');
        reset(challenges, 'nobump');
      }
    } else if (!inside && was) lightInside.delete(i);
  });
}

document.getElementById('start-btn')!.addEventListener('click', () => void start());
document.getElementById('resume-btn')!.addEventListener('click', () => setPaused(false));
document.getElementById('next-map')!.addEventListener('click', () => {
  completeEl.classList.add('hidden');
  profile.townIndex++;
  save();
  loadMap();
  shopOpen.clear();
  serviceNear.clear();
  lightInside.clear();
  upgradeHinted = false;
  paused = false;
  hud.toast(map.theme.name, rain ? 'a rainy day — tips are better' : 'new town, new shops', 2800);
});
window.addEventListener('keydown', (e) => {
  if (!started && (e.code === 'Enter' || e.code === 'KeyW')) void start();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    save();
    setPaused(true);
  }
});
window.addEventListener('beforeunload', save);
canvas.addEventListener('pointerdown', () => touchHint.classList.add('gone'));

// ------------------------------------------------------------ progression
function gainXp(n: number) {
  const before = profile.level;
  const gained = addXp(profile, n);
  hud.setXp(profile.level, profile.xp, xpForLevel(profile.level), gained > 0);
  if (gained > 0) {
    const unlock = LEVEL_UNLOCKS[profile.level];
    setTimeout(() => {
      if (!completeEl.classList.contains('hidden') || orders.done) {
        hud.badge(`Level ${profile.level}!`, unlock ?? 'the town knows your bell now', '⭐');
        audio.fanfare();
        return;
      }
      hud.toast(`Level ${profile.level}!`, unlock ?? 'the town knows your bell now', 3200, true);
      renderer.confetti(rider.x, rider.y);
      audio.fanfare();
    }, 700);
    rider.health = 100;
    void before;
  }
}

function checkBadges() {
  for (const a of checkAchievements(profile)) hud.badge(a.name, a.desc);
}

function onChallenge(c: Challenge | null) {
  if (!c) return;
  const reward = Math.round(c.reward * (profile.level >= 4 ? 1.5 : 1) * 100) / 100;
  profile.wallet = Math.round((profile.wallet + reward) * 100) / 100;
  profile.stats.challenges++;
  hud.badge('Challenge complete', `${c.text} · +${reward} €`, '🎯');
  renderer.floatText(rider.x, rider.y - 1, `🎯 +${reward} €`, '#c9f2d0', true);
  audio.fanfare();
  gainXp(25);
  hud.setChallenges(challenges);
  checkBadges();
  save();
}
const adv = (id: ChallengeId, n = 1, abs = false) => onChallenge(advance(challenges, id, n, abs));

// ------------------------------------------------------------ events
function handle(ev: OrderEvent, nightNow: number) {
  switch (ev.type) {
    case 'pickup': {
      const o = ev.order;
      const tag = o.kind === 'rush' ? '⚡ rush · ' : o.kind === 'vip' ? '★ VIP · ' : '';
      hud.toast(`${o.item} for ${o.house.no} ${o.house.street}`, `${tag}${o.limit}s · ${o.fragile ? 'fragile — mind the trees' : o.hot ? `${o.shop.shop!.hotWord} — hurry for a bonus` : 'from ' + o.shop.shop!.name}`, 3000);
      renderer.toss(o.shop.doorX, o.shop.doorY, rider.x, rider.y, o.shop.shop!.roof);
      if (o.kind !== 'normal') renderer.floatText(rider.x, rider.y, o.kind === 'rush' ? '⚡ Rush!' : '★ VIP', '#ffe08a');
      audio.pop();
      break;
    }
    case 'full':
      hud.toast('Rack full', `you can carry ${orders.capacity} — upgrade it in the garage`);
      break;
    case 'near':
      hud.toast(`${ev.order.house.no} ${ev.order.house.street}`, `${ev.order.customer} is waiting · slow down at the glowing door`);
      break;
    case 'late':
      hud.toast(`Running late for ${ev.order.house.no} ${ev.order.house.street}`, 'deliver anyway — smaller tip');
      break;
    case 'damaged':
      hud.toast(`careful with ${ev.order.item}!`, `${Math.round(ev.order.condition * 100)}% intact`);
      break;
    case 'delivered': {
      const o = ev.order;
      const st = profile.stats;
      profile.wallet = Math.round((profile.wallet + ev.tip) * 100) / 100;
      st.tipsEarned = Math.round((st.tipsEarned + ev.tip) * 100) / 100;
      st.deliveries++;
      if (ev.onTime) st.onTime++;
      st.bestStreak = Math.max(st.bestStreak, ev.streak);
      if (o.kind === 'vip' && ev.onTime) st.vip++;
      if (o.kind === 'rush' && ev.onTime) st.rush++;
      if (nightNow > 0.6) st.night++;
      if (rain) st.rain++;

      const bits = [`+${ev.tip.toFixed(2)} €`];
      bits.push(ev.onTime ? `${Math.round(ev.left)}s to spare` : 'late');
      if (o.fragile && o.condition > 0.97) bits.push('not a scratch');
      if (ev.streak >= 2) bits.push(`streak ${ev.streak}`);
      hud.toast(`${o.customer} says thanks!`, bits.join(' · '));
      renderer.toss(rider.x, rider.y, o.house.doorX + o.house.nx * 0.8, o.house.doorY + o.house.ny * 0.8, o.shop.shop!.roof);
      setTimeout(() => {
        renderer.customer(o.house, ev.onTime);
        renderer.floatText(o.house.stopX, o.house.stopY, `+${ev.tip.toFixed(2)} €`, ev.onTime ? '#fff1b8' : '#ffc2c2', ev.tip > 6);
        renderer.burst('sparkle', o.house.stopX, o.house.stopY, 14);
        audio.sparkle();
      }, 450);
      if (ev.streak > 0 && ev.streak % 5 === 0) {
        renderer.confetti(rider.x, rider.y);
        hud.badge(`${ev.streak} in a row!`, 'the whole town is talking about you', '🔥');
      }

      gainXp(10 + Math.round(ev.tip * 2) + (ev.onTime ? 5 : 0) + (o.kind !== 'normal' ? 10 : 0));
      adv('nobump');
      if (o.hot && ev.onTime && ev.left / o.limit >= 0.5) adv('hot');
      if (o.fragile && o.condition > 0.97) adv('fragile');
      adv('streak', ev.streak, true);
      if (ev.elapsed < 25) adv('speedy');
      if (o.kind === 'rush' && ev.onTime) adv('rush');
      if (o.kind === 'vip' && ev.onTime && o.condition > 0.9) adv('vip');
      checkBadges();
      save();
      break;
    }
    case 'complete': {
      const st = profile.stats;
      st.towns++;
      if (ev.stars === 3) st.perfectTowns++;
      const bonus = ev.stars * 5;
      profile.wallet = Math.round((profile.wallet + bonus) * 100) / 100;
      gainXp(40 + ev.stars * 20);
      checkBadges();
      save();
      const stars = Array.from({ length: 3 }, (_, i) => `<span class="${i < ev.stars ? '' : 'off'}">★</span>`).join('');
      document.getElementById('stars')!.innerHTML = stars;
      document.getElementById('complete-title')!.textContent = `${map.theme.name} done`;
      document.getElementById('complete-text')!.textContent = `Next stop: ${THEMES[(profile.townIndex + 1) % THEMES.length].name}`;
      const found = postcards.filter((p) => p.got).length;
      const lines = [
        `⏱ ${ev.onTime}/${ev.total} on time`,
        `💶 ${ev.tips.toFixed(2)} € in tips + ${bonus} € town bonus`,
        ...challenges.map((c) => `${c.done ? '🎯' : '◻️'} ${c.text}`),
        `✉ ${found}/3 postcards found`,
      ];
      document.getElementById('complete-list')!.innerHTML = lines.map((l) => `<li>${l}</li>`).join('');
      setTimeout(() => {
        hud.clearToast();
        completeEl.classList.remove('hidden');
        paused = true;
        audio.fanfare();
      }, 1400);
      break;
    }
  }
}

function collectPostcards() {
  for (const p of postcards) {
    if (p.got || Math.hypot(p.x - rider.x, p.y - rider.y) > 1.8) continue;
    p.got = true;
    profile.stats.postcards++;
    profile.album[map.theme.id] = (profile.album[map.theme.id] ?? 0) + 1;
    profile.wallet = Math.round((profile.wallet + 3) * 100) / 100;
    const n = postcards.filter((c) => c.got).length;
    hud.badge(`Postcard ${n}/3`, `a hidden postcard from ${map.theme.name} · +3 €`, '✉');
    renderer.burst('sparkle', p.x, p.y, 20);
    renderer.floatText(p.x, p.y, '✉ +3 €', '#ffd1dc');
    audio.collect();
    gainXp(15);
    adv('cards', n, true);
    checkBadges();
    save();
  }
}

const SECRET_INFO: Record<Secret['kind'], { title: string; text: string; cash: number; xp: number; icon: string }> = {
  chest: { title: 'Hidden chest!', text: 'tucked under the leaves', cash: 12, xp: 30, icon: '🧰' },
  gnome: { title: 'A garden gnome', text: 'he was hiding behind the house', cash: 5, xp: 20, icon: '🍄' },
  kitten: { title: 'Lost kitten found', text: 'back home safe — the owner is grateful', cash: 8, xp: 25, icon: '🐱' },
  stargazer: { title: 'The stargazer', text: 'shares a look at the stars with you', cash: 10, xp: 40, icon: '🔭' },
};

const shopOpen = new Map<number, boolean>();
function announceShops(hour: number) {
  if (!started) return;
  for (const s of orders.shops) {
    const open = orders.isOpen(s);
    const was = shopOpen.get(s.id);
    shopOpen.set(s.id, open);
    if (was === undefined || was === open) continue;
    hud.badge(`${s.shop!.name} ${open ? 'is open' : 'just closed'}`, open ? 'new orders soon' : `see you tomorrow · it's ${Math.floor(hour)}:00`, open ? '🔓' : '🔒');
  }
}
document.getElementById('orders')!.addEventListener('click', (e) => {
  (e.currentTarget as HTMLElement).classList.toggle('open');
});

function discoverSecrets(night: number) {
  for (const s of secrets) {
    if (s.got) continue;
    if (s.night && night < 0.6) continue;
    const reach = s.kind === 'stargazer' ? 3 : 1.9;
    if (Math.hypot(s.x - rider.x, s.y - rider.y) > reach) continue;
    s.got = true;
    const info = SECRET_INFO[s.kind];
    profile.secrets[s.kind] = (profile.secrets[s.kind] ?? 0) + 1;
    profile.stats.secrets++;
    profile.wallet = Math.round((profile.wallet + info.cash) * 100) / 100;
    hud.badge(info.title, `${info.text} · +${info.cash} €`, info.icon);
    renderer.burst('sparkle', s.x, s.y, 26);
    renderer.confetti(s.x, s.y);
    renderer.floatText(s.x, s.y, `${info.icon} secret!`, '#ffe08a', true);
    audio.collect();
    audio.fanfare();
    gainXp(info.xp);
    // secret cosmetics
    const unlock = (id: string, name: string) => {
      if (profile.owned.includes(id)) return;
      profile.owned.push(id);
      hud.badge('New style unlocked', `${name} — wear it in the garage`, '✦');
    };
    if (s.kind === 'stargazer') unlock('beanie-starry', 'Starry beanie');
    if ((profile.secrets.chest ?? 0) >= 3) unlock('frame-treasure', 'Treasure bike paint');
    if ((profile.secrets.kitten ?? 0) >= 3) unlock('scarf-kitten', 'Kitten scarf');
    adv('secret', secrets.filter((x) => x.got).length, true);
    checkBadges();
    save();
  }
}

// ------------------------------------------------------------ loop
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let hudAcc = 0;
let saveAcc = 0;
const bumps: BumpEvent[] = [];
const events: OrderEvent[] = [];
const tEvents: TrafficEvent[] = [];
const qEvents: QuestEvent[] = [];
const GREETINGS = ['ciao!', 'nice basket!', 'chill ride!', 'buona giornata!', 'love the scarf!', 'see you around!'];

function handleTraffic(ev: TrafficEvent) {
  const d = Math.hypot(ev.v.x - rider.x, ev.v.y - rider.y);
  switch (ev.type) {
    case 'honk':
      audio.horn(d);
      break;
    case 'ring':
      audio.otherBell();
      break;
    case 'wave':
      renderer.floatText(ev.v.x, ev.v.y, GREETINGS[Math.floor(Math.random() * GREETINGS.length)], '#c9f2d0');
      if (Math.random() < 0.5) audio.otherBell();
      break;
    case 'hit': {
      const a = ev.v.heading;
      rider.x += Math.cos(a) * 1.2;
      rider.y += Math.sin(a) * 1.2;
      rider.heading = a + (Math.random() - 0.5);
      rider.speed = Math.min(6, ev.power * 0.6);
      rider.hurt(14 + ev.power * 1.5);
      rider.dizzy = 2;
      rider.wobble = 1;
      audio.horn(0);
      audio.land(1);
      renderer.shake(0.8);
      renderer.burst('dust', rider.x, rider.y, 10);
      renderer.floatText(rider.x, rider.y, 'beep! ouch!', '#ffb3b3', true);
      hud.toast('Watch the traffic!', 'cars drive on the right — keep to the edge', 3000);
      reset(challenges, 'nobump');
      break;
    }
  }
}

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused) return;

  time += dt;
  acc += dt;
  const controls = started ? input.read() : { pedal: 0, brake: false, steer: 0, aim: null };
  critters.update(dt, rider.x, rider.y, rider.speed);
  const movers: Mover[] = critters.obstacles().map((o) => ({ x: o.x, y: o.y, r: o.r, kind: 'person' as const, onHit: () => (o.w.bumped = 1.4) }));
  if (started) {
    const hourNow = lightAt(time).hour;
    const busy = busyness(hourNow);
    const nightNow = hourNow < 5.5 || hourNow >= 21.5;
    traffic.setDensity(busy, nightNow ? 0.25 : 0.55 + busy * 0.45, rider.x, rider.y);
    critters.setDensity(nightNow ? 0.2 : 0.5 + busy * 0.5, rider.x, rider.y);
    traffic.update(dt, rider.x, rider.y, rider.speed, tEvents, time);
    for (const m of traffic.movers()) movers.push({ ...m, onHit: () => (m.v.honk = 4) });
  }
  const odo = rider.odometer;
  while (acc >= STEP) {
    rider.update(STEP, controls, map, bumps, movers);
    acc -= STEP;
  }
  const light = lightAt(time);
  orders.hour = light.hour;
  if (started) {
    const moved = rider.odometer - odo;
    profile.stats.meters += moved;
    townMeters += moved;
    if (Math.floor(townMeters / 50) !== Math.floor((townMeters - moved) / 50)) adv('ride', Math.floor(townMeters), true);

    orders.update(dt, rider, time, bumps, events);
    for (const b of bumps) {
      audio.land(b.power / 3);
      renderer.burst('dust', b.x, b.y, b.type === 'slip' ? 12 : 6);
      renderer.shake(Math.min(0.7, b.power / (b.type === 'slip' ? 6 : 8)));
      reset(challenges, 'nobump');
      if (b.what === 'pothole') {
        renderer.floatText(rider.x, rider.y, 'bump!', '#ffd27a');
        if (!potholeTip) {
          potholeTip = true;
          hud.toast('Pothole!', 'patched-up streets are bumpy — slow down or ride around them');
        }
      } else if (b.type === 'slip') {
        hud.toast('whoops — slipped!', rider.wet ? 'wet grass is slippery, ease off the turns' : 'loose ground — take the corner slower');
        renderer.floatText(rider.x, rider.y, 'ouch!', '#ffb3b3');
      } else if (b.what === 'car') {
        hud.toast('bonk! into a car', 'ouch — mind the traffic');
        renderer.floatText(rider.x, rider.y, 'ouch!', '#ffb3b3');
      } else if (b.what === 'rider') hud.toast('sorry, fellow rider!', 'ring the bell to say hi instead 🔔');
      else if (b.person) hud.toast('oops — sorry!', 'try the bell 🔔');
      else if (b.power > 3.5) renderer.floatText(rider.x, rider.y, 'bonk!', '#ffd27a');
      if (rider.health < 35 && !restingToast) {
        restingToast = true;
        hud.toast('Feeling bruised', 'stop at the café to rest and heal ☕', 3200);
      }
    }
    // resting at a café heals you
    const cafe = orders.shops.find((s) => s.shop!.id === 'cafe' && Math.hypot(s.stopX - rider.x, s.stopY - rider.y) < 4);
    rider.resting = !!cafe && rider.speed < 0.6;
    if (rider.health > 70) restingToast = false;
    for (const ev of events) handle(ev, light.night);
    for (const ev of tEvents) handleTraffic(ev);
    collectPostcards();
    discoverSecrets(light.night);
    quests.update(rider.x, rider.y, rider.speed, time, light.hour, qEvents);
    for (const ev of qEvents) handleQuest(ev);
    qEvents.length = 0;
    visitServices(light.hour);
    checkRedLights();
  }
  bumps.length = 0;
  events.length = 0;
  tEvents.length = 0;

  const target = started ? orders.target(rider) : null;
  audio.update(dt, rider.speed, false, rider.pedalling);
  renderer.updateCamera(rider, map, dt);
  renderer.render({
    map, rider, orders: started ? orders : null, target, light, time, dt, joy: input.joy,
    critters, postcards, rain,
    style: {
      frame: cosmeticColor(profile.equipped.frame),
      beanie: cosmeticColor(profile.equipped.beanie),
      scarf: cosmeticColor(profile.equipped.scarf),
    },
    headlight: rider.stats.light,
    traffic,
    secrets,
    quests: started ? quests : null,
  });
  dayClock.draw(light.hour, light.night);

  portrait.draw(rider, time, { beanie: cosmeticColor(profile.equipped.beanie), scarf: cosmeticColor(profile.equipped.scarf) }, rain);

  hudAcc += dt;
  if (hudAcc > 0.1) {
    hudAcc = 0;
    hud.update({
      speed: rider.speed,
      phase: light.name,
      orders,
      time,
      tips: profile.wallet,
      targetId: target?.order?.id ?? null,
      riderX: rider.x,
      riderY: rider.y,
      surface: ['grass', 'road', 'water', 'sand', 'plaza', 'gravel', 'closed road'][rider.surface] ?? '',
      braking: rider.braking && rider.speed > 0.5,
    });
    pedalBtn.classList.toggle('spin', rider.pedalling && rider.speed > 0.5);
    hud.setChallenges(challenges);
    hud.setFinds(postcards.filter((p) => p.got).length, secrets.filter((x) => x.got).length, secrets.length);
    hud.setStreak(orders.streak, orders.streakMul);
    announceShops(light.hour);
    hud.setQuests(quests, time);
    minimap.draw(rider, orders, target, time, quests);
    ipod.tick();
  }
  saveAcc += dt;
  if (saveAcc > 8) {
    saveAcc = 0;
    if (started) save();
  }
}

requestAnimationFrame(frame);

// tiny debug handle for tinkering from the console
(window as unknown as { chill: unknown }).chill = {
  rider,
  renderer,
  audio,
  profile,
  get map() {
    return map;
  },
  get orders() {
    return orders;
  },
  get critters() {
    return critters;
  },
  get traffic() {
    return traffic;
  },
  get postcards() {
    return postcards;
  },
  get secrets() {
    return secrets;
  },
  get quests() {
    return quests;
  },
  warp: (s: number) => (time += s),
  next: () => {
    profile.townIndex++;
    loadMap();
  },
};
