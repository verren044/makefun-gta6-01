// The story: eight missions, $5,500 in all. Two shapes are generalised so the
// later missions reuse the same code as the early ones:
//  heat    — reach N stars, then lose them all (missions 3 and 7)
//  collect — pick up N bags or crates, then deliver them (missions 4, 6, 8)
// Pickups are armed when their mission starts and nowhere else.
import { MISSION_DEFS, GOAL_MONEY } from './config.js';
import { wantedStars } from './police.js';

export const ARRIVE_RADIUS = 70;
export const PICKUP_RADIUS = 34;

export function createMissions() {
  const missions = {
    index: 0,
    /** 'go' | 'gain' | 'lose' | 'collect' | 'deliver' */
    phase: 'go',
    collected: 0,
    pickups: [],
    completed: [],
    bannerT: 0,
    bannerText: '',
    storyDone: false,
  };
  armMission(missions, 0);
  return missions;
}

export function currentDef(missions) {
  return MISSION_DEFS[missions.index];
}

/** Arm a mission: set its phase and spawn its pickups. */
export function armMission(missions, index) {
  const def = MISSION_DEFS[index];
  if (!def) {
    missions.storyDone = true;
    return;
  }
  missions.index = index;
  missions.collected = 0;
  missions.pickups = [];
  if (def.type === 'heat') {
    missions.phase = 'gain';
  } else if (def.type === 'collect') {
    missions.phase = 'collect';
    missions.pickups = def.spots.map((s) => ({ x: s.x, y: s.y, kind: def.pickupKind, taken: false }));
  } else {
    missions.phase = 'go';
  }
}

/** The current objective for the HUD and the autopilot. (px, py) is the
 *  player's position, in the car when driving. */
export function missionObjective(missions, police, px, py) {
  const def = currentDef(missions);
  if (!def) return { kind: 'done', x: 0, y: 0, text: 'Story complete' };
  if (def.type === 'goto') {
    return { kind: 'goto', x: def.target.x, y: def.target.y, text: def.blurb, requireCar: def.requireCar };
  }
  if (def.type === 'goto2') {
    if (missions.phase === 'go') {
      return { kind: 'goto', x: def.target.x, y: def.target.y, text: def.blurb, requireCar: def.requireCar, leg: 1, legs: 2 };
    }
    return { kind: 'goto', x: def.target2.x, y: def.target2.y, text: def.blurb, requireCar: def.requireCar, leg: 2, legs: 2 };
  }
  if (def.type === 'heat') {
    if (missions.phase === 'gain') {
      return { kind: 'heat-gain', x: 0, y: 0, text: `Reach ${def.heat} stars of heat`, heat: def.heat };
    }
    return { kind: 'heat-lose', x: 0, y: 0, text: 'Lose the heat — stay clean and far from cops', heat: def.heat };
  }
  // collect
  if (missions.phase === 'collect') {
    let nearest = null;
    let bestD = Infinity;
    for (const p of missions.pickups) {
      if (p.taken) continue;
      const d = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (d < bestD) { bestD = d; nearest = p; }
    }
    if (nearest) {
      return { kind: 'collect', x: nearest.x, y: nearest.y, text: def.blurb, count: missions.collected, total: def.pickups };
    }
    missions.phase = 'deliver';
  }
  return { kind: 'deliver', x: def.deliver.x, y: def.deliver.y, text: 'Deliver them to the drop-off', count: missions.collected, total: def.pickups };
}

/** One line for the HUD: "MISSION 3/8 — Three-Star Heat (0/3★)". */
export function missionHudLine(missions, police) {
  const def = currentDef(missions);
  if (!def) return `STORY COMPLETE — $${GOAL_MONEY} / $${GOAL_MONEY}`;
  const stars = wantedStars(police);
  if (def.type === 'heat') {
    if (missions.phase === 'gain') return `MISSION ${def.id}/8 — ${def.name} (${stars}/${def.heat}★)`;
    return `MISSION ${def.id}/8 — ${def.name} (lose ${stars}★)`;
  }
  if (def.type === 'collect') {
    return `MISSION ${def.id}/8 — ${def.name} (${missions.collected}/${def.pickups})`;
  }
  if (def.type === 'goto2') {
    return `MISSION ${def.id}/8 — ${def.name} (${missions.phase === 'go' ? '1' : '2'}/2)`;
  }
  return `MISSION ${def.id}/8 — ${def.name}`;
}

/**
 * Advance the mission state. `world` carries player, police, money and stats.
 * Returns the completed mission def, or null.
 */
export function updateMissions(missions, world, dt) {
  if (missions.storyDone) return null;
  const def = currentDef(missions);
  const { player, police } = world;
  // The autopilot and the HUD read the player's position through these.
  missions._px = player.car ? player.car.x : player.x;
  missions._py = player.car ? player.car.y : player.y;
  const px = missions._px;
  const py = missions._py;

  if (def.type === 'goto') {
    const d = Math.hypot(def.target.x - px, def.target.y - py);
    if (d < ARRIVE_RADIUS && (!def.requireCar || player.car)) return completeMission(missions, world, def);
  } else if (def.type === 'goto2') {
    const target = missions.phase === 'go' ? def.target : def.target2;
    const d = Math.hypot(target.x - px, target.y - py);
    if (d < ARRIVE_RADIUS && (!def.requireCar || player.car)) {
      if (missions.phase === 'go') {
        missions.phase = 'go2';
        missions.bannerT = 2;
        missions.bannerText = 'Leg 2 — head to the next stop';
      } else {
        return completeMission(missions, world, def);
      }
    }
  } else if (def.type === 'heat') {
    const stars = wantedStars(police);
    if (missions.phase === 'gain' && stars >= def.heat) {
      missions.phase = 'lose';
      missions.bannerT = 2.5;
      missions.bannerText = `${def.heat} stars! Now lose them all`;
    } else if (missions.phase === 'lose' && stars === 0) {
      return completeMission(missions, world, def);
    }
  } else if (def.type === 'collect') {
    if (missions.phase === 'collect') {
      for (const p of missions.pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - px, p.y - py) < PICKUP_RADIUS) {
          p.taken = true;
          missions.collected += 1;
          world.stats.pickups += 1;
          world.events |= 8; // EVENT_PICKUP
          if (missions.collected >= def.pickups) missions.phase = 'deliver';
          break;
        }
      }
    } else {
      const d = Math.hypot(def.deliver.x - px, def.deliver.y - py);
      if (d < ARRIVE_RADIUS) return completeMission(missions, world, def);
    }
  }
  if (missions.bannerT > 0) missions.bannerT -= dt;
  return null;
}

function completeMission(missions, world, def) {
  world.money += def.reward;
  world.stats.missionsDone += 1;
  missions.completed.push(def.id);
  missions.bannerT = 3;
  missions.bannerText = `Mission complete — ${def.name} +$${def.reward}`;
  world.events |= 1; // EVENT_MISSION
  const next = missions.index + 1;
  if (next >= MISSION_DEFS.length) {
    missions.storyDone = true;
    world.events |= 32; // EVENT_STORY_DONE
  } else {
    armMission(missions, next);
  }
  return def;
}
