// =============================================================================
// LEVEL DEVIL — Full Game with Animated Human Character
// =============================================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = 800, H = 560;

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playTone(freq, dur, type = 'square', vol = 0.15) {
  ensureAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxJump() { playTone(440, 0.12, 'sine', 0.1); }
function sfxDeath() { playTone(120, 0.4, 'sawtooth', 0.2); playTone(80, 0.5, 'sawtooth', 0.15); }
function sfxWin() {
  playTone(523, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.15, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.3, 'sine', 0.12), 200);
}
function sfxTrap() { playTone(200, 0.2, 'square', 0.1); }

// ─── Troll Messages ──────────────────────────────────────────────────────────
const trollMsgs = [
  "That wasn't very fair, was it?","Did you really trust that platform?",
  "The floor is a lie.","Maybe try not dying?","Git gud.",
  "That spike was totally visible... not.","Skill issue.",
  "The game is working as intended.","You fell for that? Really?",
  "Pro tip: don't die.","This is fine. Everything is fine.",
  "Rage quit is always an option.","Your keyboard works, right?",
  "I see you've discovered gravity.","Were you even trying?",
  "Fun fact: you can't win.","Just one more try... right?",
  "The exit was RIGHT THERE.","Patience is a virtue you don't have.",
  "That trap was placed with love ❤️","Your ancestors are disappointed.",
  "Even my grandma would do better.","Have you tried turning your brain on?"
];

// ─── Input ───────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ─── Game State ───────────────────────────────────────────────────────────────
let currentLevel = 0;
let deaths = 0;
let startTime = 0;
let elapsedTime = 0;
let gameState = 'menu';
let screenShake = 0;
let warningTimer = 0;
let particles = [];
let levelTimer = 0;
let playerName = 'Anonymous';
let deathFlash = 0;
let winEffect = 0;

// ─── Animated Human Player ───────────────────────────────────────────────────
const player = {
  x: 0, y: 0, w: 16, h: 38,
  vx: 0, vy: 0,
  onGround: false,
  speed: 5.0,
  jumpForce: -10.5,
  gravity: 0.45,
  maxFallSpeed: 14,
  facing: 1,
  trail: [],
  reverseControls: false,
  jumpDelay: 0,
  jumpQueued: false,
  slowSpeed: false,
  // Animation
  animFrame: 0,
  animTimer: 0,
  isRunning: false,
  isDead: false,
  deadTimer: 0,
  squishY: 1,
  squishX: 1,
  legSwing: 0,
  armSwing: 0,
  bobOffset: 0,
  bobDir: 1,
  jumpSquish: 0,
};

