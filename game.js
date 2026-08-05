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

// ─── Audio / SFX ──────────────────────────────────────────────────────────────
// Every sound is synthesized at runtime via the Web Audio API — no asset
// files, matching the project's zero-dependency approach. Retro square/
// triangle-wave beeps plus filtered noise bursts for percussive impacts.
const MUTE_KEY = 'mma_muted';
let sfxMuted = localStorage.getItem(MUTE_KEY) === '1';
let audioCtx = null;

function getAudioCtx() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function toggleMute() {
  sfxMuted = !sfxMuted;
  localStorage.setItem(MUTE_KEY, sfxMuted ? '1' : '0');
}

// A single oscillator with an optional pitch glide and an exponential
// decay envelope (silence-clamped so exponentialRamp never targets 0).
function tone({ freq, glideTo, duration = 0.12, type = 'square', volume = 0.16, delay = 0 }) {
  if (sfxMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// A short burst of band-passed white noise — for hits/thuds/impacts.
function noiseBurst({ duration = 0.12, filterFreq = 1200, volume = 0.2, delay = 0 }) {
  if (sfxMuted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const size = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

  const noise  = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + duration + 0.02);
}

const sfx = {
  attack() {
    tone({ freq: 900, glideTo: 500, duration: 0.08, type: 'triangle', volume: 0.12 });
  },
  hit() {
    noiseBurst({ duration: 0.07, filterFreq: 1800, volume: 0.2 });
    tone({ freq: 220, glideTo: 120, duration: 0.08, type: 'square', volume: 0.09, delay: 0.01 });
  },
  enemyDeath() {
    tone({ freq: 300, glideTo: 900, duration: 0.16, type: 'square', volume: 0.14 });
  },
  playerHurt() {
    noiseBurst({ duration: 0.15, filterFreq: 500, volume: 0.22 });
    tone({ freq: 180, glideTo: 80, duration: 0.18, type: 'sawtooth', volume: 0.12, delay: 0.02 });
  },
  playerDeath() {
    tone({ freq: 400, glideTo: 50, duration: 0.6, type: 'sawtooth', volume: 0.16 });
  },
  start() {
    tone({ freq: 440, duration: 0.1, type: 'square', volume: 0.13 });
    tone({ freq: 660, duration: 0.14, type: 'square', volume: 0.13, delay: 0.09 });
  },
  leaderboardSave() {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, duration: 0.1, type: 'triangle', volume: 0.14, delay: i * 0.09 }));
  },
  highScore() {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, duration: 0.14, type: 'square', volume: 0.15, delay: i * 0.09 }));
  },
};

// ─── Leaderboard ──────────────────────────────────────────────────────────────
const LB_KEY = 'mma_leaderboard';
let inputName       = '';
let leaderboardCache = [];
let deadCooldown    = 0;

// Native text input overlaid on the canvas so touch devices get a real OS
// keyboard instead of relying on physical keydown events (which mobile
// browsers don't reliably send while a virtual keyboard is up).
const nameInput = document.getElementById('name-input');
const NAME_ENTRY_BOX = { w: 320, h: 40, x: W / 2 - 160, y: H / 2 - 4 };

function submitLeaderboardEntry() {
  addToLeaderboard(inputName, player.score);
  leaderboardCache = loadLeaderboard();
  deadCooldown = 45;
  gameState = 'dead';
  sfx.leaderboardSave();
  if (nameInput) {
    nameInput.style.display = 'none';
    nameInput.blur();
    nameInput.value = '';
  }
}

// Keeps the overlay positioned over NAME_ENTRY_BOX and visible for the
// duration of the enterName state; the player taps it to focus it (a
// programmatic .focus() outside a user gesture won't raise the keyboard
// on iOS).
function syncNameInputOverlay() {
  if (!nameInput || !isTouchDevice()) return;
  if (nameInput.style.display !== 'block') {
    nameInput.style.display = 'block';
    nameInput.value = inputName;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / W;
  const scaleY = rect.height / H;
  nameInput.style.left     = `${rect.left + NAME_ENTRY_BOX.x * scaleX}px`;
  nameInput.style.top      = `${rect.top  + NAME_ENTRY_BOX.y * scaleY}px`;
  nameInput.style.width    = `${NAME_ENTRY_BOX.w * scaleX}px`;
  nameInput.style.height   = `${NAME_ENTRY_BOX.h * scaleY}px`;
  nameInput.style.fontSize = `${20 * scaleY}px`;
}

function hideNameInputOverlay() {
  if (nameInput && nameInput.style.display !== 'none') nameInput.style.display = 'none';
}

if (nameInput) {
  nameInput.addEventListener('input', () => { inputName = nameInput.value.slice(0, 12); });
}

function loadLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); }
  catch { return []; }
}

