# Core / Rim

A small interactive 3D driving piece. One island, two aesthetics, one car
with hall-effect-switch feel.

The outer rim is jagged, gray, scattered with chaotic primitives. The
center is perfectly tiled acoustic panels. The car has zero drift — push
forward, it goes forward. Let go, it stops. As you drive toward the
center, the audio crossfades from distorted static into a clean ambient
pad. Two glowing obelisks in the core each reveal a question about the
gap between how you're seen and what you actually do.

## Stack

- **Vite** — dev server / bundler
- **Three.js** (r160) — rendering
- **Cannon-es** — physics
- **Web Audio API** — both soundtracks are synthesized at runtime
  (no external audio files)

## Run

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/>.

Click **Enter the island** to unlock audio (browsers require a gesture
before the `AudioContext` will start).

## Controls

| Key                  | Action         |
| -------------------- | -------------- |
| `W` / `↑`            | Forward        |
| `S` / `↓`            | Reverse        |
| `A` / `←`            | Turn left      |
| `D` / `→`            | Turn right     |
| `Space`              | Brake (hard)   |
| `Esc`                | Close any open modal |

## Project layout

```
.
├── index.html         # HUD, audio gate, both modals
├── style.css          # Frosted-glass UI
├── vite.config.js
├── package.json
└── src/
    ├── main.js        # Orchestrator: scene, loop, glue
    ├── terrain.js     # The dual-zone world (core floor + rim scatter)
    ├── vehicle.js     # Box car with direct-velocity controller
    ├── audio.js       # Two synthesized tracks + distance crossfade
    ├── controls.js    # WASD/arrows/space -> state
    ├── monuments.js   # Obelisks + Box3 collision
    └── modals.js      # Modal manager + audio gate
```

## Design notes

- **Physics ground is a single flat plane.** The chaos is *on* the
  ground (scattered primitives, perimeter spikes), not the ground itself.
  This keeps the car's "no drift, no slide" feel honest.
- **The car controller sets linear/angular velocity directly each
  frame** instead of applying forces. The Cannon-es body still
  participates in collisions (so the obelisks register as hits), but
  the driver has none of the momentum that a force-based controller
  would imply. Lateral velocity is zeroed, so there's no drift.
- **Yaw is the only rotation axis** (`angularFactor = (0, 1, 0)`), and
  yaw is snapped, not integrated.
- **Audio is a single `THREE.AudioListener` on the camera.** The
  crossfade is a smoothstep on the listener's XZ distance to origin:
  0 units → full clean pad, ≥ 50 units → full distorted noise.
- **Monument collision is AABB-vs-AABB.** Each obelisk has a single
  `THREE.Box3` in world space (with a small margin so it feels fair at
  speed). The vehicle computes its own AABB from the Cannon body each
  frame. The modal layer owns the "already-triggered" state to avoid
  re-firing every frame while you're inside the box.
- **Resume behavior:** the car is teleported 5 units along world +Z
  (away from the origin) and the physics loop is resumed. The audio
  will re-blend as you drive out.

## Build for production

```bash
npm run build
npm run preview
```

Output in `dist/`.
