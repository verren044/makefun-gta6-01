# Solmar Bay — BUILD_LOG (round 5, fresh rebuild)

Fresh rebuild in a live sealed recording. No old entry file was read; every
game file was typed new in this session. The only copied file is the kit's
vendored library (`vendor/makefun-game.ts`, unchanged).

## What was built

- Open-world crime game "Solmar Bay", plain JavaScript + 2D canvas, no
  external library, no network request. `game/index.html` opens in desktop
  Chrome and plays offline.
- City 3600x2800, five districts: Ember Heights (volcano + Ember Casino +
  park), Marina Del Sol, Porto Verde, Old Harbor, Northgate Hills.
  Deterministic generation from a seed (mulberry32, own implementation).
- 12 drivable cars (Ember GT top speed 640, fastest), 22 traffic cars on
  the road grid, 40 pedestrians on sidewalks.
- Player on foot (WASD/arrows) and driving (E enter/exit, carjacking an
  occupied traffic car ejects its driver and raises wanted +2). J shoots.
- Five-star wanted system: cop cars spawn and pursue at wanted 1+, on-foot
  cops spawn near the player at wanted 3+, wanted decays out of sight.
- HUD: money, wanted stars, health, mission objective, live minimap with
  district readout. Start screen, pause (P), save from pause (S), save
  format v2 (money/position/current mission). Game over and restart.
- 8-mission story, $5,500 total (300/400/500/600/700/800/1000/1200):
  1 First Wheels, 2 Harbor Pickup, 3 Bay Delivery (timed), 4 Tail the
  Courier (chase), 5 Ember Escape, 6 Casino Setup (shootout), 7 Porto
  Payday (two drops), 8 The Ember Score.
- Four screenshot scenes behind `?shot=<name>&seed=1`, each playing the
  real rules forward from a fresh world with a fixed-step autopilot:
  start, play, chase, mission.

## Sim

`/home/hatch/workspace/makefun/gta6-01-r5-sim/sim.mjs` (not committed):
24/24 PASS — determinism, districts/landmarks, bounds, 12 cars / Ember GT
640, 22 traffic on roads, 40 peds on sidewalks, on-foot movement, entering
a car, driving continuity, carjacking, wanted cap 5, cop spawn/pursuit and
clear at wanted 0, foot cops at high wanted, shooting damage, all 8
missions completing via autopilot with exact payouts ($5,500 total),
save v2 round-trip, 10,000-step soak with no exception and player in bounds.

Fixes found by the sim in this session: shoot cooldown now also ticks down
while driving (was blocking the casino shootout), pedestrian spawns moved
mid-block so the nearest road is always their own sidewalk, and the sim
autopilot brakes near markers (a car at top speed cannot turn inside a
70-unit marker radius).

## Checks run

- `node sim.mjs` → 24/24 PASS.
- `MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts` and `/tmp/out2` →
  both exit 0, `dossier.json` 812,557 bytes (cap 1.5 MiB), byte-identical
  across runs (also verified against a third run).
- Screenshots re-rendered in this session with headless Chromium
  (Playwright build; the /opt/meta-chromium build refused to start:
  "Hatch WebGL domain policy is required for browser startup"):
  1-play.jpg 162,024 B; 2-chase.jpg 162,865 B; 3-mission.jpg 170,304 B;
  4-start.jpg 72,760 B — all 1280x720, each under the 256 KiB cap.
  Frames visually checked: driving with mission marker + HUD + minimap,
  3-star chase with police cars, on-foot player at the mission marker,
  title screen.
- `game/`: 15 files, 51,963 bytes, 0 symlinks — within caps (993 files,
  48 MiB).
- `git status` shows only the intended files.
