
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const bestEl = document.getElementById("best");
const finalScoreEl = document.getElementById("finalScore");

const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const muteBtn = document.getElementById("muteBtn");

const W = canvas.width;
const H = canvas.height;

let player;
let enemies = [];
let gems = [];
let particles = [];
let floatingTexts = [];
let keys = {};

let score = 0;
let elapsed = 0;
let gemBonus = 50;
let gemSpawnTimer = 0;
let spawnTimer = 0;

let best = Number(localStorage.getItem("neonBest")) || 0;
let running = false;
let lastTime = 0;
let animationId = null;

let soundEnabled = true;
let audioContext = null;

bestEl.textContent = best;

// -------------------- SOUND --------------------

function playTone(frequency, duration, type = "square", volume = 0.04) {
  if (!soundEnabled) return;

  try {
    audioContext ??= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("Audio unavailable:", error);
  }
}

muteBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  muteBtn.textContent = soundEnabled ? "SOUND: ON" : "SOUND: OFF";

  if (soundEnabled) {
    playTone(660, 0.12);
  }
});

// -------------------- RESET GAME --------------------

function resetGame() {
  player = {
    x: W / 2,
    y: H / 2,
    size: 12,
    speed: 230
  };

  enemies = [];
  gems = [];
  particles = [];
  floatingTexts = [];
  keys = {};

  score = 0;
  elapsed = 0;
  spawnTimer = 0;
  gemSpawnTimer = 0;

  scoreEl.textContent = score;
  timerEl.textContent = "0.0";
}

// -------------------- SPAWN ENEMIES --------------------

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);

  let x;
  let y;

  if (side === 0) {
    x = Math.random() * W;
    y = -20;
  } else if (side === 1) {
    x = W + 20;
    y = Math.random() * H;
  } else if (side === 2) {
    x = Math.random() * W;
    y = H + 20;
  } else {
    x = -20;
    y = Math.random() * H;
  }

  enemies.push({
    x,
    y,
    size: 10,
    speed: 55 + Math.random() * 25
  });
}

// -------------------- SPAWN GEMS --------------------

function spawnGem() {
  // Avoid spawning a gem directly on the player.
  let x;
  let y;
  let attempts = 0;

  do {
    x = 25 + Math.random() * (W - 50);
    y = 25 + Math.random() * (H - 50);
    attempts++;
  } while (
    Math.hypot(x - player.x, y - player.y) < 100 &&
    attempts < 20
  );

  gems.push({
    x,
    y,
    size: 9,
    pulse: Math.random() * Math.PI * 2
  });
}

// -------------------- PARTICLES --------------------

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;

    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.4 + Math.random() * 0.4,
      maxLife: 0.8,
      color
    });
  }
}

// -------------------- FLOATING SCORE --------------------

function showFloatingText(x, y, text, color) {
  floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.9,
    maxLife: 0.9
  });
}

// -------------------- DRAW BACKGROUND --------------------

function drawGrid() {
  ctx.fillStyle = "#080816";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(0, 245, 255, 0.08)";
  ctx.lineWidth = 1;

  const gridSize = 40;

  for (let x = 0; x <= W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let y = 0; y <= H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

// -------------------- DRAW PLAYER --------------------

function drawPlayer() {
  ctx.save();

  ctx.shadowBlur = 18;
  ctx.shadowColor = "#00f5ff";
  ctx.fillStyle = "#00f5ff";

  ctx.fillRect(
    player.x - player.size / 2,
    player.y - player.size / 2,
    player.size,
    player.size
  );

  ctx.restore();
}

// -------------------- DRAW ENEMIES --------------------

function drawEnemies() {
  enemies.forEach((enemy) => {
    ctx.save();

    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff2d75";
    ctx.fillStyle = "#ff2d75";

    ctx.fillRect(
      enemy.x - enemy.size / 2,
      enemy.y - enemy.size / 2,
      enemy.size,
      enemy.size
    );

    ctx.restore();
  });
}

// -------------------- DRAW GEMS --------------------

function drawGems() {
  gems.forEach((gem) => {
    ctx.save();

    ctx.translate(gem.x, gem.y);
    ctx.rotate(Math.PI / 4);

    const pulseSize =
      gem.size + Math.sin(gem.pulse) * 2;

    ctx.shadowBlur = 18;
    ctx.shadowColor = "#00f5ff";
    ctx.fillStyle = "#00f5ff";

    ctx.fillRect(
      -pulseSize / 2,
      -pulseSize / 2,
      pulseSize,
      pulseSize
    );

    ctx.restore();
  });
}

// -------------------- DRAW PARTICLES --------------------

function drawParticles(dt) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    ctx.globalAlpha = Math.max(
      0,
      particle.life / particle.maxLife
    );

    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  });

  ctx.globalAlpha = 1;

  particles = particles.filter(
    (particle) => particle.life > 0
  );
}

