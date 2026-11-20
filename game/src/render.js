// Solmar Bay — canvas rendering: city, cars, peds, player, HUD, minimap, screens.
import { CONFIG } from './config.js';
import { districtAt } from './city.js';
import { MISSIONS, currentObjective } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const ZOOM = 0.5;

export function render(ctx, state) {
  const player = state.player;
  if (state.screen === 'start') {
    drawStart(ctx, state);
    return;
  }
  const camX = clampCam(player.x - VIEW_W / ZOOM / 2, CONFIG.CITY_W - VIEW_W / ZOOM);
  const camY = clampCam(player.y - VIEW_H / ZOOM / 2, CONFIG.CITY_H - VIEW_H / ZOOM);
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-camX, -camY);

  drawGround(ctx, state);
  drawRoads(ctx, state);
  drawParks(ctx, state);
  drawVolcano(ctx, state);
  drawCasino(ctx, state);
  drawBuildings(ctx, state);
  drawMissionMarker(ctx, state);
  drawTraffic(ctx, state);
  drawCars(ctx, state);
  drawCops(ctx, state);
  drawPeds(ctx, state);
  drawBullets(ctx, state);
  drawPlayer(ctx, state);
  ctx.restore();

  drawHUD(ctx, state);
  drawMinimap(ctx, state);
  if (state.screen === 'pause') drawPause(ctx, state);
  if (state.screen === 'over') drawGameOver(ctx, state);
}

function clampCam(v, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(max, v));
}

function drawGround(ctx, state) {
  ctx.fillStyle = '#3d4a35';
  ctx.fillRect(0, 0, CONFIG.CITY_W, CONFIG.CITY_H);
  for (const d of state.world.districts) {
    ctx.fillStyle = d.color + '55';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = '#ffffff22';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(d.name, d.x + 24, d.y + 60);
  }
}

