// The renderer: a sun-soaked top-down Solmar Bay — sea and beach on the west,
// districts in their own ground tints, roads with lane dashes, roofs, trees, parks
// and named landmarks — then the cars, the crowd, Marco, the bullets and the
// particles, and over it all the HUD: health, cash, wanted stars, the mission
// tracker, a live minimap, speed and car health, toasts, banners and the red edge
// flash when the heat is on. Title, pause and game-over screens included.

import { CAR_CONF, FONT, MISSION_DEFS, PALETTE, ROADS_X, ROADS_Y, ROAD_W, SEA_X, BEACH_X, STORY_GOAL, WORLD } from './config.js';
import { clamp, dist } from './random.js';
import { districtAt } from './city.js';
import { currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const VIEW_W = 1280;
const VIEW_H = 720;
const MINI_W = 232;
const MINI_H = 174;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let camX = 0;
  let camY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(VIEW_W * dpr);
    canvas.height = Math.round(VIEW_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function groundColor(x, y) {
    if (x < SEA_X) return PALETTE.sea;
    if (x < BEACH_X) return PALETTE.beach;
    const d = districtAt(x, y);
    if (d === 'Downtown') return '#6d7a52';
    if (d === 'Old Town') return '#7a6a52';
    if (d === 'Suburbs') return '#66804f';
    if (d === 'Industrial') return '#6f6a5e';
    if (d === 'Palm Court') return '#77854f';
    return PALETTE.grass;
  }

  function drawCity(state) {
    const x0 = Math.max(0, camX - 60);
    const y0 = Math.max(0, camY - 60);
    const x1 = Math.min(WORLD.width, camX + VIEW_W + 60);
    const y1 = Math.min(WORLD.height, camY + VIEW_H + 60);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    const step = 160;
    for (let gx = Math.floor(x0 / step) * step; gx < x1; gx += step) {
      for (let gy = Math.floor(y0 / step) * step; gy < y1; gy += step) {
        ctx.fillStyle = groundColor(gx + step / 2, gy + step / 2);
        ctx.fillRect(gx, gy, step + 1, step + 1);
      }
    }
    ctx.fillStyle = PALETTE.beach;
    ctx.fillRect(SEA_X, y0, BEACH_X - SEA_X, y1 - y0);
    for (const park of state.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const ry of ROADS_Y) {
      if (ry < y0 - ROAD_W || ry > y1 + ROAD_W) continue;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(Math.max(x0, BEACH_X), ry - ROAD_W / 2, x1 - Math.max(x0, BEACH_X), ROAD_W);
      ctx.fillStyle = PALETTE.lane;
      for (let lx = Math.floor(Math.max(x0, BEACH_X) / 64) * 64; lx < x1; lx += 64) {
        ctx.fillRect(lx, ry - 2, 30, 4);
      }
    }
    for (const rx of ROADS_X) {
      if (rx < x0 - ROAD_W || rx > x1 + ROAD_W) continue;
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(rx - ROAD_W / 2, Math.max(y0, 0), ROAD_W, y1 - Math.max(y0, 0));
      ctx.fillStyle = PALETTE.lane;
      for (let ly = Math.floor(y0 / 64) * 64; ly < y1; ly += 64) {
        ctx.fillRect(rx - 2, ly, 4, 30);
      }
    }
    for (const tree of state.city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.fillStyle = '#3d6b2f';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5d9a44';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 2, tree.r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.downtown ? '#8a7f70' : '#7d7468';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, 5);
    }
    for (const lm of state.city.landmarks) {
      if (lm.x > x1 || lm.x + lm.w < x0 || lm.y > y1 || lm.y + lm.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(lm.x + 5, lm.y + 7, lm.w, lm.h);
      ctx.fillStyle = lm.color;
      ctx.fillRect(lm.x, lm.y, lm.w, lm.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(lm.x + 4, lm.y + 4, lm.w - 8, lm.h - 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, lm.x + lm.w / 2, lm.y + lm.h / 2 + 5);
    }
  }

  function drawCarShape(car, isCop) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR_CONF.length / 2 + 3, -CAR_CONF.width / 2 + 4, CAR_CONF.length, CAR_CONF.width);
    ctx.fillStyle = isCop ? '#1d2126' : car.model.color;
    ctx.beginPath();
    ctx.roundRect(-CAR_CONF.length / 2, -CAR_CONF.width / 2, CAR_CONF.length, CAR_CONF.width, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(2, -CAR_CONF.width / 2 + 4, 12, CAR_CONF.width - 8);
    ctx.fillRect(-14, -CAR_CONF.width / 2 + 4, 9, CAR_CONF.width - 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR_CONF.length / 2 - 3, -CAR_CONF.width / 2 + 2, 3, 5);
    ctx.fillRect(CAR_CONF.length / 2 - 3, CAR_CONF.width / 2 - 7, 3, 5);
    if (isCop) {
      ctx.fillStyle = '#e8ecf2';
      ctx.fillRect(-8, -CAR_CONF.width / 2, 16, CAR_CONF.width);
      ctx.fillStyle = '#22262e';
      ctx.font = 'bold 8px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    if (car.wrecked) {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -10);
      ctx.lineTo(10, 10);
      ctx.moveTo(10, -10);
      ctx.lineTo(-14, 10);
      ctx.stroke();
    }
    ctx.restore();
    if (car.health < CAR_CONF.maxHealth && !car.wrecked) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.x - 20, car.y - 26, 40, 5);
      ctx.fillStyle = car.health > 50 ? PALETTE.health : PALETTE.healthLow;
      ctx.fillRect(car.x - 20, car.y - 26, 40 * (car.health / CAR_CONF.maxHealth), 5);
    }
  }

  function drawMarker(x, y, label, pulse) {
    const r = 16 + Math.sin(pulse * 5) * 4;
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - r - 8);
  }

  function drawMinimap(state, obj) {
    const mx = VIEW_W - MINI_W - 14;
    const my = 14;
    const sx = MINI_W / WORLD.width;
    const sy = MINI_H / WORLD.height;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(mx - 6, my - 6, MINI_W + 12, MINI_H + 12);
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.strokeRect(mx - 6, my - 6, MINI_W + 12, MINI_H + 12);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mx, my, MINI_W, MINI_H);
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx + SEA_X * sx, my, MINI_W - SEA_X * sx, MINI_H);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(mx + (rx - ROAD_W / 2) * sx, my, ROAD_W * sx, MINI_H);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + (ry - ROAD_W / 2) * sy, MINI_W, ROAD_W * sy);
    ctx.fillStyle = '#8a7f70';
    for (const b of state.city.buildings) ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    ctx.fillStyle = '#f2c94c';
    for (const lm of state.city.landmarks) ctx.fillRect(mx + lm.x * sx, my + lm.y * sy, 4, 4);
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx + car.x * sx - 1.5, my + car.y * sy - 1.5, 3, 3);
    }
    const flash = Math.sin(state.time * 10) > 0;
    for (const cop of state.cops) {
      ctx.fillStyle = flash ? PALETTE.sirenRed : PALETTE.sirenBlue;
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (obj && !state.missions.storyComplete) {
      const pulse = 3 + Math.sin(state.time * 5) * 1.5;
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(mx + obj.x * sx, my + obj.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx + px * sx, my + py * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', mx, my + MINI_H + 20);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.panelBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }

  function drawHUD(state, ui) {
    const p = state.player;
    panel(14, 14, 360, 96);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('MARCO SOLIS', 26, 38);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(26, 48, 180, 10);
    ctx.fillStyle = p.health > 40 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(26, 48, 180 * (p.health / 100), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`HP ${Math.ceil(p.health)}`, 212, 57);
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText(`$${state.cash}`, 26, 84);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`of $${STORY_GOAL}  •  ${state.stats.carsStolen} stolen  •  ${state.missions.done}/4 done`, 150, 84);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    ctx.font = '28px ' + FONT;
    ctx.fillStyle = state.wanted > 0 ? PALETTE.star : PALETTE.starEmpty;
    ctx.textAlign = 'right';
    ctx.fillText(stars, VIEW_W - 268, 52);
    ctx.textAlign = 'left';

    const obj = currentObjective(state);
    if (!state.missions.storyComplete) {
      const def = MISSION_DEFS[state.missions.index];
      panel(14, 122, 330, 66);
      ctx.fillStyle = PALETTE.toast;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText(`MISSION ${state.missions.index + 1}/4 — ${def.title}`, 26, 144);
      ctx.fillStyle = '#ffffff';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(obj.stageText, 26, 164);
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(`Reward $${def.reward}  •  ${districtAt(p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y)}`, 26, 180);
    } else {
      panel(14, 122, 330, 66);
      ctx.fillStyle = PALETTE.toast;
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText('STORY COMPLETE', 26, 144);
      ctx.fillStyle = '#ffffff';
      ctx.font = `13px ${FONT}`;
      ctx.fillText('The garage is Marco\'s again. Free roam!', 26, 164);
    }

    if (p.inCar) {
      panel(14, VIEW_H - 78, 240, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 24px ${FONT}`;
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)} mph`, 26, VIEW_H - 44);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `12px ${FONT}`;
      ctx.fillText(p.inCar.model.name, 26, VIEW_H - 26);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(150, VIEW_H - 56, 88, 9);
      ctx.fillStyle = p.inCar.health > 40 ? PALETTE.health : PALETTE.healthLow;
      ctx.fillRect(150, VIEW_H - 56, 88 * (p.inCar.health / 100), 9);
      ctx.fillStyle = '#ffffff';
      ctx.font = `11px ${FONT}`;
      ctx.fillText(`CAR ${Math.ceil(p.inCar.health)}`, 150, VIEW_H - 26);
    } else {
      panel(14, VIEW_H - 78, 300, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = `13px ${FONT}`;
      ctx.fillText('WASD move  •  Shift run  •  E steal car', 26, VIEW_H - 52);
      ctx.fillText('Space shoot  •  F punch  •  P pause  •  G save', 26, VIEW_H - 30);
    }

    drawMinimap(state, obj);

    let ty = 210;
    for (const t of state.toasts) {
      ctx.globalAlpha = Math.min(1, t.t);
      ctx.fillStyle = PALETTE.panel;
      ctx.fillRect(VIEW_W / 2 - 190, ty, 380, 30);
      ctx.fillStyle = PALETTE.toast;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, VIEW_W / 2, ty + 20);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
      ty += 36;
    }
    if (state.banner) {
      ctx.globalAlpha = Math.min(1, state.banner.t);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 250, VIEW_W, 84);
      ctx.fillStyle = PALETTE.banner;
      ctx.font = `bold 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(state.banner.text, VIEW_W / 2, 292);
      ctx.fillStyle = '#ffffff';
      ctx.font = `18px ${FONT}`;
      ctx.fillText(state.banner.sub, VIEW_W / 2, 320);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    if (state.wanted >= 3) {
      const a = 0.10 + 0.08 * Math.sin(state.time * 6);
      const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
      grad.addColorStop(0, 'rgba(255,40,30,0)');
      grad.addColorStop(1, `rgba(255,40,30,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    if (obj && !state.missions.storyComplete && state.missions.index !== 2) {
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      const d = dist(px, py, obj.x, obj.y);
      const sx = obj.x - camX;
      const sy = obj.y - camY;
      if (sx < 0 || sx > VIEW_W || sy < 0 || sy > VIEW_H) {
        const ang = Math.atan2(obj.y - py, obj.x - px);
        const ax = VIEW_W / 2 + Math.cos(ang) * 300;
        const ay = VIEW_H / 2 + Math.sin(ang) * 210;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = PALETTE.marker;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold 13px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`${obj.label} — ${Math.round(d)}m`, ax, ay + 30);
        ctx.textAlign = 'left';
      }
    }
    if (ui && ui.muted) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `13px ${FONT}`;
      ctx.fillText('MUTED (M)', VIEW_W - 120, VIEW_H - 20);
    }
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.title;
    ctx.font = `bold 74px ${FONT}`;
    ctx.fillText('SOLMAR BAY', VIEW_W / 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('An open-world crime story', VIEW_W / 2, 228);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Marco Solis owes $2,000 to buy back his brother\'s garage from fixer Lena Cruz.', VIEW_W / 2, 268);
    ctx.fillText('Steal cars. Run jobs. Lose the cops. Bring the money home.', VIEW_W / 2, 292);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('Press SPACE or click to start', VIEW_W / 2, 350);
    if (best && best.cash > 0) {
      ctx.fillStyle = PALETTE.cash;
      ctx.font = `16px ${FONT}`;
      ctx.fillText(`Saved game: $${best.cash}  •  ${best.missions} missions done — press C to continue`, VIEW_W / 2, 384);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('WASD move  •  Shift run  •  E steal / exit car  •  Space shoot  •  F punch', VIEW_W / 2, 440);
    ctx.fillText('P pause  •  G save  •  M mute  •  Mouse aims the pistol', VIEW_W / 2, 466);
    ctx.fillStyle = '#8b93a3';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('A wholly original city, story and cast. Nothing here comes from any other game.', VIEW_W / 2, 640);
    ctx.textAlign = 'left';
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 46px ${FONT}`;
    ctx.fillText('PAUSED', VIEW_W / 2, 330);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P or Space to keep playing  •  G save  •  M mute', VIEW_W / 2, 372);
    ctx.textAlign = 'left';
  }

  function drawOver(state, ui) {
    ctx.fillStyle = 'rgba(8, 12, 22, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    const title = state.over === 'busted' ? 'BUSTED' : state.over === 'wasted' ? 'WASTED' : 'THE BIG SCORE';
    ctx.fillStyle = state.over === 'story' ? PALETTE.title : '#e5534b';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText(title, VIEW_W / 2, 240);
    ctx.fillStyle = '#ffffff';
    ctx.font = `19px ${FONT}`;
    const line = state.over === 'busted'
      ? 'The Bay Patrol caught up with Marco.'
      : state.over === 'wasted'
        ? 'Marco went down in Solmar Bay.'
        : 'Marco bought the garage back. The story is complete — free roam, or play again.';
    ctx.fillText(line, VIEW_W / 2, 286);
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`$${state.cash} earned  •  ${state.stats.carsStolen} cars stolen  •  ${state.missions.done}/4 missions`, VIEW_W / 2, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `16px ${FONT}`;
    ctx.fillText(`Wanted peak: ${state.maxWantedThisMission} stars  •  Shots fired: ${state.stats.shotsFired}`, VIEW_W / 2, 366);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('Press SPACE or click to play again', VIEW_W / 2, 420);
    ctx.textAlign = 'left';
  }

  function draw(state, screen, ui) {
    const p = state.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    const shakeX = state.shake > 0 ? Math.sin(state.time * 127.3) * state.shake * 14 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 149.1) * state.shake * 14 : 0;
    camX = clamp(px - VIEW_W / 2 + shakeX, 0, Math.max(0, WORLD.width - VIEW_W));
    camY = clamp(py - VIEW_H / 2 + shakeY, 0, Math.max(0, WORLD.height - VIEW_H));
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-camX, -camY);
    drawCity(state);
    const obj = currentObjective(state);
    if (screen === SCREEN_PLAY && !state.missions.storyComplete && state.missions.index !== 2) {
      drawMarker(obj.x, obj.y, obj.label, state.time);
    }
    if (state.missions.index === 3) {
      for (const bag of state.missions.bags) {
        if (!bag.armed || bag.taken) continue;
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.arc(bag.x, bag.y, 12 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 12px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('$', bag.x, bag.y + 4);
        ctx.textAlign = 'left';
      }
    }
    for (const ped of state.peds) {
      if (!ped.alive) continue;
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 8, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob * 0.4, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2118';
      ctx.beginPath();
      ctx.arc(ped.x + (ped.faceX || 0) * 3, ped.y - 4 + bob * 0.4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) drawCarShape(car, false);
    for (const cop of state.cops) {
      drawCarShape(cop, true);
      const flash = Math.sin(state.time * 12) > 0;
      ctx.fillStyle = flash ? PALETTE.sirenRed : PALETTE.sirenBlue;
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 18, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of state.bullets) {
      ctx.fillStyle = PALETTE.bullet;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.max);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (!p.inCar) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 10, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.hurtTimer > 0 && Math.sin(state.time * 30) > 0 ? '#e5534b' : PALETTE.player;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22262e';
      ctx.beginPath();
      ctx.arc(p.x + p.faceX * 4, p.y - 3 + p.faceY * 4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHUD(state, ui);
    if (screen === SCREEN_TITLE) drawTitle(state, ui ? ui.best : null);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, ui);
  }

  return { draw, resize };
}
