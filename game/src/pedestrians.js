// Solmar Bay — pedestrian AI. No DOM.
import { CONFIG, clampToCity } from './config.js';

export function createPedestrians(world) {
  return world.pedSpawns.map((s, i) => ({
    id: i,
    x: s.x, y: s.y,
    horizontal: s.horizontal,
    dir: s.dir,
    speed: 45 + (i % 4) * 12,
    color: ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'][(i * 7) % 6],
    walking: true,
  }));
}

export function updatePedestrians(peds, dt) {
  for (const p of peds) {
    if (!p.walking) continue;
    const step = p.speed * p.dir * dt;
    if (p.horizontal) {
      p.x += step;
      if (p.x < 40 || p.x > CONFIG.CITY_W - 40) p.dir *= -1;
    } else {
      p.y += step;
      if (p.y < 40 || p.y > CONFIG.CITY_H - 40) p.dir *= -1;
    }
    const c = clampToCity(p.x, p.y);
    p.x = c.x;
    p.y = c.y;
  }
}