function addToLeaderboard(name, score) {
  const board = loadLeaderboard();
  board.push({ name: (name.trim() || 'ANON').slice(0, 12).toUpperCase(), score });
  board.sort((a, b) => b.score - a.score);
  board.splice(10);
  localStorage.setItem(LB_KEY, JSON.stringify(board));
}

function qualifiesForLeaderboard(score) {
  if (score <= 0) return false;
  const board = loadLeaderboard();
  return board.length < 10 || score > board[board.length - 1].score;
}

// ─── Input ────────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener('keydown', e => {
  if (gameState === 'enterName') {
    if (nameInput && e.target === nameInput) {
      // Native input owns typing/backspace here; only intercept Enter to submit.
      if (e.key === 'Enter') { submitLeaderboardEntry(); e.preventDefault(); }
      return;
    }
    if (e.key === 'Enter') {
      submitLeaderboardEntry();
    } else if (e.key === 'Backspace') {
      inputName = inputName.slice(0, -1);
    } else if (e.key.length === 1 && inputName.length < 12) {
      inputName += e.key;
    }
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM' && !e.repeat) toggleMute();
  keys[e.code] = true;
  e.preventDefault();
});
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

// Tappable mute toggle, top-right below the score/best-score readout —
// desktop uses the 'M' key instead (see drawHUD).
const MUTE_BTN = { x: W - 54, y: 60, w: 40, h: 26 };

function touchesHitMuteBtn(touchList) {
  const rect = canvas.getBoundingClientRect();
  const sx = W / rect.width;
  const sy = H / rect.height;
  return Array.from(touchList).some(t => {
    const cx = (t.clientX - rect.left) * sx;
    const cy = (t.clientY - rect.top) * sy;
    return cx >= MUTE_BTN.x && cx <= MUTE_BTN.x + MUTE_BTN.w &&
           cy >= MUTE_BTN.y && cy <= MUTE_BTN.y + MUTE_BTN.h;
  });
}

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

