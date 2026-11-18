// Combat: Marco's pistol (Space, or click to fire toward the mouse) and his fists
// (F). Bullets fly straight, stop on walls, and hurt whatever they touch — a
// pedestrian, a car, a cop car — and every hit like that is a crime the wanted
// system hears about.

import { BULLET, CAR_CONF, PLAYER_CONF } from './config.js';
import { angleDiff, dist } from './random.js';
import { circleHitsSolid } from './city.js';
import { damageCar } from './vehicles.js';
import { hitPedestrian } from './pedestrians.js';

export function createBullet(x, y, angle) {
  return { x, y, angle, travelled: 0, alive: true };
}

/** Fire one bullet from (x, y) toward (tx, ty). */
export function fireBullet(state, x, y, tx, ty) {
  const angle = Math.atan2(ty - y, tx - x);
  state.bullets.push(createBullet(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, angle));
  state.events.push({ type: 'shot', x, y });
  state.danger = { x, y, radius: 420, panic: 1 };
  state.shotsFired += 1;
}

function bulletHitsCar(bullet, car) {
  if (car.wrecked) return false;
  const dx = bullet.x - car.x;
  const dy = bullet.y - car.y;
  const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
  const across = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
  return Math.abs(along) < CAR_CONF.length / 2 + 4 && Math.abs(across) < CAR_CONF.width / 2 + 4;
}

/** Advance every bullet; hits push events the world turns into wanted stars. */
export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    if (!b.alive) continue;
    const stepLen = BULLET.speed * dt;
    b.x += Math.cos(b.angle) * stepLen;
    b.y += Math.sin(b.angle) * stepLen;
    b.travelled += stepLen;
    if (b.travelled > BULLET.range || circleHitsSolid(state.city, b.x, b.y, 2)) {
      b.alive = false;
      state.events.push({ type: 'bulletWall', x: b.x, y: b.y });
      continue;
    }
    let hit = false;
    for (const ped of state.peds) {
      if (ped.alive && dist(b.x, b.y, ped.x, ped.y) < 16) {
        hitPedestrian(ped);
        state.events.push({ type: 'pedShot', x: ped.x, y: ped.y });
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        if (bulletHitsCar(b, car)) {
          damageCar(car, BULLET.damage);
          state.events.push({ type: 'carShot', car, x: b.x, y: b.y });
          hit = true;
          break;
        }
      }
    }
    if (!hit) {
      for (const cop of state.cops) {
        if (bulletHitsCar(b, cop)) {
          damageCar(cop, BULLET.damage);
          state.events.push({ type: 'copShot', car: cop, x: b.x, y: b.y });
          hit = true;
          break;
        }
      }
    }
    if (hit) b.alive = false;
  }
  state.bullets = state.bullets.filter((b) => b.alive);
}

/**
 * A punch in the facing direction: the nearest pedestrian or car inside the arc
 * takes the hit. Returns what was hit, or null.
 */
export function punch(state) {
  const p = state.player;
  if (p.punchTimer > 0) return null;
  p.punchTimer = PLAYER_CONF.punchCooldown;
  state.events.push({ type: 'punch', x: p.x + p.faceX * 30, y: p.y + p.faceY * 30 });
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d > PLAYER_CONF.punchRange + 14) continue;
    const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
    const facing = Math.atan2(p.faceY, p.faceX);
    if (Math.abs(angleDiff(ang, facing)) > PLAYER_CONF.punchArc) continue;
    hitPedestrian(ped);
    state.events.push({ type: 'pedShot', x: ped.x, y: ped.y });
    return { kind: 'ped', target: ped };
  }
  for (const car of state.cars) {
    if (car.kind === 'player' || car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d > PLAYER_CONF.punchRange + 26) continue;
    damageCar(car, PLAYER_CONF.punchDamage);
    state.events.push({ type: 'carShot', car, x: car.x, y: car.y });
    return { kind: 'car', target: car };
  }
  return null;
}
