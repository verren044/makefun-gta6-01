// The wanted system and the Bay Patrol: stars rise on every crime, decay after
// ten clean seconds a star, and cop cars spawn to match — one per star up to four.
// Cops chase on the road graph, ram (at most 4 HP of damage every 2 seconds across
// the whole chase), and arrest a man on foot after 1.4 seconds of contact.

import { COP_MODEL, WANTED } from './config.js';
import { dist } from './random.js';
import { clampToFree, nearestNode, route } from './city.js';
import { createCar, damageCar, driveCar, steerToward } from './vehicles.js';

export function copsForLevel(stars) {
  return WANTED.copsForStars[Math.max(0, Math.min(WANTED.maxStars, stars))];
}

/** Raise the wanted level, remembering the highest level this mission has seen. */
export function addWanted(state, amount, reason) {
  if (amount <= 0) return;
  const before = state.wanted;
  state.wanted = Math.min(WANTED.maxStars, state.wanted + amount);
  state.cleanTimer = 0;
  state.maxWantedThisMission = Math.max(state.maxWantedThisMission, state.wanted);
  if (state.wanted > before) {
    state.events.push({ type: 'wantedUp', stars: state.wanted, reason });
  }
}

/** Keep the cop count matched to the wanted level, spawning on nearby roads. */
export function syncCops(state) {
  const want = copsForLevel(state.wanted);
  while (state.cops.length < want) {
    const p = state.player;
    const node = state.city.nodes[Math.floor(state.rng() * state.city.nodes.length)];
    const near = state.city.nodes.reduce((best, n) => {
      const d = dist(n.x, n.y, p.x, p.y);
      const bd = dist(best.x, best.y, p.x, p.y);
      return d > 320 && d < bd ? n : best;
    }, node);
    const cop = createCar(COP_MODEL, near.x, near.y, 0, 'cop');
    cop.route = null;
    cop.routeIndex = 0;
    state.cops.push(cop);
  }
  while (state.cops.length > want) {
    state.cops.pop();
  }
}

/** Decay: ten clean seconds per star, then one star drops. */
export function updateWanted(state, dt) {
  if (state.wanted > 0) {
    state.cleanTimer += dt;
    if (state.cleanTimer >= WANTED.decaySeconds) {
      state.cleanTimer = 0;
      state.wanted -= 1;
      state.events.push({ type: 'wantedDown', stars: state.wanted });
      if (state.wanted === 0) state.maxWantedThisMission = 0;
    }
  }
  syncCops(state);
}

/**
 * Chase the player: route on the road graph while far away, steer straight at him
 * once close. Returns 'busted' when an arrest completes, else null.
 */
export function updateCops(state, dt) {
  const p = state.player;
  state.ramCooldown = Math.max(0, state.ramCooldown - dt);
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  for (const cop of state.cops) {
    if (cop.wrecked) continue;
    const d = dist(cop.x, cop.y, px, py);
    let target;
    if (d < 340) {
      target = { x: px, y: py };
    } else {
      if (!cop.route || cop.routeIndex >= cop.route.length) {
        cop.route = route(state.city, cop.x, cop.y, px, py);
        cop.routeIndex = 0;
      }
      target = cop.route[cop.routeIndex];
      if (dist(cop.x, cop.y, target.x, target.y) < 46) {
        cop.routeIndex += 1;
        continue;
      }
    }
    const { steer, throttle } = steerToward(cop, target.x, target.y);
    const chaseThrottle = d < 340 ? 1 : Math.max(0.7, throttle);
    driveCar(state.city, cop, { throttle: chaseThrottle, steer }, dt);
    const touch = dist(cop.x, cop.y, px, py);
    if (touch < 52) {
      if (p.inCar) {
        if (state.ramCooldown <= 0) {
          state.ramCooldown = WANTED.ramCooldownSeconds;
          damageCar(p.inCar, WANTED.ramDamage);
          state.events.push({ type: 'rammed', x: px, y: py });
        }
        cop.speed *= 0.55;
      } else {
        cop.arrestTimer = (cop.arrestTimer || 0) + dt;
        if (cop.arrestTimer >= WANTED.arrestSeconds) {
          return 'busted';
        }
      }
    } else {
      cop.arrestTimer = 0;
    }
  }
  return null;
}

/** A cop car that got wrecked is towed off and replaced by the sync step. */
export function cleanupCops(state) {
  state.cops = state.cops.filter((c) => !c.wrecked);
}
