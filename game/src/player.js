// The player on foot: position, health, and the walk step. Driving lives in
// vehicles.js; entering and leaving a car is coordinated by world.js.
import { PLAYER } from './config.js';
import { moveCircle } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0,
    health: PLAYER.health,
    /** The car the player is driving, or null when on foot. */
    car: null,
    lastDamageT: -99,
    moving: false,
  };
}

/** Walk one step in the direction (mx, my), normalised; returns distance moved. */
export function stepPlayerOnFoot(player, city, mx, my, dt) {
  const len = Math.hypot(mx, my);
  if (len < 0.01) {
    player.moving = false;
    return 0;
  }
  const nx = mx / len;
  const ny = my / len;
  const before = { x: player.x, y: player.y };
  const moved = moveCircle(city, player.x, player.y, nx * PLAYER.walkSpeed * dt, ny * PLAYER.walkSpeed * dt, PLAYER.radius);
  player.x = moved.x;
  player.y = moved.y;
  player.angle = Math.atan2(ny, nx);
  player.moving = true;
  return Math.hypot(player.x - before.x, player.y - before.y);
}

export function hurtPlayer(player, damage, elapsed) {
  player.health = Math.max(0, player.health - damage);
  player.lastDamageT = elapsed;
}

/** Health comes back after a few quiet seconds. */
export function regenPlayer(player, dt, elapsed) {
  if (player.health > 0 && player.health < PLAYER.health && elapsed - player.lastDamageT > PLAYER.regenDelay) {
    player.health = Math.min(PLAYER.health, player.health + PLAYER.regenRate * dt);
  }
}
