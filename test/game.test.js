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

  test('crab (the mini-boss) has the most HP of any enemy', () => {
    const hps = Object.values(g.ENEMY_DEFS).map(d => d.hp);
    expect(g.ENEMY_DEFS.crab.hp).toBe(Math.max(...hps));
  });

  test('puffer is tankier than the regular (non-mini-boss) enemies', () => {
    expect(g.ENEMY_DEFS.puffer.hp).toBeGreaterThan(g.ENEMY_DEFS.guppy.hp);
    expect(g.ENEMY_DEFS.puffer.hp).toBeGreaterThan(g.ENEMY_DEFS.jellyfish.hp);
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

  test('jellyfish is the slowest enemy, drifting rather than chasing', () => {
    const speeds = Object.values(g.ENEMY_DEFS).map(d => d.speed);
    expect(g.ENEMY_DEFS.jellyfish.speed).toBe(Math.min(...speeds));
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
    // Force a shark spawn regardless of where 'shark' falls in ENEMY_DEFS's key order
    const types = Object.keys(g.ENEMY_DEFS);
    const sharkIndex = types.indexOf('shark');
    t.mock.method(Math, 'random', () => (sharkIndex + 0.5) / types.length);
    g.spawnEnemy();
    const shark = g.enemies.find(e => e.type === 'shark');
    expect(shark).toBeDefined();
    expect(shark.shootCooldown).toBeGreaterThan(0);
  });

  test('guppy spawns above the sea floor', (t) => {
    const types = Object.keys(g.ENEMY_DEFS);
    const guppyIndex = types.indexOf('guppy');
    t.mock.method(Math, 'random', () => guppyIndex / types.length); // force guppy
    g.spawnEnemy();
    const guppy = g.enemies.find(e => e.type === 'guppy');
    expect(guppy).toBeDefined();
    expect(guppy.y).toBeLessThan(g.SEAFLOOR);
  });

  test('jellyfish spawns above the sea floor with a slow drift speed', (t) => {
    const types = Object.keys(g.ENEMY_DEFS);
    const jellyIndex = types.indexOf('jellyfish');
    t.mock.method(Math, 'random', () => (jellyIndex + 0.5) / types.length);
    g.spawnEnemy();
    const jelly = g.enemies.find(e => e.type === 'jellyfish');
    expect(jelly).toBeDefined();
    expect(jelly.y).toBeLessThan(g.SEAFLOOR);
    expect(jelly.speed).toBeLessThan(g.ENEMY_DEFS.puffer.speed);
  });

  test('a crab roll sticks when the mini-boss rarity check passes, starting unshielded', (t) => {
    const types = Object.keys(g.ENEMY_DEFS);
    const crabIndex = types.indexOf('crab');
    const crabBucket = (crabIndex + 0.5) / types.length; // lands the *first* roll on crab
    let call = 0;
    t.mock.method(Math, 'random', () => {
      call++;
      return call === 1 ? crabBucket : 0.1; // 2nd roll <= CRAB_STICK_CHANCE (0.25) -> sticks
    });
    g.spawnEnemy();
    const crab = g.enemies.find(e => e.type === 'crab');
    expect(crab).toBeDefined();
    expect(crab.shielded).toBe(false);
    expect(crab.swipeCooldown).toBeGreaterThan(0);
  });

  test('a crab roll rerolls to a common type when the mini-boss rarity check fails', (t) => {
    const types = Object.keys(g.ENEMY_DEFS);
    const crabIndex = types.indexOf('crab');
    const crabBucket = (crabIndex + 0.5) / types.length;
    let call = 0;
    t.mock.method(Math, 'random', () => {
      call++;
      if (call === 1) return crabBucket; // first roll: crab
      if (call === 2) return 0.9;        // > CRAB_STICK_CHANCE -> reroll away from crab
      return 0;                          // reroll picks the first common type
    });
    g.spawnEnemy();
    expect(g.enemies.length).toBe(1);
    expect(g.enemies[0].type).not.toBe('crab');
  });
});

