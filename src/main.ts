import './styles.css';
import { AudioEngine } from './audio/audio';
import { lightAt } from './game/daylight';
import { Input } from './game/input';
import { generateMap, type GameMap } from './game/map';
import { Orders, type OrderEvent } from './game/orders';
import { Rider, type BumpEvent } from './game/rider';
import { THEMES } from './game/themes';
import { Minimap } from './render/minimap';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';

const store = {
  get(key: string, fallback: number) {
    try {
      const v = localStorage.getItem(`chill-rider:${key}`);
      return v === null ? fallback : Number(v);
    } catch {
      return fallback;
    }
  },
  set(key: string, v: number) {
    try {
      localStorage.setItem(`chill-rider:${key}`, String(v));
    } catch {
      /* storage unavailable — fine */
    }
  },
};

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement);
const input = new Input(canvas);
const hud = new Hud();
const audio = new AudioEngine();
const rider = new Rider();

let mapIndex = store.get('maps', 0);
let totalTips = store.get('tips2', 0);
let map: GameMap;
let orders: Orders;
let started = false;
let paused = false;
let hudVisible = true;
let time = 0;

function loadMap(index: number) {
  const theme = THEMES[index % THEMES.length];
  const seed = (Math.random() * 1e9) | 0;
  map = generateMap(theme, seed);
  orders = new Orders(map);
  rider.place(map.spawn.x, map.spawn.y, map.spawn.heading);
  renderer.reset();
  minimap.setMap(map);
  hud.setPlace(theme.name);
}
loadMap(mapIndex);

const volume = document.getElementById('volume') as HTMLInputElement;
volume.value = String(store.get('volume', 0.8));
audio.setVolume(Number(volume.value));

// ------------------------------------------------------------ wiring
audio.radio.onTrack = (t) => hud.setTrack(t);
hud.setTrack(audio.radio.track);

const toggleRadio = async () => {
  await audio.start();
  audio.radio.toggle();
  hud.setRadio(audio.radio.playing);
};

input.onToggle = (what) => {
  switch (what) {
    case 'radio': void toggleRadio(); break;
    case 'next': audio.radio.next(); break;
    case 'hud': hudVisible = !hudVisible; hud.setVisible(hudVisible); break;
    case 'pause': setPaused(!paused); break;
    case 'bell': audio.bell(); break;
  }
};

document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => input.bindButton(el, el.dataset.act as 'brake'));
document.getElementById('t-bell')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  audio.bell();
});
document.getElementById('radio-toggle')!.addEventListener('click', () => void toggleRadio());
document.getElementById('radio-next')!.addEventListener('click', () => audio.radio.next());
volume.addEventListener('input', () => {
  const v = Number(volume.value);
  audio.setVolume(v);
  store.set('volume', v);
});

const startEl = document.getElementById('start')!;
const pauseEl = document.getElementById('pause')!;
const completeEl = document.getElementById('complete')!;
const touchHint = document.getElementById('touch-hint')!;

async function start() {
  if (started) return;
  started = true;
  startEl.classList.add('hidden');
  hud.toast(map.theme.name, 'pick up your first order at a shop');
  await audio.start();
  await audio.radio.play();
  hud.setRadio(true);
}

function setPaused(p: boolean) {
  if (!started || !completeEl.classList.contains('hidden')) return;
  paused = p;
  pauseEl.classList.toggle('hidden', !p);
}

document.getElementById('start-btn')!.addEventListener('click', () => void start());
document.getElementById('resume-btn')!.addEventListener('click', () => setPaused(false));
document.getElementById('next-map')!.addEventListener('click', () => {
  completeEl.classList.add('hidden');
  mapIndex++;
  store.set('maps', mapIndex);
  loadMap(mapIndex);
  paused = false;
  hud.toast(map.theme.name, 'new town, new shops');
});
window.addEventListener('keydown', (e) => {
  if (!started && (e.code === 'Enter' || e.code === 'KeyW')) void start();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});
