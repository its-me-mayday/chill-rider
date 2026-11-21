# 🚲 Chill Rider

A lo-fi 2D bicycle ride through an endless golden hour. Pedal over rolling hills,
catch a little air on the bumps, and let the generative radio play.
There is no way to lose — just ride.

## ✨ Features

- **Deliveries** — load parcels at the *Chill Post* office and slow down at each customer's glowing door
  to hand them over. Tips grow when you're on time and keep fragile parcels (cakes, teapots, telescopes…)
  safe from rough landings. Miss a house and they'll simply meet you further down the road, for a smaller tip.
- **Endless side-scrolling road** — procedural hills and kickers, deterministic so every ride is the same world.
- **Bike physics** — pedal power, gravity on slopes, drag, braking, airtime and flips (lean in the air).
- **Day cycle** — golden hour → pink dusk → blue night (stars, moon, street lamps, fireflies, headlight) → soft dawn.
- **Parallax world** — mountains, hills with trees and houses whose windows light up at night, clouds, birds, petals.
- **Chill FM** — a generative lo-fi radio built with Tone.js: random key, tempo and jazzy progressions,
  dusty keys, bass, swung drums, bell melodies and vinyl crackle. No samples.
- **World sounds** — wind that follows your speed, freewheel clicks when coasting, landing thumps, a bike bell.
- **Plays on phones** — touch controls, safe-area aware layout, landscape or portrait.

## 🎮 Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W / ↑ | ▲ | Pedal |
| S / ↓ / Space | ■ | Brake |
| A / ← | ⟲ | Lean back (backflip in the air) |
| D / → | ⟳ | Lean forward (frontflip in the air) |
| C | C | Cruise control |
| B | 🔔 | Bell |
| R / N | radio pill | Radio on/off, next track |
| H | — | Hide HUD (photo mode) |
| P / Esc | — | Pause |

## 🛠️ Tech stack

- **TypeScript** + **Vite**
- **Canvas 2D** renderer, no game engine — everything is drawn procedurally
- **Tone.js** for the generative radio and sound effects

```
src/
  game/    bike physics, terrain, palettes, input
  render/  canvas renderer, bike drawing, particles
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
