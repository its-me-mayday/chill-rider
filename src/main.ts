import './styles.css';
import { AudioEngine } from './audio/audio';
import { advance, pickChallenges, reset, type Challenge, type ChallengeId } from './game/challenges';
import { Critters } from './game/critters';
import { lightAt } from './game/daylight';
import { Input } from './game/input';
import { generateMap, type GameMap } from './game/map';
import { Orders, type OrderEvent } from './game/orders';
import {
  addXp, bikeStats, checkAchievements, cosmeticColor, LEVEL_UNLOCKS, loadProfile, saveProfile, xpForLevel,
} from './game/profile';
import { Rider, type BumpEvent, type Mover } from './game/rider';
import { THEMES } from './game/themes';
import { Minimap } from './render/minimap';
import { Renderer } from './render/renderer';
import { Garage } from './ui/garage';
import { Hud } from './ui/hud';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement);
const input = new Input(canvas);
const hud = new Hud();
const audio = new AudioEngine();
const rider = new Rider();
const profile = loadProfile();
const garage = new Garage(profile);

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
let challenges: Challenge[] = [];
let postcards: { x: number; y: number; got: boolean }[] = [];
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
  critters = new Critters(map, 8 + Math.min(10, profile.level));
  challenges = pickChallenges(seed, profile.level);
  postcards = map.postcards.map((p) => ({ ...p, got: false }));
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

const volume = document.getElementById('volume') as HTMLInputElement;
try {
  volume.value = localStorage.getItem('chill-rider:volume') ?? '0.8';
} catch {
  /* ignore */
}
audio.setVolume(Number(volume.value));

// ------------------------------------------------------------ wiring
audio.radio.onTrack = (t) => hud.setTrack(t);
hud.setTrack(audio.radio.track);
hud.setXp(profile.level, profile.xp, xpForLevel(profile.level));

const toggleRadio = async () => {
  await audio.start();
  audio.radio.toggle();
  hud.setRadio(audio.radio.playing);
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
    case 'hud': hudVisible = !hudVisible; hud.setVisible(hudVisible); break;
    case 'pause': setPaused(!paused); break;
    case 'bell': ringBell(); break;
  }
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && started) openGarage();
});

document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => input.bindButton(el, el.dataset.act as 'brake'));
document.getElementById('t-bell')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  ringBell();
});
document.getElementById('radio-toggle')!.addEventListener('click', () => void toggleRadio());
document.getElementById('radio-next')!.addEventListener('click', () => audio.radio.next());
volume.addEventListener('input', () => {
  audio.setVolume(Number(volume.value));
  try {
    localStorage.setItem('chill-rider:volume', volume.value);
  } catch {
    /* ignore */
  }
});

const startEl = document.getElementById('start')!;
const pauseEl = document.getElementById('pause')!;
const completeEl = document.getElementById('complete')!;
const touchHint = document.getElementById('touch-hint')!;
const garageBtn = document.getElementById('garage-btn')!;

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
}

function setPaused(p: boolean) {
  if (!started || !completeEl.classList.contains('hidden') || garage.isOpen) return;
  paused = p;
  pauseEl.classList.toggle('hidden', !p);
}

let pausedBeforeGarage = false;
function openGarage() {
  if (garage.isOpen) return;
  pausedBeforeGarage = paused;
  paused = true;
  garage.open();
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
garageBtn.addEventListener('click', () => started && openGarage());
document.getElementById('complete-garage')!.addEventListener('click', () => openGarage());

document.getElementById('start-btn')!.addEventListener('click', () => void start());
document.getElementById('resume-btn')!.addEventListener('click', () => setPaused(false));
document.getElementById('next-map')!.addEventListener('click', () => {
  completeEl.classList.add('hidden');
  profile.townIndex++;
  save();
  loadMap();
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

// ------------------------------------------------------------ loop
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let hudAcc = 0;
let saveAcc = 0;
const bumps: BumpEvent[] = [];
const events: OrderEvent[] = [];

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused) return;

  time += dt;
  acc += dt;
  const controls = started ? input.read() : { pedal: 0, brake: false, steer: 0, aim: null };
  critters.update(dt, rider.x, rider.y, rider.speed);
  const movers: Mover[] = critters.obstacles().map((o) => ({ x: o.x, y: o.y, r: o.r, onHit: () => (o.w.bumped = 1.4) }));
  const odo = rider.odometer;
  while (acc >= STEP) {
    rider.update(STEP, controls, map, bumps, movers);
    acc -= STEP;
  }
  const light = lightAt(time + 15);
  if (started) {
    const moved = rider.odometer - odo;
    profile.stats.meters += moved;
    townMeters += moved;
    if (Math.floor(townMeters / 50) !== Math.floor((townMeters - moved) / 50)) adv('ride', Math.floor(townMeters), true);

    orders.update(dt, rider, time, bumps, events);
    for (const b of bumps) {
      audio.land(b.power / 3);
      renderer.burst('dust', b.x, b.y, 6);
      renderer.shake(Math.min(0.6, b.power / 8));
      reset(challenges, 'nobump');
      if (b.person) hud.toast('oops — sorry!', 'try the bell 🔔');
    }
    for (const ev of events) handle(ev, light.night);
    collectPostcards();
  }
  bumps.length = 0;
  events.length = 0;

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
  });

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
    });
    hud.setChallenges(challenges);
    hud.setStreak(orders.streak, orders.streakMul);
    garageBtn.classList.toggle('has-new', garage.hasAffordable());
    minimap.draw(rider, orders, target, time);
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
  get postcards() {
    return postcards;
  },
  warp: (s: number) => (time += s),
  next: () => {
    profile.townIndex++;
    loadMap();
  },
};