canvas.addEventListener('pointerdown', () => touchHint.classList.add('gone'));

// ------------------------------------------------------------ events
function handle(ev: OrderEvent) {
  switch (ev.type) {
    case 'pickup': {
      const o = ev.order;
      hud.toast(`${o.item} for ${o.house.no} ${o.house.street}`, `${o.limit}s · ${o.fragile ? 'fragile — mind the trees' : o.hot ? 'still warm — hurry for a bonus' : 'from ' + o.shop.shop!.name}`, 3000);
      audio.sparkle();
      break;
    }
    case 'full':
      hud.toast('Basket full', 'deliver something first');
      break;
    case 'near':
      hud.toast(`${ev.order.house.no} ${ev.order.house.street}`, 'slow down at the glowing door');
      break;
    case 'late':
      hud.toast(`Running late for ${ev.order.house.no} ${ev.order.house.street}`, 'deliver anyway — smaller tip');
      break;
    case 'damaged':
      hud.toast(`careful with ${ev.order.item}!`, `${Math.round(ev.order.condition * 100)}% intact`);
      break;
    case 'delivered': {
      totalTips = Math.round((totalTips + ev.tip) * 100) / 100;
      store.set('tips2', totalTips);
      const bits = [`+${ev.tip.toFixed(2)} €`];
      bits.push(ev.onTime ? `${Math.round(ev.left)}s to spare` : 'late');
      if (ev.order.fragile && ev.order.condition > 0.97) bits.push('not a scratch');
      hud.toast(`Delivered to ${ev.order.house.no} ${ev.order.house.street}`, bits.join(' · '));
      renderer.burst('sparkle', ev.order.house.stopX, ev.order.house.stopY, 18);
      audio.sparkle();
      break;
    }
    case 'complete': {
      const stars = Array.from({ length: 3 }, (_, i) => `<span class="${i < ev.stars ? '' : 'off'}">★</span>`).join('');
      document.getElementById('stars')!.innerHTML = stars;
      document.getElementById('complete-title')!.textContent = `${map.theme.name} done`;
      document.getElementById('complete-text')!.textContent =
        `${ev.onTime}/${ev.total} on time · ${ev.tips.toFixed(2)} € in tips. Next stop: ${THEMES[(mapIndex + 1) % THEMES.length].name}.`;
      setTimeout(() => {
        completeEl.classList.remove('hidden');
        paused = true;
      }, 1200);
      break;
    }
  }
}

// ------------------------------------------------------------ loop
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
let hudAcc = 0;
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
  while (acc >= STEP) {
    rider.update(STEP, controls, map, bumps);
    acc -= STEP;
  }
  if (started) {
    orders.update(dt, rider, time, bumps, events);
    for (const b of bumps) {
      audio.land(b.power / 3);
      renderer.burst('dust', b.x, b.y, 6);
    }
    for (const ev of events) handle(ev);
  }
  bumps.length = 0;
  events.length = 0;

  const light = lightAt(time + 15);
  const target = started ? orders.target(rider) : null;
  audio.update(dt, rider.speed, false, rider.pedalling);
  renderer.updateCamera(rider, map, dt);
  renderer.render(map, rider, started ? orders : null, target, light, time, dt, input.joy);

  hudAcc += dt;
  if (hudAcc > 0.1) {
    hudAcc = 0;
    hud.update({
      speed: rider.speed,
      phase: light.name,
      orders,
      time,
      tips: totalTips,
      targetId: target?.order?.id ?? null,
      riderX: rider.x,
      riderY: rider.y,
    });
    minimap.draw(rider, orders, target, time);
  }
}

requestAnimationFrame(frame);

// tiny debug handle for tinkering from the console
(window as unknown as { chill: unknown }).chill = {
  rider,
  renderer,
  audio,
  get map() {
    return map;
  },
  get orders() {
    return orders;
  },
  warp: (s: number) => (time += s),
  next: () => {
    mapIndex++;
    loadMap(mapIndex);
  },
};
