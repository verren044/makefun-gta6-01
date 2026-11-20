// Solmar Bay — city queries, spawn logic, whole-game state assembly. No DOM.
import { CONFIG } from './config.js';
import { generateCity, districtNameAt } from './world.js';
import { createPlayer } from './player.js';
import { createDrivableCars, createTraffic } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPoliceState } from './police.js';
import { createMissionState } from './missions.js';

export function districtAt(world, x, y) {
  return districtNameAt(world.districts, x, y);
}

export function nearestRoad(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const r of world.roads) {
    let d;
    if (r.horizontal) {
      const cx = Math.max(r.x1, Math.min(x, r.x2));
      d = Math.hypot(x - cx, y - r.y1);
    } else {
      const cy = Math.max(r.y1, Math.min(y, r.y2));
      d = Math.hypot(x - r.x1, y - cy);
    }
    if (d < bestD) { bestD = d; best = r; }
  }
  return { road: best, dist: bestD };
}

export function pointOnRoad(world, x, y) {
  return nearestRoad(world, x, y).dist <= CONFIG.ROAD_WIDTH / 2 + 4;
}

// Build the full mutable game state for a seed. Every module works on this object.
export function createGameState(seed) {
  const world = generateCity(seed);
  const state = {
    seed,
    world,
    time: 0,
    screen: 'start',
    player: createPlayer(world),
    cars: createDrivableCars(world),
    traffic: createTraffic(world),
    peds: createPedestrians(world),
    police: createPoliceState(),
    mission: createMissionState(world),
    bullets: [],
    message: '',
    messageTimer: 0,
    gameOver: false,
    allMissionsDone: false,
  };
  return state;
}

// One fixed logic step shared by the browser loop, the screenshot scenes and the sim.
export function stepGame(state, input, dt) {
  state.time += dt;
  return state;
}
