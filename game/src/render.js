// Drawing only: the world's state and the current screen in, pixels out. A
// 1280x720 camera follows the player and is clamped to the WORLD bounds, so it
// never shows past the edge of the map. The minimap names the district the
// player is standing in; the pause screen lists all eight jobs.
import {
  WORLD, PALETTE, FONT, DISTRICTS, LANDMARKS, EMBER_PARK, DOWNTOWN_PARK,
  WATER, MISSION_DEFS, GOAL_MONEY, ROADS_X, ROADS_Y,
} from './config.js';
import { verticalSpan, horizontalSpan, districtAt } from './city.js';
import { wantedStars } from './police.js';
import { missionHudLine, missionObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_STORY = 'story';

const VIEW_W = 1280;
const VIEW_H = 720;
const MINIMAP = { x: 1036, y: 16, w: 228, h: 176 };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const cam = { x: 0, y: 0 };

  function font(size, bold) {
    const key = `${size}:${bold ? 1 : 0}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function inView(x, y, pad) {
    return x > cam.x - pad && x < cam.x + VIEW_W + pad && y > cam.y - pad && y < cam.y + VIEW_H + pad;
  }

  function drawGround() {
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
    // Water along the west edge.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
    // Parks.
    for (const park of [DOWNTOWN_PARK, EMBER_PARK]) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
  }

  function drawRoads() {
    ctx.fillStyle = PALETTE.road;
    for (const vx of ROADS_X) {
      const [y0, y1] = verticalSpan(vx);
      ctx.fillRect(vx - 28, y0, 56, y1 - y0);
    }
    for (const hy of ROADS_Y) {
      const [x0, x1] = horizontalSpan(hy);
      ctx.fillRect(x0, hy - 28, x1 - x0, 56);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadDash;
    for (const vx of ROADS_X) {
      const [y0, y1] = verticalSpan(vx);
      for (let y = y0 + 20; y < y1; y += 56) ctx.fillRect(vx - 2, y, 4, 26);
    }
    for (const hy of ROADS_Y) {
      const [x0, x1] = horizontalSpan(hy);
      for (let x = x0 + 20; x < x1; x += 56) ctx.fillRect(x, hy - 2, 26, 4);
    }
  }

  function drawBuildings(world) {
    for (const b of world.city.buildings) {
      if (!inView(b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let f = 1; f < b.floors; f += 1) {
        ctx.fillRect(b.x + 7, b.y + 7 + ((b.h - 14) / b.floors) * f, b.w - 14, 2);
      }
    }
    // Landmarks.
    const lm = LANDMARKS;
    drawLandmark(lm.garage, PALETTE.garage, 'RAY\u2019S');
    drawLandmark(lm.pier, PALETTE.pier, 'PIER');
    drawLandmark(lm.casino, PALETTE.casino, 'CASINO');
    // The volcano: a cone with a glowing crater.
    const v = lm.volcano;
    ctx.fillStyle = PALETTE.volcano;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y + v.h);
    ctx.lineTo(v.x + v.w / 2, v.y);
    ctx.lineTo(v.x + v.w, v.y + v.h);
    ctx.closePath();
    ctx.fill();
    const pulse = 10 + Math.sin(world.elapsed * 3) * 3;
    ctx.fillStyle = PALETTE.lava;
    ctx.beginPath();
    ctx.arc(v.x + v.w / 2, v.y + 16, pulse, 0, Math.PI * 2);
    ctx.fill();
    text('VOLCANO', v.x + v.w / 2, v.y + v.h + 16, 13, PALETTE.text, 'center', true);
    // Park trees.
    ctx.fillStyle = PALETTE.tree;
    for (const t of world.city.trees) {
      if (!inView(t.x, t.y, 20)) continue;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawLandmark(r, color, label) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12);
    if (label === 'CASINO') {
      ctx.fillStyle = PALETTE.casinoSign;
      ctx.fillRect(r.x + 8, r.y + 10, r.w - 16, 22);
      text(label, r.x + r.w / 2, r.y + 27, 15, '#3a2c00', 'center', true);
    } else {
      text(label, r.x + r.w / 2, r.y + r.h / 2 + 5, 15, PALETTE.text, 'center', true);
    }
  }

  function drawCarShape(car, isPlayer, isCop) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = car.model.w;
    const h = car.model.h;
    ctx.fillStyle = isCop ? PALETTE.copCar : car.model.color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(20,26,36,0.85)';
    ctx.fillRect(-w / 2 + 8, -h / 2 + 4, w / 2 - 10, h - 8);
    ctx.fillStyle = isCop ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.fillRect(-w / 6, -h / 2, w / 3, h);
    if (isCop) {
      ctx.fillStyle = Math.floor(Date.now() / 300) % 2 === 0 ? '#ff3b30' : '#0a84ff';
      ctx.fillRect(-6, -h / 2 - 2, 12, 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = PALETTE.player;
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    }
    ctx.restore();
  }

  function drawWorld(world) {
    drawGround();
    drawRoads();
    drawBuildings(world);
    // Pickups: glowing bags and crates, armed by the current mission only.
    const pulse = 0.6 + Math.sin(world.elapsed * 5) * 0.4;
    for (const p of world.missions.pickups) {
      if (p.taken || !inView(p.x, p.y, 40)) continue;
      const color = p.kind === 'cash' ? PALETTE.pickupCash : p.kind === 'chips' ? PALETTE.pickupChips : PALETTE.pickupEmber;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#10201a';
      ctx.fillRect(p.x - 7, p.y - 5, 14, 10);
    }
    // Cars: parked and traffic first, then the player's, then cop cars.
    for (const car of world.cars) {
      if (car.kind === 'wreck') {
        if (!inView(car.x, car.y, 60)) continue;
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-car.model.w / 2, -car.model.h / 2, car.model.w, car.model.h);
        ctx.restore();
        continue;
      }
      if (car.kind === 'player') continue;
      if (!inView(car.x, car.y, 60)) continue;
      drawCarShape(car, false, false);
    }
    // Pedestrians.
    for (const ped of world.peds) {
      if (!ped.alive || !inView(ped.x, ped.y, 20)) continue;
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ped.x, ped.y);
      ctx.lineTo(ped.x + Math.cos(ped.angle) * 11, ped.y + Math.sin(ped.angle) * 11);
      ctx.stroke();
    }
    // The player: in a car, or on foot.
    const player = world.player;
    if (player.car) {
      drawCarShape(player.car, true, false);
    } else {
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b2a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
      ctx.stroke();
    }
    // Cop cars and on-foot cops.
    for (const cop of world.police.cops) {
      if (!inView(cop.x, cop.y, 60)) continue;
      if (cop.kind === 'car') {
        drawCarShape({ x: cop.x, y: cop.y, angle: cop.angle, model: { w: 46, h: 24, color: PALETTE.copCar } }, false, true);
      } else {
        ctx.fillStyle = PALETTE.cop;
        ctx.beginPath();
        ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cop.x - 5, cop.y - 2, 10, 4);
      }
    }
    // Muzzle flash.
    if (world.muzzle) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(world.muzzle.x, world.muzzle.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObjectiveMarker(world) {
    const player = world.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const obj = missionObjective(world.missions, world.police, px, py);
    if (obj.kind === 'done' || obj.kind === 'heat-gain' || obj.kind === 'heat-lose') return;
    const tx = obj.x;
    const ty = obj.y;
    const sx = tx - cam.x;
    const sy = ty - cam.y;
    const pulse = 1 + Math.sin(world.elapsed * 6) * 0.15;
    if (sx > 20 && sx < VIEW_W - 20 && sy > 20 && sy < VIEW_H - 20) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#3a2c00';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      const dist = Math.round(Math.hypot(tx - px, ty - py));
      text(`${dist}m`, sx, sy - 24, 15, PALETTE.marker, 'center', true);
    } else {
      // Off-screen: an arrow on the view edge pointing at the target.
      const cx = Math.min(Math.max(sx, 40), VIEW_W - 40);
      const cy = Math.min(Math.max(sy, 40), VIEW_H - 40);
      const a = Math.atan2(ty - py, tx - px);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMinimap(world) {
    const m = MINIMAP;
    const sx = m.w / WORLD.width;
    const sy = m.h / WORLD.height;
    ctx.fillStyle = 'rgba(10, 13, 20, 0.85)';
    ctx.fillRect(m.x - 6, m.y - 6, m.w + 12, m.h + 12);
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      ctx.fillRect(m.x + d.x0 * sx, m.y + d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1;
    for (const vx of ROADS_X) {
      const [y0, y1] = verticalSpan(vx);
      ctx.beginPath();
      ctx.moveTo(m.x + vx * sx, m.y + y0 * sy);
      ctx.lineTo(m.x + vx * sx, m.y + y1 * sy);
      ctx.stroke();
    }
    for (const hy of ROADS_Y) {
      const [x0, x1] = horizontalSpan(hy);
      ctx.beginPath();
      ctx.moveTo(m.x + x0 * sx, m.y + hy * sy);
      ctx.lineTo(m.x + x1 * sx, m.y + hy * sy);
      ctx.stroke();
    }
    // Volcano and casino dots.
    ctx.fillStyle = PALETTE.lava;
    ctx.fillRect(m.x + 2560 * sx - 2, m.y + 2160 * sy - 2, 4, 4);
    ctx.fillStyle = PALETTE.casinoSign;
    ctx.fillRect(m.x + 2750 * sx - 2, m.y + 2190 * sy - 2, 4, 4);
    // Objective.
    const player = world.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    const obj = missionObjective(world.missions, world.police, px, py);
    if (obj.x || obj.y) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(m.x + obj.x * sx, m.y + obj.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cops.
    ctx.fillStyle = '#ff3b30';
    for (const cop of world.police.cops) {
      ctx.fillRect(m.x + cop.x * sx - 1, m.y + cop.y * sy - 1, 3, 3);
    }
    // Player.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(m.x + px * sx, m.y + py * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(m.x + px * sx, m.y + py * sy, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    // District readout under the minimap.
    text(districtAt(px, py), m.x + m.w / 2, m.y + m.h + 20, 15, PALETTE.text, 'center', true);
  }

  function drawHud(world) {
    const stars = wantedStars(world.police);
    // Money + mission line, top left.
    text(`$${world.money.toLocaleString('en-US')} / $${GOAL_MONEY.toLocaleString('en-US')}`, 20, 34, 26, PALETTE.text, 'left', true);
    text(missionHudLine(world.missions, world.police), 20, 62, 17, PALETTE.muted, 'left');
    // Wanted stars under the minimap.
    let starText = '';
    for (let i = 0; i < 5; i += 1) starText += i < stars ? '★' : '☆';
    text(starText, MINIMAP.x + MINIMAP.w, MINIMAP.y + MINIMAP.h + 44, 24, PALETTE.star, 'right', true);
    // Health bar, bottom left.
    const player = world.player;
    ctx.fillStyle = 'rgba(10,13,20,0.8)';
    ctx.fillRect(16, VIEW_H - 46, 220, 30);
    ctx.fillStyle = player.health > 40 ? '#37d67a' : PALETTE.danger;
    ctx.fillRect(20, VIEW_H - 42, 212 * (player.health / 100), 12);
    text(`HP ${Math.ceil(player.health)}`, 24, VIEW_H - 20, 13, PALETTE.text, 'left', true);
    if (player.car) {
      const speed = Math.round(Math.abs(player.car.speed) * 2.237);
      text(`${player.car.model.name} — ${speed} mph`, 252, VIEW_H - 20, 15, PALETTE.text, 'left', true);
      // Car health bar.
      ctx.fillStyle = 'rgba(10,13,20,0.8)';
      ctx.fillRect(252, VIEW_H - 46, 140, 12);
      ctx.fillStyle = player.car.health > 40 ? '#4fc3f7' : PALETTE.danger;
      ctx.fillRect(252, VIEW_H - 46, 140 * (player.car.health / 100), 12);
    } else {
      text('On foot — E to steal a car, J to shoot', 252, VIEW_H - 20, 15, PALETTE.muted, 'left');
    }
    // Session stats, bottom right.
    const s = world.stats;
    text(`Carjackings ${s.carjackings} · Peds down ${s.pedsDown} · Shots ${s.shotsFired}`, VIEW_W - 16, VIEW_H - 20, 13, PALETTE.muted, 'right');
    // Mission banner.
    if (world.missions.bannerT > 0) {
      ctx.fillStyle = 'rgba(10,13,20,0.85)';
      const w = 560;
      ctx.fillRect((VIEW_W - w) / 2, 84, w, 44);
      text(world.missions.bannerText, VIEW_W / 2, 114, 20, PALETTE.marker, 'center', true);
    }
    // Red edge flash at high wanted levels or low health.
    const danger = stars >= 3 || player.health < 30;
    if (danger) {
      const a = 0.12 + Math.sin(world.elapsed * 6) * 0.06;
      ctx.strokeStyle = `rgba(229,83,75,${a.toFixed(3)})`;
      ctx.lineWidth = 18;
      ctx.strokeRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const lineH = 32;
    const height = 150 + lines.length * lineH + 64;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    text(title, VIEW_W / 2, y + 66, 46, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 118 + i * lineH, 19, PALETTE.muted, 'center');
    }
    if (prompt) text(prompt, VIEW_W / 2, y + height - 30, 21, PALETTE.marker, 'center', true);
  }

  function drawPause(world) {
    const lines = [];
    for (const def of MISSION_DEFS) {
      const done = world.missions.completed.includes(def.id);
      const current = !done && world.missions.index === def.id - 1 && !world.missions.storyDone;
      const mark = done ? '✓' : current ? '▶' : '·';
      lines.push(`${mark}  ${def.id}. ${def.name} — $${def.reward}`);
    }
    lines.push('');
    const s = world.stats;
    lines.push(`Money $${world.money.toLocaleString('en-US')} / $${GOAL_MONEY.toLocaleString('en-US')}   Carjackings ${s.carjackings}   Peds down ${s.pedsDown}   Shots ${s.shotsFired}`);
    drawPanel('PAUSED', lines, 'P to resume · S to save');
  }

  /** Paint one frame: the world through the camera, then the HUD or a panel. */
  function draw(world, screen, best) {
    const player = world.player;
    const px = player.car ? player.car.x : player.x;
    const py = player.car ? player.car.y : player.y;
    // Camera clamped to WORLD: it never shows past the map edge.
    cam.x = Math.min(Math.max(px - VIEW_W / 2, 0), WORLD.width - VIEW_W);
    cam.y = Math.min(Math.max(py - VIEW_H / 2, 0), WORLD.height - VIEW_H);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawWorld(world);
    ctx.restore();
    drawObjectiveMarker(world);
    drawMinimap(world);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'An open-world crime story in the spirit of GTA 6.',
        `$${GOAL_MONEY.toLocaleString('en-US')} across eight jobs — from a stolen car to the Ember Score.`,
        'Drive, steal, run from the cops, and finish all eight missions.',
        'WASD / arrows to move and drive · E to enter a car · J to shoot · P to pause',
        best > 0 ? `Best haul so far: $${best.toLocaleString('en-US')}` : 'A new story in Solmar Bay — good luck, kid.',
      ];
      drawPanel('SOLMAR BAY', lines, 'Press Space or click to start');
      return;
    }
    drawHud(world);
    if (screen === SCREEN_PAUSED) drawPause(world);
    else if (screen === SCREEN_OVER) {
      const busted = world.busted;
      const lines = [
        busted ? 'The cops finally caught up with you.' : 'Solmar Bay got the better of you.',
        `Money kept: $${world.money.toLocaleString('en-US')} — ${world.stats.missionsDone} of 8 missions done.`,
        best > 0 ? `Best haul: $${best.toLocaleString('en-US')}` : '',
      ];
      drawPanel(busted ? 'BUSTED' : 'WASTED', lines, 'Press Space to try again');
    } else if (screen === SCREEN_STORY) {
      const s = world.stats;
      const lines = [
        `All eight jobs done — $${GOAL_MONEY.toLocaleString('en-US')} in the bag.`,
        `Carjackings ${s.carjackings} · Peds down ${s.pedsDown} · Shots fired ${s.shotsFired}`,
        'Ray is proud of you. Solmar Bay is yours.',
      ];
      drawPanel('STORY COMPLETE', lines, 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
