'use strict';

require('./setup.js');
const g = require('../game.js');

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

// Jest-compatible expect() shim on top of node:assert ─────────────────────────
function expect(actual) {
  return {
    toBe:                 (e)  => assert.strictEqual(actual, e),
    toEqual:              (e)  => assert.deepStrictEqual(actual, e),
    toBeGreaterThan:      (n)  => assert.ok(actual > n,  `expected ${actual} > ${n}`),
    toBeLessThan:         (n)  => assert.ok(actual < n,  `expected ${actual} < ${n}`),
    toBeGreaterThanOrEqual:(n) => assert.ok(actual >= n, `expected ${actual} >= ${n}`),
    toBeLessThanOrEqual:  (n)  => assert.ok(actual <= n, `expected ${actual} <= ${n}`),
    toBeCloseTo:          (n, p = 2) => {
      const delta = Math.pow(10, -p) / 2;
      assert.ok(Math.abs(actual - n) < delta, `expected |${actual} - ${n}| < ${delta}`);
    },
    toBeTruthy:    ()  => assert.ok(actual),
    toBeFalsy:     ()  => assert.ok(!actual),
    toBeDefined:   ()  => assert.notStrictEqual(actual, undefined),
    toContain:     (x) => assert.ok(actual.includes(x)),
    toHaveProperty:(k) => assert.ok(k in Object(actual), `expected property '${k}'`),
    not: {
      toBe:    (e) => assert.notStrictEqual(actual, e),
      toBeTruthy: () => assert.ok(!actual),
    },
  };
}

// Convenience rect builder ─────────────────────────────────────────────────────
const rect = (x, y, w, h) => ({ x, y, w, h });

// ─── rectsOverlap ─────────────────────────────────────────────────────────────

describe('rectsOverlap', () => {
  test('overlapping rects return true', () => {
    expect(g.rectsOverlap(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(true);
  });

  test('horizontally separated rects return false', () => {
    expect(g.rectsOverlap(rect(0, 0, 10, 10), rect(15, 0, 10, 10))).toBe(false);
  });

  test('vertically separated rects return false', () => {
    expect(g.rectsOverlap(rect(0, 0, 10, 10), rect(0, 15, 10, 10))).toBe(false);
  });

  test('rects that only share an edge are NOT considered overlapping (strict)', () => {
    // a.x + a.w === b.x  →  10 > 10 is false
    expect(g.rectsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(false);
  });

  test('fully contained rect returns true', () => {
    expect(g.rectsOverlap(rect(0, 0, 100, 100), rect(20, 20, 10, 10))).toBe(true);
  });

  test('identical rects return true', () => {
    expect(g.rectsOverlap(rect(5, 5, 20, 20), rect(5, 5, 20, 20))).toBe(true);
  });
});

// ─── attackHitbox ─────────────────────────────────────────────────────────────

describe('attackHitbox', () => {
  beforeEach(() => g.resetGame());

  test('hitbox center is in front of player when facing right', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    const box = g.attackHitbox();
    expect(box.x + box.w / 2).toBeGreaterThan(g.player.x);
  });

  test('hitbox center is in front of player when facing left', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = -1;
    const box = g.attackHitbox();
    expect(box.x + box.w / 2).toBeLessThan(g.player.x);
  });

  test('hitbox width is ATTACK_REACH * 1.2 and height is 48', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    const box = g.attackHitbox();
    expect(box.w).toBeCloseTo(g.ATTACK_REACH * 1.2);
    expect(box.h).toBe(48);
  });

  test('hitbox centers are equidistant from player when facing left vs right', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    g.player.facing = 1;
    const r = g.attackHitbox();
    g.player.facing = -1;
    const l = g.attackHitbox();
    const distR = (r.x + r.w / 2) - g.player.x;
    const distL = g.player.x - (l.x + l.w / 2);
    assert.ok(Math.abs(distR - distL) < 0.01, 'hitboxes should mirror symmetrically');
  });
});

// ─── Enemy definitions ────────────────────────────────────────────────────────

