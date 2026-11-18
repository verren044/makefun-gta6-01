// The world: one state object, one fixed step, and the autopilot that drives the
// screenshot scenes and the story simulation. Everything that happens in Solmar Bay
// — driving, stealing, shooting, cops, missions — flows through step().

import { CAR_CONF, STEP, WANTED } from './config.js';
import { angleDiff, clamp, createRandom, dist } from './random.js';
import { buildCity, circleHitsSolid, clampToFree, isOnRoad, nearestRoadPoint, route } from './city.js';
import { createPlayer, exitCar, hurtPlayer, tryEnterCar, updateOnFoot } from './player.js';
import { damageCar, driveCar, nearestCar, nudgeOutOfSolid, resetCarIds, respawnWreckedCar, spawnParkedCars, spawnTrafficCars, steerToward, updateTraffic } from './vehicles.js';
import { hitPedestrian, nearestPedestrian, spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { fireBullet, punch, updateBullets } from './combat.js';
import { addWanted, cleanupCops, updateCops, updateWanted } from './police.js';
import { createMissions, currentObjective, startMission, updateMissions } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_STORY = 8;

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  resetCarIds();
  const parked = spawnParkedCars(city, rng);
  const traffic = spawnTrafficCars(city, rng);
  const state = {
    seed,
    rng,
    city,
    time: 0,
    player: createPlayer(city.playerSpawn.x, city.playerSpawn.y),
    cars: [...parked, ...traffic],
    peds: spawnPedestrians(city, rng),
    cops: [],
    bullets: [],
    particles: [],
    missions: createMissions(city),
    wanted: 0,
    cleanTimer: 0,
    maxWantedThisMission: 0,
    cash: 0,
    ramCooldown: 0,
    crimeCooldown: 0,
    shootCooldown: 0,
    shootGrace: 0,
    danger: null,
    over: null,
    events: [],
    sfx: [],
    toasts: [],
    banner: null,
    shake: 0,
    saveNow: false,
    shotsFired: 0,
    fleeDriverAt: null,
    stats: { carsStolen: 0, carjackings: 0, missionsDone: 0, pedsDown: 0, shotsFired: 0 },
    bot: { route: null, routeIndex: 0, stuckTimer: 0, lastX: 0, lastY: 0, reverseTimer: 0, waitTimer: 0 },
  };
  return state;
}

function toast(state, text) {
  state.toasts.push({ text, t: 4 });
  if (state.toasts.length > 4) state.toasts.shift();
}

function banner(state, text, sub) {
  state.banner = { text, sub: sub || '', t: 3.2 };
}

function burst(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.4 + state.rng() * 0.8);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + state.rng() * 0.4, max: 0.9, color, size: 2 + state.rng() * 3 });
  }
  if (state.particles.length > 240) state.particles.splice(0, state.particles.length - 240);
}

function playerPos(state) {
  const p = state.player;
  if (p.inCar) return { x: p.inCar.x, y: p.inCar.y };
  return { x: p.x, y: p.y };
}

function runOverCheck(state) {
  const p = state.player;
  if (!p.inCar || Math.abs(p.inCar.speed) < 90) return;
  const car = p.inCar;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (dist(car.x, car.y, ped.x, ped.y) < 30) {
      hitPedestrian(ped);
      state.stats.pedsDown += 1;
      state.events.push({ type: 'pedShot', x: ped.x, y: ped.y });
      car.speed *= 0.82;
    }
  }
}

function carCollisionCheck(state) {
  const p = state.player;
  if (!p.inCar) return;
  const car = p.inCar;
  for (const other of [...state.cars, ...state.cops]) {
    if (other === car || other.wrecked) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 42 && d > 0.01) {
      const push = (42 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      nudgeOutOfSolid(state.city, car);
      nudgeOutOfSolid(state.city, other);
      const closing = Math.abs(car.speed - other.speed);
      if (closing > 200) {
        damageCar(car, 6);
        damageCar(other, 6);
        burst(state, car.x, car.y, '#ffb347', 8, 160);
        state.shake = Math.max(state.shake, 0.25);
        if (state.crimeCooldown <= 0 && other.kind !== 'player') {
          state.crimeCooldown = 4;
          state.events.push({ type: 'carShot', car: other, x: other.x, y: other.y });
        }
      } else {
        car.speed *= 0.85;
        other.speed *= 0.85;
      }
    }
  }
}

