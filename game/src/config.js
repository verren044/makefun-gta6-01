// Solmar Bay — every tuning number, colour, district and mission in one place.
// The world is a fixed 3600x2800 top-down city. The renderer scales a 1280x720
// camera view over it, so no rule below depends on the screen size.

export const STEP = 1 / 60;

export const WORLD = { width: 3600, height: 2800 };

/** Road half-width: the driveable corridor is 56 px across. */
export const ROAD_HALF = 28;

/** Vertical road centre-lines, west to east. 2360 is the boundary road; the seven
 *  past it (2480..3560) are the Ember Heights street grid, 2360 included making
 *  eight verticals. The first seven run the full height of the map. */
export const ROADS_X = [200, 560, 920, 1280, 1640, 2000, 2360, 2480, 2660, 2840, 3020, 3200, 3380, 3560];

/** Horizontal road centre-lines, north to south. The last six (1800..2640) are the
 *  Ember Heights street grid; the first five run the full width of the map. */
export const ROADS_Y = [200, 560, 920, 1280, 1640, 1800, 1900, 2100, 2280, 2460, 2640];

/** Ember Heights verticals span only y in [1800, 2800]; main verticals span all y. */
export const EMBER_X_MIN = 2360;
export const EMBER_Y_MIN = 1800;

/** Districts: name, bounds and the ground tint the renderer paints under the roads. */
export const DISTRICTS = [
  { name: 'DOWNTOWN', x0: 0, y0: 0, x1: 1400, y1: 1400, tint: '#2e3440' },
  { name: 'VICE HILLS', x0: 1400, y0: 0, x1: 3600, y1: 1800, tint: '#33382f' },
  { name: 'MARINA', x0: 0, y0: 1400, x1: 1400, y1: 2800, tint: '#2c3a44' },
  { name: 'SOUTHSIDE', x0: 1400, y0: 1800, x1: 2400, y1: 2800, tint: '#3a3230' },
  { name: 'EMBER HEIGHTS', x0: 2400, y0: 1800, x1: 3600, y1: 2800, tint: '#453029' },
];

export const PLAYER = {
  walkSpeed: 230,
  radius: 14,
  health: 100,
  /** Seconds of no damage before health starts coming back. */
  regenDelay: 6,
  regenRate: 5,
};

export const CAR = {
  /** Entering a car only works this close to it. */
  enterRadius: 46,
  /** A traffic car this slow counts as stopped, so it can be jacked. */
  jackSpeed: 40,
  health: 100,
  /** Car health regained per second after 4 s without a hit. */
  regenDelay: 4,
  regenRate: 2,
  /** Damage a cop ram does to the player's car. */
  ramDamage: 3,
};

/** Twelve drivable models. Ember GT is the fastest car in Solmar Bay. */
export const CAR_MODELS = [
  { name: 'Ember GT', top: 640, accel: 420, color: '#e5484d', w: 46, h: 24 },
  { name: 'Volcano Truck', top: 470, accel: 300, color: '#c2703d', w: 52, h: 26 },
  { name: 'Casino Limo', top: 500, accel: 320, color: '#d8b45a', w: 58, h: 24 },
  { name: 'Island Scooter', top: 300, accel: 380, color: '#4fc3f7', w: 30, h: 16 },
  { name: 'Solmar Coupe', top: 560, accel: 380, color: '#7c5cff', w: 46, h: 22 },
  { name: 'Vice Sedan', top: 460, accel: 300, color: '#8b93a3', w: 46, h: 22 },
  { name: 'Marina Cab', top: 440, accel: 310, color: '#f2c94c', w: 46, h: 22 },
  { name: 'Palm Pickup', top: 450, accel: 290, color: '#5da271', w: 50, h: 24 },
  { name: 'Neon Hatch', top: 520, accel: 360, color: '#ff7ad9', w: 42, h: 22 },
  { name: 'Dock Van', top: 420, accel: 270, color: '#c9ced6', w: 52, h: 26 },
  { name: 'Sunset Cruiser', top: 480, accel: 300, color: '#ff9f43', w: 48, h: 24 },
  { name: 'Bay Runner', top: 540, accel: 350, color: '#2dd4bf', w: 44, h: 22 },
];

export const TRAFFIC_COUNT = 22;
export const PED_COUNT = 40;
export const PARKED_COUNT = 18;
/** Twenty marked parking spots around the map; eighteen of them hold a car. */
export const PARKING_SPOTS = 20;

export const POLICE = {
  /** Cop car top speed: slower than every car except the scooter, so a fast
   *  getaway always works and a slow one does not. */
  carTop: 360,
  carAccel: 340,
  /** On-foot cops are slower than the player's walk, so fleeing on foot works. */
  footSpeed: 190,
  /** A cop this close, for this long, busts an on-foot player. */
  bustRadius: 26,
  bustTime: 1.0,
  /** A stopped player car with a cop car this close, for this long, is busted. */
  carBustRadius: 50,
  carBustTime: 1.5,
  /** Cops spawn this far from the player, on a road. */
  spawnDist: 520,
  /** Wanted decays one star per this many clean seconds (no cop within
   *  cleanRadius and no crime for crimeGrace seconds). */
  cleanRadius: 500,
  cleanSeconds: 5,
  crimeGrace: 4,
  maxStars: 5,
};

