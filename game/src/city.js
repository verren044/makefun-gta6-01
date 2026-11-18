// Solmar Bay itself: a seeded, deterministic city of 3200x2400 — seven north-south
// roads, five east-west roads, about seventy buildings, parks, trees and eight named
// landmarks — plus the road graph every driver (traffic, police, the autopilot) routes
// on, and the collision helpers that give walls their slide instead of a dead stop.

import { BEACH_X, LANDMARKS, ROADS_X, ROADS_Y, ROAD_W, SEA_X, WORLD } from './config.js';
import { clamp, randInt, randPick, randRange } from './random.js';

const PIER = { x: 40, y: 990, w: 170, h: 70 };

function rectsOverlap(a, b, pad) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

function landmarkByName(city, name) {
  return city.landmarks.find((l) => l.name === name);
}

export function landmarkCenter(city, name) {
  const l = landmarkByName(city, name);
  return { x: l.x + l.w / 2, y: l.y + l.h / 2 };
}

/** Which district a point belongs to, for the map tint and the HUD readout. */
export function districtAt(x, y) {
  if (x < 700) return y > 1400 ? 'Industrial' : 'Marina';
  if (x >= 2120 && y < 1020) return 'Old Town';
  if (x >= 1760 && y >= 1380) return 'Suburbs';
  if (x >= 1040 && x <= 2120 && y >= 300 && y <= 1380) return 'Downtown';
  if (y < 660) return 'Palm Court';
  return 'Downtown';
}

