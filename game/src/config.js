// Solmar Bay — constants. Plain JS, no DOM.
export const CONFIG = {
  CITY_W: 3600,
  CITY_H: 2800,
  SEED: 1,
  ROAD_WIDTH: 64,
  AVENUE_GAP_X: 300,
  AVENUE_GAP_Y: 280,
  DRIVABLE_CAR_COUNT: 12,
  TRAFFIC_COUNT: 22,
  PED_COUNT: 40,
  PLAYER_SPEED: 230,
  PLAYER_RADIUS: 14,
  BULLET_SPEED: 900,
  BULLET_DAMAGE: 34,
  BULLET_LIFE: 1.5,
  SHOOT_COOLDOWN: 0.25,
  MAX_WANTED: 5,
  WANTED_DECAY_SECONDS: 8,
  COP_CAR_SPEED: 430,
  FOOT_COP_SPEED: 185,
  ENTER_CAR_RADIUS: 70,
  MISSION_PAYOUTS: [300, 400, 500, 600, 700, 800, 1000, 1200],
  TOTAL_PAYOUT: 5500,
  SAVE_VERSION: 2,
};

export const DISTRICT_NAMES = [
  'Ember Heights',
  'Marina Del Sol',
  'Porto Verde',
  'Old Harbor',
  'Northgate Hills',
];

export function clampToCity(x, y) {
  return {
    x: Math.max(20, Math.min(CONFIG.CITY_W - 20, x)),
    y: Math.max(20, Math.min(CONFIG.CITY_H - 20, y)),
  };
}
