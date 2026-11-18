// A small seeded random number generator (mulberry32): the same seed gives the same
// city, traffic and pedestrians, which is what makes the game deterministic — the
// screenshot scenes repeatable and the story simulation provable. Never use Math.random
// in game code; every random draw goes through a generator created from the seed.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max]. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of a non-empty array, uniformly. */
export function randPick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Wrap an angle into (-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Euclidean distance between two points. */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
