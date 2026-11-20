// The wanted system: heat (0–5 stars) rises with crimes and falls when the
// player stays clean and far from every cop. Cop cars chase a driver; on-foot
// cops chase a walker — slower than the player's walk, so fleeing works. A
// busted arrest needs a cop close by for a sustained moment, never an instant
// touch, so a fast getaway is always possible.
import { POLICE, CAR, WORLD } from './config.js';
import { moveCircle, nearestRoadPoint, bfsPath } from './city.js';
import { range } from './random.js';

export function createPolice() {
  return {
    heat: 0,
    lastCrimeT: -99,
    cleanTimer: 0,
    bustTimer: 0,
    carBustTimer: 0,
    cops: [],
    routeT: 0,
  };
}

export function wantedStars(police) {
  return Math.min(POLICE.maxStars, Math.floor(police.heat + 1e-6));
}

export function addHeat(police, amount, elapsed) {
  police.heat = Math.min(POLICE.maxStars, police.heat + amount);
  police.lastCrimeT = elapsed;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Distance from (x, y) to the nearest living cop, Infinity when there is none. */
export function nearestCopDist(police, x, y) {
  let best = Infinity;
  for (const cop of police.cops) {
    if (cop.down) continue;
    const dx = cop.x - x;
    const dy = cop.y - y;
    const d = Math.hypot(dx, dy);
    if (d < best) best = d;
  }
  return best;
}

/** The nearest living cop object, or null. */
export function nearestCop(police, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const cop of police.cops) {
    if (cop.down) continue;
    const dx = cop.x - x;
    const dy = cop.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = cop; }
  }
  return best;
}

function spawnCopCar(police, state, random, px, py) {
  const { city } = state;
  // Drop the cop on a road roughly spawnDist away, in a random direction.
  let spot = null;
  for (let tries = 0; tries < 12; tries += 1) {
    const a = range(random, 0, Math.PI * 2);
    const d = range(random, POLICE.spawnDist * 0.8, POLICE.spawnDist * 1.3);
    const sx = px + Math.cos(a) * d;
    const sy = py + Math.sin(a) * d;
    if (sx < 60 || sy < 60 || sx > WORLD.width - 60 || sy > WORLD.height - 60) continue;
    spot = nearestRoadPoint(city, sx, sy);
    if (spot) break;
  }
  if (!spot) spot = nearestRoadPoint(city, px + POLICE.spawnDist, py);
  police.cops.push({
    kind: 'car', x: spot.x, y: spot.y, angle: 0, speed: 0,
    health: 3, down: false, route: [], routeIdx: 0, routeT: 0, ramT: 0,
  });
}

function spawnFootCop(police, state, random, px, py) {
  const { city } = state;
  let spot = null;
  for (let tries = 0; tries < 12; tries += 1) {
    const a = range(random, 0, Math.PI * 2);
    const d = range(random, 380, 520);
    const sx = px + Math.cos(a) * d;
    const sy = py + Math.sin(a) * d;
    if (sx < 40 || sy < 40 || sx > WORLD.width - 40 || sy > WORLD.height - 40) continue;
    spot = nearestRoadPoint(city, sx, sy);
    if (spot) break;
  }
  if (!spot) spot = { x: px + 420, y: py };
  police.cops.push({
    kind: 'foot', x: spot.x, y: spot.y, angle: 0, speed: 0,
    health: 1, down: false, stuckT: 0, lastX: spot.x, lastY: spot.y,
  });
}

/**
 * One police step. `state` is { player, city, cars, random, elapsed, events }.
 * Returns true when the player is busted.
 */
