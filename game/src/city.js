// The city of Solmar Bay: its roads, buildings, landmarks, parks and water, plus
// the road graph the traffic, the police and the autopilot route on, and the
// circle-vs-rectangle collision with wall sliding that everything moves with.
// Everything is built once from the seeded generator, so the city is identical
// for a given seed.
import {
  WORLD, ROAD_HALF, ROADS_X, ROADS_Y, EMBER_X_MIN, EMBER_Y_MIN,
  DISTRICTS, LANDMARKS, EMBER_PARK, DOWNTOWN_PARK, WATER,
} from './config.js';
import { range, int, pick } from './random.js';

const BUILDING_COLORS = ['#4a5060', '#565e70', '#414856', '#5d6577', '#4d5468'];
const ROOF_COLORS = ['#6b7280', '#7a6a55', '#5b7a6a', '#715a6e'];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** The y-span a vertical road at x covers. Ember verticals (past 2360) run only
 *  in the south-east; 2360 itself is the boundary road and runs the full height. */
export function verticalSpan(x) {
  return x > EMBER_X_MIN ? [EMBER_Y_MIN, WORLD.height] : [0, WORLD.height];
}

/** The x-span a horizontal road at y covers. Ember horizontals run only in the south-east. */
export function horizontalSpan(y) {
  return y >= EMBER_Y_MIN ? [EMBER_X_MIN, WORLD.width] : [0, WORLD.width];
}

/** Is a point on a road (inside a corridor, within the road's span)? */
export function onRoad(city, x, y) {
  for (const vx of ROADS_X) {
    const [y0, y1] = verticalSpan(vx);
    if (Math.abs(x - vx) <= ROAD_HALF && y >= y0 && y <= y1) return true;
  }
  for (const hy of ROADS_Y) {
    const [x0, x1] = horizontalSpan(hy);
    if (Math.abs(y - hy) <= ROAD_HALF && x >= x0 && x <= x1) return true;
  }
  return false;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'SOLMAR BAY';
}

