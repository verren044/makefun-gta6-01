// Solmar Bay — the 8-mission story, $5,500 total. No DOM.
import { CONFIG } from './config.js';

export const MISSIONS = [
  { name: 'First Wheels', payout: 300, kind: 'enter_car', desc: 'Get in a car. Any car on the street will do — press E next to one.' },
  { name: 'Harbor Pickup', payout: 400, kind: 'reach', desc: 'Drive to the pickup point in Old Harbor.' },
  { name: 'Bay Delivery', payout: 500, kind: 'reach_timed', time: 120, desc: 'Deliver the package to Marina Del Sol before the timer runs out.' },
  { name: 'Tail the Courier', payout: 600, kind: 'chase', desc: 'Catch up with the courier crossing town. Get within reach of his car.' },
  { name: 'Ember Escape', payout: 700, kind: 'escape', desc: 'The cops are on you. Lose the heat and reach the Northgate Hills safehouse.' },
  { name: 'Casino Setup', payout: 800, kind: 'shootout', desc: 'Clear the three guards outside the Ember Casino, then reach the side door.' },
  { name: 'Porto Payday', payout: 1000, kind: 'multi', desc: 'Two drops: Porto Verde first, then Marina Del Sol.' },
  { name: 'The Ember Score', payout: 1200, kind: 'finale', desc: 'Hit the Ember Casino vault. Walk in, take the score, walk out rich.' },
];

export function totalPayout() {
  return MISSIONS.reduce((s, m) => s + m.payout, 0);
}

export function createMissionState(world) {
  const state = {
    index: 0,
    completed: [],
    money: 0,
    started: false,
    stage: 0,
    timer: 0,
    target: { x: 0, y: 0 },
    chase: { x: 0, y: 0, tx: 0, ty: 0 },
    enemies: [],
    done: false,
    justCompleted: null,
  };
  return state;
}

function missionTarget(i, world) {
  switch (i) {
    case 1: return { x: 900, y: 1960 }; // Old Harbor
    case 2: return { x: 570, y: 560 }; // Marina Del Sol
    case 4: return { x: 2700, y: 1960 }; // Northgate Hills safehouse
    case 5: return { x: world.casino.x + 40, y: world.casino.y + 40 }; // Casino side door
    case 6: return { x: 1710, y: 560 }; // Porto Verde first drop
    case 7: return { x: world.casino.x, y: world.casino.y }; // Casino vault
    default: return { x: world.playerSpawn.x, y: world.playerSpawn.y };
  }
}

export function startMission(mission, world, police) {
  const i = mission.index;
  const def = MISSIONS[i];
  if (!def) return;
  mission.started = true;
  mission.stage = 0;
  mission.enemies = [];
  mission.justCompleted = null;
  if (def.kind === 'reach_timed') mission.timer = def.time;
  if (def.kind === 'chase') {
    mission.chase = { x: 1500, y: 700, tx: 3000, ty: 2000 };
    mission.target = { x: 1500, y: 700 };
  } else if (def.kind === 'multi') {
    mission.target = { x: 1710, y: 560 };
  } else {
    mission.target = missionTarget(i, world);
  }
  if (def.kind === 'shootout') {
    const c = world.casino;
    mission.enemies = [
      { x: c.x - 160, y: c.y - 60, health: 100 },
      { x: c.x + 160, y: c.y - 40, health: 100 },
      { x: c.x, y: c.y + 170, health: 100 },
    ];
  }
  if (def.kind === 'escape' && police) {
    police.wanted = Math.max(police.wanted, 2);
  }
}

// Where the HUD marker points right now. Needs the full game state for enter_car.
export function currentObjective(state) {
  const m = state.mission;
  if (m.done || m.index >= MISSIONS.length) return null;
  const def = MISSIONS[m.index];
  if (def.kind === 'enter_car') {
    let best = null;
    let bestD = Infinity;
    for (const c of state.cars) {
      const d = Math.hypot(c.x - state.player.x, c.y - state.player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { x: best.x, y: best.y, radius: 70, label: def.name } : null;
  }
  if (def.kind === 'chase') return { x: m.chase.x, y: m.chase.y, radius: 90, label: def.name };
  if (def.kind === 'shootout') {
    const alive = m.enemies.filter((e) => e.health > 0);
    if (alive.length > 0) return { x: alive[0].x, y: alive[0].y, radius: 60, label: def.name + ' — clear the guards' };
    return { x: m.target.x, y: m.target.y, radius: 70, label: def.name };
  }
  if (def.kind === 'multi') {
    const t = m.stage === 0 ? { x: 1710, y: 560 } : { x: 570, y: 560 };
    return { x: t.x, y: t.y, radius: 70, label: def.name + (m.stage === 0 ? ' — drop 1 of 2' : ' — drop 2 of 2') };
  }
  return { x: m.target.x, y: m.target.y, radius: 70, label: def.name };
}

function completeMission(state, player) {
  const def = MISSIONS[state.mission.index];
  player.money += def.payout;
  state.mission.money += def.payout;
  state.mission.completed.push(def.name);
  state.mission.justCompleted = def.name;
  state.mission.index += 1;
  state.mission.started = false;
  if (state.mission.index >= MISSIONS.length) state.mission.done = true;
}

export function updateMission(state, dt) {
  const m = state.mission;
  if (m.done) return null;
  const def = MISSIONS[m.index];
  if (!def) return null;
  if (!m.started) startMission(m, state.world, state.police);
  const player = state.player;

  if (def.kind === 'enter_car') {
    if (player.inCar) {
      completeMission(state, player);
      return def.name;
    }
    return null;
  }

  if (def.kind === 'chase') {
    // Courier drives toward his destination at 150 u/s.
    const dx = m.chase.tx - m.chase.x;
    const dy = m.chase.ty - m.chase.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = Math.min(150 * dt, dist);
    m.chase.x += (dx / dist) * step;
    m.chase.y += (dy / dist) * step;
    if (Math.hypot(player.x - m.chase.x, player.y - m.chase.y) < 90) {
      completeMission(state, player);
      return def.name;
    }
    return null;
  }

  if (def.kind === 'shootout') {
    const alive = m.enemies.filter((e) => e.health > 0);
    if (alive.length === 0) {
      if (Math.hypot(player.x - m.target.x, player.y - m.target.y) < 80) {
        completeMission(state, player);
        return def.name;
      }
    }
    return null;
  }

  if (def.kind === 'multi') {
    const t = m.stage === 0 ? { x: 1710, y: 560 } : { x: 570, y: 560 };
    if (Math.hypot(player.x - t.x, player.y - t.y) < 70) {
      if (m.stage === 0) {
        m.stage = 1;
        return 'drop1';
      }
      completeMission(state, player);
      return def.name;
    }
    return null;
  }

  if (def.kind === 'reach_timed') {
    m.timer -= dt;
    if (m.timer <= 0) {
      // Out of time: restart the run, keep the mission.
      m.started = false;
      return 'timeout';
    }
  }

  // reach / reach_timed / escape / finale: touch the marker.
  if (Math.hypot(player.x - m.target.x, player.y - m.target.y) < 70) {
    completeMission(state, player);
    return def.name;
  }
  return null;
}
