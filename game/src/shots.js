// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world, steered by the same autopilot the
// headless simulation uses, so the frame is what a real game looks like and
// the same seed always gives the same frame.
import { STEP } from './config.js';
import { botInput, stepWorld } from './world.js';
import { wantedStars } from './police.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const CHASE_SECONDS = 18;
/** The mission scene fast-forwards the story until mission 8 is running. */
const MISSION_LIMIT_SECONDS = 1200;

function runBot(world, seconds, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, botInput(world, STEP), STEP);
    if (stopWhen && stopWhen(world)) break;
    if (world.busted || world.wasted) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best money to show. Names: start, play, chase, mission; anything else
 * is start.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    runBot(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: world.money };
  }
  if (name === 'chase') {
    // Get the bot into a car first, then light three stars: cop cars in the
    // mirror, the wanted stars lit, the city sliding past. Lighting the heat
    // while the bot is still on foot just makes it run from the cops on foot.
    runBot(world, 8);
    world.police.heat = 3;
    world.police.lastCrimeT = world.elapsed;
    runBot(world, 10);
    return { screen: SCREEN_PLAY, best: world.money };
  }
  if (name === 'mission') {
    runBot(world, MISSION_LIMIT_SECONDS, (w) => w.missions.index === 7 && w.missions.collected >= 1);
    // If the fast-forward did not reach mission 8 with a crate in hand, keep
    // playing a little longer; the scene is still a real game state.
    if (!(world.missions.index === 7 && world.missions.collected >= 1)) {
      runBot(world, 240, (w) => w.missions.index === 7 && w.missions.collected >= 1);
    }
    const over = world.busted || world.wasted;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.money };
  }
  // start: a living city behind the title panel.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    stepWorld(world, { up: false, down: false, left: false, right: false, shoot: false, enter: false }, STEP);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}

export { wantedStars };