// ─── Draw Animated Human ─────────────────────────────────────────────────────
function drawHuman(px, py, facing, state, animFrame, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const cx = px + player.w / 2;
  const by = py + player.h; // bottom of player hitbox

  // Colors
  const skinColor = '#f4a460';
  const darkSkin = '#c8843a';
  const shirtColor = '#ff3344';
  const pantsColor = '#2255cc';
  const shoeColor = '#333';
  const hairColor = '#222';

  // Animation values
  const t = animFrame * 0.25;
  const isWalking = state === 'walk';
  const isJumping = state === 'jump';
  const isDead = state === 'dead';

  let legL = 0, legR = 0, armL = 0, armR = 0;
  let bodyTilt = 0;
  let headBob = 0;
  let squishX = 1, squishY = 1;

  if (isWalking) {
    legL = Math.sin(t * 3) * 12;
    legR = -Math.sin(t * 3) * 12;
    armL = -Math.sin(t * 3) * 10;
    armR = Math.sin(t * 3) * 10;
    bodyTilt = Math.sin(t * 3) * 1.5;
    headBob = Math.abs(Math.sin(t * 3)) * 1.5;
  } else if (isJumping) {
    legL = -20; legR = 20;
    armL = -30; armR = 30;
    squishX = 0.88; squishY = 1.12;
  } else if (isDead) {
    legL = 40; legR = -20;
    armL = 60; armR = -40;
    squishX = 1.3; squishY = 0.7;
  } else {
    // Idle - slight breathing
    headBob = Math.sin(t * 0.8) * 0.8;
    armL = Math.sin(t * 0.8) * 3;
    armR = -Math.sin(t * 0.8) * 3;
  }

  ctx.save();
  ctx.translate(cx, by);
  if (facing === -1) ctx.scale(-1, 1);
  ctx.rotate((bodyTilt * Math.PI) / 180);
  ctx.scale(squishX, squishY);

  const totalH = player.h;
  // Y coordinates from bottom (0 = feet, -totalH = top of head)
  const feetY = 0;
  const legTopY = -totalH * 0.38;
  const waistY = -totalH * 0.42;
  const shoulderY = -totalH * 0.78;
  const neckY = -totalH * 0.82;
  const headCY = -totalH * 0.92;
  const headR = 7;

  // ── SHOES ──
  // Left shoe
  ctx.save();
  ctx.rotate((legL * Math.PI) / 180);
  ctx.fillStyle = shoeColor;
  ctx.beginPath();
  ctx.ellipse(0, feetY - 2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right shoe
  ctx.save();
  ctx.rotate((legR * Math.PI) / 180);
  ctx.fillStyle = shoeColor;
  ctx.beginPath();
  ctx.ellipse(0, feetY - 2, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── LEGS ──
  const legW = 5;
  // Left leg
  ctx.save();
  ctx.translate(-4, legTopY);
  ctx.rotate((legL * Math.PI) / 180);
  ctx.fillStyle = pantsColor;
  ctx.fillRect(-legW / 2, 0, legW, legTopY * -1 + feetY - legTopY - 4);
  ctx.restore();

  // Right leg
  ctx.save();
  ctx.translate(4, legTopY);
  ctx.rotate((legR * Math.PI) / 180);
  ctx.fillStyle = pantsColor;
  ctx.fillRect(-legW / 2, 0, legW, legTopY * -1 + feetY - legTopY - 4);
  ctx.restore();

  // ── BODY / TORSO ──
  const bodyW = 16;
  const bodyH = Math.abs(shoulderY - waistY) + 2;
  ctx.fillStyle = shirtColor;
  ctx.beginPath();
  ctx.roundRect(-bodyW / 2, shoulderY - 2, bodyW, bodyH + 4, 3);
  ctx.fill();

  // Shirt detail (pocket/stripe)
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-3, shoulderY + 2, 6, 5);

  // ── ARMS ──
  const armW = 4;
  const armLen = 14;

  // Left arm
  ctx.save();
  ctx.translate(-bodyW / 2 + 1, shoulderY + 3);
  ctx.rotate(((armL - 10) * Math.PI) / 180);
  ctx.fillStyle = shirtColor;
  ctx.fillRect(-armW / 2, 0, armW, armLen - 2);
  // Hand
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, armLen, 3, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(bodyW / 2 - 1, shoulderY + 3);
  ctx.rotate(((armR + 10) * Math.PI) / 180);
  ctx.fillStyle = shirtColor;
  ctx.fillRect(-armW / 2, 0, armW, armLen - 2);
  // Hand
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(0, armLen, 3, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── NECK ──
  ctx.fillStyle = skinColor;
  ctx.fillRect(-3, neckY - 1, 6, Math.abs(headCY - neckY) + headR - 1);

  // ── HEAD ──
  const hx = 0, hy = headCY - headBob;
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(hx, hy, headR + 1, headR, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = hairColor;
  ctx.beginPath();
  ctx.ellipse(hx, hy - headR * 0.2, headR + 1, headR * 0.6, 0, Math.PI, 0);
  ctx.fill();
  // Hair detail
  ctx.fillRect(hx - headR, hy - headR * 0.5, headR * 2 + 2, 4);

  // Eyes
  if (!isDead) {
    // White of eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(hx + 3, hy - 1, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx - 2, hy - 1, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(hx + 3.5, hy - 1, 1.2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx - 1.5, hy - 1, 1.2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(hx + 4, hy - 1.5, 0.5, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyebrows - worried expression while running
    ctx.strokeStyle = hairColor;
    ctx.lineWidth = 1.5;
    if (isWalking) {
      ctx.beginPath(); ctx.moveTo(hx + 1, hy - 4); ctx.lineTo(hx + 5.5, hy - 3.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 4.5, hy - 3.2); ctx.lineTo(hx - 0.5, hy - 4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(hx + 1, hy - 3.5); ctx.lineTo(hx + 5.5, hy - 3.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 4.5, hy - 3.5); ctx.lineTo(hx - 0.5, hy - 3.5); ctx.stroke();
    }
    // Mouth - smile or grimace
    ctx.beginPath();
    if (isJumping) {
      ctx.arc(hx, hy + 2, 2.5, 0, Math.PI);
    } else if (isWalking) {
      ctx.moveTo(hx - 2, hy + 2.5); ctx.lineTo(hx + 2, hy + 2.5);
    } else {
      ctx.arc(hx, hy + 3, 2, 0, Math.PI);
    }
    ctx.strokeStyle = darkSkin;
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Dead X eyes
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1.5;
    const ex1 = hx + 3, ey1 = hy - 1;
    ctx.beginPath(); ctx.moveTo(ex1-2, ey1-2); ctx.lineTo(ex1+2, ey1+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex1+2, ey1-2); ctx.lineTo(ex1-2, ey1+2); ctx.stroke();
    const ex2 = hx - 2, ey2 = hy - 1;
    ctx.beginPath(); ctx.moveTo(ex2-2, ey2-2); ctx.lineTo(ex2+2, ey2+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex2+2, ey2-2); ctx.lineTo(ex2-2, ey2+2); ctx.stroke();
    // Sad mouth
    ctx.beginPath();
    ctx.arc(hx, hy + 4, 2, Math.PI, 0);
    ctx.strokeStyle = darkSkin;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Glow effect around player
  if (!isDead) {
    ctx.globalAlpha = 0.15;
    const grd = ctx.createRadialGradient(0, headCY / 2, 0, 0, headCY / 2, 20);
    grd.addColorStop(0, '#ff3344');
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.fillRect(-20, headCY - 10, 40, Math.abs(headCY) + 15);
  }

  ctx.restore();
  ctx.restore();
}

// ─── Level Setup ─────────────────────────────────────────────────────────────
function makePlatform(x, y, w, h, opts = {}) {
  return {
    x, y, w, h: h || 16,
    color: opts.color || '#2a2a4a',
    fake: opts.fake || false, fakeTimer: 0, fakeTriggered: false, visible: true,
    moving: opts.moving || false, mx: opts.mx || 0, my: opts.my || 0,
    mRange: opts.mRange || 0, mSpeed: opts.mSpeed || 1, mOrig: { x, y }, mTime: 0,
    crumble: opts.crumble || false, crumbleTimer: 0, crumbleTriggered: false,
  };
}

function makeSpike(x, y, w, h, opts = {}) {
  return {
    x, y, w, h, isSpike: true, dir: opts.dir || 'up', color: '#ff3333',
    hidden: opts.hidden || false, revealDist: opts.revealDist || 120, revealed: false,
    moving: opts.moving || false, mx: opts.mx || 0, my: opts.my || 0,
    mRange: opts.mRange || 0, mSpeed: opts.mSpeed || 1, mOrig: { x, y }, mTime: 0,
    popup: opts.popup || false, popupTriggered: false,
    popupOrigY: y, popupTargetY: opts.popupTargetY || y,
  };
}

function makeExit(x, y) { return { x, y, w: 30, h: 44 }; }

// ─── Level Themes ─────────────────────────────────────────────────────────────
const levelThemes = [
  { sky:['#87CEEB','#d4f0ff'], platCol:'#3d7a3d', platHi:'rgba(180,255,120,0.18)', movCol:'#2a6aa0', spikeCol:'#cc3300',
    gridCol:'rgba(255,255,255,0.06)', starCount:0, cloudCount:5, name:'Sunny Meadow' },
  { sky:['#ff9966','#ffcc88'], platCol:'#7a4a1e', platHi:'rgba(255,200,100,0.15)', movCol:'#a06020', spikeCol:'#ff3300',
    gridCol:'rgba(255,180,80,0.05)', starCount:0, cloudCount:3, name:'Sunset Cave' },
  { sky:['#c8eeff','#e8f8ff'], platCol:'#3377bb', platHi:'rgba(200,240,255,0.25)', movCol:'#2255aa', spikeCol:'#003388',
    gridCol:'rgba(100,200,255,0.06)', starCount:0, cloudCount:4, name:'Arctic Ice' },
  { sky:['#220000','#440800'], platCol:'#6a1500', platHi:'rgba(255,80,0,0.15)', movCol:'#993300', spikeCol:'#ff5500',
    gridCol:'rgba(255,80,0,0.07)', starCount:0, cloudCount:0, name:'Lava World' },
  { sky:['#f0c0ff','#ffe0f8'], platCol:'#c060a0', platHi:'rgba(255,200,255,0.2)', movCol:'#8830b0', spikeCol:'#ff0066',
    gridCol:'rgba(255,150,255,0.06)', starCount:0, cloudCount:4, name:'Candy Land' },
  { sky:['#002244','#004466'], platCol:'#005577', platHi:'rgba(0,200,255,0.18)', movCol:'#006688', spikeCol:'#00ddff',
    gridCol:'rgba(0,150,255,0.06)', starCount:8, cloudCount:0, name:'Deep Ocean' },
  { sky:['#1a0a2a','#2a1040'], platCol:'#3a1a5a', platHi:'rgba(200,100,255,0.15)', movCol:'#5a0a8a', spikeCol:'#dd00ff',
    gridCol:'rgba(180,80,255,0.05)', starCount:20, cloudCount:2, name:'Ghost World' },
  { sky:['#2a2a2a','#1a1a1a'], platCol:'#555555', platHi:'rgba(255,220,0,0.12)', movCol:'#ff9900', spikeCol:'#ffcc00',
    gridCol:'rgba(255,200,0,0.05)', starCount:0, cloudCount:0, name:'Industrial' },
  { sky:['#000830','#001050'], platCol:'#0a3a7a', platHi:'rgba(0,255,255,0.2)', movCol:'#0055aa', spikeCol:'#00ffff',
    gridCol:'rgba(0,200,255,0.08)', starCount:30, cloudCount:0, name:'Neon Mirror' },
  { sky:['#0d0000','#200000'], platCol:'#6a0000', platHi:'rgba(255,40,0,0.18)', movCol:'#880000', spikeCol:'#ff2200',
    gridCol:'rgba(255,30,0,0.07)', starCount:0, cloudCount:0, name:"Devil's Inferno" },
];

// ─── Levels ─────────────────────────────────────────────────────────────────
const levels = [];

// ── Level 1: SUNNY MEADOW — bright, welcoming, gentle intro with ONE nasty trick ──
levels.push({ name:"Welcome To Hell", spawn:[60,490],
  exit:makeExit(720,80),
  platforms:[
    makePlatform(0,520,180,18),
    makePlatform(210,475,140,18),
    makePlatform(390,430,140,18),
    makePlatform(570,385,140,18),
    makePlatform(480,315,140,18),
    makePlatform(310,250,140,18),
    makePlatform(150,185,140,18),
    makePlatform(310,120,140,18),
    makePlatform(500,145,120,18),
    makePlatform(650,100,150,18),
  ],
  spikes:[
    makeSpike(718,86,30,14),   // ONE sneaky spike right at exit lip
  ],
  msg:"Looks easy. It is. Except for the ONE thing. 😈" });

// ── Level 2: SUNSET CAVE — exit at BOTTOM, ceiling spikes, inverted thinking ──
levels.push({ name:"Topsy Turvy", spawn:[60,80],
  exit:makeExit(710,490),
  platforms:[
    makePlatform(0,0,800,22),   // ceiling floor
    makePlatform(0,60,160,18),  // spawn ledge
    makePlatform(200,130,120,18),
    makePlatform(100,215,120,18),
    makePlatform(270,300,120,18),
    makePlatform(120,385,120,18),
    makePlatform(300,450,100,18),
    makePlatform(450,380,110,18),
    makePlatform(600,300,110,18),
    makePlatform(450,215,110,18),
    makePlatform(600,130,110,18),
    makePlatform(680,210,120,18),
    makePlatform(580,385,110,18),
    makePlatform(690,450,110,18),
  ],
  spikes:[
    makeSpike(160,22,120,14,{dir:'down'}),
    makeSpike(390,22,180,14,{dir:'down'}),
    makeSpike(650,22,150,14,{dir:'down'}),
    makeSpike(220,558,320,16),
  ],
  msg:"Exit is at the BOTTOM. Ceiling will bite. Plan ahead!" });

// ── Level 3: ARCTIC ICE — moving platforms over a spike chasm, precise timing ──
levels.push({ name:"Ice Rink", spawn:[50,490],
  exit:makeExit(720,80),
  platforms:[
    makePlatform(0,520,100,18),
    makePlatform(140,460,90,18,{moving:true,mx:1,mRange:100,mSpeed:1.2}),
    makePlatform(350,400,90,18,{moving:true,mx:1,mRange:90,mSpeed:1.5}),
    makePlatform(180,330,90,18,{moving:true,my:1,mRange:70,mSpeed:1.1}),
    makePlatform(400,260,90,18,{moving:true,mx:1,mRange:110,mSpeed:1.6}),
    makePlatform(200,190,90,18,{moving:true,mx:1,mRange:80,mSpeed:1.3}),
    makePlatform(430,130,90,18,{moving:true,mx:1,mRange:100,mSpeed:1.7}),
    makePlatform(650,90,150,18),
  ],
  spikes:[
    makeSpike(0,558,800,16),
    makeSpike(0,170,12,200),     // left wall
    makeSpike(788,170,12,200),   // right wall
  ],
  msg:"Platforms slide like ice. Wait, time, jump. Repeat." });

// ── Level 4: LAVA WORLD — crumbling platforms over lava, must run fast ──
levels.push({ name:"Hot Feet", spawn:[50,490],
  exit:makeExit(720,80),
  platforms:[
    makePlatform(0,520,110,18),
    makePlatform(130,505,80,18,{crumble:true}),
    makePlatform(230,490,70,18,{crumble:true}),
    makePlatform(320,470,70,18,{crumble:true}),
    makePlatform(410,450,70,18,{crumble:true}),
    makePlatform(500,430,65,18,{crumble:true}),
    makePlatform(585,410,65,18,{crumble:true}),
    makePlatform(670,385,65,18,{crumble:true}),
    makePlatform(590,340,75,18,{crumble:true}),
    makePlatform(490,295,75,18,{crumble:true}),
    makePlatform(380,255,75,18,{crumble:true}),
    makePlatform(470,210,75,18,{crumble:true}),
    makePlatform(575,175,75,18,{crumble:true}),
    makePlatform(665,110,135,18),
  ],
  spikes:[
    makeSpike(0,558,800,16),
    makeSpike(110,558,800,6),  // lava floor glow
  ],
  msg:"The ground melts under you. NEVER stop moving. 🔥" });

// ── Level 5: CANDY LAND — FAKE staircase bait, real path is lower ──
levels.push({ name:"Sweet Lies", spawn:[50,490],
  exit:makeExit(720,80),
  platforms:[
    makePlatform(0,520,130,18),
    // Pretty staircase — all FAKE
    makePlatform(180,470,100,18,{fake:true}),
    makePlatform(320,415,100,18,{fake:true}),
    makePlatform(460,360,100,18,{fake:true}),
    makePlatform(600,305,100,18,{fake:true}),
    makePlatform(660,250,100,18,{fake:true}),
    // Real winding route below
    makePlatform(150,520,80,18),
    makePlatform(260,490,80,18),
    makePlatform(170,450,80,18),
    makePlatform(280,410,80,18),
    makePlatform(390,380,80,18),
    makePlatform(300,330,80,18),
    makePlatform(420,290,80,18),
    makePlatform(540,260,80,18),
    makePlatform(450,210,80,18),
    makePlatform(560,170,80,18),
    makePlatform(660,140,140,18),
  ],
  spikes:[
    makeSpike(0,558,800,16),
  ],
  msg:"Everything beautiful is a trap. The real path is ugly." });

// ── Level 6: DEEP OCEAN — hidden spikes EVERYWHERE, small reveal radius ──
levels.push({ name:"Deep Dread", spawn:[50,490],
  exit:makeExit(720,60),
  platforms:[
    makePlatform(0,520,130,18),
    makePlatform(180,460,130,18),
    makePlatform(360,395,130,18),
    makePlatform(540,330,130,18),
    makePlatform(670,265,130,18),
    makePlatform(490,200,130,18),
    makePlatform(310,140,130,18),
    makePlatform(150,90,130,18),
    makePlatform(310,75,110,18),
    makePlatform(470,80,130,18),
    makePlatform(640,65,160,18),
  ],
  spikes:[
    makeSpike(200,446,100,14,{hidden:true,revealDist:75}),
    makeSpike(385,381,90,14,{hidden:true,revealDist:70}),
    makeSpike(570,316,80,14,{hidden:true,revealDist:65}),
    makeSpike(700,251,70,14,{hidden:true,revealDist:60}),
    makeSpike(520,186,80,14,{hidden:true,revealDist:68}),
    makeSpike(340,126,80,14,{hidden:true,revealDist:72}),
    makeSpike(175,76,80,14,{hidden:true,revealDist:78}),
    makeSpike(335,61,80,14,{hidden:true,revealDist:65}),
    makeSpike(0,558,800,16),
  ],
  msg:"They are everywhere. And they wait until it's almost too late." });

// ── Level 7: GHOST WORLD — reversed controls, descend to bottom-right exit ──
levels.push({ name:"Brain Flip", spawn:[700,80], exit:makeExit(30,490), reverseControls:true,
  platforms:[
    makePlatform(620,80,180,18),
    makePlatform(460,140,120,18,{moving:true,mx:1,mRange:60,mSpeed:1.0}),
    makePlatform(580,210,110,18),
    makePlatform(420,275,110,18,{crumble:true}),
    makePlatform(540,345,110,18,{moving:true,mx:1,mRange:55,mSpeed:1.2}),
    makePlatform(360,405,110,18,{crumble:true}),
    makePlatform(210,350,110,18,{moving:true,my:1,mRange:40,mSpeed:1.1}),
    makePlatform(80,410,120,18),
    makePlatform(150,465,110,18,{crumble:true}),
    makePlatform(0,490,90,18),
  ],
  spikes:[
    makeSpike(420,261,110,14),
    makeSpike(360,391,110,14,{hidden:true,revealDist:95}),
    makeSpike(0,558,800,16),
  ],
  msg:"⚠ CONTROLS REVERSED! You spawn top-right. Exit is bottom-left. Good luck." });

// ── Level 8: INDUSTRIAL — moving platforms + synced spike riders, tight timing ──
levels.push({ name:"The Machine", spawn:[50,490],
  exit:makeExit(720,60),
  platforms:[
    makePlatform(0,520,100,18),
    makePlatform(130,455,100,18,{moving:true,mx:1,mRange:90,mSpeed:1.5}),
    makePlatform(370,390,100,18,{moving:true,mx:1,mRange:80,mSpeed:1.8}),
    makePlatform(210,320,100,18,{moving:true,my:1,mRange:55,mSpeed:1.3}),
    makePlatform(430,255,100,18,{moving:true,mx:1,mRange:95,mSpeed:2.0}),
    makePlatform(280,185,100,18,{crumble:true}),
    makePlatform(430,130,100,18,{moving:true,mx:1,mRange:85,mSpeed:1.7}),
    makePlatform(590,95,90,18,{crumble:true}),
    makePlatform(660,70,140,18),
  ],
  spikes:[
    makeSpike(130,441,45,14,{moving:true,mx:1,mRange:90,mSpeed:1.5}),
    makeSpike(410,376,45,14,{moving:true,mx:1,mRange:80,mSpeed:1.8}),
    makeSpike(445,241,45,14,{moving:true,mx:1,mRange:95,mSpeed:2.0}),
    makeSpike(450,116,45,14,{moving:true,mx:1,mRange:85,mSpeed:1.7}),
    makeSpike(220,306,60,14,{hidden:true,revealDist:85}),
    makeSpike(290,171,60,14,{hidden:true,revealDist:80}),
    makeSpike(0,558,800,16),
  ],
  msg:"The spikes move WITH the platforms. Watch the machine's rhythm." });

// ── Level 9: NEON MIRROR — everything: fake+crumble+moving+hidden+reversed ──
levels.push({ name:"Maximum Chaos", spawn:[50,490], exit:makeExit(720,65), reverseControls:true,
  platforms:[
    makePlatform(0,520,110,18),
    makePlatform(150,465,90,18,{crumble:true}),
    makePlatform(280,415,90,18,{moving:true,mx:1,mRange:65,mSpeed:1.4}),
    makePlatform(450,360,90,18,{fake:true}),
    makePlatform(450,440,90,18),       // real below fake
    makePlatform(580,295,90,18,{crumble:true}),
    makePlatform(430,230,90,18,{moving:true,my:1,mRange:45,mSpeed:1.6}),
    makePlatform(280,165,90,18,{crumble:true}),
    makePlatform(410,115,90,18,{moving:true,mx:1,mRange:70,mSpeed:1.9}),
    makePlatform(570,145,90,18,{fake:true}),
    makePlatform(570,215,90,18),       // real below fake
    makePlatform(670,80,130,18),
  ],
  spikes:[
    makeSpike(590,281,90,14,{hidden:true,revealDist:90}),
    makeSpike(290,151,80,14,{hidden:true,revealDist:85}),
    makeSpike(160,451,80,14),
    makeSpike(0,558,800,16),
  ],
  msg:"⚠ REVERSED + Fake + Crumble + Hidden + Moving. ALL at once." });

// ── Level 10: DEVIL'S INFERNO — brutal gauntlet, all mechanics, no mercy ──
levels.push({ name:"DEVIL'S INFERNO", spawn:[50,500],
  exit:makeExit(715,50),
  platforms:[
    makePlatform(0,535,90,18),
    makePlatform(110,510,70,18,{crumble:true}),
    makePlatform(200,485,70,18,{crumble:true}),
    makePlatform(290,460,70,18,{crumble:true}),
    makePlatform(385,430,75,18,{fake:true}),
    makePlatform(385,510,75,18),         // real
    makePlatform(490,450,75,18,{moving:true,mx:1,mRange:55,mSpeed:1.7}),
    makePlatform(620,395,75,18,{moving:true,my:1,mRange:45,mSpeed:1.9}),
    makePlatform(500,330,70,18),
    makePlatform(370,275,75,18,{fake:true}),
    makePlatform(260,275,75,18),         // real
    makePlatform(150,220,75,18,{crumble:true}),
    makePlatform(265,175,75,18,{moving:true,mx:1,mRange:65,mSpeed:2.1}),
    makePlatform(430,145,75,18,{crumble:true}),
    makePlatform(540,110,75,18,{moving:true,mx:1,mRange:50,mSpeed:2.0}),
    makePlatform(665,75,135,18),
  ],
  spikes:[
    makeSpike(490,436,40,14,{moving:true,mx:1,mRange:55,mSpeed:1.7}),
    makeSpike(620,381,40,14,{moving:true,my:1,mRange:45,mSpeed:1.9}),
    makeSpike(270,261,60,14,{hidden:true,revealDist:85}),
    makeSpike(160,206,65,14,{hidden:true,revealDist:80}),
    makeSpike(275,161,65,14,{hidden:true,revealDist:75}),
    makeSpike(545,96,70,14,{hidden:true,revealDist:78}),
    makeSpike(0,558,800,16),
  ],
  msg:"This is it. No second chances. Survive or cry. 🔥💀🔥" });

// ─── Clone Level ─────────────────────────────────────────────────────────────
function cloneLevel(idx) {
  const lvl = JSON.parse(JSON.stringify(levels[idx]));
  lvl.platforms.forEach(p => { p.mOrig = { x: p.x, y: p.y }; });
  lvl.spikes.forEach(s => { if (s.mOrig) s.mOrig = { x: s.x, y: s.y }; s.popupOrigY = s.y; });
  return lvl;
}

let activeLvl = null;

// ─── Load Level ───────────────────────────────────────────────────────────────
function loadLevel(idx) {
  currentLevel = idx;
  activeLvl = cloneLevel(idx);
  particles = [];
  levelTimer = 0;

  player.x = activeLvl.spawn[0];
  player.y = activeLvl.spawn[1];
  player.vx = 0; player.vy = 0;
  player.onGround = false;
  player.reverseControls = activeLvl.reverseControls || false;
  player.jumpDelay = 0; player.jumpQueued = false;
  player.slowSpeed = activeLvl.slowSpeed || false;
  player.trail = [];
  player.isDead = false;
  player.animFrame = 0;

  document.getElementById('hudLevel').textContent = idx + 1;

  // Flash theme name then level message
  const th = levelThemes[Math.min(idx, levelThemes.length - 1)];
  showWarning(`LVL ${idx + 1}: ${activeLvl.name}`);
  setTimeout(() => {
    if (gameState === 'playing') {
      if (activeLvl.reverseControls) showWarning("⚠ CONTROLS REVERSED ⚠");
      else showWarning(activeLvl.msg || '');
    }
  }, 1800);
}

function showWarning(txt) {
  const el = document.getElementById('warningBanner');
  el.textContent = txt;
  el.classList.add('show');
  warningTimer = 200;
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
const overlay = document.getElementById('overlay');
function showOverlay(title, subtitle, desc, btnText, showStats, troll) {
  document.getElementById('overlayTitle').textContent = title;
  
  const subtitleEl = document.getElementById('overlaySubtitle');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.display = subtitle ? '' : 'none';
  
  const descEl = document.getElementById('overlayDesc');
  descEl.textContent = desc;
  descEl.style.display = desc ? '' : 'none';

  document.getElementById('overlayBtn').textContent = btnText;
  document.getElementById('overlayStats').style.display = showStats ? 'flex' : 'none';
  document.getElementById('trollMsg').textContent = troll || '';
  if (showStats) {
    document.getElementById('statDeaths').textContent = deaths;
    document.getElementById('statTime').textContent = formatTime(elapsedTime);
  }
  const nameSection = document.getElementById('nameSection');
  nameSection.style.display = (gameState === 'menu') ? 'flex' : 'none';
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

document.getElementById('overlayBtn').addEventListener('click', () => {
  ensureAudio();
  playerName = document.getElementById('playerNameInput').value.trim() || 'Anonymous';
  if (gameState === 'menu') {
    gameState = 'playing';
    deaths = 0;
    startTime = performance.now();
    elapsedTime = 0;
    loadLevel(0);
    hideOverlay();
  } else if (gameState === 'dead') {
    gameState = 'playing';
    loadLevel(currentLevel);
    hideOverlay();
  } else if (gameState === 'win' || gameState === 'gameover') {
    gameState = 'menu';
    showOverlay('LEVEL DEVIL','','','START GAME', false);
  }
});

document.addEventListener('keydown', e => {
  if (gameState !== 'playing') {
    if (e.code === 'Enter') {
      e.preventDefault();
      document.getElementById('overlayBtn').click();
    }
    return;
  }
  if (e.code === 'KeyR' && gameState === 'dead') {
    gameState = 'playing';
    loadLevel(currentLevel);
    hideOverlay();
  }
});
// ─── Physics ─────────────────────────────────────────────────────────────────
function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayer() {
  const lvl = activeLvl;
  const spd = player.slowSpeed ? player.speed * 0.6 : player.speed;
  const rev = player.reverseControls;

  let moveLeft = rev ? keys['ArrowRight'] : keys['ArrowLeft'];
  let moveRight = rev ? keys['ArrowLeft'] : keys['ArrowRight'];

  if (moveLeft) { player.vx = -spd; player.facing = rev ? 1 : -1; player.isRunning = true; }
  else if (moveRight) { player.vx = spd; player.facing = rev ? -1 : 1; player.isRunning = true; }
  else { player.vx *= 0.7; if (Math.abs(player.vx) < 0.3) player.vx = 0; player.isRunning = false; }

  // Jump
  if (lvl.delayedJump) {
    if (keys['Space'] && player.onGround && !player.jumpQueued) {
      player.jumpQueued = true;
      player.jumpDelay = 12;
    }
    if (player.jumpQueued) {
      player.jumpDelay--;
      if (player.jumpDelay <= 0) {
        if (player.onGround) { player.vy = player.jumpForce; player.onGround = false; sfxJump(); }
        player.jumpQueued = false;
      }
    }
  } else {
    if (keys['Space'] && player.onGround) {
      player.vy = player.jumpForce;
      player.onGround = false;
      sfxJump();
    }
  }

  player.vy += player.gravity;
  if (player.vy > player.maxFallSpeed) player.vy = player.maxFallSpeed;

  player.x += player.vx;
  if (player.x < 0) player.x = 0;
  if (player.x + player.w > W) player.x = W - player.w;

  // X platform collision
  for (const p of lvl.platforms) {
    if (!p.visible) continue;
    if (rectCollide(player, p)) {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  player.y += player.vy;
  player.onGround = false;

  // Y platform collision
  for (const p of lvl.platforms) {
    if (!p.visible) continue;
    if (rectCollide(player, p)) {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        if (p.fake && !p.fakeTriggered) { p.fakeTriggered = true; p.fakeTimer = 30; sfxTrap(); }
        if (p.crumble && !p.crumbleTriggered) { p.crumbleTriggered = true; p.crumbleTimer = 45; sfxTrap(); }
        if (p.moving) {
          const dx = Math.sin((p.mTime) * 0.02 * p.mSpeed) * p.mx * p.mSpeed * 0.5;
          player.x += dx;
        }
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }

  if (player.y > H + 50) killPlayer();

  // Trail
  player.trail.push({ x: player.x + player.w/2, y: player.y + player.h/2 });
  if (player.trail.length > 10) player.trail.shift();

  // Animation frame
  if (player.isRunning && player.onGround) {
    player.animTimer++;
    if (player.animTimer > 4) { player.animFrame++; player.animTimer = 0; }
  } else {
    player.animFrame = 0;
  }
}

// ─── Update Traps ─────────────────────────────────────────────────────────────
function updateTraps() {
  const lvl = activeLvl;
  levelTimer++;

  for (const p of lvl.platforms) {
    if (p.moving && p.visible) {
      p.mTime++;
      p.x = p.mOrig.x + Math.sin(p.mTime * 0.02 * p.mSpeed) * p.mRange * p.mx;
      p.y = p.mOrig.y + Math.sin(p.mTime * 0.02 * p.mSpeed) * p.mRange * p.my;
    }
    if (p.fake && p.fakeTriggered) { p.fakeTimer--; if (p.fakeTimer <= 0) p.visible = false; }
    if (p.crumble && p.crumbleTriggered) { p.crumbleTimer--; if (p.crumbleTimer <= 0) p.visible = false; }
  }

  for (const s of lvl.spikes) {
    if (!s.isSpike) continue;
    if (s.moving) {
      s.mTime++;
      s.x = s.mOrig.x + Math.sin(s.mTime * 0.02 * s.mSpeed) * s.mRange * (s.mx || 0);
      s.y = s.mOrig.y + Math.sin(s.mTime * 0.02 * s.mSpeed) * s.mRange * (s.my || 0);
    }
    if (s.hidden && !s.revealed) {
      const dx = (player.x + player.w/2) - (s.x + s.w/2);
      const dy = (player.y + player.h/2) - (s.y + s.h/2);
      if (Math.sqrt(dx*dx + dy*dy) < (s.revealDist * 1.8)) { s.revealed = true; s.hidden = false; sfxTrap(); }
    }
    if (s.popup && !s.popupTriggered) {
      if (Math.abs((player.x + player.w/2) - (s.x + s.w/2)) < 60) { s.popupTriggered = true; sfxTrap(); }
    }
    if (s.popup && s.popupTriggered) { s.y += (s.popupTargetY - s.y) * 0.3; }
    if (!s.hidden && rectCollide(player, s)) killPlayer();
  }

  const e = lvl.exit;
  if (rectCollide(player, e)) winLevel();
}

// ─── Kill / Win ───────────────────────────────────────────────────────────────
function killPlayer() {
  if (gameState !== 'playing') return;
  deaths++;
  gameState = 'dead';
  screenShake = 18;
  deathFlash = 8;
  sfxDeath();
  document.getElementById('hudDeaths').textContent = deaths;

  player.isDead = true;

  for (let i = 0; i < 24; i++) {
    particles.push({
      x: player.x + player.w/2, y: player.y + player.h/2,
      vx: (Math.random()-0.5)*12, vy: (Math.random()-0.5)*12 - 4,
      life: 45+Math.random()*20,
      color: Math.random()>0.5?'#ff2244':'#ff8844',
      size: 3+Math.random()*5,
    });
  }

  setTimeout(() => {
    if (gameState === 'dead') {
      const msg = trollMsgs[Math.floor(Math.random()*trollMsgs.length)];
      showOverlay('YOU DIED', `LVL ${currentLevel+1}: ${activeLvl.name}`,
        'Press R or click below to retry.', 'RETRY', false, msg);
    }
  }, 600);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyR' && (gameState === 'dead')) {
    gameState = 'playing';
    loadLevel(currentLevel);
    hideOverlay();
  }
});

function winLevel() {
  if (gameState !== 'playing') return;
  sfxWin();
  winEffect = 60;
  if (currentLevel >= levels.length - 1) {
    gameState = 'win';
    elapsedTime = (performance.now() - startTime) / 1000;
    // Save score
    saveScore(playerName, deaths, elapsedTime);
    showOverlay('🎉 YOU WIN! 🎉', 'YOU BEAT LEVEL DEVIL!',
      `All 10 levels conquered! Total deaths: ${deaths}. Absolute legend.`,
      'PLAY AGAIN', true,
      deaths===0?"Zero deaths?! Are you even human?":
      deaths<15?"Not bad... not bad at all.":
      deaths<50?"That was painful to watch.":
      "You died more than a cat has lives. Several cats.");
  } else {
    currentLevel++;
    loadLevel(currentLevel);
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.35; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function drawSpikes(s) {
  const th = levelThemes[Math.min(currentLevel, levelThemes.length - 1)];
  ctx.fillStyle = s.color !== '#ff3333' ? s.color : th.spikeCol;
  ctx.shadowColor = th.spikeCol;
  ctx.shadowBlur = 12;

  if (s.h <= 16) {
    const count = Math.max(1, Math.floor(s.w / 14));
    const sw = s.w / count;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      if (s.dir === 'up') {
        ctx.moveTo(s.x + i*sw + 1, s.y + s.h);
        ctx.lineTo(s.x + i*sw + sw/2, s.y);
        ctx.lineTo(s.x + (i+1)*sw - 1, s.y + s.h);
      } else {
        ctx.moveTo(s.x + i*sw + 1, s.y);
        ctx.lineTo(s.x + i*sw + sw/2, s.y + s.h);
        ctx.lineTo(s.x + (i+1)*sw - 1, s.y);
      }
      ctx.fill();
    }
  } else {
    // Floor spikes
    const count = Math.floor(s.w / 14);
    const sw = s.w / count;
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i*sw + 1, s.y + s.h);
      ctx.lineTo(s.x + i*sw + sw/2, s.y);
      ctx.lineTo(s.x + (i+1)*sw - 1, s.y + s.h);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function drawPlatform(p) {
  if (!p.visible) return;
  let alpha = 1;
  if (p.fake && p.fakeTriggered) alpha = Math.max(0, p.fakeTimer / 18);
  if (p.crumble && p.crumbleTriggered) {
    alpha = Math.max(0, p.crumbleTimer / 28);
  }
  ctx.globalAlpha = alpha;

  // Platform color — themed
  const th = levelThemes[Math.min(currentLevel, levelThemes.length - 1)];
  let col = th.platCol;
  if (p.moving) col = th.movCol;
  if (p.fake) col = th.platCol; // same but with shimmer
  if (p.crumble && p.crumbleTriggered) {
    ctx.save();
    if (p.crumbleTimer < 15) ctx.translate((Math.random()-0.5)*3, (Math.random()-0.5)*3);
    col = '#8b4513';
  }

  ctx.fillStyle = col;
  const r = 3;
  ctx.beginPath();
  ctx.moveTo(p.x+r, p.y); ctx.lineTo(p.x+p.w-r, p.y);
  ctx.quadraticCurveTo(p.x+p.w, p.y, p.x+p.w, p.y+r);
  ctx.lineTo(p.x+p.w, p.y+p.h-r);
  ctx.quadraticCurveTo(p.x+p.w, p.y+p.h, p.x+p.w-r, p.y+p.h);
  ctx.lineTo(p.x+r, p.y+p.h);
  ctx.quadraticCurveTo(p.x, p.y+p.h, p.x, p.y+p.h-r);
  ctx.lineTo(p.x, p.y+r);
  ctx.quadraticCurveTo(p.x, p.y, p.x+r, p.y);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(p.x+2, p.y+1, p.w-4, 3);

  if (p.moving) {
    ctx.strokeStyle = 'rgba(100,180,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (p.fake && !p.fakeTriggered) {
    const shimmer = Math.abs(Math.sin(levelTimer * 0.035)) * 0.12;
    ctx.fillStyle = `rgba(180,80,255,${shimmer})`;
    ctx.fillRect(p.x+2, p.y+1, p.w-4, p.h-2);
  }

  if (p.crumble && !p.crumbleTriggered) {
    ctx.fillStyle = 'rgba(255,120,30,0.08)';
    ctx.fillRect(p.x+2, p.y+1, p.w-4, p.h-2);
  }

  ctx.globalAlpha = 1;
  if (p.crumble && p.crumbleTriggered) ctx.restore();
}

function render() {
  ctx.save();

  // Screen shake
  if (screenShake > 0) {
    ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
    screenShake -= 0.9;
  }

  // Death flash
  if (deathFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${deathFlash/8 * 0.3})`;
    ctx.fillRect(0, 0, W, H);
    deathFlash--;
  }

  // BG — themed per level
  const theme = levelThemes[Math.min(currentLevel, levelThemes.length - 1)];
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.sky[0]);
  bg.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Stars (dark levels)
  if (theme.starCount > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    // Deterministic star positions seeded by level index
    for (let i = 0; i < theme.starCount; i++) {
      const sx = ((i * 137 + currentLevel * 41) % 780) + 10;
      const sy = ((i * 97 + currentLevel * 23) % 300) + 10;
      const sr = 0.8 + (i % 3) * 0.5;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill();
    }
  }

  // Clouds (bright levels)
  if (theme.cloudCount > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < theme.cloudCount; i++) {
      const cx2 = ((i * 193 + currentLevel * 31 + levelTimer * 0.2) % 900) - 50;
      const cy2 = 40 + (i * 60) % 120;
      const cw = 60 + (i * 20) % 40;
      ctx.beginPath();
      ctx.ellipse(cx2, cy2, cw, 18, 0, 0, Math.PI*2);
      ctx.ellipse(cx2 + cw*0.3, cy2 - 10, cw*0.6, 16, 0, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // Subtle grid
  ctx.strokeStyle = theme.gridCol;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  if (gameState === 'playing' || gameState === 'dead') {
    const lvl = activeLvl;

    // Exit portal
    const e = lvl.exit;
    const t = levelTimer * 0.05;
    // Portal glow
    ctx.save();
    const grd = ctx.createRadialGradient(e.x+e.w/2, e.y+e.h/2, 0, e.x+e.w/2, e.y+e.h/2, 40);
    grd.addColorStop(0, 'rgba(0,255,136,0.2)');
    grd.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(e.x-20, e.y-20, e.w+40, e.h+40);
    // Door frame
    ctx.fillStyle = '#00cc66';
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = '#001a0d';
    ctx.fillRect(e.x+3, e.y+3, e.w-6, e.h-6);
    // Animated inner portal
    ctx.fillStyle = `rgba(0,255,136,${0.3+Math.sin(t*3)*0.2})`;
    ctx.fillRect(e.x+3, e.y+3, e.w-6, e.h-6);
    // Door knob
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(e.x+e.w-8, e.y+e.h/2, 3, 0, Math.PI*2);
    ctx.fill();
    // EXIT text
    ctx.fillStyle = 'rgba(0,255,136,0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x+e.w/2, e.y - 6);
    ctx.textAlign = 'left';
    ctx.restore();

    // Platforms
    for (const p of lvl.platforms) drawPlatform(p);

    // Spikes
    for (const s of lvl.spikes) {
      if (!s.isSpike || s.hidden) continue;
      drawSpikes(s);
    }

    // Player trail
    for (let i = 0; i < player.trail.length; i++) {
      const t2 = player.trail[i];
      const a = (i / player.trail.length) * 0.2;
      ctx.fillStyle = `rgba(255,50,70,${a})`;
      const sz = (i/player.trail.length) * 8;
      ctx.fillRect(t2.x - sz/2, t2.y - sz/2, sz, sz);
    }

    // Draw animated human
    if (gameState === 'playing') {
      const state = !player.onGround ? 'jump' : player.isRunning ? 'walk' : 'idle';
      drawHuman(player.x, player.y, player.facing, state, player.animFrame, 1);
    } else if (gameState === 'dead') {
      // Show dead human at last position
      drawHuman(player.x, player.y, player.facing, 'dead', 0, 1);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life / 60;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Win effect
    if (winEffect > 0) {
      ctx.globalAlpha = winEffect / 60 * 0.5;
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      winEffect--;
    }
  }

  ctx.restore();
}

// ─── HUD Timer ────────────────────────────────────────────────────────────────
function formatTime(s) {
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function updateHUD() {
  if (gameState === 'playing') {
    elapsedTime = (performance.now() - startTime) / 1000;
    document.getElementById('hudTime').textContent = formatTime(elapsedTime);
  }
  if (warningTimer > 0) {
    warningTimer--;
    if (warningTimer <= 0) document.getElementById('warningBanner').classList.remove('show');
  }
}

// ─── Score API ────────────────────────────────────────────────────────────────
async function saveScore(name, d, time) {
  try {
    await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, deaths: d, time: Math.round(time) }),
    });
  } catch (e) { console.log('Could not save score', e); }
}

async function loadLeaderboard() {
  const el = document.getElementById('lbContent');
  // Clean default content
  el.innerHTML = '<div class="text-center text-zinc-500 py-10 font-space-grotesk tracking-widest uppercase">Loading records...</div>';
  try {
    const res = await fetch('/api/scores');
    const data = await res.json();
    if (!data.length) { el.innerHTML = '<div class="text-center text-zinc-500 py-10 font-space-grotesk tracking-widest uppercase">No records found.</div>'; return; }
    
    let html = '';
    data.forEach((s, i) => {
      const isTop = i === 0;
      const rankNum = (i + 1).toString().padStart(2, '0');
      const rankColor = isTop ? 'text-tertiary' : 'text-zinc-500';
      const bgCol = isTop ? 'bg-surface-container-lowest border-l-4 border-tertiary shadow-[0_4px_24px_rgba(255,164,76,0.15)]' : 'bg-surface-container-low hover:bg-surface-bright border-l-4 border-transparent';
      const iconBg = isTop ? 'bg-tertiary/20' : 'bg-surface-container';
      const iconCol = isTop ? 'text-tertiary' : 'text-zinc-500';
      const icon = isTop ? 'military_tech' : 'person';
      
      html += `
        <div class="flex items-center gap-4 ${bgCol} p-4 rounded-lg transition-colors mb-3">
            <span class="font-space-grotesk font-black ${rankColor} text-lg w-6 text-center">${rankNum}</span>
            <div class="w-10 h-10 rounded-md ${iconBg} flex items-center justify-center border border-outline-variant/10">
                <span class="material-symbols-outlined ${iconCol}" data-icon="${icon}">${icon}</span>
            </div>
            <div class="flex-1">
                <p class="font-space-grotesk text-sm font-bold uppercase tracking-widest text-on-surface">${escHtml(s.name)}</p>
                <p class="font-body text-[10px] text-zinc-500 mt-1">DEATHS: <span class="text-primary font-bold">${s.deaths}</span> \u00A0|\u00A0 TIME: <span class="text-secondary font-bold">${formatTime(s.time)}</span></p>
            </div>
        </div>
      `;
    });
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = '<div class="text-center text-primary py-10 font-space-grotesk tracking-widest uppercase text-xs">Error: Sync failed.</div>';
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Leaderboard modal
document.getElementById('lbBtn').addEventListener('click', () => {
  document.getElementById('leaderboardModal').classList.add('open');
  loadLeaderboard();
});
document.getElementById('lbClose').addEventListener('click', () => {
  document.getElementById('leaderboardModal').classList.remove('open');
});
document.getElementById('leaderboardModal').addEventListener('click', e => {
  if (e.target === document.getElementById('leaderboardModal')) {
    document.getElementById('leaderboardModal').classList.remove('open');
  }
});

// ─── Game Loop ─────────────────────────────────────────────────────────────────
let globalFrame = 0;
function gameLoop() {
  globalFrame++;
  if (gameState === 'playing') {
    updatePlayer();
    updateTraps();
  }
  updateParticles();
  updateHUD();
  render();
  requestAnimationFrame(gameLoop);
}

// ─── Init ──────────────────────────────────────────────────────────────────────
showOverlay('LEVEL DEVIL','','','START GAME', false);
gameLoop();