// -------------------- DRAW FLOATING TEXT --------------------

function drawFloatingTexts(dt) {
  floatingTexts.forEach((item) => {
    item.y -= 35 * dt;
    item.life -= dt;

    ctx.save();
    ctx.globalAlpha = Math.max(
      0,
      item.life / item.maxLife
    );

    ctx.fillStyle = item.color;
    ctx.font = "bold 18px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowBlur = 12;
    ctx.shadowColor = item.color;
    ctx.fillText(item.text, item.x, item.y);

    ctx.restore();
  });

  floatingTexts = floatingTexts.filter(
    (item) => item.life > 0
  );
}

// -------------------- UPDATE GAME --------------------

function update(dt) {
  elapsed += dt;

  // Player movement
  let dx = 0;
  let dy = 0;

  if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
  if (keys.ArrowDown || keys.s || keys.S) dy += 1;
  if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
  if (keys.ArrowRight || keys.d || keys.D) dx += 1;

  // Normalize diagonal movement
  if (dx !== 0 || dy !== 0) {
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  // Keep player inside canvas
  player.x = Math.max(
    player.size / 2,
    Math.min(W - player.size / 2, player.x)
  );

  player.y = Math.max(
    player.size / 2,
    Math.min(H - player.size / 2, player.y)
  );

  // Spawn enemies
  spawnTimer += dt;

  const spawnInterval = Math.max(
    0.35,
    1.15 - elapsed * 0.012
  );

  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
  }

  // Spawn a gem every few seconds if none is waiting
  gemSpawnTimer += dt;

  if (gemSpawnTimer >= 3 && gems.length === 0) {
    gemSpawnTimer = 0;
    spawnGem();
  }

  // Move enemies toward player and check collisions
  for (const enemy of enemies) {
    const ex = player.x - enemy.x;
    const ey = player.y - enemy.y;
    const distance = Math.hypot(ex, ey) || 1;

    enemy.x += (ex / distance) * enemy.speed * dt;
    enemy.y += (ey / distance) * enemy.speed * dt;

    const collisionDistance =
      player.size / 2 + enemy.size / 2;

    if (distance < collisionDistance) {
      endGame();
      return;
    }
  }

  // Update gems and check collection
  for (let i = gems.length - 1; i >= 0; i--) {
    const gem = gems[i];

    gem.pulse += dt * 5;

    const distance = Math.hypot(
      player.x - gem.x,
      player.y - gem.y
    );

    if (distance < player.size / 2 + gem.size) {
      gems.splice(i, 1);

      score += gemBonus;
      scoreEl.textContent = score;

      burst(gem.x, gem.y, "#00f5ff", 16);
      showFloatingText(
        gem.x,
        gem.y - 10,
        `+${gemBonus}`,
        "#00f5ff"
      );

      playTone(880, 0.12, "sine", 0.05);

      // Start the timer for the next gem
      gemSpawnTimer = 0;
    }
  }

  // Survival points + gem bonus
  score += 0; // Gem bonuses are added directly to score.
  scoreEl.textContent = score;
  timerEl.textContent = elapsed.toFixed(1);
}

// -------------------- RENDER --------------------

function render(dt = 0) {
  drawGrid();
  drawParticles(dt);
  drawGems();
  drawPlayer();
  drawEnemies();
  drawFloatingTexts(dt);
}

// -------------------- GAME LOOP --------------------

function loop(timestamp) {
  if (!running) return;

  const dt = Math.min(
    (timestamp - lastTime) / 1000 || 0,
    0.033
  );

  lastTime = timestamp;

  update(dt);
  render(dt);

  if (running) {
    animationId = requestAnimationFrame(loop);
  }
}

// -------------------- START GAME --------------------

function startGame() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  resetGame();

  startScreen.classList.add("hidden");
  gameOverScreen.classList.add("hidden");

  running = true;
  lastTime = performance.now();

  playTone(600, 0.12);

  animationId = requestAnimationFrame(loop);
}

// -------------------- END GAME --------------------

function endGame() {
  if (!running) return;

  running = false;

  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  burst(player.x, player.y, "#00f5ff");
  render(0);

  finalScoreEl.textContent = score;

  if (score > best) {
    best = score;
    localStorage.setItem("neonBest", best);
    bestEl.textContent = best;
  }

  gameOverScreen.classList.remove("hidden");

  playTone(150, 0.3, "sawtooth", 0.06);
}

// -------------------- CONTROLS --------------------

window.addEventListener("keydown", (event) => {
  const key = event.key;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(key)
  ) {
    event.preventDefault();
  }

  keys[key] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

window.addEventListener("blur", () => {
  keys = {};
});

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);

// Initial screen
resetGame();
render();
