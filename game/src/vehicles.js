// Solmar Bay — drivable cars, traffic AI, carjacking, driving physics. No DOM.
import { CONFIG, clampToCity } from './config.js';
import { nearestRoad } from './city.js';

export const CAR_DEFS = [
  { name: 'Ember GT', topSpeed: 640, accel: 420, handling: 2.6 },
  { name: 'Solmar Comet', topSpeed: 590, accel: 400, handling: 2.5 },
  { name: 'Bay Falcon', topSpeed: 560, accel: 380, handling: 2.4 },
  { name: 'Volcano Runner', topSpeed: 540, accel: 370, handling: 2.3 },
  { name: 'Harbor Cruiser', topSpeed: 510, accel: 350, handling: 2.2 },
  { name: 'Marina Sting', topSpeed: 490, accel: 340, handling: 2.4 },
  { name: 'Porto Dart', topSpeed: 470, accel: 330, handling: 2.3 },
  { name: 'Northgate Bull', topSpeed: 450, accel: 320, handling: 2.0 },
  { name: 'Sunset Coupe', topSpeed: 430, accel: 310, handling: 2.2 },
  { name: 'Dockside Van', topSpeed: 380, accel: 280, handling: 1.8 },
  { name: 'Hills Pickup', topSpeed: 360, accel: 270, handling: 1.9 },
  { name: 'Old Town Sedan', topSpeed: 340, accel: 260, handling: 2.0 },
];

export const CAR_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#b03a2e'];

export function createDrivableCars(world) {
  return world.carSpawns.map((s, i) => ({
    id: i,
    def: CAR_DEFS[i],
    color: CAR_COLORS[i % CAR_COLORS.length],
    x: s.x, y: s.y, angle: s.angle,
    speed: 0,
    occupied: false,
    traffic: false,
  }));
}

export function createTraffic(world) {
  return world.trafficSpawns.map((s, i) => ({
    id: i,
    def: CAR_DEFS[(i + 3) % CAR_DEFS.length],
    color: CAR_COLORS[(i + 5) % CAR_COLORS.length],
    x: s.x, y: s.y,
    angle: s.horizontal ? (s.dir > 0 ? 0 : Math.PI) : (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: 120 + (i % 5) * 18,
    horizontal: s.horizontal,
    dir: s.dir,
    occupied: true,
    driver: true,
    traffic: true,
    carjacked: false,
  }));
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(player, cars) {
  const car = nearestCar(cars, player.x, player.y, CONFIG.ENTER_CAR_RADIUS);
  if (!car) return null;
  player.inCar = car;
  player.onFoot = false;
  car.occupied = true;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return car;
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return;
  car.speed = 0;
  player.inCar = null;
  player.onFoot = true;
  player.x = car.x + 34;
  player.y = car.y + 10;
  const c = clampToCity(player.x, player.y);
  player.x = c.x;
  player.y = c.y;
}

export function driveCar(player, input, dt) {
  const car = player.inCar;
  if (!car) return;
  const def = car.def;
  if (input.up) car.speed += def.accel * dt;
  else if (input.down) car.speed -= def.accel * 0.9 * dt;
  else {
    // Engine braking / drag.
    car.speed -= car.speed * 0.6 * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (car.speed > def.topSpeed) car.speed = def.topSpeed;
  if (car.speed < -140) car.speed = -140;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  if (steer !== 0 && Math.abs(car.speed) > 5) {
    car.angle += steer * def.handling * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 200 + 0.3);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const c = clampToCity(car.x, car.y);
  if (c.x !== car.x || c.y !== car.y) {
    car.x = c.x;
    car.y = c.y;
    car.speed *= 0.4;
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
}

// Carjack an occupied traffic car: driver ejected, wanted rises, player takes the car.
export function carjack(player, trafficCar, police) {
  if (!trafficCar || !trafficCar.driver) return false;
  trafficCar.driver = false;
  trafficCar.carjacked = true;
  trafficCar.occupied = false;
  trafficCar.speed = 0;
  player.inCar = trafficCar;
  player.onFoot = false;
  player.x = trafficCar.x;
  player.y = trafficCar.y;
  player.angle = trafficCar.angle;
  if (police) police.wanted = Math.min(CONFIG.MAX_WANTED, police.wanted + 2);
  return true;
}

// Traffic drives its road; at the end of a segment it turns onto a cross road,
// otherwise it reverses. Deterministic: the turn choice depends only on the car id.
export function updateTraffic(traffic, world, dt) {
  for (const car of traffic) {
    if (car.carjacked || car === null) continue;
    if (car.occupied === false && car.driver === false) continue; // jacked, parked
    if (car.driver === false) continue;
    const step = car.speed * car.dir * dt;
    if (car.horizontal) {
      car.x += step;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 60 || car.x > CONFIG.CITY_W - 60) {
        // Turn onto the nearest vertical road.
        const nr = nearestRoad(world, car.x, car.y);
        if (nr.road && !nr.road.horizontal) {
          car.x = nr.road.x1;
          car.horizontal = false;
          car.dir = car.id % 2 === 0 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.dir *= -1;
        }
      }
    } else {
      car.y += step;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 60 || car.y > CONFIG.CITY_H - 60) {
        const nr = nearestRoad(world, car.x, car.y);
        if (nr.road && nr.road.horizontal) {
          car.y = nr.road.y1;
          car.horizontal = true;
          car.dir = car.id % 2 === 0 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.dir *= -1;
        }
      }
    }
    const c = clampToCity(car.x, car.y);
    car.x = c.x;
    car.y = c.y;
  }
}
