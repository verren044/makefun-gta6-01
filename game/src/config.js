// Solmar Bay — every tuning number, colour, district and car model in one place.
// The city is a fixed 3200x2400 world; the renderer scales the camera to the window,
// so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Seven north-south roads and five east-west roads; every crossing is a routing node. */
export const ROADS_X = [320, 680, 1040, 1400, 1760, 2120, 2480];
export const ROADS_Y = [300, 660, 1020, 1380, 1740];
export const ROAD_W = 96;

/** The sea fills the west strip; the beach runs along its edge. */
export const SEA_X = 170;
export const BEACH_X = 230;

/** Where a saved game is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar-bay.save.v1';

export const PLAYER_CONF = {
  radius: 14,
  walkSpeed: 215,
  runSpeed: 330,
  health: 100,
  punchRange: 46,
  punchArc: 1.1,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR_CONF = {
  length: 46,
  width: 22,
  radius: 17,
  maxHealth: 100,
  wreckRespawnSeconds: 6,
};

export const BULLET = { speed: 900, range: 520, damage: 34, cooldown: 0.22, radius: 4 };

export const WANTED = {
  maxStars: 5,
  decaySeconds: 10,
  copsForStars: [0, 1, 2, 3, 4, 4],
  ramDamage: 4,
  ramCooldownSeconds: 2,
  arrestSeconds: 1.4,
  arrestRange: 52,
};

export const TRAFFIC_COUNT = 16;
export const PED_COUNT = 26;
export const PARKED_COUNT = 14;

/** Eight original car models: name, paint, top speed, acceleration and handling. */
export const CAR_MODELS = [
  { name: 'Coral Coupe', color: '#e2574c', topSpeed: 520, accel: 300, handling: 2.9 },
  { name: 'Bay Sedan', color: '#4f7ec2', topSpeed: 460, accel: 260, handling: 2.6 },
  { name: 'Palm Pickup', color: '#c98a2e', topSpeed: 430, accel: 240, handling: 2.3 },
  { name: 'Marina Hatch', color: '#3fae8a', topSpeed: 480, accel: 280, handling: 3.0 },
  { name: 'Solmar Sport', color: '#f2c94c', topSpeed: 580, accel: 340, handling: 3.2 },
  { name: 'Harbor Van', color: '#8b93a3', topSpeed: 400, accel: 210, handling: 2.0 },
  { name: 'Sunset Taxi', color: '#e8b93c', topSpeed: 470, accel: 270, handling: 2.7 },
  { name: 'Dune Buggy', color: '#7fb069', topSpeed: 500, accel: 290, handling: 3.1 },
];

export const COP_MODEL = { name: 'Bay Patrol', color: '#22262e', topSpeed: 540, accel: 320, handling: 3.0 };

/** The eight named landmarks, fixed so missions and the map always agree. Each one
 * sits clear of the road corridors, so no landmark ever blocks a crossing. */
export const LANDMARKS = [
  { name: 'Solmar Tower', x: 1470, y: 730, w: 150, h: 110, color: '#5b7fa6' },
  { name: 'Marina Pier', x: 120, y: 1020, w: 130, h: 60, color: '#8a6d4b' },
  { name: 'Palm Court Mall', x: 1830, y: 360, w: 190, h: 120, color: '#b06a8a' },
  { name: 'Harbor Market', x: 750, y: 1450, w: 170, h: 110, color: '#4f8a6d' },
  { name: "Ray's Garage", x: 2550, y: 1800, w: 150, h: 100, color: '#a67c3d' },
  { name: 'Solmar Stadium', x: 2190, y: 1090, w: 220, h: 150, color: '#6d7fb0' },
  { name: 'Coral Park', x: 1040, y: 1740, w: 200, h: 130, color: '#4f8a4f' },
  { name: 'Sunset Beach', x: 120, y: 1740, w: 150, h: 120, color: '#d9b380' },
];

export const MISSION_DEFS = [
  {
    id: 1,
    title: 'Borrowed Wheels',
    briefing: 'Steal a car and drive it to Marina Pier. Lena is waiting.',
    reward: 250,
    stages: ['Steal a car', 'Drive to Marina Pier'],
  },
  {
    id: 2,
    title: 'The Pickup',
    briefing: 'Collect the package at Harbor Market, then deliver it to Palm Court Mall.',
    reward: 400,
    stages: ['Go to Harbor Market', 'Deliver to Palm Court Mall'],
  },
  {
    id: 3,
    title: 'Heat Wave',
    briefing: 'The cops are watching. Get to 3 stars, then lose them all.',
    reward: 600,
    stages: ['Raise your wanted level to 3 stars', 'Lose the cops — get back to 0 stars'],
  },
  {
    id: 4,
    title: 'The Big Score',
    briefing: 'Three cash bags are stashed around Solmar Bay. Grab them all and bring them to Ray\'s Garage.',
    reward: 1000,
    stages: ['Collect the 3 cash bags', 'Deliver the bags to Ray\'s Garage'],
  },
];

export const STORY_GOAL = 2000;

export const PALETTE = {
  sea: '#2e6f8e',
  seaDeep: '#25607e',
  beach: '#d9b380',
  grass: '#5d8a4a',
  grassDark: '#527d42',
  park: '#4f8a4f',
  sidewalk: '#9aa0a8',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#d8c95a',
  building: '#7d7468',
  roof: '#5d564c',
  roofAlt: '#6d5a4a',
  downtown: '#8a7f70',
  text: '#f2f4f7',
  muted: '#b9c0cb',
  panel: 'rgba(12, 18, 30, 0.82)',
  panelBorder: 'rgba(255,255,255,0.18)',
  health: '#58d68d',
  healthLow: '#e5534b',
  cash: '#f2c94c',
  star: '#f2c94c',
  starEmpty: '#5a6270',
  player: '#f2f4f7',
  ped: '#e8a34c',
  bullet: '#ffe08a',
  marker: '#ff5a4e',
  cop: '#3a6fd8',
  sirenRed: '#ff3b30',
  sirenBlue: '#3a6fd8',
  toast: '#ffd166',
  banner: '#ffd166',
  title: '#ffd166',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
