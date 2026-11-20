// Solmar Bay — shooting, health, damage. No DOM.
import { CONFIG } from './config.js';

export function shoot(player, bullets) {
  if (!player.alive || player.shootCooldown > 0) return null;
  player.shootCooldown = CONFIG.SHOOT_COOLDOWN;
  const b = {
    x: player.x + Math.cos(player.angle) * 22,
    y: player.y + Math.sin(player.angle) * 22,
    dx: Math.cos(player.angle),
    dy: Math.sin(player.angle),
    speed: CONFIG.BULLET_SPEED,
    life: CONFIG.BULLET_LIFE,
    dead: false,
  };
  bullets.push(b);
  return b;
}

// Aim a shot from the player straight at a target point (used by autopilot/shots).
export function shootAt(player, bullets, tx, ty) {
  if (!player.alive || player.shootCooldown > 0) return null;
  player.angle = Math.atan2(ty - player.y, tx - player.x);
  return shoot(player, bullets);
}

export function updateBullets(bullets, targets, dt) {
  let hits = 0;
  for (const b of bullets) {
    if (b.dead) continue;
    b.x += b.dx * b.speed * dt;
    b.y += b.dy * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > CONFIG.CITY_W || b.y < 0 || b.y > CONFIG.CITY_H) {
      b.dead = true;
      continue;
    }
    for (const t of targets) {
      if (!t || t.health <= 0) continue;
      if (Math.hypot(t.x - b.x, t.y - b.y) < 26) {
        t.health -= CONFIG.BULLET_DAMAGE;
        b.dead = true;
        hits += 1;
        break;
      }
    }
  }
  for (let i = bullets.length - 1; i >= 0; i--) {
    if (bullets[i].dead) bullets.splice(i, 1);
  }
  return hits;
}

export function damageTarget(target, dmg) {
  target.health -= dmg;
  return target.health;
}
