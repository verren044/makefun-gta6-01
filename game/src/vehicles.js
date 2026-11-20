// Cars: the twelve models, the twenty parking spots (eighteen filled), the
// twenty-two traffic cars that drive the road graph, and the driving physics
// the player, the traffic and the police all share.
import { CAR_MODELS, TRAFFIC_COUNT, PARKED_COUNT, WORLD } from './config.js';
import { ROAD_HALF } from './config.js';
import { moveCircle, bfsPath, nearestNode, onRoad, circleHits } from './city.js';
import { pick, shuffle, range, int } from './random.js';

/**
 * Twenty parking spots, parked along the curb of a road. The first four are
 * fixed: the Ember GT in front of Ray's Garage, the Casino Limo by the Ember
 * Casino, the Volcano Truck by the volcano, and the Island Scooter at the pier.
 * Spots sit in the left lane (x = road - 14 / y = road - 14) while traffic
 * drives the right lane (road + 14), so parked cars never block the flow.
 */
export const PARKING_SPOTS = [
  { x: 1070, y: 1266, angle: 0, model: 0 }, // Ember GT — Ray's Garage
  { x: 2826, y: 2190, angle: Math.PI / 2, model: 2 }, // Casino Limo — Ember Casino
  { x: 2466, y: 2190, angle: Math.PI / 2, model: 1 }, // Volcano Truck — volcano
  { x: 180, y: 2446, angle: 0, model: 3 }, // Island Scooter — Marina Pier
  { x: 546, y: 740, angle: Math.PI / 2, model: -1 },
  { x: 906, y: 380, angle: Math.PI / 2, model: -1 },
  { x: 1266, y: 740, angle: Math.PI / 2, model: -1 },
  { x: 1626, y: 1100, angle: Math.PI / 2, model: -1 },
  { x: 1986, y: 380, angle: Math.PI / 2, model: -1 },
  { x: 2346, y: 1460, angle: Math.PI / 2, model: -1 },
  { x: 2646, y: 1960, angle: Math.PI / 2, model: -1 },
  { x: 3006, y: 2320, angle: Math.PI / 2, model: -1 },
  { x: 3366, y: 2500, angle: Math.PI / 2, model: -1 },
  { x: 3546, y: 2000, angle: Math.PI / 2, model: -1 },
  { x: 380, y: 186, angle: 0, model: -1 },
  { x: 1100, y: 546, angle: 0, model: -1 },
  { x: 1460, y: 906, angle: 0, model: -1 },
  { x: 740, y: 1626, angle: 0, model: -1 },
  { x: 2500, y: 2086, angle: 0, model: -1 },
  { x: 3100, y: 2446, angle: 0, model: -1 },
];

export function carRadius(car) {
  return Math.max(car.model.w, car.model.h) * 0.42;
}

function makeCar(id, modelIdx, x, y, angle, kind) {
  const model = CAR_MODELS[modelIdx];
  return {
    id, model, modelIdx, x, y, angle, speed: 0, health: 100,
    kind, route: [], routeIdx: 0, cruise: model.top * 0.45,
    lastHitT: -99, stuckT: 0, lastX: x, lastY: y,
  };
}

export function createCars(random, city) {
  const cars = [];
  // Parked cars: eighteen of the twenty spots, shuffled so the two empty
  // spots differ per seed. The four fixed-model spots always hold their car.
  const order = shuffle(random, PARKING_SPOTS.map((s, i) => i));
  const chosen = new Set(order.slice(0, PARKED_COUNT));
  for (const i of order) {
    if (!chosen.has(i)) continue;
    const spot = PARKING_SPOTS[i];
    const modelIdx = spot.model >= 0 ? spot.model : int(random, 4, CAR_MODELS.length - 1);
    cars.push(makeCar(`parked-${i}`, modelIdx, spot.x, spot.y, spot.angle, 'parked'));
  }
  // Traffic: twenty-two cars dropped on random road nodes, each with a route
  // to a random far node.
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const node = pick(random, city.nodes);
    const modelIdx = int(random, 0, CAR_MODELS.length - 1);
    const car = makeCar(`traffic-${i}`, modelIdx, node.x, node.y, range(random, 0, Math.PI * 2), 'traffic');
    retargetTraffic(random, city, car);
    cars.push(car);
  }
  return cars;
}

/** Give a traffic car a fresh route to a random far node. */
export function retargetTraffic(random, city, car) {
  const dest = pick(random, city.nodes);
  const path = bfsPath(city, { x: car.x, y: car.y }, { x: dest.x, y: dest.y });
  car.route = path.length > 0 ? path : [{ x: dest.x, y: dest.y }];
  car.routeIdx = 0;
}