function drawRoads(ctx, state) {
  for (const r of state.world.roads) {
    ctx.fillStyle = '#2b2b30';
    if (r.horizontal) ctx.fillRect(r.x1, r.y1 - CONFIG.ROAD_WIDTH / 2, r.x2 - r.x1, CONFIG.ROAD_WIDTH);
    else ctx.fillRect(r.x1 - CONFIG.ROAD_WIDTH / 2, r.y1, CONFIG.ROAD_WIDTH, r.y2 - r.y1);
    ctx.strokeStyle = '#e8c832';
    ctx.setLineDash([24, 24]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1);
    ctx.lineTo(r.x2, r.y2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawParks(ctx, state) {
  for (const p of state.world.parks) {
    ctx.fillStyle = '#2e6b2a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (const t of p.trees) {
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '20px sans-serif';
    ctx.fillText(p.name, p.x + 8, p.y + 22);
  }
}

function drawVolcano(ctx, state) {
  const v = state.world.volcano;
  ctx.fillStyle = '#6e3b26';
  ctx.beginPath();
  ctx.arc(v.x, v.y, v.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a4a2e';
  ctx.beginPath();
  ctx.arc(v.x, v.y, v.r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5a1f';
  ctx.beginPath();
  ctx.arc(v.x, v.y, v.r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(v.x, v.y, v.r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('EMBER VOLCANO', v.x - 110, v.y + v.r + 30);
}

function drawCasino(ctx, state) {
  const c = state.world.casino;
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(c.x - 8, c.y - 8, c.w + 16, c.h + 16);
  ctx.fillStyle = '#7a1f1f';
  ctx.fillRect(c.x, c.y, c.w, c.h);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('EMBER CASINO', c.x + 12, c.y + 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('$ $ $', c.x + 12, c.y + 84);
}

function drawBuildings(ctx, state) {
  for (const b of state.world.buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = '#ffe9a8';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.floors) % 3 === 0) {
          ctx.fillRect(b.x + 8 + i * 26, b.y + 12 + j * 26, 12, 12);
        }
      }
    }
  }
}

function drawMissionMarker(ctx, state) {
  const obj = currentObjective(state);
  if (!obj || state.screen !== 'play') return;
  const pulse = 1 + 0.18 * Math.sin(state.time * 5);
  ctx.save();
  ctx.translate(obj.x, obj.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd23f';
  const s = 26 * pulse;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeStyle = '#ff5a1f';
  ctx.lineWidth = 4;
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(obj.label, obj.x + 30, obj.y - 30);
}

function drawCarShape(ctx, x, y, angle, color, label) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-26, -13, 52, 26);
  ctx.fillStyle = '#222831';
  ctx.fillRect(-8, -11, 18, 22);
  ctx.fillStyle = '#dfe6e9';
  ctx.fillRect(20, -11, 5, 22);
  ctx.restore();
  if (label) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px sans-serif';
    ctx.fillText(label, x - 30, y - 24);
  }
}

function drawCars(ctx, state) {
  for (const c of state.cars) {
    if (state.player.inCar === c) continue;
    drawCarShape(ctx, c.x, c.y, c.angle, c.color, c.def.name);
  }
  for (const t of state.traffic) {
    if (state.player.inCar === t) continue;
    drawCarShape(ctx, t.x, t.y, t.angle, t.color, null);
  }
}

function drawTraffic(ctx, state) {
  // Traffic is drawn with the cars above; this keeps the draw order explicit.
}

function drawCops(ctx, state) {
  for (const cop of state.police.copCars) {
    drawCarShape(ctx, cop.x, cop.y, cop.angle, '#1a1a2e', 'POLICE');
    const blink = Math.floor(state.time * 6) % 2 === 0 ? '#ff2e2e' : '#2e6bff';
    ctx.fillStyle = blink;
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.police.footCops) {
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PD', cop.x - 8, cop.y + 4);
  }
}

function drawPeds(ctx, state) {
  for (const p of state.peds) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets(ctx, state) {
  ctx.fillStyle = '#ffe66d';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.inCar) {
    drawCarShape(ctx, p.x, p.y, p.angle, p.inCar.color, p.inCar.def.name + ' — YOU');
    return;
  }
  ctx.fillStyle = '#f5f6fa';
  ctx.beginPath();
  ctx.arc(p.x, p.y, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e84118';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24);
  ctx.stroke();
}

function drawHUD(ctx, state) {
  const p = state.player;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.fillStyle = '#2ed573';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 16, 42);
  ctx.fillStyle = '#ffa502';
  ctx.font = 'bold 28px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.police.wanted ? '★' : '☆';
  ctx.fillText(stars, 240, 42);
  // Health bar.
  ctx.fillStyle = '#57606f';
  ctx.fillRect(520, 18, 200, 26);
  ctx.fillStyle = p.health > 30 ? '#2ed573' : '#ff4757';
  ctx.fillRect(520, 18, 200 * Math.max(0, p.health / 100), 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 730, 40);
  const obj = currentObjective(state);
  if (obj) {
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('▸ ' + obj.label, 16, 100);
  }
  const m = state.mission;
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mission ' + Math.min(m.index + 1, 8) + '/8 — ' + (m.done ? 'All done!' : MISSIONS[m.index].name) + '  ($' + m.money + ' / $5,500)', 16, 132);
  if (m.started && MISSIONS[m.index] && MISSIONS[m.index].kind === 'reach_timed') {
    ctx.fillStyle = '#ff6b81';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('TIME ' + Math.ceil(m.timer) + 's', 16, 164);
  }
  if (state.messageTimer > 0) {
    ctx.fillStyle = '#ffd32a';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(state.message, VIEW_W / 2 - 160, 200);
  }
  const district = districtAt(state.world, p.x, p.y);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText(district + '  •  ' + Math.round(p.x) + ', ' + Math.round(p.y), 16, VIEW_H - 16);
}

function drawMinimap(ctx, state) {
  const mw = 230;
  const mh = 180;
  const mx = VIEW_W - mw - 16;
  const my = VIEW_H - mh - 16;
  const sx = mw / CONFIG.CITY_W;
  const sy = mh / CONFIG.CITY_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx, my, mw, mh);
  for (const d of state.world.districts) {
    ctx.fillStyle = d.color;
    ctx.fillRect(mx + d.x * sx, my + d.y * sy, d.w * sx, d.h * sy);
  }
  ctx.fillStyle = '#ff5a1f';
  const v = state.world.volcano;
  ctx.beginPath();
  ctx.arc(mx + v.x * sx, my + v.y * sy, 6, 0, Math.PI * 2);
  ctx.fill();
  const obj = currentObjective(state);
  if (obj) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx + obj.x * sx, my + obj.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of state.police.copCars) {
    ctx.fillStyle = '#2e6bff';
    ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(mx, my, mw, mh);
}

function drawStart(ctx, state) {
  ctx.fillStyle = '#140f1e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ff5a1f';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText('SOLMAR BAY', 90, 220);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('An open-world crime story in five districts', 95, 280);
  ctx.fillStyle = '#ffffff';
  ctx.font = '26px sans-serif';
  ctx.fillText('12 cars  •  22 traffic  •  40 pedestrians  •  5-star wanted  •  8 missions — $5,500', 95, 340);
  ctx.fillText('WASD / arrows — move & drive      E — enter / exit car      J — shoot', 95, 400);
  ctx.fillText('P — pause      S — save (pause screen)      Missions pay out in order', 95, 440);
  ctx.fillStyle = '#2ed573';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Press ENTER to start', 95, 540);
  ctx.fillStyle = '#ffa502';
  ctx.font = '22px sans-serif';
  ctx.fillText('Ember Heights — volcano, casino, and the final score.', 95, 600);
}

function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('PAUSED', 520, 300);
  ctx.font = '26px sans-serif';
  ctx.fillText('P — resume      S — save game (v2)      ENTER — resume', 400, 360);
}

function drawGameOver(ctx, state) {
  ctx.fillStyle = 'rgba(60,0,0,0.75)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#ff4757';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BUSTED / WASTED', 330, 320);
  ctx.fillStyle = '#ffffff';
  ctx.font = '28px sans-serif';
  ctx.fillText('Press ENTER to restart', 480, 390);
}