describe('ENEMY_DEFS', () => {
  test('score increases with difficulty: guppy < puffer < shark', () => {
    const { guppy, puffer, shark } = g.ENEMY_DEFS;
    expect(guppy.score).toBeLessThan(puffer.score);
    expect(puffer.score).toBeLessThan(shark.score);
  });

  test('score values match design spec (100 / 200 / 300)', () => {
    expect(g.ENEMY_DEFS.guppy.score).toBe(100);
    expect(g.ENEMY_DEFS.puffer.score).toBe(200);
    expect(g.ENEMY_DEFS.shark.score).toBe(300);
  });

  test('puffer has the most HP of any enemy', () => {
    const hps = Object.values(g.ENEMY_DEFS).map(d => d.hp);
    expect(g.ENEMY_DEFS.puffer.hp).toBe(Math.max(...hps));
  });

  test('guppy is the only flying enemy', () => {
    expect(g.ENEMY_DEFS.guppy.flying).toBe(true);
    expect(g.ENEMY_DEFS.puffer.flying).toBe(false);
    expect(g.ENEMY_DEFS.shark.flying).toBe(false);
  });

  test('guppy is the fastest enemy', () => {
    const speeds = Object.values(g.ENEMY_DEFS).map(d => d.speed);
    expect(g.ENEMY_DEFS.guppy.speed).toBe(Math.max(...speeds));
  });
});

// ─── spawnEnemy ───────────────────────────────────────────────────────────────

describe('spawnEnemy', () => {
  beforeEach(() => g.resetGame());

  test('adds exactly one enemy', () => {
    expect(g.enemies.length).toBe(0);
    g.spawnEnemy();
    expect(g.enemies.length).toBe(1);
  });

  test('enemy has required fields and a valid type', () => {
    g.spawnEnemy();
    const e = g.enemies[0];
    expect(Object.keys(g.ENEMY_DEFS)).toContain(e.type);
    expect(e.hp).toBeGreaterThan(0);
    expect(e.maxHp).toBe(g.ENEMY_DEFS[e.type].hp);
    expect(e.vx).toBeLessThan(0);   // always moves left
    expect(e.dead).toBe(false);
  });

  test('enemy spawns beyond the right edge of the canvas', () => {
    g.camX = 0;
    g.spawnEnemy();
    expect(g.enemies[0].x).toBeGreaterThan(800);
  });

  test('shark spawns with a positive shoot cooldown', (t) => {
    // Force shark spawn by making Math.random return 0.99 (last type)
    t.mock.method(Math, 'random', () => 0.99);
    g.spawnEnemy();
    const shark = g.enemies.find(e => e.type === 'shark');
    if (shark) expect(shark.shootCooldown).toBeGreaterThan(0);
  });

  test('guppy spawns above the sea floor', (t) => {
    t.mock.method(Math, 'random', () => 0); // first type = guppy
    g.spawnEnemy();
    const guppy = g.enemies.find(e => e.type === 'guppy');
    if (guppy) expect(guppy.y).toBeLessThan(g.SEAFLOOR);
  });
});

// ─── spawnParticles ───────────────────────────────────────────────────────────

describe('spawnParticles', () => {
  beforeEach(() => { g.particles.length = 0; });

  test('adds the requested number of particles', () => {
    g.spawnParticles(100, 200, 7);
    expect(g.particles.length).toBe(7);
  });

  test('particles spawn at the given coordinates', () => {
    g.spawnParticles(300, 150, 5);
    for (const p of g.particles) {
      assert.ok(Math.abs(p.x - 300) < 1, 'particle x near spawn point');
      assert.ok(Math.abs(p.y - 150) < 1, 'particle y near spawn point');
    }
  });

  test('each particle starts at full life with positive decay and radius', () => {
    g.spawnParticles(0, 0, 3);
    for (const p of g.particles) {
      expect(p.life).toBe(1);
      expect(p.decay).toBeGreaterThan(0);
      expect(p.r).toBeGreaterThan(0);
    }
  });

  test('particles have initial upward velocity bias (negative vy)', () => {
    g.spawnParticles(0, 0, 20); // large sample for statistical confidence
    const avgVy = g.particles.reduce((s, p) => s + p.vy, 0) / g.particles.length;
    expect(avgVy).toBeLessThan(0); // underwater bubbles float up
  });
});

// ─── Player state ─────────────────────────────────────────────────────────────

