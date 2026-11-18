// Cars: the eight original models, parked cars to steal, traffic that cruises the
// roads and turns at crossings, and the driving physics — acceleration, braking,
// steering that bites harder the slower you go, off-road drag, building collisions
// with wall sliding, and wrecks that get towed back to a parking spot at 50 HP.

import { CAR_CONF, CAR_MODELS, COP_MODEL, PARKED_COUNT, TRAFFIC_COUNT } from './config.js';
import { angleDiff, clamp, dist, randPick, randRange } from './random.js';
import { circleHitsSolid, clampToFree, isOnRoad, moveWithCollision, nearestNode, route } from './city.js';

let nextCarId = 1;

export function createCar(model, x, y, angle, kind) {
  return {
    id: nextCarId,
    model,
    x,
    y,
    angle,
    speed: 0,
    health: CAR_CONF.maxHealth,
    kind,
    wrecked: false,
    wreckTimer: 0,
    honkTimer: 0,
    route: null,
    routeIndex: 0,
    stuckTimer: 0,
    lastX: x,
    lastY: y,
    reverseTimer: 0,
    driver: kind === 'traffic',
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

/** Parked cars on the city's parking spots, ready to be stolen. */
export function spawnParkedCars(city, rng) {
  const cars = [];
  const spots = [...city.parkingSpots];
  for (let i = 0; i < PARKED_COUNT && spots.length > 0; i += 1) {
    const spot = spots.splice(Math.floor(rng() * spots.length), 1)[0];
    cars.push(createCar(randPick(rng, CAR_MODELS), spot.x, spot.y, spot.angle, 'parked'));
  }
  return cars;
}

/** Traffic cars cruising the roads, each following a route of crossings. */
export function spawnTrafficCars(city, rng) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const node = city.nodes[Math.floor(rng() * city.nodes.length)];
    const car = createCar(randPick(rng, CAR_MODELS), node.x + randRange(rng, -20, 20), node.y + randRange(rng, -20, 20), randRange(rng, 0, Math.PI * 2), 'traffic');
    retargetTraffic(city, car, rng);
    car.speed = randRange(rng, 110, 160);
    cars.push(car);
  }
  return cars;
}

export function retargetTraffic(city, car, rng) {
  const from = nearestNode(city, car.x, car.y);
  const goal = city.nodes[Math.floor(rng() * city.nodes.length)];
  if (goal === from) {
    car.route = [{ x: car.x, y: car.y }];
  } else {
    car.route = route(city, car.x, car.y, goal.x, goal.y);
  }
  car.routeIndex = 0;
}

/** Steer a car toward a point: returns { steer, throttle } in [-1, 1]. */
export function steerToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(want, car.angle);
  const steer = clamp(diff * 1.8, -1, 1);
  const throttle = Math.abs(diff) > 2.2 ? -0.6 : Math.abs(diff) > 1.2 ? 0.25 : 1;
  return { steer, throttle };
}

/**
 * One step of car physics. `input` is { throttle: -1..1, steer: -1..1 }.
 * Off-road driving drags; a hard hit on a wall costs health and speed.
 */
export function driveCar(city, car, input, dt) {
  const model = car.model;
  const onRoad = isOnRoad(car.x, car.y);
  const drag = onRoad ? 0.35 : 1.15;
  const accel = input.throttle * model.accel;
  car.speed += accel * dt;
  car.speed -= car.speed * drag * dt;
  if (input.throttle === 0) car.speed -= car.speed * 1.4 * dt;
  car.speed = clamp(car.speed, -model.topSpeed * 0.45, model.topSpeed);
  if (Math.abs(car.speed) < 4 && input.throttle === 0) car.speed = 0;
  const turnRate = model.handling * clamp(Math.abs(car.speed) / 160, 0.25, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += input.steer * turnRate * dt;
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const beforeX = car.x;
  const beforeY = car.y;
  const moved = moveWithCollision(city, car.x, car.y, dx, dy, CAR_CONF.radius);
  car.x = moved.x;
  car.y = moved.y;
  if ((moved.hitX || moved.hitY) && Math.abs(car.speed) > 120) {
    damageCar(car, Math.min(12, (Math.abs(car.speed) - 120) / 18));
    car.speed *= 0.35;
  } else if (moved.hitX || moved.hitY) {
    car.speed *= 0.6;
  }
  return { hitWall: moved.hitX || moved.hitY, movedDist: dist(beforeX, beforeY, car.x, car.y) };
}

export function damageCar(car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    car.wreckTimer = 0;
  }
}

/** A wrecked car is towed to a free parking spot and patched up to 50 HP. */
export function respawnWreckedCar(city, car, rng) {
  const spot = city.parkingSpots[Math.floor(rng() * city.parkingSpots.length)];
  const free = clampToFree(city, spot.x, spot.y, CAR_CONF.radius + 4);
  car.x = free.x;
  car.y = free.y;
  car.angle = spot.angle;
  car.health = 50;
  car.wrecked = false;
  car.speed = 0;
  car.kind = 'parked';
  car.driver = false;
}

/** Shove a car out of a building it was pushed into (a traffic shunt can park a
 * car inside a wall, where the collision slide alone can never free it). */
export function nudgeOutOfSolid(city, car) {
  for (let i = 0; i < 14 && circleHitsSolid(city, car.x, car.y, CAR_CONF.radius); i += 1) {
    const dirs = [[12, 0], [-12, 0], [0, 12], [0, -12], [9, 9], [-9, 9], [9, -9], [-9, -9]];
    let moved = false;
    for (const [dx, dy] of dirs) {
      if (!circleHitsSolid(city, car.x + dx, car.y + dy, CAR_CONF.radius)) {
        car.x += dx;
        car.y += dy;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
}

/** Advance every traffic car one step along its route. */
export function updateTraffic(city, cars, rng, dt) {
  for (const car of cars) {
    if (car.wrecked) {
      car.wreckTimer += dt;
      continue;
    }
    if (!car.route || car.routeIndex >= car.route.length) retargetTraffic(city, car, rng);
    const target = car.route[car.routeIndex];
    if (dist(car.x, car.y, target.x, target.y) < 34) {
      car.routeIndex += 1;
      continue;
    }
    const { steer, throttle } = steerToward(car, target.x, target.y);
    const cruise = Math.min(1, Math.max(0.45, throttle));
    driveCar(city, car, { throttle: cruise, steer }, dt);
    const moved = dist(car.lastX, car.lastY, car.x, car.y);
    if (moved < 2 * dt * 60 * 0.12 && Math.abs(car.speed) < 12) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 2) {
        car.reverseTimer = 0.9;
        car.stuckTimer = 0;
      }
    } else {
      car.stuckTimer = 0;
    }
    if (car.reverseTimer > 0) {
      car.reverseTimer -= dt;
      driveCar(city, car, { throttle: -0.7, steer: -steer }, dt);
    }
    car.lastX = car.x;
    car.lastY = car.y;
  }
}

export function nearestCar(cars, x, y, maxDist, kinds) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (kinds && !kinds.includes(car.kind)) continue;
    if (car.wrecked) continue;
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