canvas.addEventListener('touchstart',  e => {
  if (touchesHitMuteBtn(e.touches)) { e.preventDefault(); return; }
  updateTouchKeys(e);
}, { passive: false });
canvas.addEventListener('touchmove',   updateTouchKeys, { passive: false });
canvas.addEventListener('touchend',    e => {
  if (touchesHitMuteBtn(e.changedTouches)) { toggleMute(); e.preventDefault(); return; }
  if (gameState === 'enterName') {
    // A tap lands here only when it misses the overlaid name input (taps
    // that hit the input are consumed by it) — treat it as "done typing".
    submitLeaderboardEntry();
    e.preventDefault();
    return;
  }
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

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#03045e';
  ctx.beginPath();
  ctx.roundRect(MUTE_BTN.x, MUTE_BTN.y, MUTE_BTN.w, MUTE_BTN.h, 6);
  ctx.fill();
  ctx.strokeStyle = '#00b4d8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#caf0f8';
  ctx.font = 'bold 10px "Courier New"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sfxMuted ? 'MUTE' : 'SFX', MUTE_BTN.x + MUTE_BTN.w / 2, MUTE_BTN.y + MUTE_BTN.h / 2);

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
  jellyBell: '#d8a1ff', jellyGlow: '#f3d9ff', jellyTentacle: '#b57edc',
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
    sfx.attack();
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
      if (player.hp <= 0) { player.dead = true; sfx.playerDeath(); }
      else                { sfx.playerHurt(); }
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
  guppy:     { w: 26, h: 18, hp: 1, speed: 2.2,  score: 100, flying: true,  swimMid: 80, swimAmp: 80, swimRate: 0.50 },
  puffer:    { w: 36, h: 30, hp: 4, speed: 0.8,  score: 200, flying: false, swimMid: 50, swimAmp: 40, swimRate: 0.45 },
  shark:     { w: 56, h: 34, hp: 3, speed: 1.5,  score: 300, flying: false, swimMid: 90, swimAmp: 65, swimRate: 0.30 },
  jellyfish: { w: 30, h: 34, hp: 2, speed: 0.35, score: 150, flying: false, swimMid: 70, swimAmp: 22, swimRate: 0.18 },
};

let enemySpawnTimer = 0;
let spawnInterval   = 120;
let difficultyTimer = 0;

function spawnEnemy() {
  const types = Object.keys(ENEMY_DEFS);
  const type  = types[Math.floor(Math.random() * types.length)];
  const def   = ENEMY_DEFS[type];
  const spawnX = camX + W + 50;
  const spawnY = SEAFLOOR - def.swimMid;

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

    const def = ENEMY_DEFS[e.type];
    const targetY = SEAFLOOR - def.swimMid - Math.sin(e.anim * def.swimRate) * def.swimAmp;
    e.y += (targetY - e.y) * 0.05;

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
        sfx.hit();
        if (e.hp <= 0) {
          e.dead = true;
          player.score += e.score;
          spawnParticles(e.x, e.y - e.h / 2, 14);
          sfx.enemyDeath();
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
        if (player.hp <= 0) { player.dead = true; sfx.playerDeath(); }
        else                { sfx.playerHurt(); }
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
      case 'guppy':     drawGuppy(e);     break;
      case 'puffer':    drawPuffer(e);    break;
      case 'shark':     drawShark(e);     break;
      case 'jellyfish': drawJellyfish(e); break;
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

function drawJellyfish(e) {
  const pulseT   = e.anim * 0.5;
  const pulse    = Math.sin(pulseT);   // -1..1, drives the propulsion contraction
  const bellW    = 15 - pulse * 2.5;
  const bellH    = 13 + pulse * 3.5;
  const glow     = 0.5 + pulse * 0.25;

  ctx.save();

  // Soft bioluminescent glow
  ctx.shadowColor = C.jellyGlow;
  ctx.shadowBlur  = 10 + glow * 8;

  // Bell (dome)
  ctx.globalAlpha = 0.55;
  ctx.fillStyle   = C.jellyBell;
  ctx.beginPath();
  ctx.ellipse(0, -20, bellW, bellH, 0, Math.PI, 0);
  ctx.quadraticCurveTo(bellW * 0.7, -20 + bellH * 0.7, 0, -20 + bellH * 0.55);
  ctx.quadraticCurveTo(-bellW * 0.7, -20 + bellH * 0.7, -bellW, -20);
  ctx.closePath();
  ctx.fill();

  // Inner glow core
  ctx.globalAlpha = 0.5 + glow * 0.3;
  ctx.fillStyle = C.jellyGlow;
  ctx.beginPath();
  ctx.ellipse(0, -21, bellW * 0.4, bellH * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Trailing tentacles — each lags slightly for a gentle drifting wave
  ctx.strokeStyle = C.jellyTentacle;
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 0.5;
  const tentacleCount = 5;
  for (let i = 0; i < tentacleCount; i++) {
    const tx    = -bellW * 0.7 + (i / (tentacleCount - 1)) * bellW * 1.4;
    const sway  = Math.sin(pulseT * 0.8 + i * 0.9) * 6;
    const sway2 = Math.sin(pulseT * 0.8 + i * 0.9 + 1.2) * 9;
    ctx.beginPath();
    ctx.moveTo(tx, -14);
    ctx.quadraticCurveTo(tx + sway, -2, tx + sway2, 14 + (i % 2) * 4);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  ctx.globalAlpha = 1;
  ctx.restore();
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
  if (!isTouchDevice()) {
    // Touch devices get a tappable icon instead (see drawTouchControls / MUTE_BTN).
    ctx.fillStyle = '#48cae4';
    ctx.font = '11px "Courier New"';
    ctx.fillText(sfxMuted ? 'SFX OFF (M)' : 'SFX ON (M)', W - 14, highScore > 0 ? 68 : 50);
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

function drawNameEntryScreen() {
  ctx.fillStyle = 'rgba(2,13,26,0.90)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 200);
  ctx.fillStyle = `rgba(247,215,107,${pulse})`;
  ctx.font = 'bold 22px "Courier New"';
  ctx.fillText('YOU MADE THE LEADERBOARD!', W / 2, H / 2 - 84);

  ctx.fillStyle = '#caf0f8';
  ctx.font = '18px "Courier New"';
  ctx.fillText(`Score: ${player.score}`, W / 2, H / 2 - 54);

  ctx.fillStyle = '#90e0ef';
  ctx.font = '14px "Courier New"';
  ctx.fillText('Enter your name (up to 12 characters)', W / 2, H / 2 - 22);

  const { x: boxX, y: boxY, w: boxW, h: boxH } = NAME_ENTRY_BOX;
  ctx.strokeStyle = '#48cae4';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  const touch = isTouchDevice();
  if (!touch) {
    // On touch devices the native input overlay renders its own text on
    // top of this box, so drawing it here too would double up.
    const blink = Math.floor(Date.now() / 500) % 2 === 0;
    ctx.fillStyle = '#caf0f8';
    ctx.font = 'bold 20px "Courier New"';
    ctx.fillText(inputName.toUpperCase() + (blink ? '|' : ''), W / 2, boxY + 27);
  }

  ctx.fillStyle = '#48cae4';
  ctx.font = '13px "Courier New"';
  if (touch) {
    ctx.fillText('Tap the box to type, leave blank for ANON', W / 2, H / 2 + 56);
    ctx.fillText('Tap outside the box to save', W / 2, H / 2 + 74);
  } else {
    ctx.fillText('ENTER to confirm  •  leave blank for ANON', W / 2, H / 2 + 56);
  }
  ctx.textAlign = 'left';
}

function drawDeathScreen() {
  ctx.fillStyle = 'rgba(2,13,26,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#ff6b9d';
  ctx.font = 'bold 28px "Courier New"';
  ctx.fillText('MAGGIE SWAM AWAY...', W / 2, 46);

  ctx.fillStyle = '#caf0f8';
  ctx.font = '18px "Courier New"';
  ctx.fillText(`Score: ${player.score}`, W / 2, 76);

  if (isNewHighScore) {
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 150);
    ctx.fillStyle = `rgba(247,215,107,${pulse})`;
    ctx.font = 'bold 16px "Courier New"';
    ctx.fillText('~ NEW HIGH SCORE! ~', W / 2, 100);
  } else if (highScore > 0) {
    ctx.fillStyle = '#90e0ef';
    ctx.font = '14px "Courier New"';
    ctx.fillText(`Best: ${highScore}`, W / 2, 100);
  }

  const board = leaderboardCache;
  if (board.length > 0) {
    ctx.fillStyle = '#48cae4';
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillText('── TOP SCORES ──', W / 2, 128);

    board.slice(0, 5).forEach((entry, i) => {
      const y = 150 + i * 22;
      const isYou = entry.score === player.score;
      ctx.fillStyle = isYou ? '#f7d76b' : '#caf0f8';
      ctx.font = isYou ? 'bold 13px "Courier New"' : '13px "Courier New"';
      const medal = ['1.', '2.', '3.', '4.', '5.'][i];
      ctx.fillText(`${medal} ${entry.name.padEnd(12)}  ${entry.score}`, W / 2, y);
    });
  }

  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  ctx.fillStyle = '#48cae4';
  ctx.font = 'bold 14px "Courier New"';
  if (blink) ctx.fillText('Press ENTER or tap to try again!', W / 2, 278);
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
  sfx.start();
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
      if (restartTimer === 1) {
        isNewHighScore = saveHighScore();
        if (isNewHighScore) sfx.highScore();
      }
      if (restartTimer > 60) {
        restartTimer = 0;
        if (qualifiesForLeaderboard(player.score)) {
          gameState = 'enterName';
          inputName = '';
        } else {
          leaderboardCache = loadLeaderboard();
          gameState = 'dead';
        }
      }
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
    if (deadCooldown > 0) deadCooldown--;
    drawDeathScreen();
    if (deadCooldown <= 0 && pressed(['Enter', 'KeyZ'])) resetGame();
  }

  if (gameState === 'enterName') {
    drawNameEntryScreen();
    syncNameInputOverlay();
  } else {
    hideNameInputOverlay();
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
    loadLeaderboard, addToLeaderboard, qualifiesForLeaderboard,
    toggleMute,
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
    get inputName()        { return inputName; },
    set inputName(v)       { inputName = v; },
    get deadCooldown()     { return deadCooldown; },
    set deadCooldown(v)    { deadCooldown = v; },
    get sfxMuted()          { return sfxMuted; },
    set sfxMuted(v)         { sfxMuted = v; },
  };
}