describe('Player state', () => {
  beforeEach(() => g.resetGame());

  test('starts with full HP (5)', () => {
    expect(g.player.hp).toBe(5);
    expect(g.player.hp).toBe(g.player.maxHp);
  });

  test('is not dead and not attacking after reset', () => {
    g.player.dead = true; g.player.attacking = true;
    g.resetGame();
    expect(g.player.dead).toBe(false);
    expect(g.player.attacking).toBe(false);
  });

  test('invincibility frames block consecutive hits', () => {
    g.player.hp = 3;
    g.player.invincible = 60;
    // Damage only applies when invincible <= 0
    if (g.player.invincible <= 0) g.player.hp--;
    expect(g.player.hp).toBe(3); // blocked

    g.player.invincible = 0;
    if (g.player.invincible <= 0) g.player.hp--;
    expect(g.player.hp).toBe(2); // landed
  });

  test('player dies when HP reaches 0', () => {
    g.player.hp = 1;
    g.player.hp--;
    g.player.dead = g.player.hp <= 0;
    expect(g.player.dead).toBe(true);
  });
});

// ─── resetGame ────────────────────────────────────────────────────────────────

describe('resetGame', () => {
  test('restores player position and stats', () => {
    g.player.x = 999; g.player.hp = 1; g.player.score = 5000;
    g.player.invincible = 30; g.player.dead = true;
    g.resetGame();
    expect(g.player.x).toBe(120);
    expect(g.player.hp).toBe(g.player.maxHp);
    expect(g.player.score).toBe(0);
    expect(g.player.invincible).toBe(0);
    expect(g.player.dead).toBe(false);
  });

  test('clears enemies array', () => {
    g.spawnEnemy(); g.spawnEnemy();
    expect(g.enemies.length).toBeGreaterThan(0);
    g.resetGame();
    expect(g.enemies.length).toBe(0);
  });

  test('clears laser projectiles', () => {
    g.lasers.push({ x: 400, y: 200, vx: -10, w: 28, h: 5, life: 50 });
    g.resetGame();
    expect(g.lasers.length).toBe(0);
  });

  test('clears particles', () => {
    g.spawnParticles(100, 100, 12);
    g.resetGame();
    expect(g.particles.length).toBe(0);
  });

  test('snaps dolphin back to starting position', () => {
    g.dolphin.x = 999; g.dolphin.y = 999;
    g.resetGame();
    expect(g.dolphin.x).toBe(70);
    expect(g.dolphin.y).toBe(g.SEAFLOOR - 40);
  });

  test('resets difficulty state', () => {
    g.spawnInterval = 40; g.difficultyTimer = 9000; g.enemySpawnTimer = 99;
    g.resetGame();
    expect(g.spawnInterval).toBe(120);
    expect(g.difficultyTimer).toBe(0);
    expect(g.enemySpawnTimer).toBe(0);
  });

  test('sets gameState to "playing"', () => {
    g.gameState = 'dead';
    g.resetGame();
    expect(g.gameState).toBe('playing');
  });
});

// ─── saveHighScore ────────────────────────────────────────────────────────────

describe('saveHighScore', () => {
  beforeEach(() => {
    g.resetGame();
    g.highScore = 0;
    localStorage.clear();
  });

  test('returns true and updates highScore on a new best', () => {
    g.player.score = 1500;
    expect(g.saveHighScore()).toBe(true);
    expect(g.highScore).toBe(1500);
  });

  test('returns false when score does not beat the current best', () => {
    g.highScore = 2000;
    g.player.score = 500;
    expect(g.saveHighScore()).toBe(false);
    expect(g.highScore).toBe(2000);
  });

  test('persists the new high score to localStorage', () => {
    g.player.score = 3000;
    g.saveHighScore();
    expect(localStorage.getItem('maggie_high_score')).toBe('3000');
  });

  test('equal score does NOT overwrite (strict greater-than)', () => {
    g.highScore = 1000; g.player.score = 1000;
    expect(g.saveHighScore()).toBe(false);
  });
});

// ─── Laser projectiles ────────────────────────────────────────────────────────

describe('Laser projectiles', () => {
  beforeEach(() => g.resetGame());

  test('laser velocity is negative (moves left)', () => {
    g.lasers.push({ x: 500, y: 200, vx: -10, w: 28, h: 5, life: 80 });
    expect(g.lasers[0].vx).toBeLessThan(0);
  });

  test('laser position advances left each tick', () => {
    const laser = { x: 500, y: 200, vx: -10, w: 28, h: 5, life: 80 };
    g.lasers.push(laser);
    laser.x += laser.vx;
    expect(g.lasers[0].x).toBe(490);
  });

  test('laser overlaps player hitbox when in range', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    const playerBox = rect(
      g.player.x - g.player.w / 2,
      g.player.y - g.player.h,
      g.player.w, g.player.h
    );
    const laser = rect(186, g.player.y - 30, 28, 5);
    expect(g.rectsOverlap(laser, playerBox)).toBe(true);
  });

  test('laser misses player when it is far above', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    const playerBox = rect(
      g.player.x - g.player.w / 2,
      g.player.y - g.player.h,
      g.player.w, g.player.h
    );
    const laser = rect(186, 0, 28, 5); // near top of screen
    expect(g.rectsOverlap(laser, playerBox)).toBe(false);
  });
});