export function buildCity(random) {
  // --- solid rectangles: buildings, landmarks, water -----------------------
  const solids = [];
  const buildings = [];

  // Landmarks are solid first, so no generated building ever covers one.
  for (const key of Object.keys(LANDMARKS)) {
    const lm = LANDMARKS[key];
    solids.push({ x: lm.x, y: lm.y, w: lm.w, h: lm.h, kind: key });
  }
  solids.push({ x: WATER.x, y: WATER.y, w: WATER.w, h: WATER.h, kind: 'water' });

  const noBuild = [
    { x: LANDMARKS.garage.x - 20, y: LANDMARKS.garage.y - 20, w: LANDMARKS.garage.w + 40, h: LANDMARKS.garage.h + 40 },
    { x: LANDMARKS.pier.x - 20, y: LANDMARKS.pier.y - 20, w: LANDMARKS.pier.w + 40, h: LANDMARKS.pier.h + 40 },
    { x: LANDMARKS.volcano.x - 20, y: LANDMARKS.volcano.y - 20, w: LANDMARKS.volcano.w + 40, h: LANDMARKS.volcano.h + 40 },
    { x: LANDMARKS.casino.x - 20, y: LANDMARKS.casino.y - 20, w: LANDMARKS.casino.w + 40, h: LANDMARKS.casino.h + 40 },
    { x: EMBER_PARK.x - 8, y: EMBER_PARK.y - 8, w: EMBER_PARK.w + 16, h: EMBER_PARK.h + 16 },
    { x: DOWNTOWN_PARK.x - 8, y: DOWNTOWN_PARK.y - 8, w: DOWNTOWN_PARK.w + 16, h: DOWNTOWN_PARK.h + 16 },
    { x: WATER.x - 8, y: WATER.y - 8, w: WATER.w + 16, h: WATER.h + 16 },
  ];

  // One building per city block (two when the block is big), placed inside the
  // block with a 14 px margin from the road edge.
  for (let i = 0; i < ROADS_X.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Y.length - 1; j += 1) {
      const x0 = ROADS_X[i];
      const x1 = ROADS_X[i + 1];
      const y0 = ROADS_Y[j];
      const y1 = ROADS_Y[j + 1];
      // All four bounding roads must exist across this cell.
      const [vy0a, vy1a] = verticalSpan(x0);
      const [vy0b, vy1b] = verticalSpan(x1);
      const [hx0a, hx1a] = horizontalSpan(y0);
      const [hx0b, hx1b] = horizontalSpan(y1);
      if (vy0a > y0 || vy1a < y1 || vy0b > y0 || vy1b < y1) continue;
      if (hx0a > x0 || hx1a < x1 || hx0b > x0 || hx1b < x1) continue;
      const ix0 = x0 + ROAD_HALF + 14;
      const ix1 = x1 - ROAD_HALF - 14;
      const iy0 = y0 + ROAD_HALF + 14;
      const iy1 = y1 - ROAD_HALF - 14;
      const iw = ix1 - ix0;
      const ih = iy1 - iy0;
      if (iw < 56 || ih < 56) continue;
      const big = iw > 260 && ih > 260;
      const count = big && random() < 0.55 ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = Math.min(iw - 8, range(random, 56, count === 2 ? iw / 2 - 6 : 210));
        const h = Math.min(ih - 8, range(random, 56, count === 2 ? ih / 2 - 6 : 190));
        const bx = count === 2 && b === 0
          ? ix0 + 4
          : count === 2
            ? ix1 - w - 4
            : ix0 + 4 + random() * Math.max(0, iw - w - 8);
        const by = count === 2 && b === 0
          ? iy0 + 4
          : count === 2
            ? iy1 - h - 4
            : iy0 + 4 + random() * Math.max(0, ih - h - 8);
        const rect = { x: bx, y: by, w, h };
        let blocked = false;
        for (const nb of noBuild) if (rectsOverlap(rect, nb)) { blocked = true; break; }
        if (blocked) continue;
        const building = {
          ...rect,
          color: pick(random, BUILDING_COLORS),
          roof: pick(random, ROOF_COLORS),
          floors: int(random, 1, 4),
        };
        buildings.push(building);
        solids.push({ x: bx, y: by, w, h, kind: 'building' });
      }
    }
  }

  // --- road graph: a node at every intersection, edges along each road -----
  const nodes = [];
  const nodeIndex = new Map();
  for (const vx of ROADS_X) {
    const [y0, y1] = verticalSpan(vx);
    for (const hy of ROADS_Y) {
      const [x0, x1] = horizontalSpan(hy);
      if (hy >= y0 && hy <= y1 && vx >= x0 && vx <= x1) {
        const id = nodes.length;
        nodes.push({ id, x: vx, y: hy });
        nodeIndex.set(`${vx},${hy}`, id);
      }
    }
  }
  const adjacency = nodes.map(() => []);
  function link(a, b) {
    if (a === undefined || b === undefined || a === b) return;
    adjacency[a].push(b);
    adjacency[b].push(a);
  }
  for (const vx of ROADS_X) {
    const [y0, y1] = verticalSpan(vx);
    const column = nodes
      .filter((n) => n.x === vx && n.y >= y0 && n.y <= y1)
      .sort((a, b) => a.y - b.y);
    for (let k = 0; k < column.length - 1; k += 1) link(column[k].id, column[k + 1].id);
  }
  for (const hy of ROADS_Y) {
    const [x0, x1] = horizontalSpan(hy);
    const row = nodes
      .filter((n) => n.y === hy && n.x >= x0 && n.x <= x1)
      .sort((a, b) => a.x - b.x);
    for (let k = 0; k < row.length - 1; k += 1) link(row[k].id, row[k + 1].id);
  }

  // --- park trees (decor only, no collision) -------------------------------
  const trees = [];
  for (const park of [EMBER_PARK, DOWNTOWN_PARK]) {
    const n = park === EMBER_PARK ? 7 : 12;
    for (let k = 0; k < n; k += 1) {
      trees.push({
        x: park.x + 16 + random() * (park.w - 32),
        y: park.y + 16 + random() * (park.h - 32),
        r: range(random, 9, 15),
      });
    }
  }

  return { solids, buildings, nodes, adjacency, trees };
}

