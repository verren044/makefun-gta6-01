// Solmar Bay — game loop, screen state machine, wiring of all modules.
import { CONFIG } from './config.js';
import { createGameState } from './city.js';
import { createInput, attachInput } from './input.js';
import { updatePlayer, damagePlayer, saveGameV2, loadGameV2 } from './player.js';
import { driveCar, enterCar, exitCar, updateTraffic, carjack, nearestCar } from './vehicles.js';
import { updatePedestrians } from './pedestrians.js';
import { updatePolice, addWanted } from './police.js';
import { shoot, updateBullets } from './combat.js';
import { updateMission, MISSIONS } from './missions.js';
import { render } from './render.js';
import { setupShot } from './shots.js';

const SAVE_KEY = 'solmarbay-save-v2';

function showMessage(state, text) {
  state.message = text;
  state.messageTimer = 3;
}

function tick(state, input, dt) {
  const p = state.player;
  if (!p.alive) {
    state.screen = 'over';
    return;
  }
  if (input.enter) {
    input.enter = false;
    if (p.inCar) {
      exitCar(p);
    } else {
      const car = enterCar(p, state.cars);
      if (!car) {
        // Try carjacking the nearest occupied traffic car.
        const near = nearestCar(state.traffic, p.x, p.y, CONFIG.ENTER_CAR_RADIUS);
        if (near && near.driver) {
          carjack(p, near, state.police);
          showMessage(state, 'Carjacked! Wanted +2');
        }
      } else {
        showMessage(state, 'Driving ' + car.def.name);
      }
    }
  }
  if (input.shoot) {
    shoot(p, state.bullets);
  }
  if (p.inCar) driveCar(p, input, dt);
  else updatePlayer(p, input, dt);
  updateTraffic(state.traffic, state.world, dt);
  updatePedestrians(state.peds, dt);
  updatePolice(state.police, p, state.world, dt);
  const targets = state.mission.enemies.concat(state.police.footCops);
  const hits = updateBullets(state.bullets, targets, dt);
  if (hits > 0 && state.mission.enemies.some((e) => e.health <= 0)) {
    showMessage(state, 'Guard down');
  }
  const done = updateMission(state, dt);
  if (done && done !== 'drop1' && done !== 'timeout') {
    const def = MISSIONS.find((m) => m.name === done);
    showMessage(state, 'Mission complete: ' + done + ' +$' + (def ? def.payout : ''));
    if (state.mission.done) showMessage(state, 'THE EMBER SCORE — $5,500 banked. You own Solmar Bay.');
  }
  if (state.messageTimer > 0) state.messageTimer -= dt;
  state.time += dt;
  if (!p.alive) state.screen = 'over';
}

function save(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveGameV2(state)));
    showMessage(state, 'Game saved (v2)');
  } catch (e) {
    showMessage(state, 'Save failed');
  }
}

function load(state) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return loadGameV2(state, JSON.parse(raw));
  } catch (e) {
    return false;
  }
}

function main() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || '1') || 1;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  if (shot) {
    // Screenshot scene: fixed pre-roll, one deterministic frame.
    const state = setupShot(shot, seed);
    render(ctx, state);
    document.title = 'Solmar Bay — shot ' + shot;
    return;
  }

  const state = createGameState(seed);
  const input = createInput();
  attachInput(input);
  load(state);
  state.screen = 'start';

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (input.pause) {
      input.pause = false;
      if (state.screen === 'play') state.screen = 'pause';
      else if (state.screen === 'pause') state.screen = 'play';
    }
    if (state.screen === 'start' && input.confirm) {
      input.confirm = false;
      state.screen = 'play';
    } else if (state.screen === 'over' && input.confirm) {
      input.confirm = false;
      const fresh = createGameState(seed);
      Object.keys(state).forEach((k) => delete state[k]);
      Object.assign(state, fresh);
      state.screen = 'play';
    } else if (state.screen === 'pause') {
      if (input.save) {
        input.save = false;
        save(state);
      }
      if (input.confirm) {
        input.confirm = false;
        state.screen = 'play';
      }
    } else if (state.screen === 'play') {
      tick(state, input, dt);
    }
    render(ctx, state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