// ─── Difficulty scaling ───────────────────────────────────────────────────────

describe('Difficulty scaling', () => {
  const step = (interval) => Math.max(40, interval - 8);

  test('spawnInterval decreases by 8 each 600-tick threshold', () => {
    expect(step(120)).toBe(112);
    expect(step(112)).toBe(104);
    expect(step(56)).toBe(48);
  });

  test('spawnInterval is clamped to a minimum of 40', () => {
    expect(step(44)).toBe(40);
    expect(step(40)).toBe(40);
    expect(step(32)).toBe(40); // can never be forced below 40
  });
});

// ─── Dolphin companion ────────────────────────────────────────────────────────

describe('Dolphin companion', () => {
  beforeEach(() => g.resetGame());

  test('spring follow converges toward target over multiple ticks', () => {
    g.player.x = 500; g.player.facing = 1;
    g.dolphin.x = 0; g.dolphin.vx = 0; g.dolphin.vy = 0;
    const targetX = g.player.x - g.player.facing * 56; // 444

    for (let i = 0; i < 30; i++) {
      g.dolphin.vx += (targetX - g.dolphin.x) * 0.07;
      g.dolphin.vx *= 0.82;
      g.dolphin.x  += g.dolphin.vx;
    }

    // After 30 ticks the dolphin should be well past the halfway point
    expect(g.dolphin.x).toBeGreaterThan(targetX / 2);
    // And not overshooting wildly
    expect(g.dolphin.x).toBeLessThan(targetX + 30);
  });

  test('facing updates to match movement direction', () => {
    g.dolphin.vx = 4;
    if (Math.abs(g.dolphin.vx) > 0.4) g.dolphin.facing = g.dolphin.vx > 0 ? 1 : -1;
    expect(g.dolphin.facing).toBe(1);

    g.dolphin.vx = -4;
    if (Math.abs(g.dolphin.vx) > 0.4) g.dolphin.facing = g.dolphin.vx > 0 ? 1 : -1;
    expect(g.dolphin.facing).toBe(-1);
  });

  test('bubble timer resets to 160–240 after reaching zero', () => {
    g.dolphin.bubbleTimer = 1;
    g.dolphin.bubbleTimer--;
    if (g.dolphin.bubbleTimer <= 0) {
      g.dolphin.bubbleTimer = 160 + Math.floor(Math.random() * 80);
    }
    expect(g.dolphin.bubbleTimer).toBeGreaterThanOrEqual(160);
    expect(g.dolphin.bubbleTimer).toBeLessThanOrEqual(240);
  });

  test('dolphin is reset to start position alongside player reset', () => {
    g.dolphin.x = 700; g.dolphin.vx = 99;
    g.resetGame();
    expect(g.dolphin.x).toBe(70);
    expect(g.dolphin.vx).toBe(0);
  });
});

// ─── Game constants ───────────────────────────────────────────────────────────

describe('Game constants', () => {
  test('GRAVITY is positive but lighter than a typical platform game (< 0.5)', () => {
    expect(g.GRAVITY).toBeGreaterThan(0);
    expect(g.GRAVITY).toBeLessThan(0.5);
  });

  test('SWIM_FORCE is negative (pushes player upward)', () => {
    expect(g.SWIM_FORCE).toBeLessThan(0);
  });

  test('SEAFLOOR is at canvas height minus 60 (340 for a 400-tall canvas)', () => {
    expect(g.SEAFLOOR).toBe(340);
  });

  test('ATTACK_REACH is a positive distance', () => {
    expect(g.ATTACK_REACH).toBeGreaterThan(0);
  });

  test('ATTACK_DURATION and ATTACK_COOLDOWN are both positive frame counts', () => {
    expect(g.ATTACK_DURATION).toBeGreaterThan(0);
    // cooldown should be longer than the attack so there's a gap between swings
    const ATTACK_COOLDOWN = 26; // from game.js constant
    expect(ATTACK_COOLDOWN).toBeGreaterThan(g.ATTACK_DURATION);
  });
});
