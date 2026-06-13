// Maggie's Mermaid Adventure

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const SEAFLOOR = H - 60;

// ─── High score ───────────────────────────────────────────────────────────────
const HS_KEY = 'maggie_high_score';
let highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10);

function saveHighScore() {
  if (player.score > highScore) {
    highScore = player.score;
    localStorage.setItem(HS_KEY, highScore);
    return true;
  }
  return false;
}

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.code] = false; });

function pressed(codes) { return codes.some(c => keys[c]); }

// ─── Touch controls ───────────────────────────────────────────────────────────
const isTouchDevice = () => navigator.maxTouchPoints > 0;

const TOUCH_BTNS = [
  { x: 12,  y: 344, w: 82, h: 50, code: 'ArrowLeft',  label: '◀' },
  { x: 102, y: 344, w: 82, h: 50, code: 'ArrowRight', label: '▶' },
  { x: 606, y: 344, w: 82, h: 50, code: 'ArrowUp',    label: 'SWIM' },
  { x: 696, y: 344, w: 96, h: 50, code: 'Space',      label: 'ATK' },
];

function updateTouchKeys(e) {
  e.preventDefault();
  TOUCH_BTNS.forEach(b => { keys[b.code] = false; });
  const rect = canvas.getBoundingClientRect();
  const sx = W / rect.width;
  const sy = H / rect.height;
  Array.from(e.touches).forEach(t => {
    const cx = (t.clientX - rect.left) * sx;
    const cy = (t.clientY - rect.top) * sy;
    TOUCH_BTNS.forEach(b => {
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        keys[b.code] = true;
      }
    });
  });
}

canvas.addEventListener('touchstart',  updateTouchKeys, { passive: false });
canvas.addEventListener('touchmove',   updateTouchKeys, { passive: false });
canvas.addEventListener('touchend',    e => {
  if (gameState === 'start' || gameState === 'dead') { resetGame(); e.preventDefault(); return; }
  updateTouchKeys(e);
}, { passive: false });
canvas.addEventListener('touchcancel', updateTouchKeys, { passive: false });

