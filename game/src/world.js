// The world: everything wired together. createWorld(seed) builds the city, the
// cars, the pedestrians, the player, the police and the story from one seeded
// generator, so the same seed always plays the same game. stepWorld advances
// one fixed step from a { up, down, left, right, shoot, enter } command.
// botInput is the autopilot the headless simulation and the screenshot scenes
// steer with: it routes on the road graph, flees cops on foot while wanted,
// and recovers from being wedged instead of pushing forever.
// Nothing here touches the browser except save/load, which are guarded.
import {
  WORLD, PLAYER, CAR, COMBAT, GOAL_MONEY, MISSION_DEFS, SAVE_KEY, STEP,
} from './config.js';
import { createRandom } from './random.js';
import {
  buildCity, bfsPath, moveCircle, segmentClear, nearestNode, districtAt, circleHits, nearestRoadPoint, onRoad,
} from './city.js';
import {
  createCars, stepTraffic, driveCar, nearestCar, resolveCarCollisions,
  carRadius, retargetTraffic,
} from './vehicles.js';
import { createPeds, stepPeds, nearestPed } from './pedestrians.js';
import {
  createPlayer, stepPlayerOnFoot, hurtPlayer, regenPlayer,
} from './player.js';
import { createCombat, tryShoot, tickCombat } from './combat.js';
import {
  createPolice, stepPolice, wantedStars, addHeat, nearestCop, nearestCopDist,
} from './police.js';
import {
  createMissions, updateMissions, missionObjective, missionHudLine,
} from './missions.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WASTED = 4;
export const EVENT_PICKUP = 8;
export const EVENT_SHOT = 16;
export const EVENT_STORY_DONE = 32;

export const SPAWN = { x: 700, y: 560 };

const CORNERS = [
  { x: 200, y: 200 }, { x: 3400, y: 200 },
  { x: 200, y: 2600 }, { x: 3400, y: 2600 },
];
/** Stuck when progress in a 2 s window is under 15% of the distance the bot
 *  should have covered — the walk deadzone is 0.15, not 0.3. */
const WALK_DEADZONE = 0.15;
const STUCK_WINDOW = 1.2;

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = buildCity(random);
  // The spawn is on a road, but never trust a coordinate: if a building ever
  // covers it, drop the player on the nearest road point instead of inside
  // a solid, where no move could ever succeed.
  let spawn = { x: SPAWN.x, y: SPAWN.y };
  if (circleHits(city, spawn.x, spawn.y, PLAYER.radius)) {
    spawn = nearestRoadPoint(city, spawn.x, spawn.y) || spawn;
  }
  const world = {
    seed,
    random,
    city,
    cars: createCars(random, city),
    peds: createPeds(random, city),
    player: createPlayer(spawn.x, spawn.y),
    combat: createCombat(),
    police: createPolice(),
    missions: createMissions(),
    money: 0,
    elapsed: 0,
    events: 0,
    busted: false,
    wasted: false,
    muzzle: null,
    stats: { missionsDone: 0, carjackings: 0, pedsDown: 0, shotsFired: 0, pickups: 0, copsDown: 0 },
    bot: {
      route: [], routeIdx: 0, routeKey: '', routeT: 0,
      lastX: spawn.x, lastY: spawn.y, checkT: 0,
      recoveryT: 0, recoverySide: 1, corner: null,
    },
  };
  return world;
}

export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  for (const key of Object.keys(fresh)) world[key] = fresh[key];
}

export function playerPos(world) {
  if (world.player.car) return { x: world.player.car.x, y: world.player.car.y };
  return { x: world.player.x, y: world.player.y };
}