/** The point on a road centreline nearest (x, y): the escape hatch for a car
 * that ended up off-road inside a block. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const px = rx;
    const py = clamp(y, 0, WORLD.height);
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
    }
  }
  for (const ry of ROADS_Y) {
    const px = clamp(x, BEACH_X, WORLD.width);
    const py = ry;
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
    }
  }
  return best;
}
export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2 + 8) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2 + 8) return true;
  return false;
}

/** The crossing (routing node) nearest a point. */
export function nearestNode(city, x, y) {
  let best = city.nodes[0];
  let bestD = Infinity;
  for (const n of city.nodes) {
    const dx = n.x - x;
    const dy = n.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/**
 * A route from (fromX, fromY) to (toX, toY) as waypoints: the nearest crossing, a
 * breadth-first path across the crossing grid, then the destination itself. Driving
 * only ever along road centrelines is what keeps the autopilot and the police from
 * wedging on building corners.
 */
export function route(city, fromX, fromY, toX, toY) {
  const start = nearestNode(city, fromX, fromY);
  const goal = nearestNode(city, toX, toY);
  const cols = ROADS_X.length;
  const rows = ROADS_Y.length;
  const key = (c, r) => r * cols + c;
  const prev = new Map();
  const queue = [key(start.col, start.row)];
  prev.set(key(start.col, start.row), -1);
  while (queue.length > 0) {
    const cur = queue.shift();
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    if (cur === key(goal.col, goal.row)) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nk = key(nc, nr);
      if (!prev.has(nk)) {
        prev.set(nk, cur);
        queue.push(nk);
      }
    }
  }
  const path = [];
  let cur = key(goal.col, goal.row);
  while (cur !== -1) {
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    path.unshift({ x: ROADS_X[c], y: ROADS_Y[r] });
    cur = prev.get(cur);
  }
  if (path.length === 0) path.push({ x: start.x, y: start.y });
  path.push({ x: toX, y: toY });
  return path;
}

/** True when a circle of radius r at (x, y) overlaps a building, a solid
 * landmark, or the sea. The pier, the parks and the beach stay open ground. */
export function circleHitsSolid(city, x, y, r) {
  if (x < SEA_X + r && !(x > PIER.x && x < PIER.x + PIER.w && y > PIER.y && y < PIER.y + PIER.h)) return true;
  if (x - r < 0 || x + r > WORLD.width || y - r < 0 || y + r > WORLD.height) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  for (const b of city.solidRects) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy) with wall sliding: try the x move, then the y move, and
 * keep whichever axis is free, so a car or a walker slides along a wall instead of
 * sticking to its corner.
 */
export function moveWithCollision(city, x, y, dx, dy, r) {
  let nx = x;
  let ny = y;
  let hitX = false;
  let hitY = false;
  if (!circleHitsSolid(city, x + dx, y, r)) nx = x + dx;
  else hitX = true;
  if (!circleHitsSolid(city, nx, y + dy, r)) ny = y + dy;
  else hitY = true;
  return { x: nx, y: ny, hitX, hitY };
}

function buildBuildings(rng, landmarks, parks) {
  const buildings = [];
  const blocked = [...landmarks, ...parks];
  const xEdges = [BEACH_X + 30, ...ROADS_X, WORLD.width - 30];
  const yEdges = [40, ...ROADS_Y, WORLD.height - 40];
  const roofColors = ['#5d564c', '#6d5a4a', '#4f5a66', '#6b5a52'];
  for (let xi = 0; xi < xEdges.length - 1; xi += 1) {
    for (let yi = 0; yi < yEdges.length - 1; yi += 1) {
      const x0 = xEdges[xi] + ROAD_W / 2 + 14;
      const x1 = xEdges[xi + 1] - ROAD_W / 2 - 14;
      const y0 = yEdges[yi] + ROAD_W / 2 + 14;
      const y1 = yEdges[yi + 1] - ROAD_W / 2 - 14;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      const count = randInt(rng, 2, 3);
      for (let k = 0; k < count; k += 1) {
        const bw = randRange(rng, 90, Math.min(190, w * 0.62));
        const bh = randRange(rng, 80, Math.min(170, h * 0.62));
        const bx = randRange(rng, x0, x0 + w - bw);
        const by = randRange(rng, y0, y0 + h - bh);
        const b = { x: bx, y: by, w: bw, h: bh, roof: randPick(rng, roofColors), downtown: districtAt(bx + bw / 2, by + bh / 2) === 'Downtown' };
        if (blocked.some((o) => rectsOverlap(b, o, 26))) continue;
        if (buildings.some((o) => rectsOverlap(b, o, 18))) continue;
        buildings.push(b);
      }
    }
  }
  return buildings;
}

function buildParking(rng, city) {
  const spots = [];
  const crossings = city.nodes.filter((n) => n.x > 400 && n.y > 200);
  for (let i = 0; i < 14; i += 1) {
    const n = crossings[Math.floor(rng() * crossings.length)];
    const vertical = rng() < 0.5;
    const side = rng() < 0.5 ? -1 : 1;
    const x = vertical ? n.x + side * (ROAD_W / 2 + 26) : n.x + randRange(rng, -70, 70);
    const y = vertical ? n.y + randRange(rng, -70, 70) : n.y + side * (ROAD_W / 2 + 26);
    if (city.buildings.some((b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30)) continue;
    if (x < SEA_X + 40) continue;
    spots.push({ x, y, angle: vertical ? Math.PI / 2 : 0 });
  }
  return spots;
}

/** Build the whole city from one seeded generator: same seed, same Solmar Bay. */
export function buildCity(rng) {
  const landmarks = LANDMARKS.map((l) => ({ ...l }));
  const parks = [
    { x: 1040, y: 1740, w: 200, h: 130 },
    { x: 320, y: 300, w: 150, h: 110 },
    { x: 2480, y: 660, w: 140, h: 100 },
  ];
  const buildings = buildBuildings(rng, landmarks, parks);
  const nodes = [];
  for (let r = 0; r < ROADS_Y.length; r += 1) {
    for (let c = 0; c < ROADS_X.length; c += 1) {
      nodes.push({ x: ROADS_X[c], y: ROADS_Y[r], col: c, row: r });
    }
  }
  const city = { landmarks, parks, buildings, nodes, trees: [], parkingSpots: [] };
  // The building-like landmarks are solid; the pier, the parks and the beach are open.
  city.solidRects = landmarks.filter((l) => ['Solmar Tower', 'Palm Court Mall', 'Harbor Market', "Ray's Garage", 'Solmar Stadium'].includes(l.name));
  for (let i = 0; i < 130; i += 1) {
    const x = randRange(rng, BEACH_X + 20, WORLD.width - 20);
    const y = randRange(rng, 30, WORLD.height - 20);
    if (isOnRoad(x, y)) continue;
    if (circleHitsSolid(city, x, y, 10)) continue;
    city.trees.push({ x, y, r: randRange(rng, 9, 15) });
  }
  city.parkingSpots = buildParking(rng, city);
  city.playerSpawn = { x: 1400, y: 1180 };
  city.pierPoint = { x: 190, y: 1020 };
  city.marketPoint = { x: 680, y: 1250 };
  city.mallPoint = { x: 1760, y: 420 };
  city.garagePoint = { x: 2480, y: 1620 };
  city.bagSpots = [
    { x: 2080, y: 1000 },
    { x: 1040, y: 1740 },
    { x: 2480, y: 660 },
  ];
  return city;
}

/** Clamp a point inside the world, out of the sea and out of buildings. */
export function clampToFree(city, x, y, r) {
  let cx = clamp(x, SEA_X + r + 2, WORLD.width - r - 2);
  let cy = clamp(y, r + 2, WORLD.height - r - 2);
  for (let tries = 0; tries < 8 && circleHitsSolid(city, cx, cy, r); tries += 1) {
    cx += 40;
    if (cx > WORLD.width - r - 2) {
      cx = SEA_X + r + 40;
      cy += 40;
    }
  }
  return { x: cx, y: cy };
}
