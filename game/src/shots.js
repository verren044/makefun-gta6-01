// Solmar Bay — screenshot scenes behind ?shot=<name>&seed=1.
// Each scene plays the real rules forward from a fresh world for a fixed number
// of steps with a simple autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame. No DOM here except none at all.
import { createGameState } from './city.js';
import { updatePlayer } from './player.js';
import { driveCar, enterCar, nearestCar } from './vehicles.js';
import { updateTraffic } from './vehicles.js';
import { updatePedestrians } from './pedestrians.js';
import { updatePolice, addWanted } from './police.js';
import { updateBullets } from './combat.js';
import { updateMission, currentObjective, startMission } from './missions.js';
import { CONFIG } from './config.js';

const DT = 1 / 60;

function autopilotToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const input = { up: false, down: false, left: false, right: false };
  if (dy < -12) input.up = true;
  if (dy > 12) input.down = true;
  if (dx < -12) input.left = true;
  if (dx > 12) input.right = true;
  return input;
}

function stepWorld(state, input) {
  const p = state.player;
  if (p.inCar) driveCar(p, input, DT);
  else updatePlayer(p, input, DT);
  updateTraffic(state.traffic, state.world, DT);
  updatePedestrians(state.peds, DT);
  updatePolice(state.police, p, state.world, DT);
  updateBullets(state.bullets, state.mission.enemies.concat(state.police.footCops), DT);
  updateMission(state, DT);
  state.time += DT;
  if (state.messageTimer > 0) state.messageTimer -= DT;
}

export function setupShot(name, seed) {
  const state = createGameState(seed);
  if (name === 'start') {
    state.screen = 'start';
    return state;
  }
  state.screen = 'play';

  if (name === 'play') {
    // Get in the nearest car and drive around the block.
    const car = nearestCar(state.cars, state.player.x, state.player.y, 4000);
    state.player.x = car.x - 30;
    state.player.y = car.y;
    enterCar(state.player, state.cars);
    for (let i = 0; i < 240; i++) {
      const input = { up: true, down: false, left: i > 120 && i < 170, right: i >= 170 && i < 210 };
      stepWorld(state, input);
    }
    return state;
  }

  if (name === 'chase') {
    addWanted(state.police, 3);
    const car = nearestCar(state.cars, state.player.x, state.player.y, 4000);
    state.player.x = car.x - 30;
    state.player.y = car.y;
    enterCar(state.player, state.cars);
    for (let i = 0; i < 200; i++) {
      const input = { up: true, down: false, left: i % 90 < 20, right: i % 90 >= 45 && i % 90 < 65 };
      stepWorld(state, input);
    }
    return state;
  }

  if (name === 'mission') {
    // Mission 2 (Harbor Pickup) in progress: player on foot near the marker.
    state.mission.index = 1;
    startMission(state.mission, state.world, state.police);
    const obj = currentObjective(state);
    state.player.x = obj.x - 260;
    state.player.y = obj.y - 140;
    state.player.angle = Math.atan2(obj.y - state.player.y, obj.x - state.player.x);
    for (let i = 0; i < 45; i++) {
      const input = autopilotToward(state, obj.x, obj.y);
      stepWorld(state, input);
    }
    return state;
  }

  // Unknown scene: plain play frame.
  for (let i = 0; i < 60; i++) stepWorld(state, { up: true, down: false, left: false, right: false });
  return state;
}

export const SHOT_NAMES = ['start', 'play', 'chase', 'mission'];
