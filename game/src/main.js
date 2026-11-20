// Boot and the one loop: input is read once per frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. Screens: title, play, paused, game over and
// story complete. One-shot presses are taken once per frame and applied on
// the first substep only, so E never enters and instantly exits a car.
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import {
  createWorld, resetWorld, stepWorld, saveGame, loadGame,
  EVENT_MISSION, EVENT_BUSTED, EVENT_WASTED, EVENT_PICKUP, EVENT_SHOT,
  EVENT_STORY_DONE,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_SHOOT, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(`${SAVE_KEY}.best`) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(`${SAVE_KEY}.best`, String(value));
  } catch {
    // Storage can be off: the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    resetWorld(world);
    if (!fresh) loadGame(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Finish all eight missions.');
  }

  function endGame() {
    screen = world.missions.storyDone ? SCREEN_STORY : SCREEN_OVER;
    if (world.money > best) {
      best = world.money;
      saveBest(best);
    }
    announce(world.missions.storyDone
      ? `Story complete. $${world.money}.`
      : `Game over. $${world.money}. Best $${best}.`);
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_STORY)) {
      startGame(true);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions, first) {
    const held = input.held();
    const cmd = {
      up: held.up, down: held.down, left: held.left, right: held.right,
      // One-shots only on the first substep of the frame.
      shoot: first && ((actions & ACTION_SHOOT) !== 0 || input.mouse().down),
      enter: first && (actions & ACTION_ENTER) !== 0,
    };
    const events = stepWorld(world, cmd, STEP);
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.mission();
      saveGame(world);
      if (world.money > best) {
        best = world.money;
        saveBest(best);
      }
    }
    if (events & EVENT_STORY_DONE) {
      saveGame(world);
      endGame();
    } else if (events & (EVENT_BUSTED | EVENT_WASTED)) {
      audio.busted();
      endGame();
    }
    const speed01 = world.player.car ? Math.abs(world.player.car.speed) / world.player.car.model.top : 0;
    audio.update(speed01, world.police.heat, STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE) {
      // A living city behind the title: traffic and pedestrians move, the
      // player waits.
      while (accumulator >= STEP) {
        stepWorld(world, { up: false, down: false, left: false, right: false, shoot: false, enter: false }, STEP);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(actions, first);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting it run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // S saves from the pause screen; C continues a save from the title.
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyS' && screen === SCREEN_PAUSED) {
      if (saveGame(world)) announce('Saved.');
    }
    if (event.code === 'KeyC' && screen === SCREEN_TITLE) {
      startGame(false);
    }
  });

  announce('Solmar Bay. Press Space or click to start, C to continue a save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
