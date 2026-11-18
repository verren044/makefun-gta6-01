// Pedestrians: twenty-six locals strolling the sidewalks between crossings, who
// run for cover when a gun goes off, a car bears down on them, or a wanted man gets
// close. A hit pedestrian falls and, after a while, gets up somewhere else — the
// city never runs out of people, and a hit always costs the player a star.

import { PED_COUNT } from './config.js';
import { dist, randRange } from './random.js';
import { clampToFree, moveWithCollision, nearestNode } from './city.js';

const PED_COLORS = ['#e8a34c', '#7fb069', '#c96a8a', '#6a8ac9', '#b0a06a', '#8a6ac9'];

export function spawnPedestrians(city, rng) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const node = city.nodes[Math.floor(rng() * city.nodes.length)];
    const p = {
      x: node.x + randRange(rng, -60, 60),
      y: node.y + randRange(rng, -60, 60),
      tx: node.x,
      ty: node.y,
      speed: randRange(rng, 42, 68),
      color: PED_COLORS[i % PED_COLORS.length],
      alive: true,
      deadTimer: 0,
      fleeing: false,
      panic: 0,
      walkPhase: randRange(rng, 0, Math.PI * 2),
    };
    const free = clampToFree(city, p.x, p.y, 12);
    p.x = free.x;
    p.y = free.y;
    pickPedTarget(city, p, rng);
    peds.push(p);
  }
  return peds;
}

function pickPedTarget(city, ped, rng) {
  const node = city.nodes[Math.floor(rng() * city.nodes.length)];
  ped.tx = node.x + randRange(rng, -50, 50);
  ped.ty = node.y + randRange(rng, -50, 50);
  ped.fleeing = false;
}

/**
 * Advance the crowd. `danger` is { x, y, radius, panic } — gunfire, a speeding car,
 * or a wanted player — and anyone inside it runs away from the point.
 */
export function updatePedestrians(city, peds, rng, dt, danger, playerCar) {
  for (const ped of peds) {
    if (!ped.alive) {
      ped.deadTimer += dt;
      if (ped.deadTimer > 18) {
        const node = city.nodes[Math.floor(rng() * city.nodes.length)];
        const free = clampToFree(city, node.x + randRange(rng, -50, 50), node.y + randRange(rng, -50, 50), 12);
        ped.x = free.x;
        ped.y = free.y;
        ped.alive = true;
        ped.deadTimer = 0;
        pickPedTarget(city, ped, rng);
      }
      continue;
    }
    ped.panic = Math.max(0, ped.panic - dt);
    let mx = 0;
    let my = 0;
    let speed = ped.speed;
    if (danger && dist(ped.x, ped.y, danger.x, danger.y) < danger.radius) {
      const d = Math.max(1, dist(ped.x, ped.y, danger.x, danger.y));
      mx = (ped.x - danger.x) / d;
      my = (ped.y - danger.y) / d;
      speed = ped.speed * 2.6;
      ped.fleeing = true;
      ped.panic = 2;
    } else if (playerCar && dist(ped.x, ped.y, playerCar.x, playerCar.y) < 70 && Math.abs(playerCar.speed) > 150) {
      const d = Math.max(1, dist(ped.x, ped.y, playerCar.x, playerCar.y));
      mx = (ped.x - playerCar.x) / d;
      my = (ped.y - playerCar.y) / d;
      speed = ped.speed * 2.6;
      ped.fleeing = true;
      ped.panic = 1.5;
    } else {
      if (dist(ped.x, ped.y, ped.tx, ped.ty) < 26) pickPedTarget(city, ped, rng);
      const d = Math.max(1, dist(ped.x, ped.y, ped.tx, ped.ty));
      mx = (ped.tx - ped.x) / d;
      my = (ped.ty - ped.y) / d;
      ped.fleeing = ped.panic > 0;
      if (ped.fleeing) speed = ped.speed * 2.2;
    }
    ped.walkPhase += dt * (speed / 22);
    const moved = moveWithCollision(city, ped.x, ped.y, mx * speed * dt, my * speed * dt, 12);
    ped.x = moved.x;
    ped.y = moved.y;
    ped.faceX = mx;
    ped.faceY = my;
  }
}

/** Knock a pedestrian down; returns true when this hit killed them. */
export function hitPedestrian(ped) {
  if (!ped.alive) return false;
  ped.alive = false;
  ped.deadTimer = 0;
  return true;
}

export function nearestPedestrian(peds, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const ped of peds) {
    if (!ped.alive) continue;
    const d = dist(x, y, ped.x, ped.y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