function drawTouchControls() {
  if (!isTouchDevice()) return;
  ctx.save();
  TOUCH_BTNS.forEach(b => {
    const active = keys[b.code];
    ctx.globalAlpha = active ? 0.9 : 0.5;
    ctx.fillStyle = active ? '#0077b6' : '#03045e';
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.strokeStyle = active ? '#caf0f8' : '#00b4d8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#caf0f8';
    ctx.font = `bold ${b.label.length > 2 ? 13 : 20}px "Courier New"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  });
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.restore();
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  water1: '#03045e', water2: '#023e8a', water3: '#0077b6',
  seafloor: '#7a5c2e', seafloorTop: '#c9953a',
  bubble: '#caf0f8',
  maggieSkin: '#a0673a', maggieHair: '#ff6b9d',
  maggieTop: '#ff8fab', maggieTail: '#00b4d8', maggieTailTip: '#90e0ef',
  maggieTailAccent: '#48cae4',
  pufferBody: '#a8d5a2', pufferSpike: '#e9c46a',
  guppyBody: '#ff9f1c', guppyFin: '#ffbf69', guppyStripe: '#e76f51',
  sharkBody: '#5e6fa3', sharkBelly: '#d4e5f7', sharkEye: '#ff2222',
  laserBeam: '#ff4444',
  attackArc: '#caf0f8',
  bubbleColors: ['#90e0ef', '#caf0f8', '#48cae4', '#00b4d8', '#ade8f4'],
  scoreText: '#caf0f8',
  hpColor: '#ff6b9d',
};

// ─── Background bubbles ───────────────────────────────────────────────────────
const BG_BUBBLES = Array.from({ length: 60 }, () => ({
  x: Math.random() * W,
  y: Math.random() * (SEAFLOOR - 40),
  r: Math.random() * 3 + 0.5,
  wobble: Math.random() * Math.PI * 2,
}));

// ─── Particles ────────────────────────────────────────────────────────────────
const particles = [];
function spawnParticles(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.5 + 0.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 1,
      decay: Math.random() * 0.035 + 0.025,
      r: Math.random() * 4 + 2,
      color: C.bubbleColors[Math.floor(Math.random() * C.bubbleColors.length)],
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy -= 0.06; // bubbles float up
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life * 0.8;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = p.life * 0.25;
    ctx.fillStyle = p.color;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── Camera / laser projectiles ───────────────────────────────────────────────
let camX = 0;
const lasers = [];

// ─── Dolphin companion ────────────────────────────────────────────────────────
const dolphin = {
  x: 70, y: SEAFLOOR - 40,
  vx: 0, vy: 0,
  facing: 1,
  tailAnim: 1.5,  // out of phase with Maggie so they don't look identical
  bubbleTimer: 90,
};

function updateDolphin() {
  const bobT   = Date.now() / 750;
  const targetX = player.x - player.facing * 56;
  const targetY = player.y - 38 + Math.sin(bobT) * 26;

  dolphin.vx += (targetX - dolphin.x) * 0.07;
  dolphin.vy += (targetY - dolphin.y) * 0.07;
  dolphin.vx *= 0.82;
  dolphin.vy *= 0.82;
  dolphin.x  += dolphin.vx;
  dolphin.y  += dolphin.vy;

  if (Math.abs(dolphin.vx) > 0.4) dolphin.facing = dolphin.vx > 0 ? 1 : -1;

  const spd = Math.sqrt(dolphin.vx * dolphin.vx + dolphin.vy * dolphin.vy);
  dolphin.tailAnim += 0.14 + spd * 0.025;

  // Occasional cheerful bubble puff from the snout
  dolphin.bubbleTimer--;
  if (dolphin.bubbleTimer <= 0) {
    dolphin.bubbleTimer = 160 + Math.floor(Math.random() * 80);
    spawnParticles(dolphin.x + dolphin.facing * 26, dolphin.y - 8, 5);
  }
}

function drawDolphin() {
  const sx = worldToScreen(dolphin.x);
  const f  = dolphin.facing;
  const t  = dolphin.tailAnim;

  // Two-segment wave propagating toward the flukes
  const tw1 = Math.sin(t + 0.5) * 8;
  const tw2 = Math.sin(t + 1.1) * 14;

  ctx.save();
  ctx.translate(sx, dolphin.y);
  ctx.scale(f, 1);

  // Tail flukes
  ctx.fillStyle = '#4a7a9b';
  ctx.beginPath();
  ctx.moveTo(-20 + tw2, 0);
  ctx.bezierCurveTo(-26 + tw2, -9, -32 + tw2, -6, -28 + tw2, 0);
  ctx.bezierCurveTo(-32 + tw2, 6,  -26 + tw2,  9, -20 + tw2, 0);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = '#6b9abf';
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.bezierCurveTo(-16, -9 + tw1 * 0.3, -6, -11, 4, -9);
  ctx.bezierCurveTo(14, -7, 20, -5, 24, -2);
  ctx.lineTo(26, 0);
  ctx.lineTo(24, 2);
  ctx.bezierCurveTo(20, 5, 14, 7, 4, 8);
  ctx.bezierCurveTo(-6, 9, -16, 7, -20, 0);
  ctx.closePath();
  ctx.fill();

  // Belly
  ctx.fillStyle = '#c5dce8';
  ctx.beginPath();
  ctx.ellipse(8, 2, 10, 4.5, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal fin
  ctx.fillStyle = '#4a7a9b';
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.bezierCurveTo(2, -18, 6, -21, 9, -17);
  ctx.bezierCurveTo(9, -12, 5, -9, 0, -9);
  ctx.closePath();
  ctx.fill();

  // Pectoral fin
  ctx.beginPath();
  ctx.moveTo(10, -5);
  ctx.bezierCurveTo(12, 0, 18, 4, 14, 7);
  ctx.bezierCurveTo(8, 8, 6, 4, 10, -5);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#1a2a3a';
  ctx.beginPath();
  ctx.arc(18, -3, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(18.8, -3.6, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Smile on beak
  ctx.strokeStyle = '#4a7a9b';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(22, 1);
  ctx.quadraticCurveTo(25, 3, 26, 2);
  ctx.stroke();
  ctx.lineCap = 'butt';

  ctx.restore();
}

// ─── Player ───────────────────────────────────────────────────────────────────
const player = {
  x: 120, y: SEAFLOOR,
  vx: 0, vy: 0,
  w: 36, h: 52,
  onGround: false,
  facing: 1,
  attacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  maxHp: 5,
  hp: 5,
  dead: false,
  score: 0,
  invincible: 0,
  tailAnim: 0,
};

const ATTACK_DURATION = 16;
const ATTACK_COOLDOWN = 26;
const ATTACK_REACH   = 100;
const SWIM_FORCE     = -11;
const MOVE_SPEED     = 4;
const GRAVITY        = 0.35; // lighter underwater feel

function playerUpdate() {
  if (player.dead) return;

  let moving = false;
  if (pressed(['ArrowLeft', 'KeyA'])) {
    player.vx = -MOVE_SPEED;
    player.facing = -1;
    moving = true;
  } else if (pressed(['ArrowRight', 'KeyD'])) {
    player.vx = MOVE_SPEED;
    player.facing = 1;
    moving = true;
  } else {
    player.vx *= 0.78;
  }

  if (pressed(['ArrowUp', 'KeyW'])) {
    player.vy = SWIM_FORCE;
    player.onGround = false;
  }

  if (pressed(['KeyZ', 'KeyX', 'Space']) && player.attackCooldown <= 0 && !player.attacking) {
    player.attacking = true;
    player.attackTimer = ATTACK_DURATION;
    player.attackCooldown = ATTACK_COOLDOWN;
    spawnParticles(player.x + player.facing * 38, player.y - player.h * 0.55, 8);
  }

  if (player.attackCooldown > 0) player.attackCooldown--;
  if (player.attackTimer > 0) {
    player.attackTimer--;
    if (player.attackTimer <= 0) player.attacking = false;
  }
  if (player.invincible > 0) player.invincible--;

  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;

  if (player.y - player.h < 0) { player.y = player.h; player.vy = 0; }
  if (player.y >= SEAFLOOR)    { player.y = SEAFLOOR; player.vy = 0; player.onGround = true; }
  else                          { player.onGround = false; }

  if (player.x < camX + 30) player.x = camX + 30;

  const swimSpeed = pressed(['ArrowUp', 'KeyW']) ? 0.38 : (moving || !player.onGround) ? 0.28 : 0;
  if (swimSpeed > 0) player.tailAnim += swimSpeed;
  else               player.tailAnim *= 0.80;

  const targetCam = player.x - W * 0.35;
  camX += (targetCam - camX) * 0.1;
  if (camX < 0) camX = 0;

  // Laser projectile update
  const playerBox = { x: player.x - player.w / 2, y: player.y - player.h, w: player.w, h: player.h };
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    l.x += l.vx;
    l.life--;
    if (l.life <= 0 || l.x + l.w < camX - 20 || l.x > camX + W + 20) {
      lasers.splice(i, 1);
      continue;
    }
    if (player.invincible <= 0 && rectsOverlap({ x: l.x, y: l.y, w: l.w, h: l.h }, playerBox)) {
      player.hp--;
      player.invincible = 60;
      spawnParticles(player.x, player.y - player.h / 2, 6);
      lasers.splice(i, 1);
      if (player.hp <= 0) player.dead = true;
    }
  }
}

function attackHitbox() {
  const cx = player.x + player.facing * (player.w * 0.5 + ATTACK_REACH * 0.4);
  const cy = player.y - player.h * 0.5;
  return { x: cx - ATTACK_REACH * 0.6, y: cy - 24, w: ATTACK_REACH * 1.2, h: 48 };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ─── Enemies ──────────────────────────────────────────────────────────────────
const enemies = [];

const ENEMY_DEFS = {
  guppy:  { w: 26, h: 18, hp: 1, speed: 2.2, score: 100, flying: true  },
  puffer: { w: 36, h: 30, hp: 4, speed: 0.8, score: 200, flying: false },
  shark:  { w: 56, h: 34, hp: 3, speed: 1.5, score: 300, flying: false },
};

let enemySpawnTimer = 0;
let spawnInterval   = 120;
let difficultyTimer = 0;

function spawnEnemy() {
  const types = Object.keys(ENEMY_DEFS);
  const type  = types[Math.floor(Math.random() * types.length)];
  const def   = ENEMY_DEFS[type];
  const spawnX = camX + W + 50;
  const spawnY = def.flying ? SEAFLOOR - 60 - Math.random() * 120 : SEAFLOOR;

  enemies.push({
    type, x: spawnX, y: spawnY,
    w: def.w, h: def.h,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed, score: def.score,
    flying: def.flying,
    vx: -def.speed, vy: 0,
    anim: Math.random() * Math.PI * 2,
    hitTimer: 0,
    dead: false, deathTimer: 0,
    shootCooldown: type === 'shark' ? 90 : 0,
  });
}

function updateEnemies() {
  difficultyTimer++;
  if (difficultyTimer % 600 === 0) spawnInterval = Math.max(40, spawnInterval - 8);

  enemySpawnTimer++;
  if (enemySpawnTimer >= spawnInterval) {
    enemySpawnTimer = 0;
    spawnEnemy();
    if (Math.random() < 0.3) spawnEnemy();
  }

  const atk       = player.attacking ? attackHitbox() : null;
  const playerBox = { x: player.x - player.w / 2, y: player.y - player.h, w: player.w, h: player.h };

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    if (e.dead) {
      e.deathTimer++;
      if (e.deathTimer > 30) enemies.splice(i, 1);
      continue;
    }

    e.anim += 0.12;
    e.x    += e.vx;

    if (e.flying) {
      const targetY = SEAFLOOR - 80 - Math.sin(e.anim * 0.5) * 80;
      e.y += (targetY - e.y) * 0.06;
    } else {
      if (e.y < SEAFLOOR) { e.vy += GRAVITY; e.y += e.vy; }
      if (e.y >= SEAFLOOR) { e.y = SEAFLOOR; e.vy = 0; }
    }

    if (e.type === 'shark') {
      e.shootCooldown--;
      if (e.shootCooldown <= 0 && Math.abs(e.x - player.x) < 520) {
        e.shootCooldown = 100;
        lasers.push({
          x: e.x - e.w / 2,
          y: e.y - e.h * 0.56,
          vx: -10,
          w: 28, h: 5, life: 80,
        });
      }
    }

    if (e.x < camX - 150) { enemies.splice(i, 1); continue; }

    if (atk) {
      const eBox = { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
      if (rectsOverlap(atk, eBox) && e.hitTimer <= 0) {
        e.hp--;
        e.hitTimer = 15;
        spawnParticles(e.x, e.y - e.h / 2, 6);
        if (e.hp <= 0) {
          e.dead = true;
          player.score += e.score;
          spawnParticles(e.x, e.y - e.h / 2, 14);
          continue;
        }
      }
    }
    if (e.hitTimer > 0) e.hitTimer--;

    if (player.invincible <= 0) {
      const eBox = { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
      if (rectsOverlap(playerBox, eBox)) {
        player.hp--;
        player.invincible = 60;
        spawnParticles(player.x, player.y - player.h / 2, 5);
        if (player.hp <= 0) player.dead = true;
      }
    }
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, SEAFLOOR);
  grad.addColorStop(0, C.water1);
  grad.addColorStop(0.55, C.water2);
  grad.addColorStop(1, C.water3);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, SEAFLOOR);

  // Distant light rays from surface
  const t = Date.now() / 1000;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const rx = ((i * 190 - camX * 0.03) % (W + 120) + W + 120) % (W + 120) - 60;
    ctx.globalAlpha = 0.035 + 0.018 * Math.sin(t * 0.6 + i * 1.4);
    ctx.fillStyle = '#90e0ef';
    ctx.beginPath();
    ctx.moveTo(rx + Math.sin(t * 0.4 + i) * 12, 0);
    ctx.lineTo(rx + 36, SEAFLOOR);
    ctx.lineTo(rx - 36, SEAFLOOR);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Floating background bubbles (parallax)
  BG_BUBBLES.forEach(b => {
    const px = ((b.x - camX * 0.12) % W + W) % W;
    b.wobble += 0.018;
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = C.bubble;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px + Math.sin(b.wobble) * 4, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Sea floor
  ctx.fillStyle = C.seafloor;
  ctx.fillRect(0, SEAFLOOR, W, H - SEAFLOOR);
  ctx.fillStyle = C.seafloorTop;
  ctx.fillRect(0, SEAFLOOR, W, 6);

  // Seaweed and coral
  const t2 = Date.now() / 1000;
  ctx.lineCap = 'round';
  for (let gx = -((camX * 0.95) % 100) - 20; gx < W + 20; gx += 100) {
    const wave = Math.sin(t2 * 1.2 + gx * 0.05) * 5;
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(gx, SEAFLOOR + 2);
    ctx.quadraticCurveTo(gx + 6 + wave, SEAFLOOR - 12, gx + 2 + wave, SEAFLOOR - 24);
    ctx.quadraticCurveTo(gx - 4 + wave, SEAFLOOR - 34, gx + wave, SEAFLOOR - 42);
    ctx.stroke();

    ctx.fillStyle = '#e07a5f';
    ctx.beginPath(); ctx.arc(gx + 50, SEAFLOOR - 1, 5, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 44, SEAFLOOR - 5, 3, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(gx + 56, SEAFLOOR - 5, 3, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#b05040';
    ctx.fillRect(gx + 49, SEAFLOOR - 8, 3, 8);
  }
  ctx.lineCap = 'butt';
}

function worldToScreen(wx) { return wx - camX; }

function drawPlayer() {
  const sx    = worldToScreen(player.x);
  const sy    = player.y;
  const f     = player.facing;
  const flash = player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0;
  const t     = player.tailAnim;

  // Lean into vertical movement: nose tips up when swimming, down when sinking
  const tilt = Math.max(-0.28, Math.min(0.28, -player.vy * 0.022));

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(f, 1);
  ctx.rotate(tilt * f); // multiply by f so the lean direction is consistent when flipped
  if (flash) ctx.globalAlpha = 0.4;

  // Wave-propagated tail — each segment lags the previous by ~0.5 rad,
  // giving a smooth undulation travelling toward the flukes
  const sw0 = Math.sin(t)       * 7;   // hip — very subtle
  const sw1 = Math.sin(t + 0.5) * 14;  // upper mid
  const sw2 = Math.sin(t + 1.0) * 21;  // lower mid
  const sw3 = Math.sin(t + 1.5) * 28;  // flukes — maximum swing

  // Tail body
  ctx.fillStyle = C.maggieTail;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.bezierCurveTo(-11 + sw0 * 0.15, -2, -12 + sw0 * 0.3, 8,  -8 + sw1 * 0.35, 16);
  ctx.bezierCurveTo(-4  + sw1 * 0.55, 22, sw2 * 0.7, 28,        sw2 * 0.85, 32);
  ctx.bezierCurveTo(sw2 * 0.7, 32, 8 + sw1 * 0.45, 18,          7 + sw0 * 0.2, 10);
  ctx.bezierCurveTo(9 + sw0 * 0.1, 2, 9, -4, 8, -10);
  ctx.closePath();
  ctx.fill();

  // Scale shimmer — offsets follow the wave too
  ctx.fillStyle = C.maggieTailAccent;
  ctx.globalAlpha = flash ? 0.1 : 0.3;
  for (let si = 0; si < 4; si++) {
    const shimX = (si % 2 === 0 ? -2 : 2) + [sw0, sw0, sw1, sw1][si] * 0.12;
    ctx.beginPath();
    ctx.ellipse(shimX, -6 + si * 8, 4, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = flash ? 0.4 : 1;

  // Tail flukes — driven by sw3 (most lagged, most dramatic)
  ctx.fillStyle = C.maggieTailTip;
  const flukeBase = sw2 * 0.85;
  ctx.beginPath();
  ctx.moveTo(flukeBase, 32);
  ctx.bezierCurveTo(-5 + sw3, 44, -16 + sw3, 42, -12 + sw3, 32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(flukeBase, 32);
  ctx.bezierCurveTo(13 + sw3, 44, 21 + sw3, 42, 15 + sw3, 32);
  ctx.closePath();
  ctx.fill();

  // Torso
  ctx.fillStyle = C.maggieSkin;
  ctx.beginPath();
  ctx.roundRect(-8, -44, 16, 34, 4);
  ctx.fill();

  // Shell top
  ctx.fillStyle = C.maggieTop;
  ctx.beginPath();
  ctx.ellipse(-4, -38, 5, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -38, 5, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Arms — swing with a slightly bigger arc, matching tail rhythm
  ctx.fillStyle = C.maggieSkin;
  const armSwing = player.attacking ? -30 : Math.sin(t * 0.9) * 14;
  ctx.save();
  ctx.translate(7, -40);
  ctx.rotate((armSwing * Math.PI) / 180);
  ctx.beginPath(); ctx.roundRect(-3, 0, 6, 14, 2); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(-9, -40);
  ctx.rotate((-armSwing * Math.PI) / 180);
  ctx.beginPath(); ctx.roundRect(-3, 0, 6, 12, 2); ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = C.maggieSkin;
  ctx.beginPath();
  ctx.arc(0, -52, 10, 0, Math.PI * 2);
  ctx.fill();

  // Hair — streams behind based on horizontal speed + gentle wave
  ctx.fillStyle = C.maggieHair;
  ctx.beginPath();
  ctx.arc(0, -55, 10, Math.PI, 0);
  ctx.fill();
  const hairDrift = -player.vx * 0.5 + Math.sin(t * 0.5) * 4;
  ['#ff6b9d', '#ff8fab', '#ffb3c1'].forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = 4 - i;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-7 - i, -52);
    ctx.quadraticCurveTo(-13 - i + hairDrift, -42, -15 - i + hairDrift * 0.6, -30);
    ctx.stroke();
  });
  ctx.lineCap = 'butt';

  // Eyes
  ctx.fillStyle = '#2a1208';
  ctx.beginPath();
  ctx.arc(4, -52, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(4.8, -52.8, 1, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#7a3020';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(3, -49, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Attack bubble burst
  if (player.attacking) {
    const progress = 1 - player.attackTimer / ATTACK_DURATION;
    ctx.globalAlpha = (1 - progress) * (flash ? 0.25 : 0.75);
    ctx.strokeStyle = C.attackArc;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(28, -50, 56, -Math.PI * 0.5, Math.PI * 0.4);
    ctx.stroke();
    for (let bi = 0; bi < 5; bi++) {
      const angle = (-0.5 + (bi / 4) * 0.9) * Math.PI;
      const r = 48 + progress * 18;
      ctx.beginPath();
      ctx.arc(28 + Math.cos(angle) * r, -50 + Math.sin(angle) * r, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = flash ? 0.4 : 1;
  }

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(e => {
    const sx    = worldToScreen(e.x);
    const flash = e.hitTimer > 0 && Math.floor(e.hitTimer / 3) % 2 === 0;

    ctx.save();
    ctx.translate(sx, e.y);
    if (flash) ctx.filter = 'brightness(3)';
    if (e.dead) {
      ctx.globalAlpha = 1 - e.deathTimer / 30;
      ctx.translate(0, -e.deathTimer * 1.5);
    }

    switch (e.type) {
      case 'guppy':  drawGuppy(e);  break;
      case 'puffer': drawPuffer(e); break;
      case 'shark':  drawShark(e);  break;
    }

    ctx.filter = 'none';

    if (!e.dead && e.hp < e.maxHp) {
      const bw = e.w + 8;
      const bx = -bw / 2;
      const by = -e.h - 10;
      ctx.fillStyle = '#001233';
      ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = '#00b4d8';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 5);
    }

    ctx.restore();
  });

  // Draw laser projectiles
  lasers.forEach(l => {
    const sx = worldToScreen(l.x);
    ctx.save();
    ctx.globalAlpha = Math.min(1, l.life / 20);
    ctx.shadowColor  = C.laserBeam;
    ctx.shadowBlur   = 10;
    ctx.fillStyle    = C.laserBeam;
    ctx.fillRect(sx, l.y, l.w, l.h);
    ctx.shadowBlur   = 3;
    ctx.fillStyle    = '#fff';
    ctx.fillRect(sx + 2, l.y + 1, l.w - 4, l.h - 2);
    ctx.restore();
  });
}

function drawGuppy(e) {
  const wiggle = Math.sin(e.anim * 2) * 9;

  // Tail fan
  ctx.fillStyle = C.guppyFin;
  ctx.beginPath();
  ctx.moveTo(-10, -9);
  ctx.bezierCurveTo(-20, -16 + wiggle * 0.6, -22, -3 + wiggle, -10, -9);
  ctx.closePath();
  ctx.fill();

  // Body
  ctx.fillStyle = C.guppyBody;
  ctx.beginPath();
  ctx.ellipse(2, -9, 12, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Center stripe
  ctx.fillStyle = C.guppyStripe;
  ctx.beginPath();
  ctx.ellipse(2, -9, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal fin
  ctx.fillStyle = C.guppyFin;
  ctx.beginPath();
  ctx.moveTo(-2, -15); ctx.lineTo(2, -21); ctx.lineTo(6, -15);
  ctx.closePath();
  ctx.fill();

  // Eye
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(11, -10, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(11.8, -10.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawPuffer(e) {
  const puffed = e.hitTimer > 0;
  const scale  = puffed ? 1 + (e.hitTimer / 15) * 0.4 : 1;
  const bob    = Math.sin(e.anim * 0.8) * 2;

  ctx.save();
  ctx.scale(scale, scale);

  // Spikes — more visible when puffed
  const spikeLen = puffed ? 16 : 8;
  ctx.fillStyle = C.pufferSpike;
  for (let i = 0; i < 10; i++) {
    const a  = (i / 10) * Math.PI * 2;
    const bx = Math.cos(a) * 14;
    const by = Math.sin(a) * 12 - 15 + bob;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a) * spikeLen,       by + Math.sin(a) * spikeLen);
    ctx.lineTo(bx + Math.cos(a + 0.3) * (spikeLen * 0.45), by + Math.sin(a + 0.3) * (spikeLen * 0.45));
    ctx.closePath();
    ctx.fill();
  }

  // Body
  ctx.fillStyle = C.pufferBody;
  ctx.beginPath();
  ctx.ellipse(0, -15 + bob, 14, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly highlight
  ctx.fillStyle = '#c8e6c4';
  ctx.beginPath();
  ctx.ellipse(2, -13 + bob, 7, 6, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#264653';
  ctx.beginPath();
  ctx.arc(10, -18 + bob, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(11.2, -18.8 + bob, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Grumpy mouth
  ctx.strokeStyle = '#1a535c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(12, -13 + bob, 3, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();

  // Side fin
  ctx.fillStyle = '#7ec67e';
  ctx.beginPath();
  ctx.ellipse(-12, -15 + bob, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawShark(e) {
  const bob      = Math.sin(e.anim * 0.6) * 2;
  const tailWag  = Math.sin(e.anim) * 10;
  // Glow builds up in the 20 frames before shooting
  const laserGlow = e.shootCooldown < 20 ? (20 - e.shootCooldown) / 20 : 0;

  // Tail fin (right / rear)
  ctx.fillStyle = C.sharkBody;
  ctx.beginPath();
  ctx.moveTo(22, -17 + bob);
  ctx.bezierCurveTo(32, -27 + tailWag * 0.6, 38, -20 + tailWag, 28, -17 + bob);
  ctx.bezierCurveTo(38, -8 + tailWag * 0.5, 32, -4 + tailWag, 22, -17 + bob);
  ctx.closePath();
  ctx.fill();

  // Body — head faces left
  ctx.fillStyle = C.sharkBody;
  ctx.beginPath();
  ctx.moveTo(22, -10 + bob);
  ctx.bezierCurveTo(10, -26 + bob, -10, -30 + bob, -22, -23 + bob);
  ctx.bezierCurveTo(-29, -18 + bob, -29, -10 + bob, -22, -8 + bob);
  ctx.bezierCurveTo(-10, -5 + bob, 10, -5 + bob, 22, -10 + bob);
  ctx.closePath();
  ctx.fill();

  // Belly
  ctx.fillStyle = C.sharkBelly;
  ctx.beginPath();
  ctx.ellipse(-2, -12 + bob, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Dorsal fin
  ctx.fillStyle = C.sharkBody;
  ctx.beginPath();
  ctx.moveTo(2, -29 + bob); ctx.lineTo(-4, -40 + bob); ctx.lineTo(-12, -29 + bob);
  ctx.closePath();
  ctx.fill();

  // Pectoral fin
  ctx.beginPath();
  ctx.moveTo(-5, -15 + bob);
  ctx.bezierCurveTo(-5, -7 + bob, -15, -3 + bob, -16, -15 + bob);
  ctx.closePath();
  ctx.fill();

  // Mouth + teeth (left / front)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, -17 + bob); ctx.lineTo(-26, -17 + bob);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  for (let ti = 0; ti < 3; ti++) {
    ctx.beginPath();
    ctx.moveTo(-18 - ti * 2.2, -17 + bob);
    ctx.lineTo(-18.6 - ti * 2.2, -14.5 + bob);
    ctx.lineTo(-19.2 - ti * 2.2, -17 + bob);
    ctx.fill();
  }

  // Eyes with laser charge glow
  if (laserGlow > 0) {
    ctx.shadowColor = C.sharkEye;
    ctx.shadowBlur  = 12 * laserGlow;
  }
  ctx.fillStyle = laserGlow > 0.5
    ? `rgba(255,${Math.floor(34 * (1 - laserGlow))},${Math.floor(34 * (1 - laserGlow))},1)`
    : C.sharkEye;
  ctx.beginPath();
  ctx.arc(-18, -20 + bob, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-17, -21 + bob, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function drawHUD() {
  for (let i = 0; i < player.maxHp; i++) {
    drawShell(14 + i * 24, 14, i < player.hp ? C.hpColor : '#1a3a5c');
  }

  ctx.fillStyle = C.scoreText;
  ctx.font = 'bold 18px "Courier New"';
  ctx.textAlign = 'right';
  ctx.fillText(`~ ${player.score}`, W - 14, 30);
  if (highScore > 0) {
    ctx.fillStyle = '#90e0ef';
    ctx.font = '13px "Courier New"';
    ctx.fillText(`BEST ${highScore}`, W - 14, 50);
  }
  ctx.textAlign = 'left';
}

function drawShell(x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color === C.hpColor ? '#ffb3c1' : '#0d2b45';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color === C.hpColor ? '#ff8fab' : '#1a3a5c';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Game-over / start screens ────────────────────────────────────────────────
let gameState    = 'start';
let restartTimer = 0;
let isNewHighScore = false;

function drawStartScreen() {
  ctx.fillStyle = 'rgba(2,13,26,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#90e0ef';
  ctx.font = 'bold 40px "Courier New"';
  ctx.fillText("MAGGIE'S", W / 2, H / 2 - 82);
  ctx.fillStyle = '#caf0f8';
  ctx.font = 'bold 25px "Courier New"';
  ctx.fillText('MERMAID ADVENTURE', W / 2, H / 2 - 48);

  ctx.fillStyle = '#48cae4';
  ctx.font = '15px "Courier New"';
  ctx.fillText('Dodge puffer fish & guppies,', W / 2, H / 2 + 4);
  ctx.fillText('and watch out for laser sharks!', W / 2, H / 2 + 24);

  if (highScore > 0) {
    ctx.fillStyle = '#90e0ef';
    ctx.font = '14px "Courier New"';
    ctx.fillText(`~ High Score: ${highScore}`, W / 2, H / 2 + 52);
  }

  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  ctx.fillStyle = '#caf0f8';
  ctx.font = 'bold 16px "Courier New"';
  if (blink) ctx.fillText('Press ENTER or tap to swim!', W / 2, H / 2 + 76);
  ctx.textAlign = 'left';
}

function drawDeathScreen() {
  ctx.fillStyle = 'rgba(2,13,26,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#ff6b9d';
  ctx.font = 'bold 32px "Courier New"';
  ctx.fillText('MAGGIE SWAM AWAY...', W / 2, H / 2 - 60);

  ctx.fillStyle = '#caf0f8';
  ctx.font = '20px "Courier New"';
  ctx.fillText(`Score: ${player.score}`, W / 2, H / 2 - 18);

  if (isNewHighScore) {
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 150);
    ctx.fillStyle = `rgba(144,224,239,${pulse})`;
    ctx.font = 'bold 20px "Courier New"';
    ctx.fillText('~ NEW HIGH SCORE! ~', W / 2, H / 2 + 12);
  } else if (highScore > 0) {
    ctx.fillStyle = '#90e0ef';
    ctx.font = '16px "Courier New"';
    ctx.fillText(`Best: ${highScore}`, W / 2, H / 2 + 12);
  }

  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  ctx.fillStyle = '#48cae4';
  ctx.font = 'bold 16px "Courier New"';
  if (blink) ctx.fillText('Press ENTER or tap to try again!', W / 2, H / 2 + 52);
  ctx.textAlign = 'left';
}

function resetGame() {
  player.x = 120; player.y = SEAFLOOR;
  player.vx = 0;  player.vy = 0;
  player.hp = player.maxHp;
  player.dead = false;
  player.attacking = false;
  player.attackTimer = 0; player.attackCooldown = 0;
  player.invincible = 0;
  player.score = 0;
  player.tailAnim = 0;
  camX = 0;
  dolphin.x = 70; dolphin.y = SEAFLOOR - 40;
  dolphin.vx = 0; dolphin.vy = 0;
  dolphin.facing = 1; dolphin.tailAnim = 1.5; dolphin.bubbleTimer = 90;
  enemies.length = 0;
  particles.length = 0;
  lasers.length = 0;
  enemySpawnTimer = 0;
  spawnInterval = 120;
  difficultyTimer = 0;
  gameState = 'playing';
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop); // eslint-disable-line no-undef

  drawBackground();

  if (gameState === 'start') {
    updateDolphin();
    drawDolphin();
    drawPlayer();
    drawTouchControls();
    drawStartScreen();
    if (pressed(['Enter', 'KeyZ'])) resetGame();
    return;
  }

  if (gameState === 'playing') {
    if (player.dead) {
      restartTimer++;
      if (restartTimer === 1) isNewHighScore = saveHighScore();
      if (restartTimer > 60) { gameState = 'dead'; restartTimer = 0; }
    } else {
      playerUpdate();
      updateEnemies();
    }
    updateDolphin();
  }

  updateParticles();
  drawEnemies();
  drawPlayer();
  drawDolphin();
  drawParticles();
  drawHUD();
  drawTouchControls();

  if (gameState === 'dead') {
    drawDeathScreen();
    if (pressed(['Enter', 'KeyZ'])) resetGame();
  }
}

requestAnimationFrame(loop);

// ─── Test exports (ignored by browsers, used by Jest) ─────────────────────────
if (typeof module !== 'undefined') {
  module.exports = {
    // Pure / logic functions
    rectsOverlap, attackHitbox, pressed,
    spawnParticles, spawnEnemy,
    playerUpdate, updateEnemies, updateDolphin, updateParticles,
    resetGame, saveHighScore,
    // Mutable state objects (exported by reference so tests can mutate them)
    player, enemies, lasers, dolphin, particles, keys,
    // Constant definitions
    ENEMY_DEFS,
    ATTACK_DURATION, ATTACK_REACH,
    GRAVITY, SWIM_FORCE, MOVE_SPEED, SEAFLOOR,
    // Let-variables exposed via getter/setter so tests can read and write them
    get highScore()        { return highScore; },
    set highScore(v)       { highScore = v; },
    get gameState()        { return gameState; },
    set gameState(v)       { gameState = v; },
    get spawnInterval()    { return spawnInterval; },
    set spawnInterval(v)   { spawnInterval = v; },
    get difficultyTimer()  { return difficultyTimer; },
    set difficultyTimer(v) { difficultyTimer = v; },
    get enemySpawnTimer()  { return enemySpawnTimer; },
    set enemySpawnTimer(v) { enemySpawnTimer = v; },
    get camX()             { return camX; },
    set camX(v)            { camX = v; },
  };
}