export function stepPolice(police, state, dt) {
  const { player, city, random, elapsed } = state;
  // The live position: the car when driving — player.x/y are stale on foot
  // coordinates from where the player got in, and every cop would camp there.
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const stars = wantedStars(police);
  const inCar = player.car !== null;

  // Keep the force at the right size: cop cars for a driver, on-foot cops
  // for a walker. When the heat is gone, the force stands down at once.
  police.cops = police.cops.filter((c) => !c.down);
  if (stars === 0) {
    police.cops = [];
    police.bustTimer = 0;
    police.carBustTimer = 0;
  } else {
    const wantCars = inCar ? Math.min(stars, 4) : 0;
    const wantFoot = inCar ? 0 : Math.min(stars, 2);
    const haveCars = police.cops.filter((c) => c.kind === 'car').length;
    const haveFoot = police.cops.filter((c) => c.kind === 'foot').length;
    if (inCar) police.cops = police.cops.filter((c) => c.kind === 'car');
    else police.cops = police.cops.filter((c) => c.kind === 'foot');
    for (let i = haveCars; i < wantCars; i += 1) spawnCopCar(police, state, random, px, py);
    for (let i = haveFoot; i < wantFoot; i += 1) spawnFootCop(police, state, random, px, py);
  }

  let busted = false;

  for (const cop of police.cops) {
    if (cop.kind === 'car') {
      // Re-route to the player every 1.5 s and drive the roads after them.
      cop.routeT -= dt;
      if (cop.routeT <= 0 || cop.routeIdx >= cop.route.length) {
        cop.routeT = 1.5;
        const path = bfsPath(city, { x: cop.x, y: cop.y }, { x: px, y: py });
        cop.route = path;
        cop.routeIdx = 0;
      }
      let tx = px;
      let ty = py;
      if (cop.routeIdx < cop.route.length) {
        tx = cop.route[cop.routeIdx].x;
        ty = cop.route[cop.routeIdx].y;
        if (Math.hypot(tx - cop.x, ty - cop.y) < 46) cop.routeIdx += 1;
      }
      const want = Math.atan2(ty - cop.y, tx - cop.x);
      const diff = angleDiff(want, cop.angle);
      const turn = 2.6 * dt;
      cop.angle += Math.max(-turn, Math.min(turn, diff));
      if (cop.speed < POLICE.carTop) cop.speed += POLICE.carAccel * dt;
      const step = moveCircle(city, cop.x, cop.y, Math.cos(cop.angle) * cop.speed * dt, Math.sin(cop.angle) * cop.speed * dt, 17);
      cop.x = step.x;
      cop.y = step.y;
      // Ramming the player's car: shove it and chip its health.
      if (player.car) {
        const dx = player.car.x - cop.x;
        const dy = player.car.y - cop.y;
        const d = Math.hypot(dx, dy);
        if (d < 44) {
          const push = (44 - d) * 0.15;
          const nx = dx / (d || 1);
          const ny = dy / (d || 1);
          player.car.x = Math.min(Math.max(player.car.x + nx * push, 20), WORLD.width - 20);
          player.car.y = Math.min(Math.max(player.car.y + ny * push, 20), WORLD.height - 20);
          cop.ramT -= dt;
          if (cop.ramT <= 0) {
            cop.ramT = 0.8;
            player.car.health -= CAR.ramDamage;
            player.car.lastHitT = elapsed;
          }
        }
      }
    } else {
      // On foot: run straight at the player with wall sliding. If wedged on
      // a building face, sidestep along it instead of pushing forever.
      const dx = px - cop.x;
      const dy = py - cop.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = (dx / d) * POLICE.footSpeed * dt;
      let my = (dy / d) * POLICE.footSpeed * dt;
      if (cop.stuckT > 0) {
        cop.stuckT -= dt;
        const side = cop.sideDir || 1;
        mx = (-dy / d) * side * POLICE.footSpeed * dt;
        my = (dx / d) * side * POLICE.footSpeed * dt;
      }
      const before = { x: cop.x, y: cop.y };
      const step = moveCircle(city, cop.x, cop.y, mx, my, 12);
      cop.x = step.x;
      cop.y = step.y;
      cop.angle = Math.atan2(my, mx);
      if (Math.hypot(cop.x - cop.lastX, cop.y - cop.lastY) < 0.5 && d > 30) {
        cop.stuckT = 0.8;
        cop.sideDir = (cop.sideDir || 1) * -1;
      }
      cop.lastX = cop.x;
      cop.lastY = cop.y;
      // Give up the chase when the player is far away for a while.
      if (d > 420) cop.down = true;
    }
  }
  police.cops = police.cops.filter((c) => !c.down);

  // Busted: an on-foot cop close by for a sustained moment, or a stopped car
  // with a cop car on its bumper.
  if (!inCar && stars > 0) {
    const cop = nearestCop(police, px, py);
    if (cop && cop.kind === 'foot' && Math.hypot(cop.x - px, cop.y - py) < POLICE.bustRadius) {
      police.bustTimer += dt;
      if (police.bustTimer >= POLICE.bustTime) busted = true;
    } else {
      police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
    }
  } else {
    police.bustTimer = 0;
  }
  if (inCar && stars > 0 && player.car && Math.abs(player.car.speed) < 20) {
    const near = police.cops.some((c) => c.kind === 'car' && Math.hypot(c.x - player.car.x, c.y - player.car.y) < POLICE.carBustRadius);
    if (near) {
      police.carBustTimer += dt;
      if (police.carBustTimer >= POLICE.carBustTime) busted = true;
    } else {
      police.carBustTimer = Math.max(0, police.carBustTimer - dt * 2);
    }
  } else {
    police.carBustTimer = 0;
  }

  // Heat decay: clean and far from every cop for a while, one star at a time.
  if (stars > 0 && elapsed - police.lastCrimeT > POLICE.crimeGrace) {
    const nearest = nearestCopDist(police, px, py);
    if (nearest > POLICE.cleanRadius) {
      police.cleanTimer += dt;
      if (police.cleanTimer >= POLICE.cleanSeconds) {
        police.heat = Math.max(0, police.heat - 1);
        police.cleanTimer = 0;
      }
    } else {
      police.cleanTimer = 0;
    }
  } else {
    police.cleanTimer = 0;
  }

  return busted;
}
