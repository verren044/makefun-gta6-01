// The screenshot scenes behind ?shot=start|play|chase|mission|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by
// the autopilot in world.js (or, for the end scene, by a reckless driver who never
// steers), so every frame is what a short game really looks like and the same seed
// always gives the same frame.

import { STEP } from './config.js';
import { botInput, stepWorld } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { addWanted } from './police.js';
import { startMission } from './missions.js';
import { nearestCar } from './vehicles.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 20;
const MISSION_SECONDS = 12;
const END_LIMIT_SECONDS = 120;

/** Step the world with the autopilot for `seconds` (or until the game ends). */
function runBot(state, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, botInput(state));
    if (state.over) break;
  }
}

/**
 * Set `state` to the named scene and return the screen to draw over it.
 * Unknown names stage the title, like the starter does.
 */
export function stageShot(name, state) {
  if (name === 'play') {
    runBot(state, PLAY_SECONDS);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'chase') {
    runBot(state, 6);
    addWanted(state, 3, 'staged chase');
    runBot(state, CHASE_SECONDS);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'mission') {
    state.cash = 1250;
    state.missions.done = 3;
    startMission(state, 3);
    const bag = state.missions.bags[0];
    const car = nearestCar(state.cars, bag.x, bag.y, 4000, ['parked']);
    if (car) {
      car.kind = 'player';
      car.x = bag.x - 260;
      car.y = bag.y;
      car.angle = 0;
      state.player.inCar = car;
      state.player.x = car.x;
      state.player.y = car.y;
    }
    runBot(state, MISSION_SECONDS);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY };
  }
  if (name === 'end') {
    runBot(state, 8);
    addWanted(state, 5, 'staged finale');
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      stepWorld(state, { up: true, down: false, left: false, right: false, run: false, steal: false, punch: false, shoot: false });
      if (state.over) break;
    }
    if (!state.over) state.over = 'busted';
    return { screen: SCREEN_OVER };
  }
  runBot(state, START_SECONDS);
  return { screen: SCREEN_TITLE };
}
