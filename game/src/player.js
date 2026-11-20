// Solmar Bay — player on foot. No DOM.
import { CONFIG, clampToCity } from './config.js';

export function createPlayer(world) {
  return {
    x: world.playerSpawn.x,
    y: world.playerSpawn.y,
    angle: 0,
    speed: 0,
    health: 100,
    money: 0,
    inCar: null,
    onFoot: true,
    shootCooldown: 0,
    alive: true,
  };
}

export function updatePlayer(player, input, dt) {
  if (!player.onFoot || !player.alive) return;
  let dx = 0;
  let dy = 0;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    player.angle = Math.atan2(dy, dx);
    player.x += dx * CONFIG.PLAYER_SPEED * dt;
    player.y += dy * CONFIG.PLAYER_SPEED * dt;
    player.speed = CONFIG.PLAYER_SPEED;
  } else {
    player.speed = 0;
  }
  const c = clampToCity(player.x, player.y);
  player.x = c.x;
  player.y = c.y;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
}

export function damagePlayer(player, dmg) {
  if (!player.alive) return;
  player.health -= dmg;
  if (player.health <= 0) {
    player.health = 0;
    player.alive = false;
  }
}

// Save format v2: money, position, current mission.
export function saveGameV2(state) {
  return {
    version: CONFIG.SAVE_VERSION,
    money: state.player.money,
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    mission: state.mission.index,
    health: state.player.health,
    wanted: state.police.wanted,
  };
}

export function loadGameV2(state, data) {
  if (!data || data.version !== CONFIG.SAVE_VERSION) return false;
  state.player.money = data.money;
  state.player.x = data.x;
  state.player.y = data.y;
  state.mission.index = data.mission;
  state.player.health = data.health;
  state.police.wanted = data.wanted;
  state.player.alive = data.health > 0;
  return true;
}