function processEvents(state) {
  const seen = state.events;
  for (const e of seen) {
    if (e.type === 'steal') {
      addWanted(state, 1, 'stolen car');
      toast(state, `Stole a ${e.car.model.name} — 1 star`);
      state.sfx.push('steal');
    } else if (e.type === 'carjack') {
      addWanted(state, 1, 'carjacking');
      toast(state, 'Carjacked — 1 star');
      state.sfx.push('steal');
    } else if (e.type === 'pedShot') {
      addWanted(state, 1, 'pedestrian down');
      state.stats.pedsDown += 1;
      burst(state, e.x, e.y, '#e5534b', 10, 140);
    } else if (e.type === 'carShot' || e.type === 'copShot') {
      addWanted(state, 1, 'shots fired at a car');
      burst(state, e.x, e.y, '#ffb347', 8, 180);
    } else if (e.type === 'shot') {
      state.sfx.push('shoot');
      state.shake = Math.max(state.shake, 0.08);
    } else if (e.type === 'punch') {
      state.sfx.push('punch');
    } else if (e.type === 'rammed') {
      hurtPlayer(state.player, 0);
      state.shake = Math.max(state.shake, 0.3);
      state.sfx.push('crash');
    } else if (e.type === 'bulletWall') {
      burst(state, e.x, e.y, '#d8c95a', 4, 90);
    } else if (e.type === 'wantedUp') {
      toast(state, `Wanted: ${'★'.repeat(e.stars)}`);
      state.sfx.push('siren');
    } else if (e.type === 'wantedDown') {
      if (e.stars === 0) toast(state, 'You lost the cops.');
    } else if (e.type === 'stage') {
      state.sfx.push('stage');
    } else if (e.type === 'bag') {
      toast(state, 'Cash bag secured.');
      state.sfx.push('pickup');
      burst(state, e.x, e.y, '#f2c94c', 14, 200);
    } else if (e.type === 'missionComplete') {
      banner(state, 'MISSION COMPLETE', `+$${e.reward}`);
      state.sfx.push('mission');
      state.saveNow = true;
    } else if (e.type === 'missionStart') {
      const def = state.missions.index;
      toast(state, `New mission: ${['Borrowed Wheels', 'The Pickup', 'Heat Wave', 'The Big Score'][def]}`);
    } else if (e.type === 'storyComplete') {
      banner(state, 'THE BIG SCORE — DONE', `Marco bought the garage back. $${state.cash} earned.`);
      state.over = 'story';
      state.sfx.push('story');
    }
  }
}