/** Nearest road-graph node to a point. */
export function nearestNode(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const node of city.nodes) {
    const dx = node.x - x;
    const dy = node.y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = node; }
  }
  return best;
}

/**
 * Breadth-first route along the roads, from the node nearest `from` to the node
 * nearest `to`. Returns the list of node points, not including the start point
 * itself; empty when already there. Deterministic: neighbours are visited in
 * the order the graph was built.
 */
export function bfsPath(city, from, to) {
  const start = nearestNode(city, from.x, from.y);
  const goal = nearestNode(city, to.x, to.y);
  if (start === null || goal === null) return [];
  if (start.id === goal.id) return [];
  const prev = new Array(city.nodes.length).fill(-1);
  const queue = [start.id];
  prev[start.id] = start.id;
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === goal.id) break;
    for (const next of city.adjacency[cur]) {
      if (prev[next] === -1) {
        prev[next] = cur;
        queue.push(next);
      }
    }
  }
  if (prev[goal.id] === -1) return [];
  const path = [];
  let cur = goal.id;
  while (cur !== start.id) {
    path.push({ x: city.nodes[cur].x, y: city.nodes[cur].y });
    cur = prev[cur];
  }
  path.reverse();
  return path;
}

/** The closest point on any road to (x, y). Used to drop cops onto roads. */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  function consider(px, py) {
    const dx = px - x;
    const dy = py - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = { x: px, y: py }; }
  }
  for (const vx of ROADS_X) {
    const [y0, y1] = verticalSpan(vx);
    consider(vx, Math.min(y1, Math.max(y0, y)));
  }
  for (const hy of ROADS_Y) {
    const [x0, x1] = horizontalSpan(hy);
    consider(Math.min(x1, Math.max(x0, x)), hy);
  }
  return best;
}

/** True when a circle at (x, y) with radius r touches a solid or the map edge. */
export function circleHits(city, x, y, r) {
  if (x - r < 0 || y - r < 0 || x + r > WORLD.width || y + r > WORLD.height) return true;
  for (const s of city.solids) {
    const cx = Math.min(s.x + s.w, Math.max(s.x, x));
    const cy = Math.min(s.y + s.h, Math.max(s.y, y));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/**
 * Move a circle by (dx, dy) with wall sliding: try the full step, then x-only,
 * then y-only, so a walker or driver slides along a building face instead of
 * stopping dead on it. When the circle starts inside a solid (shoved there by
 * another car), step out of it first instead of staying wedged.
 */
export function moveCircle(city, x, y, dx, dy, r) {
  // Never start outside the map: a shove that crossed the edge is pulled
  // back in instead of wedging the circle against the border forever.
  x = Math.min(Math.max(x, r), WORLD.width - r);
  y = Math.min(Math.max(y, r), WORLD.height - r);
  if (circleHits(city, x, y, r)) {
    // Already inside a solid: step out, trying further steps until one
    // lands clear — a single step often stays inside the same building.
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (let k = 1; k <= 8; k += 1) {
      for (const [ex, ey] of dirs) {
        if (!circleHits(city, x + ex * r * k, y + ey * r * k, r)) return { x: x + ex * r * k, y: y + ey * r * k };
      }
    }
    return { x, y };
  }
  if (!circleHits(city, x + dx, y + dy, r)) return { x: x + dx, y: y + dy };
  if (!circleHits(city, x + dx, y, r)) return { x: x + dx, y };
  if (!circleHits(city, x, y + dy, r)) return { x, y: y + dy };
  return { x, y };
}

/** True when the straight segment from a to b is clear for a circle of radius r. */
export function segmentClear(city, ax, ay, bx, by, r) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 20));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (circleHits(city, ax + (bx - ax) * t, ay + (by - ay) * t, r)) return false;
  }
  return true;
}
