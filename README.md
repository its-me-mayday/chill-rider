# 🚲 Chill Rider

A lo-fi bike courier game seen from above. Pick up orders at the little shops of each town and ride
them to the right address before the timer runs out — on a bicycle with a flower basket, while a
generative lo-fi radio plays.

## ✨ Features

- **Top-down towns, always different** — every map is generated: *Peach Village*, *Seashell Bay*
  (with a beach and the sea), *Pine Hollow* (dense woods) and *Old Town* (tight streets, plazas and fountains).
- **Streets and addresses** — every road has a name, every house a number: deliver to *“12 Lemon Street”*.
- **Obstacles** — trees, ponds, fountains and buildings, plus roadworks with cones and barriers, bins, cars parked in
  driveways, park benches and picnic tables, hay bales and logs in the woods, umbrellas and sandcastles on the beach.
  Roads are fastest; grass and sand slow you down.
- **Traffic** — cars and delivery vans drive on the right, turn at junctions, keep their distance, stop and honk if
  you're in their lane — and getting hit hurts.
- **Other chill riders** — cyclists in colourful outfits ride around town, ring their bells and greet you as you pass.
- **Real shops** — Pizzeria Da Mayday (wood oven smoke, checkered awning, tables with umbrellas, delivery scooter),
  Caffè Lo-Fi (steaming cups, chalkboard), Nuvola Comics (comic-bubble sign, POW! sticker), Gelateria Luna,
  Forno Pesca, Petali Fiori, Side B Records and Dog-ear Books — each with its own sign, awning, forecourt and goods.
  The shopkeeper waits at the door when an order is ready; signs glow at night.
- **Town details** — street names painted on the roads, zebra crossings, manholes, mailboxes, flower beds,
  skylights and solar panels, chimney smoke in the evening.
- **Deliver in time** — each order has a countdown. Tips grow with the time you have left; hot food pays a bonus
  when it arrives warm, fragile goods lose value every time you bump into something. Late orders can still be
  delivered for a small tip.
- **Your rider's face in the HUD** — the portrait reacts to what happens: happy, focused at speed, seeing stars after
  a knock, lying down after a slip, plasters and bruises as health drops. Bumps and slips (sharp turns on wet grass,
  sand or gravel) hurt; when badly bruised you ride slower. Health comes back slowly while riding calmly, quickly when
  you stop to rest at the café, and fully on level-up.
- **Carry up to 3 orders** and plan your route with the minimap and the guide arrow.
- **8+ deliveries per town**, rated with up to three stars, then on to the next town — each one a bit busier and tighter on time.
- **Progression** — XP and levels unlock ⚡ rush orders, ★ VIP customers and other perks; on-time streaks multiply tips.
- **Side quests** — townsfolk wait at their door with a ❗: find a lost harmonica in the park, rush a letter to an old
  friend, fetch a cappuccino from the café, or race through checkpoints against the clock.
- **Bike workshop & tailor** — upgrades (gears, gravel tires, bigger rack, suspension, headlight) are bought at
  *Officina Ruota*, scarves, beanies and paint at *Sartoria Sciarpa*; both keep opening hours. Your stats, album and
  badges live in the logbook (tap your portrait or press L).
- **Traffic lights** — busy junctions have lights with stop lines; cars and riders wait on red, and running a red
  light costs you a small fine.
- **Things to find** — 2 random challenges per town, 3 hidden postcards per town for the album, 20 achievements and lifetime stats.
- **A living town** — people walking dogs (ring the bell and they step aside), napping cats that bolt, ducks on ponds,
  butterflies, drifting cloud shadows and rainy days with puddles.
- **Animations** — parcels tossed to the door, customers popping out to wave, floating tips, tyre tracks on grass,
  leaning into turns, screen shake on bumps, confetti on level-ups.
- **A real day** — dawn, day, golden hour, dusk and night on a 24 h clock shown by a dial in the HUD. Shops keep
  opening hours (the bakery opens at 4, the pizzeria takes an afternoon break and runs late, the gelateria closes at
  midnight) and pull down their shutters when closed; traffic peaks at rush hour and the streets empty out at night.
- **Secrets** — every town hides a treasure chest and a lost kitten under the trees, a gnome behind a house and a
  stargazer who only comes out at night. Some secrets unlock special styles.
- **Radio on an iPod** — five generative stations built with Tone.js (Chill FM lo-fi, Jazz Café, Bossa Breeze, Synth Sunset, Rain Room), tuned from a click-wheel iPod: spin to scroll or change volume, press the hub to tune, ⏮/⏭ to hop stations. Plus wind, freewheel clicks, bumps and a bike bell.
- **Plays on phones** — drag anywhere to ride (floating joystick), brake and bell buttons.

## 🎮 Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W / ↑ | drag | Pedal (touch: the bike rides towards your finger) |
| A D / ← → | drag | Steer |
| S / ↓ / Space | ■ | Brake |
| B | 🔔 | Bell (people step aside) |
| L | portrait | Logbook (stats, album, badges) |
| I | radio pill | Open the iPod |
| , / . | ⏮ / ⏭ on the wheel | Previous / next station |
| R / N | ▶❚❚ / Skip | Radio on/off, next song |
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
  audio/   radio stations and world sounds
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