/** One fixed 1/60 s step. `input` carries held keys plus one-shot edges. */
export function stepWorld(state, input) {
  if (state.over) return EVENT_NONE;
  state.events = [];
  state.sfx = [];
  state.time += STEP;
  state.crimeCooldown = Math.max(0, state.crimeCooldown - STEP);
  state.shootCooldown = Math.max(0, state.shootCooldown - STEP);
  state.shootGrace = Math.max(0, state.shootGrace - STEP);
  state.shake = Math.max(0, state.shake - STEP * 1.6);
  if (state.banner) {
    state.banner.t -= STEP;
    if (state.banner.t <= 0) state.banner = null;
  }
  for (const t of state.toasts) t.t -= STEP;
  state.toasts = state.toasts.filter((t) => t.t > 0);
  if (state.danger) {
    state.danger.panic -= STEP;
    if (state.danger.panic <= 0) state.danger = null;
  }

  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    if (car.wrecked) {
      exitCar(state, p);
      state.events.push({ type: 'wrecked' });
      toast(state, 'Your car is wrecked — it will be towed and patched up.');
    } else {
      // Analog throttle/steer when the caller supplies them (the autopilot);
      // the keyboard path supplies booleans and they are converted here.
      let throttle;
      let steer;
      if (typeof input.throttle === 'number') {
        throttle = input.throttle;
        steer = input.steer || 0;
      } else {
        throttle = (input.up ? 1 : 0) - (input.down ? 0.75 : 0);
        steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      }
      const res = driveCar(state.city, car, { throttle, steer }, STEP);
      if (circleHitsSolid(state.city, car.x, car.y, CAR_CONF.radius)) nudgeOutOfSolid(state.city, car);
      if (res.hitWall && Math.abs(car.speed) > 120) {
        burst(state, car.x, car.y, '#ffb347', 6, 120);
        state.shake = Math.max(state.shake, 0.2);
        state.sfx.push('crash');
      }
      p.x = car.x;
      p.y = car.y;
      p.faceX = Math.cos(car.angle);
      p.faceY = Math.sin(car.angle);
      if (input.steal) exitCar(state, p);
      runOverCheck(state);
      carCollisionCheck(state);
    }
  } else {
    // Never let the player sit inside a wall: if a shunt or an exit put him in
    // solid ground, step him out to the nearest free point first.
    if (circleHitsSolid(state.city, p.x, p.y, 14)) {
      const free = clampToFree(state.city, p.x, p.y, 14);
      p.x = free.x;
      p.y = free.y;
    }
    updateOnFoot(state.city, p, input, STEP);
    if (input.steal) {
      const car = tryEnterCar(state, p);
      if (car) state.shootGrace = 0.4;
    }
    if (input.punch) punch(state);
    if (input.shoot && state.shootCooldown <= 0 && state.shootGrace <= 0) {
      state.shootCooldown = 0.22;
      const aimX = input.aimX !== undefined ? input.aimX : p.x + p.faceX * 100;
      const aimY = input.aimY !== undefined ? input.aimY : p.y + p.faceY * 100;
      fireBullet(state, p.x, p.y, aimX, aimY);
    }
  }
  if (p.inCar && input.shoot && state.shootCooldown <= 0 && state.shootGrace <= 0) {
    state.shootCooldown = 0.22;
    const car = p.inCar;
    const aimX = input.aimX !== undefined ? input.aimX : car.x + Math.cos(car.angle) * 100;
    const aimY = input.aimY !== undefined ? input.aimY : car.y + Math.sin(car.angle) * 100;
    fireBullet(state, car.x, car.y, aimX, aimY);
  }

  if (state.fleeDriverAt) {
    const dead = state.peds.find((ped) => !ped.alive);
    if (dead) {
      const free = clampToFree(state.city, state.fleeDriverAt.x + 30, state.fleeDriverAt.y, 12);
      dead.x = free.x;
      dead.y = free.y;
      dead.alive = true;
      dead.deadTimer = 0;
      dead.panic = 3;
    }
    state.fleeDriverAt = null;
  }

  updateTraffic(state.city, state.cars.filter((c) => c.kind === 'traffic'), state.rng, STEP);
  const playerCar = p.inCar;
  updatePedestrians(state.city, state.peds, state.rng, STEP, state.danger, playerCar);
  updateBullets(state, STEP);
  for (const car of state.cars) {
    if (car.wrecked) {
      car.wreckTimer += STEP;
      if (car.wreckTimer >= 6) respawnWreckedCar(state.city, car, state.rng);
    }
  }
  const busted = updateCops(state, STEP);
  if (busted === 'busted') {
    state.over = 'busted';
    processEvents(state);
    return EVENT_BUSTED;
  }
  cleanupCops(state);
  updateWanted(state, STEP);
  updateMissions(state, STEP);
  for (const part of state.particles) {
    part.x += part.vx * STEP;
    part.y += part.vy * STEP;
    part.vx *= 0.96;
    part.vy *= 0.96;
    part.life -= STEP;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  processEvents(state);
  state.stats.shotsFired = state.shotsFired;
  if (p.health <= 0 && !state.over) {
    state.over = 'wasted';
    return EVENT_WASTED;
  }
  if (state.over === 'story') return EVENT_STORY;
  if (state.missions.done > 0 && state.events.some((e) => e.type === 'missionComplete')) return EVENT_MISSION;
  return EVENT_NONE;
}

/**
 * The autopilot: drives the screenshot scenes and the headless story simulation.
 * It routes on the road graph (never straight through buildings), steals a car when
 * the job needs wheels, punches pedestrians to raise heat for mission 3, and hides
 * from the cops until the heat dies.
 */
