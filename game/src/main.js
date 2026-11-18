// Solmar Bay — boot and the one loop. Input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
//
// Progress saves to localStorage on G and automatically when a mission pays out;
// C on the title screen continues a saved game.

import { SAVE_KEY, STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_SAVE, ACTION_STEAL, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missions !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      missions: world.missions.done,
      carsStolen: world.stats.carsStolen,
      savedAt: Date.now(),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function applySave(world, save) {
  world.cash = save.cash;
  world.missions.done = save.missions;
  world.stats.carsStolen = save.carsStolen || 0;
  if (save.missions >= 4) {
    world.missions.storyComplete = true;
  } else if (save.missions > 0) {
    startMission(world, save.missions);
  }
}

function runShot(name) {
  const world = createWorld(seed);
  const scene = stageShot(name, world);
  const renderer = createRenderer(canvas);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { best: readSave(), muted: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createAudio();
  const input = createInput(canvas);
  let world = createWorld(seed);
  const renderer = createRenderer(canvas);
  let screen = SCREEN_TITLE;
  let best = readSave();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    if (fresh) world = createWorld(seed);
    world.shootGrace = 0.5;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Steal a car and drive to Marina Pier.');
  }

  function continueGame() {
    const save = readSave();
    if (!save) return;
    world = createWorld(seed);
    applySave(world, save);
    world.shootGrace = 0.5;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Continued. $${save.cash}, ${save.missions} missions done.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(world.over === 'busted' ? 'Busted. Game over.' : world.over === 'wasted' ? 'Wasted. Game over.' : 'Story complete.');
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_SAVE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      writeSave(world);
      announce('Game saved.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && best) continueGame();
      else if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function playStep(actions) {
    const held = input.heldState();
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const camX = Math.max(0, Math.min(3200 - 1280, px - 640));
    const camY = Math.max(0, Math.min(2400 - 720, py - 360));
    const stepInput = {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      run: held.run,
      steal: false,
      punch: false,
      shoot: held.shoot,
      aimX: camX + held.aimCanvasX * scaleX,
      aimY: camY + held.aimCanvasY * scaleY,
    };
    if (actions & ACTION_STEAL) stepInput.steal = true;
    if (actions & ACTION_PUNCH) stepInput.punch = true;
    stepWorld(world, stepInput);
    for (const sfx of world.sfx) audio.play(sfx);
    audio.siren(STEP, world.wanted);
    if (world.saveNow) {
      world.saveNow = false;
      writeSave(world);
    }
    if (world.over) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = input.takeActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      handleActions(actions);
      accumulator = 0;
    } else if (screen === SCREEN_PAUSED) {
      handleActions(actions);
      accumulator = 0;
    } else {
      handleActions(actions);
      if (screen !== SCREEN_PLAY) return;
      while (accumulator >= STEP) {
        playStep(actions);
        actions &= ~(ACTION_STEAL | ACTION_PUNCH);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    }
    renderer.draw(world, screen, { best, muted: audio.muted });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
