// Solmar Bay — five-star wanted system, cop cars and on-foot cops. No DOM.
import { CONFIG } from './config.js';
import { nearestRoad } from './city.js';
import { damagePlayer } from './player.js';

export function createPoliceState() {
  return {
    wanted: 0,
    heat: 0,
    decayTimer: 0,
    copCars: [],
    footCops: [],
    crimesCommitted: 0,
  };
}

export function addWanted(police, n) {
  police.wanted = Math.max(0, Math.min(CONFIG.MAX_WANTED, police.wanted + n));
  police.heat = 0;
  police.decayTimer = 0;
  if (n > 0) police.crimesCommitted += 1;
}

export function updatePolice(police, player, world, dt) {
  const wanted = police.wanted;
  // Cop cars: one per wanted star up to 4, only while wanted >= 1.
  const wantCopCars = wanted >= 1 ? Math.min(4, wanted) : 0;
  while (police.copCars.length < wantCopCars) {
    const s = spawnPointNear(world, player.x, player.y, police.copCars.length);
    police.copCars.push({
      x: s.x, y: s.y, angle: 0, speed: 0, health: 100,
      color: '#1a1a2e', siren: 0,
    });
  }
  while (police.copCars.length > wantCopCars) police.copCars.pop();

  // Pursue the player.
  for (const cop of police.copCars) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    cop.speed = Math.min(CONFIG.COP_CAR_SPEED, cop.speed + 380 * dt);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.x = Math.max(20, Math.min(CONFIG.CITY_W - 20, cop.x));
    cop.y = Math.max(20, Math.min(CONFIG.CITY_H - 20, cop.y));
    cop.siren += dt;
    if (dist < 46) {
      damagePlayer(player, 6 * dt);
      cop.speed *= 0.5;
    }
  }

  // On-foot cops at high wanted (3+), spawning near the player.
  const wantFoot = wanted >= 3 ? Math.min(3, wanted - 2) : 0;
  while (police.footCops.length < wantFoot) {
    const i = police.footCops.length;
    const a = (i * 2.1) + 0.6;
    police.footCops.push({
      x: player.x + Math.cos(a) * 260,
      y: player.y + Math.sin(a) * 260,
      health: 100, speed: CONFIG.FOOT_COP_SPEED,
    });
  }
  while (police.footCops.length > wantFoot) police.footCops.pop();

  for (const cop of police.footCops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.x += (dx / dist) * cop.speed * dt;
    cop.y += (dy / dist) * cop.speed * dt;
    if (dist < 34) damagePlayer(player, 8 * dt);
  }

  // Wanted decays when the player stays out of sight: no cop close by.
  if (wanted > 0) {
    const nearestCop = nearestCopDist(police, player);
    if (nearestCop > 420) {
      police.decayTimer += dt;
      if (police.decayTimer >= CONFIG.WANTED_DECAY_SECONDS) {
        police.wanted -= 1;
        police.decayTimer = 0;
      }
    } else {
      police.decayTimer = 0;
    }
  }
}

function nearestCopDist(police, player) {
  let best = Infinity;
  for (const c of police.copCars) best = Math.min(best, Math.hypot(c.x - player.x, c.y - player.y));
  for (const c of police.footCops) best = Math.min(best, Math.hypot(c.x - player.x, c.y - player.y));
  return best;
}

function spawnPointNear(world, px, py, i) {
  // A road point roughly 500 units from the player, in a spread of directions.
  const a = (i * 1.7) + 0.9;
  const tx = px + Math.cos(a) * 520;
  const ty = py + Math.sin(a) * 520;
  const cx = Math.max(80, Math.min(CONFIG.CITY_W - 80, tx));
  const cy = Math.max(80, Math.min(CONFIG.CITY_H - 80, ty));
  const nr = nearestRoad(world, cx, cy);
  if (!nr.road) return { x: cx, y: cy };
  if (nr.road.horizontal) return { x: cx, y: nr.road.y1 };
  return { x: nr.road.x1, y: cy };
}