/** The nearest car to (x, y) within maxDist that passes `test`. */
export function nearestCar(cars, x, y, maxDist, test) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.kind === 'wreck') continue;
    if (test && !test(car)) continue;
    const dx = car.x - x;
    const dy = car.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * Drive a car one step. `cmd` is { up, down, left, right }: up accelerates,
 * down brakes then reverses, left/right steer. Returns true when the car hit
 * something hard enough to lose health.
 */
export function driveCar(car, cmd, dt, city) {
  const model = car.model;
  const steer = (cmd.right ? 1 : 0) - (cmd.left ? 1 : 0);
  // The car still turns a little at a crawl, or it could never swing around
  // from a standstill.
  const turnRate = 2.8 * Math.max(0.4, Math.min(1, Math.abs(car.speed) / 150));
  car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
  if (cmd.up) {
    car.speed += model.accel * dt;
  } else if (cmd.down) {
    if (car.speed > 0) car.speed -= 560 * dt;
    else car.speed -= model.accel * 0.6 * dt;
  } else {
    const drag = 240 * dt;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - drag);
    else car.speed = Math.min(0, car.speed + drag);
  }
  if (car.speed > model.top) car.speed = model.top;
  if (car.speed < -180) car.speed = -180;
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const moved = moveCircle(city, car.x, car.y, dx, dy, carRadius(car));
  car.x = moved.x;
  car.y = moved.y;
  const travelled = Math.hypot(car.x - before.x, car.y - before.y);
  const wanted = Math.hypot(dx, dy);
  if (wanted > 4 && travelled < wanted * 0.25) {
    // Hard stop against a wall: lose speed and a little health.
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 120 || wanted > 8) return true;
  }
  return false;
}

/** One step for every traffic car: follow its route in the right lane. */
export function stepTraffic(cars, city, random, dt, elapsed) {
  for (const car of cars) {
    if (car.kind !== 'traffic') continue;
    // A car ahead in the same lane: slow down instead of rear-ending it.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.kind === 'wreck') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 62 && side < 30) { blocked = true; break; }
    }
    if (car.routeIdx >= car.route.length) retargetTraffic(random, city, car);
    const wp = car.route[car.routeIdx];
    const dx = wp.x - car.x;
    const dy = wp.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 46) {
      car.routeIdx += 1;
      continue;
    }
    // Right-lane offset: 14 px to the right of the direction of travel.
    const len = Math.max(1, dist);
    const tx = wp.x + (-dy / len) * 14;
    const ty = wp.y + (dx / len) * 14;
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(want, car.angle);
    const turn = 2.4 * dt;
    car.angle += Math.max(-turn, Math.min(turn, diff));
    const targetSpeed = blocked ? 0 : car.cruise;
    if (car.speed < targetSpeed) car.speed += 260 * dt;
    else if (car.speed > targetSpeed) car.speed -= 420 * dt;
    const step = moveCircle(city, car.x, car.y, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, carRadius(car));
    car.x = step.x;
    car.y = step.y;
    // Wedged against a wall or another car: pick a fresh route.
    if (Math.hypot(car.x - car.lastX, car.y - car.lastY) < 1 && car.speed > 40) {
      car.stuckT += dt;
      if (car.stuckT > 2) {
        retargetTraffic(random, city, car);
        car.stuckT = 0;
      }
    } else {
      car.stuckT = 0;
    }
    car.lastX = car.x;
    car.lastY = car.y;
  }
}

/**
 * Push overlapping cars apart (traffic, parked and the player's car). Returns
 * nothing; mutates positions and speeds. Parked cars do not move. A push that
 * would shove a car inside a building is skipped, so a collision never wedges
 * a car on a corner.
 */
export function resolveCarCollisions(cars, playerCar, city) {
  const all = playerCar ? [...cars, playerCar] : cars;
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i];
      const b = all[j];
      if (a.kind === 'wreck' || b.kind === 'wreck') continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = carRadius(a) + carRadius(b) - 4;
      const d = Math.hypot(dx, dy);
      if (d >= min || d === 0) continue;
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      if (a.kind !== 'parked') {
        const ax = a.x - nx * push;
        const ay = a.y - ny * push;
        const ar = carRadius(a);
        if (!city || !circleHits(city, ax, ay, ar)) {
          a.x = Math.min(Math.max(ax, ar), WORLD.width - ar);
          a.y = Math.min(Math.max(ay, ar), WORLD.height - ar);
        }
      }
      if (b.kind !== 'parked') {
        const bx = b.x + nx * push;
        const by = b.y + ny * push;
        const br = carRadius(b);
        if (!city || !circleHits(city, bx, by, br)) {
          b.x = Math.min(Math.max(bx, br), WORLD.width - br);
          b.y = Math.min(Math.max(by, br), WORLD.height - br);
        }
      }
      if (a.kind === 'traffic') a.speed *= 0.7;
      if (b.kind === 'traffic') b.speed *= 0.7;
    }
  }
}

export { angleDiff };
