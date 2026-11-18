// Missions and the story: Marco Solis owes $2,000 to buy back his brother's garage
// from the fixer Lena Cruz. Four jobs pay it off — Borrowed Wheels, The Pickup,
// Heat Wave, The Big Score — and the last one ends the story. The cash bags of
// mission 4 are armed the moment mission 4 starts, never before and never late:
// arming lives in startMission and is re-checked every step, so the bags can never
// sit unarmed after mission 3.

import { MISSION_DEFS, STORY_GOAL } from './config.js';
import { dist } from './random.js';

export function createMissions(city) {
  return {
    index: 0,
    stage: 0,
    bags: city.bagSpots.map((s) => ({ x: s.x, y: s.y, taken: false, armed: false })),
    done: 0,
    storyComplete: false,
    target: null,
    targetLabel: '',
  };
}

/** The current objective: where to go and what the tracker should say. */
export function currentObjective(state) {
  const m = state.missions;
  const city = state.city;
  const def = MISSION_DEFS[m.index];
  if (!def || m.storyComplete) return { x: 0, y: 0, label: 'Story complete — Solmar Bay is yours.', stageText: '' };
  if (m.index === 0) {
    if (m.stage === 0) {
      const car = nearestStealable(state);
      return { x: car ? car.x : city.playerSpawn.x, y: car ? car.y : city.playerSpawn.y, label: 'Steal a car', stageText: def.stages[0] };
    }
    return { x: city.pierPoint.x, y: city.pierPoint.y, label: 'Marina Pier', stageText: def.stages[1] };
  }
  if (m.index === 1) {
    if (m.stage === 0) return { x: city.marketPoint.x, y: city.marketPoint.y, label: 'Harbor Market', stageText: def.stages[0] };
    return { x: city.mallPoint.x, y: city.mallPoint.y, label: 'Palm Court Mall', stageText: def.stages[1] };
  }
  if (m.index === 2) {
    if (m.stage === 0) return { x: state.player.x, y: state.player.y, label: 'Get to 3 stars', stageText: def.stages[0] };
    return { x: state.player.x, y: state.player.y, label: 'Lose the cops', stageText: def.stages[1] };
  }
  const bag = m.bags.find((b) => b.armed && !b.taken);
  if (m.stage === 0 && bag) return { x: bag.x, y: bag.y, label: 'Cash bag', stageText: `${def.stages[0]} (${m.bags.filter((b) => b.taken).length}/3)` };
  return { x: city.garagePoint.x, y: city.garagePoint.y, label: "Ray's Garage", stageText: def.stages[1] };
}

function nearestStealable(state) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Begin mission i: stage 0, and arm the cash bags when the Big Score starts. */
export function startMission(state, i) {
  const m = state.missions;
  m.index = i;
  m.stage = 0;
  state.maxWantedThisMission = 0;
  if (i === 3) armBags(state);
  state.events.push({ type: 'missionStart', index: i });
}

/** Arm every cash bag: called at mission 4 start and re-checked each step. */
export function armBags(state) {
  for (const bag of state.missions.bags) bag.armed = true;
}

function completeMission(state) {
  const m = state.missions;
  const def = MISSION_DEFS[m.index];
  state.cash += def.reward;
  m.done += 1;
  state.stats.missionsDone = m.done;
  state.events.push({ type: 'missionComplete', index: m.index, reward: def.reward });
  if (m.index >= MISSION_DEFS.length - 1 || state.cash >= STORY_GOAL && m.index >= 3) {
    m.storyComplete = true;
    state.events.push({ type: 'storyComplete' });
    return;
  }
  startMission(state, m.index + 1);
}

function near(state, x, y, radius) {
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  return dist(px, py, x, y) < radius;
}

/** Check the current mission's conditions; completing one pays out and starts the next. */
export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.storyComplete) return;
  if (m.index === 3) armBags(state);
  const city = state.city;
  const p = state.player;
  if (m.index === 0) {
    if (m.stage === 0 && p.inCar) {
      m.stage = 1;
      state.events.push({ type: 'stage', index: 0, stage: 1 });
    } else if (m.stage === 1 && p.inCar && near(state, city.pierPoint.x, city.pierPoint.y, 90)) {
      completeMission(state);
    }
    return;
  }
  if (m.index === 1) {
    if (m.stage === 0 && near(state, city.marketPoint.x, city.marketPoint.y, 90)) {
      m.stage = 1;
      state.events.push({ type: 'stage', index: 1, stage: 1 });
    } else if (m.stage === 1 && p.inCar && near(state, city.mallPoint.x, city.mallPoint.y, 100)) {
      completeMission(state);
    }
    return;
  }
  if (m.index === 2) {
    if (m.stage === 0 && state.wanted >= 3) {
      m.stage = 1;
      state.events.push({ type: 'stage', index: 2, stage: 1 });
    } else if (m.stage === 1 && state.wanted === 0) {
      completeMission(state);
    }
    return;
  }
  if (m.index === 3) {
    if (m.stage === 0) {
      for (const bag of m.bags) {
        if (bag.armed && !bag.taken && near(state, bag.x, bag.y, 52)) {
          bag.taken = true;
          state.events.push({ type: 'bag', x: bag.x, y: bag.y });
        }
      }
      if (m.bags.every((b) => b.taken)) {
        m.stage = 1;
        state.events.push({ type: 'stage', index: 3, stage: 1 });
      }
    } else if (near(state, city.garagePoint.x, city.garagePoint.y, 100)) {
      completeMission(state);
    }
  }
}
