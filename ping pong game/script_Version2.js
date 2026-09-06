// Simple Pong with Start/Pause and Sound (Web Audio API)
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const playerScoreEl = document.getElementById('playerScore');
  const computerScoreEl = document.getElementById('computerScore');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const muteBtn = document.getElementById('muteBtn');
  const pausedOverlay = document.getElementById('pausedOverlay');

  const W = canvas.width;
  const H = canvas.height;

  // Paddle settings
  const PADDLE_WIDTH = 10;
  const PADDLE_HEIGHT = 100;
  const PADDLE_MARGIN = 10;
  const PLAYER_SPEED = 6;
  const AI_SPEED = 4.2;

  // Ball settings
  const BALL_RADIUS = 8;
  const INITIAL_BALL_SPEED = 5;
  const SPEED_INCREASE = 1.03; // slight speed increase on paddle hit
  const MAX_BALL_SPEED = 14;

  // Game state
  let playerScore = 0;
  let computerScore = 0;

  const state = {
    running: false,
    muted: false,
    waitingToServe: false
  };

  const player = {
    x: PADDLE_MARGIN,
    y: (H - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: 0
  };

  const computer = {
    x: W - PADDLE_MARGIN - PADDLE_WIDTH,
    y: (H - PADDLE_HEIGHT) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: 0,
    speed: AI_SPEED
  };

  const ball = {
    x: W / 2,
    y: H / 2,
    r: BALL_RADIUS,
    speed: INITIAL_BALL_SPEED,
    dx: 0,
    dy: 0
  };

  // Input state
  const keys = {
    ArrowUp: false,
    ArrowDown: false
  };

  // Web Audio
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playSound(kind = 'tap') {
    if (state.muted) return;
    ensureAudio();
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g);
    g.connect(audioCtx.destination);

    if (kind === 'paddle') {
      o.type = 'sine';
      o.frequency.setValueAtTime(900, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      o.start(now);
      o.stop(now + 0.2);
    } else if (kind === 'wall') {
      o.type = 'square';
      o.frequency.setValueAtTime(520, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.08, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.start(now);
      o.stop(now + 0.25);
    } else if (kind === 'score') {
      // short descending blip
      const freqs = [660, 520, 380];
      let t = now;
      for (let i = 0; i < freqs.length; i++) {
        o.frequency.setValueAtTime(freqs[i], t + i * 0.06);
      }
      o.type = 'triangle';
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.14, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      o.start(now);
      o.stop(now + 0.32);
    } else {
      // default tap
      o.type = 'sine';
      o.frequency.setValueAtTime(700, now);
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.10, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      o.start(now);
      o.stop(now + 0.16);
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function resetBall(directionToward) {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.speed = INITIAL_BALL_SPEED;
    ball.dx = 0;
    ball.dy = 0;
    state.waitingToServe = true;
    // serve after short delay if game running
    if (state.running) {
      setTimeout(() => {
        if (state.running) {
          serve(directionToward === undefined ? (Math.random() < 0.5 ? 1 : -1) : directionToward);
          state.waitingToServe = false;
        }
      }, 700);
    }
  }

  function serve(directionToward) {
    const dir = typeof directionToward === 'number' ? directionToward : (Math.random() < 0.5 ? -1 : 1);
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // small random angle
    ball.dx = dir * ball.speed * Math.cos(angle);
    ball.dy = ball.speed * Math.sin(angle);
    state.waitingToServe = false;
  }

  function drawNet() {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const segment = 12;
    for (let y = 0; y < H; y += segment * 2) {
      ctx.fillRect(W / 2 - 1, y + 6, 2, segment);
    }
  }

  function draw() {
    // clear
    ctx.clearRect(0, 0, W, H);

    // net
    drawNet();

    // paddles
    ctx.fillStyle = '#00d4ff';
    roundRect(ctx, player.x, player.y, player.width, player.height, 3);
    roundRect(ctx, computer.x, computer.y, computer.width, computer.height, 3);

    // ball
    ctx.beginPath();
    ctx.fillStyle = '#ffd166';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    // glow
    ctx.beginPath();
    const g = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.r * 4);
    g.addColorStop(0, 'rgba(255,209,102,0.14)');
    g.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = g;
    ctx.arc(ball.x, ball.y, ball.r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // rounded rectangle helper
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function update() {
    // PLAYER movement via keys
    if (keys.ArrowUp) player.y -= PLAYER_SPEED;
    if (keys.ArrowDown) player.y += PLAYER_SPEED;

    // ensure player stays in bounds
    player.y = clamp(player.y, 0, H - player.height);

    // AI movement: follow ball with limited speed and some smoothing
    const aiCenter = computer.y + computer.height / 2;
    const diff = ball.y - aiCenter;
    if (Math.abs(diff) > 8) {
      computer.y += Math.sign(diff) * computer.speed;
    }
    computer.y = clamp(computer.y, 0, H - computer.height);

    // move ball (only if it's active)
    if (!(ball.dx === 0 && ball.dy === 0)) {
      ball.x += ball.dx;
      ball.y += ball.dy;
    }

    // wall collision
    if (ball.y - ball.r <= 0) {
      ball.y = ball.r;
      ball.dy = -ball.dy;
      playSound('wall');
    } else if (ball.y + ball.r >= H) {
      ball.y = H - ball.r;
      ball.dy = -ball.dy;
      playSound('wall');
    }

    // left paddle*
