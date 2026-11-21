# 🚲 Chill Rider

A lo-fi bike courier game seen from above. Pick up orders at the little shops of each town and ride
them to the right address before the timer runs out — on a bicycle with a flower basket, while a
generative lo-fi radio plays.

## ✨ Features

- **Top-down towns, always different** — every map is generated: *Peach Village*, *Seashell Bay*
  (with a beach and the sea), *Pine Hollow* (dense woods) and *Old Town* (tight streets, plazas and fountains).
- **Streets and addresses** — every road has a name, every house a number: deliver to *“12 Lemon Street”*.
- **Obstacles** — trees, ponds, fountains and buildings block the way; roads are fastest, grass and sand slow you down.
- **Different shops** — Forno Pesca (bakery), Petali (florist), Da Mayday (pizza), Side B Records, Dog-ear Books,
  Lo-Fi Café — each with its own goods. A 📦 bubble means an order is waiting.
- **Deliver in time** — each order has a countdown. Tips grow with the time you have left; hot food pays a bonus
  when it arrives warm, fragile goods lose value every time you bump into something. Late orders can still be
  delivered for a small tip.
- **Carry up to 3 orders** and plan your route with the minimap and the guide arrow.
- **8 deliveries per map**, rated with up to three stars, then on to the next town.
- **Day cycle** — golden hour, pink dusk, blue night with street lamps, glowing windows, fireflies and a headlight, dawn.
- **Chill FM** — a generative lo-fi radio built with Tone.js, plus wind, freewheel clicks, bumps and a bike bell.
- **Plays on phones** — drag anywhere to ride (floating joystick), brake and bell buttons.

## 🎮 Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W / ↑ | drag | Pedal (touch: the bike rides towards your finger) |
| A D / ← → | drag | Steer |
| S / ↓ / Space | ■ | Brake |
| B | 🔔 | Bell |
| R / N | radio pill | Radio on/off, next song |
| H / P | — | Hide HUD, pause |

Pick up and deliver by **slowing down inside the ring** in front of a shop or the glowing door.

## 🛠️ Tech stack

- **TypeScript** + **Vite**
- **Canvas 2D** renderer, no game engine — everything is drawn procedurally
- **Tone.js** for the generative radio and sound effects

```
src/
  game/    map generation, themes, rider physics, orders, input, day cycle
  render/  canvas renderer, rider sprite, minimap
  audio/   Chill FM radio and world sounds
  ui/      DOM HUD
```

## 🚀 Getting started

```bash
npm install
npm run dev      # open the Network URL from your phone on the same Wi-Fi
npm run build    # static build in dist/
```

The game is a static site: the included GitHub Actions workflow deploys `dist/` to GitHub Pages on
every push to `main` (enable *Settings → Pages → Source: GitHub Actions* once).

---
*Created with love by Mayday*