export function botInput(state) {
  const input = { up: false, down: false, left: false, right: false, run: false, steal: false, punch: false, shoot: false };
  const p = state.player;
  const m = state.missions;
  const bot = state.bot;
  const pos = playerPos(state);

  if (m.index === 2 && m.stage === 0 && state.wanted < 3) {
    if (p.inCar) {
      input.steal = true;
      return input;
    }
    const ped = nearestPedestrian(state.peds, p.x, p.y, 900);
    if (ped && dist(p.x, p.y, ped.x, ped.y) < 52) {
      input.punch = true;
      return input;
    }
    if (ped) return walkToward(state, input, ped.x, ped.y);
    return input;
  }
  if (m.index === 2 && m.stage === 1) {
    let nearestCop = null;
    let bestD = Infinity;
    for (const cop of state.cops) {
      const d = dist(p.x, p.y, cop.x, cop.y);
      if (d < bestD) {
        bestD = d;
        nearestCop = cop;
      }
    }
    if (nearestCop && bestD < 220) {
      const away = Math.atan2(p.y - nearestCop.y, p.x - nearestCop.x);
      input.run = true;
      return walkToward(state, input, p.x + Math.cos(away) * 200, p.y + Math.sin(away) * 200);
    }
    return input;
  }

  const obj = currentObjective(state);
  // Stages that only count in a car: both deliveries and the whole Big Score.
  // On foot at such an objective the bot must go and fetch wheels first — even
  // when it is already standing on the marker.
  const needCar = m.index === 0 || (m.index === 1 && m.stage === 1) || m.index === 3;
  if (!p.inCar) {
    const car = nearestCar(state.cars, p.x, p.y, 4000, ['parked']);
    if (car && dist(p.x, p.y, car.x, car.y) < 56) {
      input.steal = true;
      return input;
    }
    if (needCar && car) return walkToward(state, input, car.x, car.y);
    if (m.index === 0 && m.stage === 0) {
      if (car) return walkToward(state, input, car.x, car.y);
      return input;
    }
    return walkToward(state, input, obj.x, obj.y);
  }

  const goal = { x: obj.x, y: obj.y };
  if (dist(pos.x, pos.y, goal.x, goal.y) < 70) {
    input.up = false;
    return input;
  }
  const driveKey = `${Math.round(goal.x)},${Math.round(goal.y)}`;
  if (!bot.route || bot.routeIndex >= bot.route.length || bot.driveKey !== driveKey) {
    bot.route = route(state.city, pos.x, pos.y, goal.x, goal.y);
    bot.routeIndex = 0;
    bot.driveKey = driveKey;
  }
  const wp = bot.route[bot.routeIndex];
  if (dist(pos.x, pos.y, wp.x, wp.y) < 60) {
    bot.routeIndex += 1;
    return input;
  }
  const car = p.inCar;
  // Stuck means no real progress over a two-second window, not one slow step.
  if (!bot.stuckRef) bot.stuckRef = { x: pos.x, y: pos.y, t: state.time };
  if (state.time - bot.stuckRef.t > 2) {
    if (dist(bot.stuckRef.x, bot.stuckRef.y, pos.x, pos.y) < 20 && Math.abs(car.speed) < 30) {
      bot.reverseTimer = 1.2;
    }
    bot.stuckRef = { x: pos.x, y: pos.y, t: state.time };
  }
  if (bot.reverseTimer > 0) {
    bot.reverseTimer -= STEP;
    input.throttle = -0.7;
    input.steer = 0;
    return input;
  }
  // Off-road inside a block: aim for the nearest road first, never straight at
  // a waypoint across a building.
  let target = wp;
  if (!isOnRoad(car.x, car.y)) target = nearestRoadPoint(car.x, car.y);
  const { steer, throttle } = steerToward(car, target.x, target.y);
  const nearWp = dist(pos.x, pos.y, wp.x, wp.y);
  // Slow in, fast out: brake for sharp turns and for the waypoint itself, so the
  // car makes the corner on the road instead of grinding through a building.
  // Look one waypoint ahead and brake BEFORE the turn, not after passing it.
  let desired = 520;
  const nextWp = bot.route[bot.routeIndex + 1];
  if (nextWp) {
    const turnAhead = Math.abs(angleDiff(
      Math.atan2(nextWp.y - wp.y, nextWp.x - wp.x),
      Math.atan2(wp.y - car.y, wp.x - car.x),
    ));
    if (turnAhead > 0.5) desired = Math.min(desired, 110 + nearWp * 0.9);
  }
  const turn = Math.abs(angleDiff(Math.atan2(target.y - car.y, target.x - car.x), car.angle));
  if (turn > 1.0) desired = Math.min(desired, 130);
  else if (turn > 0.5) desired = Math.min(desired, 230);
  if (nearWp < 200) desired = Math.min(desired, 260);
  let t = throttle;
  if (car.speed > desired) t = Math.min(t, -0.4);
  else if (nearWp < 260) t = Math.min(t, 0.45);
  input.throttle = t;
  input.steer = steer;
  return input;
}

/** Steer on foot toward a point: follow the road graph while far away, walk
 * straight at it once close. The route is only rebuilt when the target moves a
 * long way — rebuilding it every step sent the walker back to the nearest
 * crossing behind him and wedged the autopilot in a 130 px loop. */
function setWalk(input, dx, dy) {
  const d = Math.max(1, Math.hypot(dx, dy));
  input.up = dy / d < -0.3;
  input.down = dy / d > 0.3;
  input.left = dx / d < -0.3;
  input.right = dx / d > 0.3;
  input.run = true;
  return input;
}

function walkToward(state, input, tx, ty) {
  const p = state.player;
  const bot = state.bot;
  if (dist(p.x, p.y, tx, ty) < 160) return setWalk(input, tx - p.x, ty - p.y);
  const moved = !bot.walkTarget || dist(bot.walkTarget.x, bot.walkTarget.y, tx, ty) > 80;
  if (!bot.route || bot.routeIndex >= bot.route.length || moved) {
    bot.route = route(state.city, p.x, p.y, tx, ty);
    bot.routeIndex = 0;
    bot.walkTarget = { x: tx, y: ty };
  }
  let wp = bot.route[bot.routeIndex];
  if (dist(p.x, p.y, wp.x, wp.y) < 40) {
    bot.routeIndex += 1;
    if (bot.routeIndex >= bot.route.length) return setWalk(input, tx - p.x, ty - p.y);
    wp = bot.route[bot.routeIndex];
  }
  return setWalk(input, wp.x - p.x, wp.y - p.y);
}

export { currentObjective };