// ─── Crab mini-boss (shield / swipe) ───────────────────────────────────────────

describe('Crab mini-boss', () => {
  beforeEach(() => g.resetGame());

  function makeCrab(overrides = {}) {
    const crab = {
      type: 'crab', x: 0, y: g.SEAFLOOR,
      w: g.ENEMY_DEFS.crab.w, h: g.ENEMY_DEFS.crab.h,
      hp: g.ENEMY_DEFS.crab.hp, maxHp: g.ENEMY_DEFS.crab.hp,
      speed: g.ENEMY_DEFS.crab.speed, score: g.ENEMY_DEFS.crab.score,
      flying: false, vx: 0, vy: 0,
      anim: 0, hitTimer: 0, dead: false, deathTimer: 0,
      shootCooldown: 0, swipeCooldown: 999, swipeTimer: 0,
      shielded: false, shieldCycle: 999,
      ...overrides,
    };
    g.enemies.push(crab);
    return crab;
  }

  test('a shielded crab blocks a landed attack and takes no damage', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = true;
    const atk = g.attackHitbox();
    const crab = makeCrab({ x: atk.x + atk.w / 2, shielded: true });
    g.updateEnemies();
    expect(crab.hp).toBe(g.ENEMY_DEFS.crab.hp);
    expect(crab.dead).toBe(false);
  });

  test('an unshielded crab takes damage from a landed attack', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = true;
    const atk = g.attackHitbox();
    const crab = makeCrab({ x: atk.x + atk.w / 2, shielded: false });
    g.updateEnemies();
    expect(crab.hp).toBe(g.ENEMY_DEFS.crab.hp - 1);
  });

  test('shieldCycle reaching 0 flips the shielded flag', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    const crab = makeCrab({ x: 600, shielded: false, shieldCycle: 1 });
    g.updateEnemies();
    expect(crab.shielded).toBe(true);
  });

  test('a crab past its swipe cooldown damages a nearby, non-invincible player', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = false;
    g.player.invincible = 0;
    const startHp = g.player.hp;
    makeCrab({ x: g.player.x + 10, swipeCooldown: 0, shieldCycle: 999 });
    g.updateEnemies();
    expect(g.player.hp).toBeLessThan(startHp);
  });

  test('a crab out of swipe range does not damage the player', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = false;
    g.player.invincible = 0;
    const startHp = g.player.hp;
    makeCrab({ x: g.player.x + 500, swipeCooldown: 0, shieldCycle: 999 });
    g.updateEnemies();
    expect(g.player.hp).toBe(startHp);
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

// ─── Leaderboard ──────────────────────────────────────────────────────────────

describe('Leaderboard', () => {
  beforeEach(() => localStorage.clear());

  test('loadLeaderboard returns an empty array when nothing is stored', () => {
    expect(g.loadLeaderboard()).toEqual([]);
  });

  test('loadLeaderboard returns [] for corrupted JSON instead of throwing', () => {
    localStorage.setItem('mma_leaderboard', 'not valid json{{{');
    expect(g.loadLeaderboard()).toEqual([]);
  });

  test('addToLeaderboard persists an entry that loadLeaderboard can read back', () => {
    g.addToLeaderboard('Maggie', 500);
    const board = g.loadLeaderboard();
    expect(board.length).toBe(1);
    expect(board[0].name).toBe('MAGGIE');
    expect(board[0].score).toBe(500);
  });

  test('addToLeaderboard uppercases and trims the name', () => {
    g.addToLeaderboard('  spot  ', 10);
    expect(g.loadLeaderboard()[0].name).toBe('SPOT');
  });

  test('addToLeaderboard truncates names longer than 12 characters', () => {
    g.addToLeaderboard('abcdefghijklmnopqrstuvwxyz', 10);
    expect(g.loadLeaderboard()[0].name).toBe('ABCDEFGHIJKL');
  });

  test('addToLeaderboard falls back to ANON for a blank name', () => {
    g.addToLeaderboard('   ', 10);
    expect(g.loadLeaderboard()[0].name).toBe('ANON');
  });

  test('addToLeaderboard keeps the board sorted by score, descending', () => {
    g.addToLeaderboard('low', 100);
    g.addToLeaderboard('high', 900);
    g.addToLeaderboard('mid', 500);
    const board = g.loadLeaderboard();
    expect(board.map(e => e.score)).toEqual([900, 500, 100]);
  });

  test('addToLeaderboard caps the board at 10 entries', () => {
    for (let i = 0; i < 15; i++) g.addToLeaderboard(`p${i}`, i * 10);
    expect(g.loadLeaderboard().length).toBe(10);
  });

  test('addToLeaderboard drops the lowest score once the board is full', () => {
    for (let i = 0; i < 10; i++) g.addToLeaderboard(`p${i}`, i * 10); // scores 0..90
    g.addToLeaderboard('newcomer', 45);
    const scores = g.loadLeaderboard().map(e => e.score);
    expect(scores.includes(0)).toBe(false); // the lowest score (0) got bumped off
    expect(scores.includes(45)).toBe(true);
  });

  test('qualifiesForLeaderboard rejects a score of 0', () => {
    expect(g.qualifiesForLeaderboard(0)).toBe(false);
  });

  test('qualifiesForLeaderboard rejects negative scores', () => {
    expect(g.qualifiesForLeaderboard(-50)).toBe(false);
  });

  test('qualifiesForLeaderboard accepts any positive score when the board has fewer than 10 entries', () => {
    expect(g.qualifiesForLeaderboard(1)).toBe(true);
  });

  test('qualifiesForLeaderboard requires beating the lowest score once the board is full', () => {
    for (let i = 0; i < 10; i++) g.addToLeaderboard(`p${i}`, (i + 1) * 100); // scores 100..1000
    expect(g.qualifiesForLeaderboard(50)).toBe(false);
    expect(g.qualifiesForLeaderboard(100)).toBe(false); // strictly greater required
    expect(g.qualifiesForLeaderboard(150)).toBe(true);
  });
});

// ─── SFX mute toggle ──────────────────────────────────────────────────────────

describe('toggleMute', () => {
  beforeEach(() => { g.sfxMuted = false; localStorage.clear(); });

  test('flips sfxMuted from false to true', () => {
    g.toggleMute();
    expect(g.sfxMuted).toBe(true);
  });

  test('flips back to false on a second call', () => {
    g.toggleMute();
    g.toggleMute();
    expect(g.sfxMuted).toBe(false);
  });

  test('persists the muted state to localStorage', () => {
    g.toggleMute();
    expect(localStorage.getItem('mma_muted')).toBe('1');
    g.toggleMute();
    expect(localStorage.getItem('mma_muted')).toBe('0');
  });
});

// ─── Levels & bosses ────────────────────────────────────────────────────────

describe('LEVELS / BOSS_DEFS data', () => {
  test('scoreToBoss thresholds strictly increase', () => {
    for (let i = 1; i < g.LEVELS.length; i++) {
      expect(g.LEVELS[i].scoreToBoss).toBeGreaterThan(g.LEVELS[i - 1].scoreToBoss);
    }
  });

  test('every level\'s boss key resolves in BOSS_DEFS', () => {
    g.LEVELS.forEach(lvl => {
      expect(g.BOSS_DEFS[lvl.boss]).toBeDefined();
    });
  });

  test('at least 3 levels are defined', () => {
    expect(g.LEVELS.length).toBeGreaterThanOrEqual(3);
  });
});

describe('startBossIntro / createBoss', () => {
  beforeEach(() => { g.resetGame(); g.enemies.length = 0; g.lasers.length = 0; });

  test('creates a boss matching the current level\'s def', () => {
    g.level = 0;
    g.startBossIntro();
    expect(g.boss).toBeDefined();
    expect(g.boss.type).toBe(g.LEVELS[0].boss);
    expect(g.boss.hp).toBe(g.BOSS_DEFS[g.LEVELS[0].boss].hp);
    expect(g.boss.maxHp).toBe(g.boss.hp);
  });

  test('sets gameState to bossIntro', () => {
    g.startBossIntro();
    expect(g.gameState).toBe('bossIntro');
  });

  test('clears any leftover regular enemies and lasers', () => {
    g.enemies.push({ type: 'guppy' });
    g.lasers.push({ x: 0 });
    g.startBossIntro();
    expect(g.enemies.length).toBe(0);
    expect(g.lasers.length).toBe(0);
  });
});

describe('Score-threshold trigger (via loop())', () => {
  beforeEach(() => { g.resetGame(); });

  test('crossing a level\'s scoreToBoss transitions playing -> bossIntro', () => {
    g.gameState = 'playing';
    g.player.score = g.LEVELS[0].scoreToBoss;
    g.loop();
    expect(g.gameState).toBe('bossIntro');
    expect(g.boss).toBeDefined();
    expect(g.boss.type).toBe(g.LEVELS[0].boss);
  });

  test('does not trigger before the threshold is reached', () => {
    g.gameState = 'playing';
    g.player.score = g.LEVELS[0].scoreToBoss - 1;
    g.loop();
    expect(g.gameState).toBe('playing');
    expect(g.boss).toBe(null);
  });
});

describe('Boss arena: camera freeze and spawn gating', () => {
  beforeEach(() => { g.resetGame(); });

  test('camX does not move while a boss is active, even as the player moves', () => {
    g.boss = g.createBoss(g.LEVELS[0].boss);
    g.camX = 200;
    g.player.x = 400;
    g.keys['ArrowRight'] = true;
    g.playerUpdate();
    g.keys['ArrowRight'] = false;
    expect(g.camX).toBe(200);
  });

  test('camX resumes moving once boss is cleared', () => {
    g.boss = null;
    g.camX = 0;
    g.player.x = 500;
    g.playerUpdate();
    expect(g.camX).toBeGreaterThan(0);
  });

  test('the player is clamped to the frozen arena\'s right edge while a boss is active', () => {
    g.boss = g.createBoss(g.LEVELS[0].boss);
    g.camX = 100;
    g.player.x = 100 + g.SEAFLOOR; // absurdly far right
    g.playerUpdate();
    expect(g.player.x).toBeLessThanOrEqual(g.camX + 800 - 40); // W = 800 in the test canvas mock
  });

  test('regular spawnEnemy() calls are suppressed by updateEnemies() while a boss is active', () => {
    g.boss = g.createBoss(g.LEVELS[0].boss);
    g.enemySpawnTimer = g.spawnInterval; // would normally spawn this frame
    g.updateEnemies();
    expect(g.enemies.length).toBe(0);
  });

  test('spawning resumes once the boss is cleared', () => {
    g.boss = null;
    g.enemySpawnTimer = g.spawnInterval;
    g.updateEnemies();
    expect(g.enemies.length).toBeGreaterThan(0);
  });
});

describe('updateBoss: combat', () => {
  beforeEach(() => { g.resetGame(); });

  function attackAt(bossX) {
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = true;
    const atk = g.attackHitbox();
    g.boss.x = bossX !== undefined ? bossX : atk.x + atk.w / 2;
    g.boss.y = g.SEAFLOOR;
  }

  test('a landed player attack reduces boss.hp', () => {
    g.boss = g.createBoss('anglerfish');
    const startHp = g.boss.hp;
    attackAt();
    g.updateBoss();
    expect(g.boss.hp).toBe(startHp - 1);
  });

  test('defeating a non-final-level boss advances to levelComplete and increments level', () => {
    g.level = 0;
    g.boss = g.createBoss(g.LEVELS[0].boss);
    g.boss.hp = 1;
    attackAt();
    g.updateBoss();
    expect(g.boss).toBe(null);
    expect(g.level).toBe(1);
    expect(g.gameState).toBe('levelComplete');
    expect(g.player.dead).toBe(false);
  });

  test('defeating the final level\'s boss triggers victory (reuses the death pipeline)', () => {
    g.level = g.LEVELS.length - 1;
    g.boss = g.createBoss(g.LEVELS[g.level].boss);
    g.boss.hp = 1;
    attackAt();
    g.updateBoss();
    expect(g.boss).toBe(null);
    expect(g.runEndReason).toBe('victory');
    expect(g.player.dead).toBe(true);
  });

  test('boss defeat awards its score bonus', () => {
    g.level = 0;
    g.boss = g.createBoss(g.LEVELS[0].boss);
    g.boss.hp = 1;
    const bonus = g.boss.scoreBonus;
    const startScore = g.player.score;
    attackAt();
    g.updateBoss();
    expect(g.player.score).toBe(startScore + bonus);
  });

  test('boss body contact damages a non-invincible player', () => {
    g.boss = g.createBoss('anglerfish');
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.invincible = 0;
    g.boss.x = 205; g.boss.y = g.SEAFLOOR; // overlapping the player
    g.player.attacking = false;
    const startHp = g.player.hp;
    g.updateBoss();
    expect(g.player.hp).toBeLessThan(startHp);
  });

  test('an invincible player takes no contact damage from the boss', () => {
    g.boss = g.createBoss('anglerfish');
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.invincible = 30;
    g.boss.x = 205; g.boss.y = g.SEAFLOOR;
    g.player.attacking = false;
    const startHp = g.player.hp;
    g.updateBoss();
    expect(g.player.hp).toBe(startHp);
  });
});

describe('resetGame: level/boss state', () => {
  test('resets level, boss, and runEndReason to their defaults', () => {
    g.level = 2;
    g.boss = g.createBoss('leviathan');
    g.runEndReason = 'victory';
    g.bossTentacles.push({ x: 0, telegraphTimer: 1, activeTimer: 0 });
    g.resetGame();
    expect(g.level).toBe(0);
    expect(g.boss).toBe(null);
    expect(g.runEndReason).toBe('death');
    expect(g.bossTentacles.length).toBe(0);
  });
});

// ─── Powerups ─────────────────────────────────────────────────────────────────

describe('attackDamage / currentAttackCooldown', () => {
  beforeEach(() => g.resetGame());

  test('base damage is 1 with no powerups', () => {
    expect(g.attackDamage()).toBe(1);
  });

  test('damage increases by 1 per damage powerup level', () => {
    g.powerLevels = { damage: 2, speed: 0 };
    expect(g.attackDamage()).toBe(3);
  });

  test('base attack cooldown matches ATTACK_COOLDOWN with no powerups', () => {
    expect(g.currentAttackCooldown()).toBe(g.ATTACK_COOLDOWN);
  });

  test('cooldown shrinks with speed powerup levels', () => {
    g.powerLevels = { damage: 0, speed: 1 };
    expect(g.currentAttackCooldown()).toBeLessThan(g.ATTACK_COOLDOWN);
  });

  test('cooldown never drops below the 10-frame floor even at max speed stacks', () => {
    g.powerLevels = { damage: 0, speed: g.POWERUP_TYPES.speed.maxStacks };
    expect(g.currentAttackCooldown()).toBeGreaterThanOrEqual(10);
  });
});

describe('spawnPowerup / collectPowerup', () => {
  beforeEach(() => { g.resetGame(); });

  test('spawnPowerup adds exactly one item to the world', () => {
    expect(g.powerups.length).toBe(0);
    g.spawnPowerup();
    expect(g.powerups.length).toBe(1);
  });

  test('spawned powerup has a valid type and spawns beyond the right edge', () => {
    g.camX = 0;
    g.spawnPowerup();
    const p = g.powerups[0];
    expect(Object.keys(g.POWERUP_TYPES)).toContain(p.type);
    expect(p.x).toBeGreaterThan(800);
  });

  test('spawnPowerup never offers a type that is already at its max stacks', (t) => {
    g.powerLevels = { damage: g.POWERUP_TYPES.damage.maxStacks, speed: 0 };
    t.mock.method(Math, 'random', () => 0); // would pick index 0 of whatever's available
    g.spawnPowerup();
    expect(g.powerups[0].type).toBe('speed');
  });

  test('spawnPowerup does nothing once every type is fully maxed', () => {
    g.powerLevels = {
      damage: g.POWERUP_TYPES.damage.maxStacks,
      speed: g.POWERUP_TYPES.speed.maxStacks,
    };
    g.spawnPowerup();
    expect(g.powerups.length).toBe(0);
  });

  test('collectPowerup increments the matching stat by one level', () => {
    g.collectPowerup('damage');
    expect(g.powerLevels.damage).toBe(1);
  });

  test('collectPowerup does not exceed maxStacks', () => {
    g.powerLevels = { damage: g.POWERUP_TYPES.damage.maxStacks, speed: 0 };
    g.collectPowerup('damage');
    expect(g.powerLevels.damage).toBe(g.POWERUP_TYPES.damage.maxStacks);
  });

  test('collectPowerup awards a score bonus', () => {
    const startScore = g.player.score;
    g.collectPowerup('speed');
    expect(g.player.score).toBeGreaterThan(startScore);
  });
});

describe('updatePowerups', () => {
  beforeEach(() => g.resetGame());

  test('a powerup touching the player is collected and removed', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    g.powerups.push({ type: 'damage', x: 205, y: g.SEAFLOOR - 10, vx: -1.2, anim: 0 });
    g.updatePowerups();
    expect(g.powerLevels.damage).toBe(1);
    expect(g.powerups.length).toBe(0);
  });

  test('a distant powerup is left untouched and keeps drifting left', () => {
    g.player.x = 200; g.player.y = g.SEAFLOOR;
    g.powerups.push({ type: 'damage', x: 600, y: g.SEAFLOOR, vx: -1.2, anim: 0 });
    g.updatePowerups();
    expect(g.powerLevels.damage).toBe(0);
    expect(g.powerups.length).toBe(1);
    expect(g.powerups[0].x).toBeLessThan(600);
  });

  test('powerups that drift off the left edge of the world are removed', () => {
    g.camX = 500;
    g.powerups.push({ type: 'damage', x: 0, y: g.SEAFLOOR, vx: -1.2, anim: 0 });
    g.updatePowerups();
    expect(g.powerups.length).toBe(0);
  });

  test('spawning is suppressed while a boss is active', () => {
    g.boss = g.createBoss('anglerfish');
    g.powerupSpawnTimer = 99999;
    g.updatePowerups();
    expect(g.powerups.length).toBe(0);
  });
});

