// Combat: one hitscan pistol. A shot kills the nearest living person inside
// range — a pedestrian, or an on-foot cop — and every shot and kill feeds the
// wanted system. No projectiles, no randomness: the same aim is the same hit.
import { COMBAT } from './config.js';
import { nearestPed, scarePeds } from './pedestrians.js';

export function createCombat() {
  return { cooldown: 0 };
}

/** Cooldown ticks down every step, whether or not the trigger is held. */
export function tickCombat(combat, dt) {
  if (combat.cooldown > 0) combat.cooldown = Math.max(0, combat.cooldown - dt);
}

/**
 * Fire once. `state` is { player, peds, cops, police, stats, elapsed }.
 * Returns { hit: 'ped' | 'cop' | null, x, y } or null when still cooling down.
 */
export function tryShoot(combat, state, dt) {
  if (combat.cooldown > 0) return null;
  combat.cooldown = COMBAT.cooldown;
  const { player, peds } = state;
  // Shots come from the car when driving, from the player on foot.
  const ox = player.car ? player.car.x : player.x;
  const oy = player.car ? player.car.y : player.y;
  state.stats.shotsFired += 1;
  state.police.heat = Math.min(5, state.police.heat + COMBAT.heatPerShot);
  state.police.lastCrimeT = state.elapsed;
  scarePeds(peds, ox, oy, 220);
  const ped = nearestPed(peds, ox, oy, COMBAT.range);
  let cop = null;
  let copD = COMBAT.range * COMBAT.range;
  for (const c of state.police.cops) {
    if (c.kind !== 'foot' || c.health <= 0) continue;
    const dx = c.x - ox;
    const dy = c.y - oy;
    const d = dx * dx + dy * dy;
    if (d < copD) { copD = d; cop = c; }
  }
  const pedD = ped ? (ped.x - ox) ** 2 + (ped.y - oy) ** 2 : Infinity;
  if (cop && copD < pedD) {
    cop.health -= 1;
    if (cop.health <= 0) {
      cop.down = true;
      state.police.heat = Math.min(5, state.police.heat + COMBAT.heatPerCopKill);
      state.stats.copsDown += 1;
    }
    return { hit: 'cop', x: cop.x, y: cop.y };
  }
  if (ped) {
    ped.alive = false;
    ped.respawnT = 20;
    state.stats.pedsDown += 1;
    state.police.heat = Math.min(5, state.police.heat + COMBAT.heatPerKill);
    return { hit: 'ped', x: ped.x, y: ped.y };
  }
  return { hit: null, x: ox, y: oy };
}
