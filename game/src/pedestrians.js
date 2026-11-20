// Pedestrians: forty people walking the road graph, who run from gunfire and
// come back (respawned far away) after a while, so the city never empties.
import { PED_COUNT } from './config.js';
import { moveCircle, nearestNode, onRoad } from './city.js';
import { pick, range, int } from './random.js';

const PED_COLORS = ['#d8cdb4', '#c9a227', '#7fb069', '#e07a5f', '#81b29a', '#f2cc8f'];

export function createPeds(random, city) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    peds.push(spawnPed(random, city, i));
  }
  return peds;
}

function spawnPed(random, city, id) {
  const node = pick(random, city.nodes);
  return {
    id: `ped-${id}`,
    x: node.x + range(random, -20, 20),
    y: node.y + range(random, -20, 20),
    angle: range(random, 0, Math.PI * 2),
    speed: range(random, 55, 110),
    color: pick(random, PED_COLORS),
    alive: true,
    fleeT: 0,
    fleeX: 0,
    fleeY: 0,
    respawnT: 0,
    target: null,
  };
}

export function stepPeds(peds, city, random, dt) {
  for (const ped of peds) {
    if (!ped.alive) {
      ped.respawnT -= dt;
      if (ped.respawnT <= 0) {
        const fresh = spawnPed(random, city, int(random, 0, 9999));
        ped.x = fresh.x;
        ped.y = fresh.y;
        ped.angle = fresh.angle;
        ped.speed = fresh.speed;
        ped.color = fresh.color;
        ped.alive = true;
        ped.fleeT = 0;
        ped.target = null;
      }
      continue;
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const len = Math.hypot(dx, dy) || 1;
      const step = moveCircle(city, ped.x, ped.y, (dx / len) * 150 * dt, (dy / len) * 150 * dt, 10);
      ped.x = step.x;
      ped.y = step.y;
      ped.angle = Math.atan2(dy, dx);
      continue;
    }
    // Walk toward the current road node; at the node, pick a neighbouring one.
    if (!ped.target) {
      const node = nearestNode(city, ped.x, ped.y);
      ped.target = node;
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) {
      const node = ped.target;
      const neighbours = city.adjacency[node.id];
      if (neighbours.length > 0) {
        const next = city.nodes[pick(random, neighbours)];
        ped.target = next;
      } else {
        ped.target = null;
      }
      continue;
    }
    const step = moveCircle(city, ped.x, ped.y, (dx / dist) * ped.speed * dt, (dy / dist) * ped.speed * dt, 10);
    ped.x = step.x;
    ped.y = step.y;
    ped.angle = Math.atan2(dy, dx);
  }
}

/** Every living ped within radius of (x, y) runs away from it. */
export function scarePeds(peds, x, y, radius) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.fleeT = 2;
      ped.fleeX = x;
      ped.fleeY = y;
    }
  }
}

export function nearestPed(peds, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const ped of peds) {
    if (!ped.alive) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = ped; }
  }
  return best;
}

export { onRoad };