describe('Powerups integrate with combat', () => {
  beforeEach(() => g.resetGame());

  test('a damage powerup makes attacks kill a multi-hit enemy faster', () => {
    g.powerLevels = { damage: 2, speed: 0 }; // attackDamage() === 3
    g.player.x = 200; g.player.y = g.SEAFLOOR; g.player.facing = 1;
    g.player.attacking = true;
    const atk = g.attackHitbox();
    const puffer = {
      type: 'puffer', x: atk.x + atk.w / 2, y: g.SEAFLOOR,
      w: g.ENEMY_DEFS.puffer.w, h: g.ENEMY_DEFS.puffer.h,
      hp: g.ENEMY_DEFS.puffer.hp, maxHp: g.ENEMY_DEFS.puffer.hp,
      speed: g.ENEMY_DEFS.puffer.speed, score: g.ENEMY_DEFS.puffer.score,
      flying: false, vx: 0, vy: 0, anim: 0, hitTimer: 0, dead: false, deathTimer: 0,
      shootCooldown: 0, swipeCooldown: 0, swipeTimer: 0, shielded: false, shieldCycle: 0,
    };
    g.enemies.push(puffer);
    g.updateEnemies();
    expect(puffer.hp).toBe(g.ENEMY_DEFS.puffer.hp - 3);
  });
});