export function playerDistrict(world) {
  const p = playerPos(world);
  return districtAt(p.x, p.y);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A wrecked car throws its driver out on foot. */
function checkWreck(world) {
  const car = world.player.car;
  if (!car || car.health > 0) return;
  car.kind = 'wreck';
  car.speed = 0;
  world.player.car = null;
  world.player.x = car.x;
  world.player.y = car.y;
  hurtPlayer(world.player, 30, world.elapsed);
}

function enterable(car) {
  if (car.kind === 'wreck') return false;
  if (car.kind === 'parked') return true;
  return Math.abs(car.speed) < CAR.jackSpeed;
}

function stepPlayer(world, cmd, dt) {
  const { player, city } = world;
  if (player.car) {
    const crashed = driveCar(player.car, cmd, dt, city);
    if (crashed) {
      player.car.health -= 4;
      player.car.lastHitT = world.elapsed;
    }
    if (player.car.health < 100 && world.elapsed - player.car.lastHitT > CAR.regenDelay) {
      player.car.health = Math.min(100, player.car.health + CAR.regenRate * dt);
    }
    checkWreck(world);
    return;
  }
  const mx = (cmd.right ? 1 : 0) - (cmd.left ? 1 : 0);
  const my = (cmd.down ? 1 : 0) - (cmd.up ? 1 : 0);
  stepPlayerOnFoot(player, city, mx, my, dt);
  // A fast traffic car clips a walker: a hard shove and some damage.
  for (const car of world.cars) {
    if (car.kind !== 'traffic' || Math.abs(car.speed) < 50) continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    if (dx * dx + dy * dy < (carRadius(car) + 12) ** 2) {
      if (world.elapsed - player.lastDamageT > 0.5) {
        hurtPlayer(player, 8, world.elapsed);
        const d = Math.hypot(dx, dy) || 1;
        const shove = moveCircle(city, player.x, player.y, (dx / d) * 30, (dy / d) * 30, PLAYER.radius);
        player.x = shove.x;
        player.y = shove.y;
      }
    }
  }
}

function handleEnter(world, cmd) {
  if (!cmd.enter) return;
  const { player } = world;
  if (player.car) {
    if (Math.abs(player.car.speed) < 60) {
      const car = player.car;
      // Step out to the side of the car; try both sides so the player never
      // lands inside a building.
      let exitX = car.x;
      let exitY = car.y;
      for (const side of [Math.PI / 2, -Math.PI / 2]) {
        const tx = car.x + Math.cos(car.angle + side) * 34;
        const ty = car.y + Math.sin(car.angle + side) * 34;
        if (!circleHits(world.city, tx, ty, PLAYER.radius)) {
          exitX = tx;
          exitY = ty;
          break;
        }
      }
      player.car = null;
      player.x = exitX;
      player.y = exitY;
      if (car.originKind === 'traffic') {
        car.kind = 'traffic';
        retargetTraffic(world.random, world.city, car);
      } else {
        car.kind = 'parked';
      }
    }
    return;
  }
  const car = nearestCar(world.cars, player.x, player.y, CAR.enterRadius, enterable);
  if (!car) return;
  const wasTraffic = car.kind === 'traffic';
  if (!car.originKind) car.originKind = car.kind;
  car.kind = 'player';
  player.car = car;
  if (wasTraffic) {
    world.stats.carjackings += 1;
    // A carjack only raises heat when someone sees it: a cop nearby, or a
    // pedestrian close enough to watch.
    const copNear = nearestCopDist(world.police, player.x, player.y) < 700;
    const pedNear = nearestPed(world.peds, player.x, player.y, 160) !== null;
    if (copNear || pedNear) addHeat(world.police, COMBAT.heatPerCarjack, world.elapsed);
  }
}

/**
 * One fixed step. `cmd` is { up, down, left, right, shoot, enter }.
 * Returns the event flags for this step.
 */
export function stepWorld(world, cmd, dt) {
  if (world.busted || world.wasted) return 0;
  world.events = 0;
  world.elapsed += dt;
  world.muzzle = null;
  tickCombat(world.combat, dt);

  handleEnter(world, cmd);
  stepPlayer(world, cmd, dt);

  if (cmd.shoot) {
    const shot = tryShoot(world.combat, world, dt);
    if (shot) {
      world.events |= EVENT_SHOT;
      world.muzzle = shot;
    }
  }

  stepTraffic(world.cars, world.city, world.random, dt, world.elapsed);
  stepPeds(world.peds, world.city, world.random, dt);
  resolveCarCollisions(world.cars, world.player.car, world.city);

  if (stepPolice(world.police, world, dt)) {
    world.busted = true;
    world.events |= EVENT_BUSTED;
  }
  checkWreck(world);
  regenPlayer(world.player, dt, world.elapsed);
  if (world.player.health <= 0) {
    world.wasted = true;
    world.events |= EVENT_WASTED;
  }
  updateMissions(world.missions, world, dt);
  return world.events;
}

// ---------------------------------------------------------------------------
// Autopilot
// ---------------------------------------------------------------------------

function moveCmd(mx, my) {
  return {
    up: my < -0.2, down: my > 0.2, left: mx < -0.2, right: mx > 0.2,
    shoot: false, enter: false,
  };
}

function neutralCmd() {
  return { up: false, down: false, left: false, right: false, shoot: false, enter: false };
}

/** Route the bot to a target along the roads, cached and refreshed. */
function routeTarget(world, target, inCar, dt) {
  const bot = world.bot;
  const pos = playerPos(world);
  const key = `${world.missions.index}:${world.missions.phase}:${Math.round(target.x / 50)},${Math.round(target.y / 50)}:${inCar ? 1 : 0}`;
  bot.routeT -= dt;
  if (bot.routeKey !== key || bot.routeT <= 0 || bot.routeIdx >= bot.route.length) {
    const path = bfsPath(world.city, pos, target);
    bot.route = [...path, { x: target.x, y: target.y }];
    // Start at the nearest intersection: the BFS path excludes its start
    // node, so without this the first waypoint is one road away and the
    // straight line to it cuts through the building on the corner.
    const start = nearestNode(world.city, pos.x, pos.y);
    if (start && (!bot.route[0] || bot.route[0].x !== start.x || bot.route[0].y !== start.y)) {
      bot.route.unshift(start);
    }
    // Off the road (cut a corner, shoved by a collision): head for the
    // nearest road point first, so the first leg is on asphalt, never
    // straight through a building.
    if (!onRoad(world.city, pos.x, pos.y)) {
      const rp = nearestRoadPoint(world.city, pos.x, pos.y);
      if (rp) bot.route.unshift(rp);
    }
    bot.routeIdx = 0;
    bot.routeKey = key;
    bot.routeT = 2;
  }
  // Skip ahead when the next waypoint is already reachable in a straight line.
  const arrive = inCar ? 70 : 30;
  while (bot.routeIdx < bot.route.length) {
    const wp = bot.route[bot.routeIdx];
    if (Math.hypot(wp.x - pos.x, wp.y - pos.y) < arrive) {
      bot.routeIdx += 1;
      continue;
    }
    break;
  }
  if (bot.routeIdx < bot.route.length) {
    const next = bot.route[bot.routeIdx + 1];
    if (next && segmentClear(world.city, pos.x, pos.y, next.x, next.y, inCar ? 17 : 14)) {
      bot.routeIdx += 1;
    }
  }
  if (bot.routeIdx >= bot.route.length) {
    bot.nextWp = null;
    return target;
  }
  bot.nextWp = bot.routeIdx + 1 < bot.route.length ? bot.route[bot.routeIdx + 1] : null;
  return bot.route[bot.routeIdx];
}

/** Drive the car toward a point: steer at it, throttle when lined up. The car
 *  never reverses to chase a target behind it — it brakes, then crawls
 *  forward while turning. Reversing with nose-based steering is a stable
 *  trap: the car ends up driving backwards forever. It also brakes for a
 *  sharp turn at the waypoint: a fast car overshoots the corner off the road
 *  and into the buildings beside it. */
function driveToward(world, target) {
  const car = world.player.car;
  // Overtake: a car stopped dead ahead in the same lane is a head-on
  // deadlock — it stops for us, we stop for it, neither ever moves. Slip
  // past it on the side with room instead of queuing behind it forever.
  const aheadX = Math.cos(car.angle), aheadY = Math.sin(car.angle);
  for (const other of world.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const along = dx * aheadX + dy * aheadY;
    const side = -dx * aheadY + dy * aheadX;
    if (along > 0 && along < 100 && Math.abs(side) < 34) {
      const px = -aheadY, py = aheadX;
      for (const s of [1, -1]) {
        const ox = other.x + aheadX * 110 + px * 46 * s;
        const oy = other.y + aheadY * 110 + py * 46 * s;
        if (segmentClear(world.city, car.x, car.y, ox, oy, 20)) { target = { x: ox, y: oy }; break; }
      }
      break;
    }
  }
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const diff = angleDiff(want, car.angle);
  const cmd = neutralCmd();
  if (diff > 0.15) cmd.right = true;
  else if (diff < -0.15) cmd.left = true;
  // Speed cap for a sharp turn just past this waypoint.
  let cap = Infinity;
  const next = world.bot.nextWp;
  if (next) {
    const turn = Math.abs(angleDiff(
      Math.atan2(next.y - target.y, next.x - target.x),
      Math.atan2(target.y - car.y, target.x - car.x),
    ));
    const d = Math.hypot(target.x - car.x, target.y - car.y);
    if (turn > 0.5 && d < 260) cap = 140;
  }
  // Down only ever brakes forward motion; up brings a reversing car back.
  if (Math.abs(diff) < 0.35) {
    if (car.speed > cap) cmd.down = true;
    else cmd.up = true;
  } else if (Math.abs(diff) < 1.0) {
    if (car.speed > Math.min(240, cap)) cmd.down = true;
    else cmd.up = true;
  } else if (car.speed > 30) cmd.down = true;
  else cmd.up = true;
  return cmd;
}

/** Walk toward a point, or stand still when already there. */
function walkToward(world, target) {
  const pos = playerPos(world);
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const d = Math.hypot(dx, dy);
  if (d < 24) return neutralCmd();
  return moveCmd(dx / d, dy / d);
}

/** Stuck bookkeeping: returns true while a recovery manoeuvre is running. */
function stuckRecovery(world, dt, commanding) {
  const bot = world.bot;
  if (bot.recoveryT > 0) {
    bot.recoveryT -= dt;
    return true;
  }
  if (!commanding) {
    bot.checkT = 0;
    const p = playerPos(world);
    bot.lastX = p.x;
    bot.lastY = p.y;
    return false;
  }
  const pos = playerPos(world);
  bot.checkT += dt;
  if (bot.checkT >= STUCK_WINDOW) {
    const moved = Math.hypot(pos.x - bot.lastX, pos.y - bot.lastY);
    const expected = (world.player.car ? 200 : PLAYER.walkSpeed) * STUCK_WINDOW;
    if (moved < WALK_DEADZONE * expected) {
      bot.recoveryT = world.player.car ? 0.9 : 1.0;
      bot.recoverySide *= -1;
    }
    bot.lastX = pos.x;
    bot.lastY = pos.y;
    bot.checkT = 0;
  }
  return false;
}

/** Run away from a cop along the roads — never in a straight line into a
 *  building face — sidestepping off a wall when wedged. */
function fleeFrom(world, cop, dt) {
  const pos = playerPos(world);
  if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
  const dx = pos.x - cop.x;
  const dy = pos.y - cop.y;
  const d = Math.hypot(dx, dy) || 1;
  const tx = Math.min(Math.max(pos.x + (dx / d) * 380, 60), WORLD.width - 60);
  const ty = Math.min(Math.max(pos.y + (dy / d) * 380, 60), WORLD.height - 60);
  return walkToward(world, routeTarget(world, { x: tx, y: ty }, false, dt));
}

/** The recovery itself: sidestep on foot, reverse in a car. */
function recoveryCmd(world) {
  const bot = world.bot;
  if (world.player.car) {
    const cmd = neutralCmd();
    cmd.down = true;
    if (bot.recoverySide > 0) cmd.right = true;
    else cmd.left = true;
    return cmd;
  }
  // On foot: step sideways, perpendicular to the way the bot was facing, so
  // it slides off a building face instead of wedging on it.
  const a = world.player.angle + (bot.recoverySide > 0 ? Math.PI / 2 : -Math.PI / 2);
  return moveCmd(Math.cos(a), Math.sin(a));
}

/**
 * The autopilot: one command per step. It knows the current mission, flees
 * the nearest cop on foot while wanted, gains heat by shooting pedestrians
 * far from cops, loses heat by outrunning them in a fast car, and recovers
 * from being wedged with a sidestep (on foot) or a reverse (in a car).
 */
export function botInput(world, dt = STEP) {
  const bot = world.bot;
  const player = world.player;
  const pos = playerPos(world);
  const inCar = player.car !== null;
  const stars = wantedStars(world.police);
  if (world.busted || world.wasted || world.missions.storyDone) return neutralCmd();

  const obj = missionObjective(world.missions, world.police, pos.x, pos.y);

  // (a) Busted-risk on foot while wanted: flee the nearest cop, never walk
  //     into an arrest. This outranks every objective — except committing to
  //     a car a few steps away in the lose phase, where the car is the escape.
  if (!inCar && stars >= 1) {
    const cop = nearestCop(world.police, pos.x, pos.y);
    if (cop && Math.hypot(cop.x - pos.x, cop.y - pos.y) < 220) {
      const committing = obj.kind === 'heat-lose'
        && nearestCar(world.cars, pos.x, pos.y, 200, (c) => c.kind === 'parked');
      if (!committing) return fleeFrom(world, cop, dt);
    }
  }

  // Heat missions: gain stars by shooting pedestrians far from cops, then
  // lose them by outrunning the force in a fast car.
  if (obj.kind === 'heat-gain') {
    // A slow car cannot outrun the force in the lose phase, so step out of
    // one now (the Island Scooter is the only model slower than a cop car)
    // and take a fast car before shooting starts.
    const slowCar = inCar && player.car.model.top < 400;
    if (!inCar || slowCar) {
      if (slowCar) {
        const s = player.car.speed;
        if (s > 40) {
          const cmd = neutralCmd();
          cmd.down = true;
          return cmd;
        }
        if (s < -20) {
          const cmd = neutralCmd();
          cmd.up = true;
          return cmd;
        }
        const cmd = neutralCmd();
        cmd.enter = true;
        return cmd;
      }
      // Get in a car first: drive-by shooting keeps the bot moving, so a
      // cop can never pin it down. Only shoot on foot when no car is near.
      const cmd = acquireCar(world, dt, true, 800);
      if (cmd) return cmd;
      const cop = nearestCop(world.police, pos.x, pos.y);
      if (cop && Math.hypot(cop.x - pos.x, cop.y - pos.y) < 150) {
        return fleeFrom(world, cop, dt);
      }
      const ped = nearestPed(world.peds, pos.x, pos.y, 900);
      if (!ped) return neutralCmd();
      const d = Math.hypot(ped.x - pos.x, ped.y - pos.y);
      if (d < COMBAT.range - 20) {
        const c2 = neutralCmd();
        c2.shoot = true;
        return c2;
      }
      if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
      return walkToward(world, { x: ped.x, y: ped.y });
    }
    // Drive-by: chase the nearest pedestrian and shoot inside range. The
    // car never stops, so cop cars cannot pin it for a bust.
    const ped = nearestPed(world.peds, pos.x, pos.y, 1200);
    if (!ped) return neutralCmd();
    if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
    const cmd = driveToward(world, routeTarget(world, { x: ped.x, y: ped.y }, true, dt));
    if (Math.hypot(ped.x - pos.x, ped.y - pos.y) < COMBAT.range - 20) cmd.shoot = true;
    return cmd;
  }

  if (obj.kind === 'heat-lose') {
    if (!inCar) {
      const cmd = acquireCar(world, dt, true, 1500);
      if (cmd) return cmd;
      // No car in reach: run for the far corner on foot; a car may show up
      // on the way.
      if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
      if (!bot.corner) bot.corner = CORNERS[0];
      return walkToward(world, routeTarget(world, bot.corner, false, dt));
    }
    // A slow car cannot outrun the force: step out and take a fast one.
    // (Heat-gain already avoids slow cars, so this is only a safety net.)
    if (player.car.model.top < 400) {
      const s = player.car.speed;
      if (s > 40) {
        const cmd = neutralCmd();
        cmd.down = true;
        return cmd;
      }
      if (s < -20) {
        const cmd = neutralCmd();
        cmd.up = true;
        return cmd;
      }
      const cmd = neutralCmd();
      cmd.enter = true;
      return cmd;
    }
    if (!bot.corner || Math.hypot(bot.corner.x - pos.x, bot.corner.y - pos.y) < 150) {
      let best = null;
      let bestD = -1;
      for (const c of CORNERS) {
        if (bot.corner && c.x === bot.corner.x && c.y === bot.corner.y) continue;
        const d = Math.hypot(c.x - pos.x, c.y - pos.y);
        if (d > bestD) { bestD = d; best = c; }
      }
      bot.corner = best;
    }
    if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
    return driveToward(world, routeTarget(world, bot.corner, true, dt));
  }

  // Goto / collect / deliver: be in a car when one is near, then route there.
  if (!inCar) {
    const cmd = acquireCar(world, dt, false);
    if (cmd) return cmd;
    if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
    return walkToward(world, routeTarget(world, { x: obj.x, y: obj.y }, false, dt));
  }
  if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
  return driveToward(world, routeTarget(world, { x: obj.x, y: obj.y }, true, dt));
}

/**
 * Get the bot into a car: walk to the nearest parked car (fast ones first
 * when `wantFast`), enter when close. Returns a command, or null when no car
 * is worth taking and the bot should walk instead.
 */
function acquireCar(world, dt, wantFast, radius) {
  const pos = playerPos(world);
  const r = radius || (wantFast ? 500 : 350);
  const parked = nearestCar(
    world.cars, pos.x, pos.y, r,
    (c) => c.kind === 'parked' && (!wantFast || c.model.top >= 440),
  ) || nearestCar(
    world.cars, pos.x, pos.y, r,
    // When a fast car matters, never settle for one slower than a cop car.
    (c) => c.kind === 'parked' && (!wantFast || c.model.top >= 400),
  );
  if (parked) {
    const d = Math.hypot(parked.x - pos.x, parked.y - pos.y);
    if (d < CAR.enterRadius && enterable(parked)) {
      const cmd = neutralCmd();
      cmd.enter = true;
      return cmd;
    }
    if (stuckRecovery(world, dt, true)) return recoveryCmd(world);
    return walkToward(world, routeTarget(world, { x: parked.x, y: parked.y }, false, dt));
  }
  if (wantFast) {
    const moving = nearestCar(world.cars, pos.x, pos.y, 200, (c) => c.kind === 'traffic' && Math.abs(c.speed) < CAR.jackSpeed);
    if (moving) {
      const d = Math.hypot(moving.x - pos.x, moving.y - pos.y);
      if (d < CAR.enterRadius) {
        const cmd = neutralCmd();
        cmd.enter = true;
        return cmd;
      }
      return walkToward(world, { x: moving.x, y: moving.y });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Save / load (browser only; the headless sim never calls these)
// ---------------------------------------------------------------------------

export function saveGame(world) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const p = playerPos(world);
    const data = {
      v: 2,
      money: world.money,
      missionIndex: world.missions.index,
      completed: world.missions.completed,
      x: p.x, y: p.y,
      health: world.player.health,
      elapsed: world.elapsed,
      stats: world.stats,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(world) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2) return false;
    world.money = data.money | 0;
    world.elapsed = data.elapsed || 0;
    world.stats = { ...world.stats, ...data.stats };
    world.player.x = data.x;
    world.player.y = data.y;
    world.player.health = data.health || 100;
    const idx = Math.min(data.missionIndex | 0, 7);
    // Re-arm the saved mission from scratch (pickups reset, heat reset).
    const missions = world.missions;
    missions.completed = data.completed || [];
    missions.index = idx;
    missions.collected = 0;
    missions.pickups = [];
    const def = MISSION_DEFS[idx];
    if (def) {
      if (def.type === 'heat') missions.phase = 'gain';
      else if (def.type === 'collect') {
        missions.phase = 'collect';
        missions.pickups = def.spots.map((s) => ({ x: s.x, y: s.y, kind: def.pickupKind, taken: false }));
      } else missions.phase = 'go';
    }
    world.police.heat = 0;
    world.police.cops = [];
    return true;
  } catch {
    return false;
  }
}

export { missionHudLine, GOAL_MONEY };