export const COMBAT = {
  /** Hitscan pistol: kills the nearest person inside range, any direction. */
  range: 300,
  cooldown: 0.35,
  /** Heat added per shot fired, per person killed, per cop killed, per carjack. */
  heatPerShot: 0.08,
  heatPerKill: 1.0,
  heatPerCopKill: 2.0,
  heatPerCarjack: 0.25,
};

export const GOAL_MONEY = 5500;

/**
 * The eight story missions. Types:
 *  goto    — reach a waypoint (requireCar: only counts while driving)
 *  goto2   — reach waypoint A, then waypoint B (requireCar)
 *  heat    — reach `heat` stars, then lose them all
 *  collect — pick up `pickups` items, then deliver them to `deliver`
 * Rewards sum to $5,500.
 */
export const MISSION_DEFS = [
  {
    id: 1, name: 'First Wheels', type: 'goto', reward: 250, requireCar: true,
    blurb: 'Steal a car and bring it to Ray\u2019s Garage.',
    target: { x: 1070, y: 1280 },
  },
  {
    id: 2, name: 'Ray\u2019s Package', type: 'goto2', reward: 500, requireCar: true,
    blurb: 'Pick up the package downtown, then bring it back to Ray.',
    target: { x: 2000, y: 920 }, target2: { x: 1070, y: 1280 },
  },
  {
    id: 3, name: 'Three-Star Heat', type: 'heat', reward: 500, heat: 3,
    blurb: 'Raise three stars of heat, then shake every cop.',
  },
  {
    id: 4, name: 'Cash Run', type: 'collect', reward: 1000, pickups: 2, pickupKind: 'cash',
    blurb: 'Grab the two cash bags, then deliver them to Marina Pier.',
    spots: [{ x: 560, y: 200 }, { x: 2000, y: 1640 }],
    deliver: { x: 180, y: 2320 },
  },
  {
    id: 5, name: 'Ember Run', type: 'goto2', reward: 500, requireCar: true,
    blurb: 'Drive to Ember Casino, then down Volcano road.',
    target: { x: 2750, y: 2100 }, target2: { x: 2560, y: 2100 },
  },
  {
    id: 6, name: 'Casino Chips', type: 'collect', reward: 750, pickups: 2, pickupKind: 'chips',
    blurb: 'Lift the two chip bags, then deliver them to Marina Pier.',
    spots: [{ x: 2560, y: 2280 }, { x: 3020, y: 2460 }],
    deliver: { x: 180, y: 2320 },
  },
  {
    id: 7, name: 'Four-Star Heat', type: 'heat', reward: 750, heat: 4,
    blurb: 'Raise four stars of heat, then shake every cop.',
  },
  {
    id: 8, name: 'The Ember Score', type: 'collect', reward: 1250, pickups: 4, pickupKind: 'ember',
    blurb: 'Take the four ember crates from across the map, then bring them to Ray.',
    spots: [
      { x: 2800, y: 2460 }, { x: 200, y: 200 },
      { x: 2000, y: 2400 }, { x: 920, y: 560 },
    ],
    deliver: { x: 1070, y: 1280 },
  },
];

/** Landmark rectangles (solid). The volcano and the casino sit in Ember Heights,
 *  near (2560, 2160); Ray's Garage is downtown, nowhere near them. Every
 *  landmark clears the road corridors around it: a garage or pier edge inside
 *  a corridor wedges cars on its corner and blocks the road. */
export const LANDMARKS = {
  garage: { x: 980, y: 1330, w: 180, h: 120, name: 'Ray\u2019s Garage' },
  pier: { x: 60, y: 2340, w: 110, h: 120, name: 'Marina Pier' },
  volcano: { x: 2515, y: 2135, w: 110, h: 110, name: 'Ember Volcano' },
  casino: { x: 2695, y: 2135, w: 110, h: 110, name: 'Ember Casino' },
};

/** The Ember Heights park: a green block with trees, no buildings. */
export const EMBER_PARK = { x: 3228, y: 2308, w: 124, h: 124 };
/** The downtown park. */
export const DOWNTOWN_PARK = { x: 588, y: 948, w: 240, h: 240 };

/** Decorative water along the west edge; the pier sits beside it. */
export const WATER = { x: 0, y: 1900, w: 60, h: 900 };

/** Where the save lives between visits (this browser only). Bumped to v2 for
 *  the round-3 stats: carjackings, pedsDown and shotsFired are stored now. */
export const SAVE_KEY = 'solmar-bay.save.v2';

export const PALETTE = {
  backdrop: '#10131a',
  road: '#232833',
  roadEdge: '#39404f',
  roadDash: '#c9a227',
  building: '#4a5060',
  buildingRoof: '#5d6577',
  park: '#2f5d3a',
  tree: '#3f7a4a',
  water: '#1d4e6b',
  volcano: '#6b3a24',
  lava: '#ff6a00',
  casino: '#8a6d1f',
  casinoSign: '#ffd94d',
  garage: '#7a4a2b',
  pier: '#8a6d4a',
  player: '#4fc3f7',
  playerCar: '#4fc3f7',
  ped: '#d8cdb4',
  cop: '#2b6cb0',
  copCar: '#1f2937',
  pickupCash: '#37d67a',
  pickupChips: '#ffd94d',
  pickupEmber: '#ff6a00',
  marker: '#ffd94d',
  text: '#eef1f5',
  muted: '#9aa3b2',
  danger: '#e5534b',
  panel: 'rgba(20, 24, 34, 0.94)',
  star: '#ffd94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
