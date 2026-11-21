import './styles.css';
import { AudioEngine } from './audio/audio';
import { Bike, type BikeEvent } from './game/bike';
import { Deliveries, type DeliveryEvent } from './game/delivery';
import { Input } from './game/input';
import { paletteAt } from './game/palette';
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
const bike = new Bike();
const input = new Input();
const hud = new Hud();
const audio = new AudioEngine();
const deliveries = new Deliveries({ tips: store.get('tips', 0), delivered: store.get('delivered', 0) });

let started = false;
let paused = false;
let hudVisible = true;
let time = 0;
let best = store.get('best', 0);
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
    case 'cruise': hud.setCruise(input.cruise); break;
    case 'radio': void toggleRadio(); break;
    case 'next': audio.radio.next(); break;
    case 'hud': hudVisible = !hudVisible; hud.setVisible(hudVisible); break;
    case 'pause': setPaused(!paused); break;
    case 'bell': audio.bell(); break;
  }
};

document.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
  input.bindButton(el, el.dataset.act as 'pedal' | 'brake' | 'back' | 'forward');
});
document.getElementById('t-cruise')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.cruise = !input.cruise;
  hud.setCruise(input.cruise);
});
document.getElementById('t-bell')!.addEventListener('pointerdown', (e) => {
  e.preventDefault();
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

async function start() {
  if (started) return;
  started = true;
  startEl.classList.add('hidden');
  deliveries.depot = { x: bike.x + 38 };
  await audio.start();
  await audio.radio.play();
  hud.setRadio(true);
  hud.toast('Sunset Boulevard', 'enjoy the ride');
}

function setPaused(p: boolean) {
  if (!started) return;
  paused = p;
  pauseEl.classList.toggle('hidden', !p);
}

document.getElementById('start-btn')!.addEventListener('click', () => void start());
document.getElementById('resume-btn')!.addEventListener('click', () => setPaused(false));
window.addEventListener('keydown', (e) => {
  if (!started && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyW')) void start();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) setPaused(true);
});

// ------------------------------------------------------------ events
function handle(ev: BikeEvent) {
  if (ev.type === 'takeoff') return;
  audio.land(ev.airtime);
  renderer.particles.burst('dust', bike.x, bike.y, 6 + Math.round(ev.airtime * 8), 0.8 + ev.airtime);
  if (!ev.clean) {
    hud.toast('wobbly landing', 'no worries');
    return;
  }
  if (ev.flips > 0) {
    const kind = bike.airSpin > 0 ? 'backflip' : 'frontflip';
    const label = ev.flips > 1 ? `${ev.flips}× ${kind}` : kind;
    hud.toast(label, `${ev.airtime.toFixed(1)}s of air`);
    renderer.particles.burst('sparkle', bike.x, bike.y + 1, 18);
    audio.sparkle();
  } else if (ev.airtime > 0.7) {
    hud.toast('nice air', `${ev.airtime.toFixed(1)}s`);
  }
}

function handleDelivery(ev: DeliveryEvent) {
  switch (ev.type) {
    case 'pickup': {
      const n = ev.orders.length;
      const fragile = ev.orders.some((o) => o.fragile);
      hud.toast(`${n} parcels loaded`, fragile ? 'careful — something fragile' : 'off you go');
      audio.sparkle();
      break;
    }
    case 'approach':
      hud.toast(`n° ${ev.order.houseNo} · ${ev.order.customer}`, 'slow down at the glowing door');
      break;
    case 'delivered': {
      const bits = [`+${ev.tip.toFixed(2)} € tip`];
      if (ev.onTime) bits.push('on time');
      if (ev.order.fragile && ev.perfect) bits.push('not a scratch');
      hud.toast(`Delivered to ${ev.order.customer}`, bits.join(' · '));
      renderer.particles.burst('sparkle', bike.x, bike.y + 1.5, 16);
      audio.sparkle();
      store.set('tips', deliveries.tips);
      store.set('delivered', deliveries.delivered);
      break;
    }
    case 'missed':
      hud.toast(`${ev.order.customer} will meet you ahead`, `new address · n° ${ev.order.houseNo}`);
      break;
    case 'damaged':
      hud.toast(`careful with ${ev.order.item}!`, `${Math.round(ev.order.condition * 100)}% intact`);
      break;
  }
}

// ------------------------------------------------------------ loop
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
const events: BikeEvent[] = [];
const delEvents: DeliveryEvent[] = [];
let hudAcc = 0;

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (paused) return;

  time += dt;
  acc += dt;
  // before the player starts, the rider cruises gently in the background
  const controls = started ? input.read() : { pedal: false, brake: false, lean: 0, cruise: true };
  while (acc >= STEP) {
    bike.update(STEP, controls, events);
    acc -= STEP;
  }
  if (started) {
    deliveries.update(dt, bike, time, events, delEvents);
    for (const ev of events) handle(ev);
    // a delivery toast wins over a jump toast in the same frame
    for (const ev of delEvents) handleDelivery(ev);
    delEvents.length = 0;
  }
  events.length = 0;

  if (started && bike.distance > best) {
    best = bike.distance;
    if (Math.floor(time * 2) % 10 === 0) store.set('best', best);
  }

  const { pal, name } = paletteAt(time + 20);
  audio.update(dt, bike.displaySpeed, bike.airborne, bike.pedalling);
  renderer.updateCamera(bike, dt);
  renderer.render(bike, pal, time, dt, started ? deliveries : null);
  hud.update(dt, { distance: bike.distance, speed: bike.displaySpeed, phase: name, best });
  hudAcc += dt;
  if (hudAcc > 0.15) {
    hudAcc = 0;
    hud.updateDeliveries(deliveries, bike.x);
  }
}

window.addEventListener('beforeunload', () => store.set('best', best));
requestAnimationFrame(frame);

// expose a tiny debug handle for tinkering in the console
(window as unknown as { chill: unknown }).chill = {
  bike,
  renderer,
  audio,
  deliveries,
  warp: (seconds: number) => (time += seconds),
};
