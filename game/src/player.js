// Marco Solis on foot: walk, run, and the moves that make the game — stealing a
// parked car, carjacking a slow one, getting in and out. Driving itself lives in
// vehicles.js; this file is the man, not the machine.

import { PLAYER_CONF } from './config.js';
import { clamp } from './random.js';
import { clampToFree, moveWithCollision } from './city.js';
import { nearestCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    faceX: 0,
    faceY: 1,
    health: PLAYER_CONF.health,
    inCar: null,
    moving: false,
    punchTimer: 0,
    hurtTimer: 0,
    runDust: 0,
  };
}

/** One step on foot: WASD/arrows steer, Shift runs, walls slide. */
export function updateOnFoot(city, player, input, dt) {
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  player.moving = len > 0;
  if (len > 0) {
    mx /= len;
    my /= len;
    player.faceX = mx;
    player.faceY = my;
    const speed = input.run ? PLAYER_CONF.runSpeed : PLAYER_CONF.walkSpeed;
    const moved = moveWithCollision(city, player.x, player.y, mx * speed * dt, my * speed * dt, PLAYER_CONF.radius);
    player.x = moved.x;
    player.y = moved.y;
    player.runDust += dt;
  }
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
}

export function hurtPlayer(player, amount) {
  if (player.hurtTimer > 0 || player.health <= 0) return false;
  player.health = Math.max(0, player.health - amount);
  player.hurtTimer = 0.5;
  return true;
}

/**
 * Try to get into a car (E): a parked car is stolen, a slow traffic car is
 * carjacked and its driver flees on foot. Returns the car, or null.
 */
export function tryEnterCar(state, player) {
  const car = nearestCar(state.cars, player.x, player.y, 64, ['parked', 'traffic']);
  if (!car) return null;
  if (car.kind === 'traffic' && Math.abs(car.speed) > 60) return null;
  if (car.kind === 'parked') {
    car.kind = 'player';
    state.stats.carsStolen += 1;
    state.events.push({ type: 'steal', car });
  } else {
    car.kind = 'player';
    car.driver = false;
    state.stats.carsStolen += 1;
    state.stats.carjackings += 1;
    state.events.push({ type: 'carjack', car });
    state.fleeDriverAt = { x: car.x, y: car.y };
  }
  car.speed = 0;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  return car;
}

/** Step out of the car beside it. */
export function exitCar(state, player) {
  const car = player.inCar;
  if (!car) return;
  player.inCar = null;
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  const nx = car.x + side.x * 34;
  const ny = car.y + side.y * 34;
  const free = clampToFree(state.city, nx, ny, PLAYER_CONF.radius);
  player.x = free.x;
  player.y = free.y;
  car.speed = 0;
}

export function playerSpeed(state) {
  const p = state.player;
  if (p.inCar) return Math.abs(p.inCar.speed);
  return p.moving ? PLAYER_CONF.walkSpeed : 0;
}
