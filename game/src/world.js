// Solmar Bay — deterministic city generation. No DOM.
// City 3600x2800, five districts. Ember Heights holds the volcano, casino and park.
import { CONFIG } from './config.js';
import { createRng, rngRange, rngInt, rngPick, hashString } from './random.js';

const BUILDING_COLORS = ['#8a7f72', '#7d7468', '#9c8f7a', '#6f7d8a', '#a08b6d', '#7a6a58', '#8f8578', '#74806a'];
const PARK_TREES = ['#3f7a3a', '#4c8a42', '#35702f', '#5a9a4a'];

export function generateCity(seed) {
  const rng = createRng(seed);
  const W = CONFIG.CITY_W;
  const H = CONFIG.CITY_H;

  const districts = [
    { name: 'Ember Heights', x: 2280, y: 0, w: 1320, h: 1120, color: '#5a2e22', volcano: true, casino: true, park: true },
    { name: 'Marina Del Sol', x: 0, y: 0, w: 1140, h: 1120, color: '#2e5a6e', volcano: false, casino: false, park: true },
    { name: 'Porto Verde', x: 1140, y: 0, w: 1140, h: 1120, color: '#2e5a44', volcano: false, casino: false, park: true },
    { name: 'Old Harbor', x: 0, y: 1120, w: 1800, h: 1680, color: '#5a4a2e', volcano: false, casino: false, park: true },
    { name: 'Northgate Hills', x: 1800, y: 1120, w: 1800, h: 1680, color: '#3a3a5a', volcano: false, casino: false, park: true },
  ];

  // Roads: vertical avenues every 300px, horizontal every 280px, spanning the city.
  const roads = [];
  for (let x = 150; x < W; x += CONFIG.AVENUE_GAP_X) {
    roads.push({ x1: x, y1: 0, x2: x, y2: H, horizontal: false });
  }
  for (let y = 140; y < H; y += CONFIG.AVENUE_GAP_Y) {
    roads.push({ x1: 0, y1: y, x2: W, y2: y, horizontal: true });
  }

  // Buildings fill the blocks between roads.
  const buildings = [];
  const vLines = roads.filter((r) => !r.horizontal).map((r) => r.x1);
  const hLines = roads.filter((r) => r.horizontal).map((r) => r.y1);
  for (let i = 0; i < vLines.length - 1; i++) {
    for (let j = 0; j < hLines.length - 1; j++) {
      const bx = vLines[i] + CONFIG.ROAD_WIDTH / 2 + 12;
      const by = hLines[j] + CONFIG.ROAD_WIDTH / 2 + 12;
      const bw = vLines[i + 1] - vLines[i] - CONFIG.ROAD_WIDTH - 24;
      const bh = hLines[j + 1] - hLines[j] - CONFIG.ROAD_WIDTH - 24;
      if (bw < 40 || bh < 40) continue;
      // One or two buildings per block, deterministic.
      const n = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? bw : bw / 2 - 8;
        const h = n === 1 ? bh : bh;
        const x = n === 1 ? bx : bx + k * (bw / 2 + 8);
        const y = by;
        buildings.push({
          x: Math.round(x), y: Math.round(y),
          w: Math.round(w), h: Math.round(h),
          color: rngPick(rng, BUILDING_COLORS),
          floors: rngInt(rng, 1, 6),
          district: districtNameAt(districts, x + w / 2, y + h / 2),
        });
      }
    }
  }

  // Parks: one per district, placed on a block centre.
  const parks = districts.map((d) => {
    const px = d.x + d.w * rngRange(rng, 0.3, 0.6);
    const py = d.y + d.h * rngRange(rng, 0.3, 0.6);
    return {
      name: d.name + ' Park', district: d.name,
      x: Math.round(px - 90), y: Math.round(py - 70),
      w: 180, h: 140,
      trees: Array.from({ length: 9 }, () => ({
        x: Math.round(px - 80 + rng() * 160), y: Math.round(py - 60 + rng() * 120),
        r: rngInt(rng, 8, 16), color: rngPick(rng, PARK_TREES),
      })),
    };
  });

  // Ember Heights landmarks.
  const volcano = { x: 2940, y: 420, r: 150, district: 'Ember Heights' };
  const casino = { x: 3120, y: 760, w: 220, h: 130, name: 'Ember Casino', district: 'Ember Heights' };

  const world = {
    seed, w: W, h: H, districts, roads, buildings, parks, volcano, casino,
    playerSpawn: { x: 600, y: 560 },
    carSpawns: [],
    trafficSpawns: [],
    pedSpawns: [],
  };

  // Car spawns: 12 drivable cars parked along vertical avenues.
  for (let i = 0; i < CONFIG.DRIVABLE_CAR_COUNT; i++) {
    const road = roads[i % 12];
    const along = 200 + ((i * 173) % (H - 400));
    world.carSpawns.push({ x: road.x1 + 26, y: along, angle: Math.PI / 2 });
  }
  // Traffic spawns: 22 cars on roads.
  for (let i = 0; i < CONFIG.TRAFFIC_COUNT; i++) {
    const road = roads[(i * 2 + 1) % roads.length];
    if (road.horizontal) {
      world.trafficSpawns.push({ x: 200 + ((i * 211) % (W - 400)), y: road.y1, horizontal: true, dir: i % 2 === 0 ? 1 : -1 });
    } else {
      world.trafficSpawns.push({ x: road.x1, y: 200 + ((i * 197) % (H - 400)), horizontal: false, dir: i % 2 === 0 ? 1 : -1 });
    }
  }
  // Pedestrian spawns: 40 on sidewalks (just off a road edge, mid-block so the
  // nearest road is always the one they walk beside, never a crossing).
  for (let i = 0; i < CONFIG.PED_COUNT; i++) {
    const road = roads[(i * 3 + 2) % roads.length];
    if (road.horizontal) {
      const midX = vLines[i % (vLines.length - 1)] + 150;
      world.pedSpawns.push({ x: midX, y: road.y1 + CONFIG.ROAD_WIDTH / 2 + 10, horizontal: true, dir: i % 2 === 0 ? 1 : -1 });
    } else {
      const midY = hLines[i % (hLines.length - 1)] + 140;
      world.pedSpawns.push({ x: road.x1 + CONFIG.ROAD_WIDTH / 2 + 10, y: midY, horizontal: false, dir: i % 2 === 0 ? 1 : -1 });
    }
  }

  return world;
}

export function districtNameAt(districts, x, y) {
  for (const d of districts) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return districts[0].name;
}

export function cityHash(world) {
  const parts = [
    world.seed,
    world.districts.map((d) => `${d.name}:${d.x},${d.y},${d.w},${d.h}`).join('|'),
    world.roads.map((r) => `${r.x1},${r.y1},${r.x2},${r.y2}`).join('|'),
    world.buildings.map((b) => `${b.x},${b.y},${b.w},${b.h},${b.color},${b.floors}`).join('|'),
    world.parks.map((p) => `${p.x},${p.y},${p.trees.map((t) => `${t.x},${t.y},${t.r}`).join(';')}`).join('|'),
    `${world.volcano.x},${world.volcano.y},${world.volcano.r}`,
    `${world.casino.x},${world.casino.y},${world.casino.w},${world.casino.h}`,
  ];
  return hashString(parts.join('#'));
}
