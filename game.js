/* ================= Fly Dimo Fly ================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const faceImg = new Image();
faceImg.src = 'assets/face.png';
let DPR = Math.min(window.devicePixelRatio || 1, 2);
let CW, CH;
function resize(){
  const maxW = Math.min(window.innerWidth, 460);
  const maxH = window.innerHeight;
  CW = maxW; CH = maxH;
  canvas.style.width = CW+'px';
  canvas.style.height = CH+'px';
  canvas.width = CW*DPR;
  canvas.height = CH*DPR;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  buildStars();
  buildSkylines();
}
window.addEventListener('resize', resize);

// ---------- Haptics ----------
function vibrate(pattern){
  if(navigator.vibrate){
    try{ navigator.vibrate(pattern); }catch(e){}
  }
}

// ---------- Storage helpers ----------
const Store = {
  get(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw===null) return fallback;
      return JSON.parse(raw);
    }catch(e){ return fallback; }
  },
  set(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
  }
};

// ---------- SFX / Music ----------
const SFX = {
  bump: document.getElementById('sfxBump'),
  booster: document.getElementById('sfxBooster'),
  caught: document.getElementById('sfxCaught')
};
const BGM = document.getElementById('bgm');
const BGM_VOLUME = 0.6;
BGM.volume = BGM_VOLUME;
let muted = false;
function playSfx(name){
  if(muted) return;
  const el = SFX[name];
  if(!el) return;
  try{ el.currentTime = 0; el.play().catch(()=>{}); }catch(e){}
}
document.getElementById('mute').addEventListener('click', ()=>{
  muted = !muted;
  document.getElementById('mute').textContent = muted ? '\u{1F507}' : '\u{1F50A}';
  BGM.muted = muted;
});
let audioUnlocked = false;
function unlockAudio(){
  if(audioUnlocked) return;
  audioUnlocked = true;
  Object.values(SFX).forEach(a=>{
    a.volume = 1;
    const p = a.play();
    if(p && p.then){
      p.then(()=>{ a.pause(); a.currentTime = 0; }).catch(()=>{
        a.muted = true;
        a.play().then(()=>{ a.pause(); a.currentTime=0; a.muted=false; }).catch(()=>{});
      });
    }
  });
  BGM.volume = BGM_VOLUME;
  BGM.muted = muted;
  BGM.play().catch(()=>{});
}

// ---------- Difficulty ----------
const DIFFICULTIES = {
  easy:   { gap: 230, speed: 0.20, label:'Easy' },
  normal: { gap: 190, speed: 0.24, label:'Normal' },
  hard:   { gap: 155, speed: 0.30, label:'Hard' }
};
let difficulty = 'normal';

// ---------- Mode (normal / daily) ----------
let mode = 'normal';
function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

// ---------- Seeded RNG (for Daily Challenge determinism) ----------
function mulberry32(seed){
  return function(){
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let rng = Math.random;
function setupRng(){
  if(mode==='daily'){
    let seed = 0;
    const key = todayKey()+'-'+difficulty;
    for(let i=0;i<key.length;i++){ seed = (seed*31 + key.charCodeAt(i))|0; }
    rng = mulberry32(seed);
  } else {
    rng = Math.random;
  }
}

// ---------- Skins ----------
const SKINS = [
  { id:'default',    name:'Default',     unlockScore:0   },
  { id:'sunglasses', name:'Cool Dimo',   unlockScore:25  },
  { id:'cape',       name:'Caped Dimo',  unlockScore:60  },
  { id:'golden',     name:'Golden Dimo', unlockScore:120 }
];
let unlockedSkins = Store.get('flyDimoSkinsUnlocked', ['default']);
let selectedSkin = Store.get('flyDimoSkinSelected', 'default');
if(!unlockedSkins.includes(selectedSkin)) selectedSkin = 'default';

function getSkinStyle(){
  switch(selectedSkin){
    case 'sunglasses': return { torso1:'#ff6b98', torso2:'#ff3d7f', cap:'#ffd23f', sunglasses:true, cape:false, golden:false };
    case 'cape':       return { torso1:'#ff6b98', torso2:'#ff3d7f', cap:'#ffd23f', sunglasses:false, cape:true,  golden:false };
    case 'golden':     return { torso1:'#ffe58a', torso2:'#ffd23f', cap:'#fff2c0', sunglasses:false, cape:false, golden:true  };
    default:            return { torso1:'#ff6b98', torso2:'#ff3d7f', cap:'#ffd23f', sunglasses:false, cape:false, golden:false };
  }
}

function renderSkinRow(){
  const row = document.getElementById('skinRow');
  row.innerHTML = '';
  SKINS.forEach(s=>{
    const unlocked = unlockedSkins.includes(s.id);
    const div = document.createElement('div');
    div.className = 'skin-option' + (s.id===selectedSkin?' selected':'') + (!unlocked?' locked':'');
    div.title = unlocked ? s.name : `${s.name} — unlock at score ${s.unlockScore}`;
    const mini = document.createElement('canvas');
    mini.width = 40; mini.height = 40;
    drawSkinPreview(mini.getContext('2d'), s.id, unlocked);
    div.appendChild(mini);
    if(!unlocked){
      const lock = document.createElement('span');
      lock.className = 'lock';
      lock.textContent = '\u{1F512}';
      div.appendChild(lock);
    }
    div.addEventListener('click', ()=>{
      if(!unlocked) return;
      selectedSkin = s.id;
      Store.set('flyDimoSkinSelected', selectedSkin);
      renderSkinRow();
    });
    row.appendChild(div);
  });
}
function drawSkinPreview(c, skinId, unlocked){
  c.clearRect(0,0,40,40);
  const styles = {
    default:    { torso:'#ff3d7f', cap:'#ffd23f' },
    sunglasses: { torso:'#ff3d7f', cap:'#ffd23f' },
    cape:       { torso:'#ff3d7f', cap:'#ffd23f' },
    golden:     { torso:'#ffd23f', cap:'#fff2c0' }
  }[skinId];
  c.save();
  c.translate(20,22);
  c.globalAlpha = unlocked ? 1 : 0.5;
  c.fillStyle = styles.torso;
  c.beginPath(); c.roundRect ? c.roundRect(-8,-4,16,14,4) : c.rect(-8,-4,16,14); c.fill();
  c.fillStyle = '#f2b98a';
  c.beginPath(); c.arc(0,-12,8,0,Math.PI*2); c.fill();
  c.fillStyle = styles.cap;
  c.beginPath(); c.ellipse(0,-17,8,3,0,0,Math.PI*2); c.fill();
  if(skinId==='sunglasses'){
    c.fillStyle = '#1a0b2e';
    c.fillRect(-5,-13,10,3);
  }
  if(skinId==='cape'){
    c.fillStyle = '#2ec4f1';
    c.beginPath();
    c.moveTo(-8,-2); c.lineTo(-14,10); c.lineTo(-6,6); c.closePath(); c.fill();
  }
  c.restore();
}

// ---------- Achievements ----------
const ACHIEVEMENTS = [
  { id:'first_flight', title:'First Flight',  desc:'Play your first run',            icon:'🕊️', check: s=>s.totalRuns>=1 },
  { id:'coin_10',      title:'Coin Collector', desc:'Collect 10 pickups total',       icon:'🪙', check: s=>s.totalPickups>=10 },
  { id:'coin_50',      title:'Coin Hoarder',   desc:'Collect 50 pickups total',       icon:'💰', check: s=>s.totalPickups>=50 },
  { id:'combo_5',      title:'On a Roll',      desc:'Reach a combo of 5',             icon:'🔥', check: s=>s.bestCombo>=5 },
  { id:'combo_10',     title:'Unstoppable',    desc:'Reach a combo of 10',            icon:'⚡', check: s=>s.bestCombo>=10 },
  { id:'score_25',     title:'Rising Star',    desc:'Score 25 in a single run',       icon:'⭐', check: s=>s.bestScore>=25 },
  { id:'score_50',     title:'Sky Master',     desc:'Score 50 in a single run',       icon:'🌟', check: s=>s.bestScore>=50 },
  { id:'score_100',    title:'Legend',         desc:'Score 100 in a single run',      icon:'👑', check: s=>s.bestScore>=100 },
  { id:'shield_5',     title:'Shield Bearer',  desc:'Use 5 shields total',            icon:'🛡️', check: s=>s.totalShieldsUsed>=5 },
  { id:'daily_player',  title:'Daily Grinder', desc:'Play a Daily Challenge run',     icon:'📅', check: s=>s.dailyRuns>=1 }
];
let unlockedAchievements = Store.get('flyDimoAchievementsUnlocked', []);
let stats = Store.get('flyDimoStats', {
  totalRuns:0, totalPickups:0, bestCombo:0, bestScore:0, totalShieldsUsed:0, dailyRuns:0
});

function checkAchievements(){
  const newlyUnlocked = [];
  ACHIEVEMENTS.forEach(a=>{
    if(!unlockedAchievements.includes(a.id) && a.check(stats)){
      unlockedAchievements.push(a.id);
      newlyUnlocked.push(a);
    }
  });
  if(newlyUnlocked.length){
    Store.set('flyDimoAchievementsUnlocked', unlockedAchievements);
    vibrate([20,30,20,30,20]);
    newlyUnlocked.forEach((a,i)=>{
      setTimeout(()=> showToast('🎖️ '+a.title+'!'), i*1000);
    });
  }
  return newlyUnlocked;
}
function renderAchievements(){
  const list = document.getElementById('achievementsList');
  list.innerHTML = '';
  ACHIEVEMENTS.forEach(a=>{
    const unlocked = unlockedAchievements.includes(a.id);
    const row = document.createElement('div');
    row.className = 'ach-row' + (unlocked?'':' locked');
    row.innerHTML = `<div class="ach-icon">${unlocked?a.icon:'🔒'}</div>
      <div class="ach-text"><div class="ach-title">${a.title}</div><div class="ach-desc">${a.desc}</div></div>`;
    list.appendChild(row);
  });
}

// ---------- Leaderboard ----------
function getLeaderboard(){ return Store.get('flyDimoLeaderboard', []); }
function maybeAddToLeaderboard(finalScore){
  if(finalScore<=0) return false;
  const board = getLeaderboard();
  const qualifies = board.length<10 || finalScore > Math.min(...board.map(b=>b.score));
  if(!qualifies) return false;
  let name = 'Dimo';
  try{
    const entered = prompt('New leaderboard score! Enter your name:', 'Dimo');
    if(entered && entered.trim()) name = entered.trim().slice(0,16);
  }catch(e){}
  board.push({ name, score: finalScore, date: new Date().toLocaleDateString() });
  board.sort((a,b)=>b.score-a.score);
  const trimmed = board.slice(0,10);
  Store.set('flyDimoLeaderboard', trimmed);
  return true;
}
function renderLeaderboard(){
  const list = document.getElementById('leaderboardList');
  const board = getLeaderboard();
  list.innerHTML = '';
  if(!board.length){
    list.innerHTML = '<div class="lb-empty">No scores yet — go fly!</div>';
    return;
  }
  board.forEach((b,i)=>{
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.innerHTML = `<span class="rank">#${i+1}</span><span class="name">${escapeHtml(b.name)}</span><span class="sc">${b.score}</span>`;
    list.appendChild(row);
  });
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Run history ----------
function addHistory(finalScore){
  const hist = Store.get('flyDimoHistory', []);
  hist.push(finalScore);
  while(hist.length>10) hist.shift();
  Store.set('flyDimoHistory', hist);
  return hist;
}
function drawHistoryChart(){
  const c = document.getElementById('historyChart');
  const g = c.getContext('2d');
  const hist = Store.get('flyDimoHistory', []);
  g.clearRect(0,0,c.width,c.height);
  if(!hist.length) return;
  const max = Math.max(1, ...hist);
  const barW = c.width / hist.length;
  hist.forEach((v,i)=>{
    const h = (v/max) * (c.height-16);
    const x = i*barW + barW*0.18;
    const w = barW*0.64;
    const y = c.height - h - 4;
    const grad = g.createLinearGradient(0,y,0,c.height-4);
    grad.addColorStop(0, '#ffd23f');
    grad.addColorStop(1, '#ff3d7f');
    g.fillStyle = grad;
    g.beginPath();
    if(g.roundRect) g.roundRect(x,y,w,h,3); else g.rect(x,y,w,h);
    g.fill();
  });
}

// ---------- Weather / time-of-day themes ----------
const THEMES = [
  { name:'night',  top:'#2a1150', mid:'#3a1a5e', low:'#5c1f4f', bottom:'#1a0b2e', sun:false, moon:true,  stars:true  },
  { name:'sunset', top:'#ff8a5c', mid:'#ff3d7f', low:'#6a2160', bottom:'#241040', sun:true,  moon:false, stars:false, sunColor:'#ffd23f' },
  { name:'day',    top:'#7fd8ff', mid:'#4fc3f7', low:'#8a6fd9', bottom:'#3a1a5e', sun:true,  moon:false, stars:false, sunColor:'#fff6d8' }
];
let currentTheme = THEMES[0];

// ---------- Background layers ----------
let stars = [];
function buildStars(){
  stars = [];
  const n = Math.floor(CW/14);
  for(let i=0;i<n;i++){
    stars.push({
      x: Math.random()*CW,
      y: Math.random()*(CH*0.55),
      r: Math.random()*1.4+0.4,
      phase: Math.random()*Math.PI*2,
      speed: 0.0015+Math.random()*0.002
    });
  }
}

const skylineFar = [];
const skylineNear = [];
function buildSkylines(){
  skylineFar.length = 0; skylineNear.length = 0;
  let x = -40;
  while(x < CW+800){
    const w = 50+Math.random()*70;
    const h = 60+Math.random()*140;
    skylineFar.push({x, w, h, windows: buildWindows(w,h)});
    x += w + 14 + Math.random()*20;
  }
  x = -40;
  while(x < CW+800){
    const w = 70+Math.random()*90;
    const h = 90+Math.random()*190;
    skylineNear.push({x, w, h, windows: buildWindows(w,h), neon: Math.random()<0.35});
    x += w + 18 + Math.random()*26;
  }
}
function buildWindows(w,h){
  const wins = [];
  for(let wy=10; wy<h-8; wy+=16){
    for(let wx=6; wx<w-8; wx+=14){
      if(Math.random()<0.4) wins.push({x:wx,y:wy, lit: Math.random()<0.55});
    }
  }
  return wins;
}

// ---------- Game state ----------
let state = 'menu'; // menu | playing | dead
let score = 0;
let pipeSpeed = DIFFICULTIES.normal.speed;
let pipes = [];
let pickups = [];
let particles = [];
let spawnTimer = 0;
let lastTime = 0;
let worldTime = 0;
let groundOffset = 0;
let farOffset = 0;
let nearOffset = 0;
let shakeT = 0;
let flashT = 0;

let combo = 0;
let runBestCombo = 0;
let runPickups = 0;
let runShields = 0;

const effects = { magnet:0, slowmo:0, multiplier:0 };
const EFFECT_META = {
  magnet:     { label:'MAGNET', dur:4200, color:'#2ec4f1' },
  slowmo:     { label:'SLOW-MO', dur:3200, color:'#8a6fd9' },
  multiplier: { label:'2X SCORE', dur:5200, color:'#ffd23f' }
};

const GRAVITY = 0.0016;
const FLAP_V = -0.62;
const MAX_FALL = 0.85;
const PIPE_W = 76;
const GROUND_H = 64;

const player = {
  x: 0, y: 0, vy: 0,
  rot: 0,
  shield: 0,
  flapAnim: 0,
  trail: []
};

function laneStartX(){ return CW*0.28; }

function resetGame(){
  const diffCfg = DIFFICULTIES[difficulty];
  score = 0;
  pipeSpeed = diffCfg.speed;
  pipes = [];
  pickups = [];
  particles = [];
  spawnTimer = 0;
  shakeT = 0; flashT = 0;
  combo = 0; runBestCombo = 0; runPickups = 0; runShields = 0;
  effects.magnet = 0; effects.slowmo = 0; effects.multiplier = 0;
  player.x = laneStartX();
  player.y = CH*0.42;
  player.vy = 0;
  player.rot = 0;
  player.shield = 0;
  player.flapAnim = 0;
  player.trail = [];
  document.getElementById('score').textContent = '0';
  updateComboUI();
  updatePowerupTray();
  setupRng();
  currentTheme = THEMES[Math.floor(rng()*THEMES.length)];
}

function currentGap(){ return DIFFICULTIES[difficulty].gap; }

function spawnPipe(){
  const diffCfg = DIFFICULTIES[difficulty];
  const gapH = diffCfg.gap;
  const margin = 70;
  const minY = margin + gapH/2;
  const maxY = CH - GROUND_H - margin - gapH/2;
  const gapY = minY + rng()*Math.max(10, maxY-minY);

  const moving = score>=15 && rng()<0.3;
  pipes.push({
    x: CW+PIPE_W, gapY, baseGapY: gapY, passed:false, hit:false,
    moving, moveAmp: 30+rng()*30, moveFreq: 0.0012+rng()*0.0012, movePhase: rng()*Math.PI*2
  });

  if(rng() < 0.55){
    const kind = pickKind();
    pickups.push({ kind, x: CW+PIPE_W+(rng()>0.5?20:-20), y: gapY + (rng()-0.5)*40, taken:false });
  }
}
function pickKind(){
  if(score < 10) return 'shield';
  const r = rng();
  if(r<0.5) return 'shield';
  if(r<0.72) return 'magnet';
  if(r<0.86) return 'slowmo';
  return 'multiplier';
}

function flap(){
  if(state==='menu' || state==='dead'){ return; }
  player.vy = FLAP_V;
  player.flapAnim = 220;
}

// ---------- Input ----------
canvas.addEventListener('touchstart', (e)=>{ e.preventDefault(); if(state==='playing') flap(); }, {passive:false});
canvas.addEventListener('mousedown', ()=>{ if(state==='playing') flap(); });
window.addEventListener('keydown', (e)=>{
  if(e.key===' ' || e.key==='ArrowUp'){
    e.preventDefault();
    if(state==='playing') flap();
  }
});

function startGame(){
  unlockAudio();
  resetGame();
  state = 'playing';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('gameOverPanel').classList.add('hidden');
  document.getElementById('leaderboardPanel').classList.add('hidden');
  document.getElementById('achievementsPanel').classList.add('hidden');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame(){
  state = 'dead';
  playSfx('caught');
  vibrate([100,50,100]);
  shakeT = 380;

  stats.totalRuns += 1;
  stats.totalPickups += runPickups;
  stats.bestCombo = Math.max(stats.bestCombo, runBestCombo);
  stats.bestScore = Math.max(stats.bestScore, score);
  stats.totalShieldsUsed += runShields;
  if(mode==='daily') stats.dailyRuns += 1;
  Store.set('flyDimoStats', stats);

  let BEST = Store.get('flyDimoBest', 0);
  if(score > BEST){ BEST = score; Store.set('flyDimoBest', BEST); }

  if(mode==='daily'){
    const dKey = 'flyDimoDailyBest_'+todayKey()+'_'+difficulty;
    const dBest = Store.get(dKey, 0);
    if(score > dBest) Store.set(dKey, score);
  }

  const newSkins = [];
  SKINS.forEach(s=>{
    if(!unlockedSkins.includes(s.id) && BEST>=s.unlockScore){
      unlockedSkins.push(s.id);
      newSkins.push(s);
    }
  });
  if(newSkins.length) Store.set('flyDimoSkinsUnlocked', unlockedSkins);

  const newAch = checkAchievements();
  addHistory(score);
  const madeLeaderboard = maybeAddToLeaderboard(score);

  setTimeout(()=>{
    document.getElementById('goScore').textContent = 'Score: '+score;
    document.getElementById('goBest').textContent = 'Best: '+BEST + (mode==='daily' ? '  •  Daily mode' : '');
    document.getElementById('goCombo').textContent = 'Best combo this run: x'+runBestCombo;
    document.getElementById('gameOverSub').textContent = madeLeaderboard
      ? "Made the leaderboard! Constable Dhakkan's barricade still got you though."
      : "Constable Dhakkan's barricade got you this time. Try threading the gap a little cleaner.";
    drawHistoryChart();
    document.getElementById('gameOverPanel').classList.remove('hidden');
    if(newSkins.length){
      newSkins.forEach((s,i)=> setTimeout(()=> showToast('👕 New skin: '+s.name+'!'), 400+i*1000));
    }
  }, 420);
}

function showToast(text){
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function spawnParticle(x,y,color,glow){
  // Cosmetic only — deliberately uses Math.random() (not the seeded rng())
  // so reactive particle bursts never desync the Daily Challenge layout seed.
  particles.push({ x,y, vx:(Math.random()-0.5)*6, vy:-Math.random()*4-1, life:420+Math.random()*220, color, glow: !!glow });
}

function updateComboUI(){
  const card = document.getElementById('combo-card');
  if(combo>0){
    card.classList.remove('hidden');
    document.getElementById('combo').textContent = 'x'+combo;
  } else {
    card.classList.add('hidden');
  }
}
function updatePowerupTray(){
  const tray = document.getElementById('powerup-tray');
  tray.innerHTML = '';
  Object.keys(effects).forEach(key=>{
    if(effects[key]>0){
      const meta = EFFECT_META[key];
      const pct = Math.max(0, Math.min(100, (effects[key]/meta.dur)*100));
      const chip = document.createElement('div');
      chip.className = 'powerup-chip';
      chip.style.color = meta.color;
      chip.style.borderColor = meta.color;
      chip.innerHTML = `<span>${meta.label}</span><span class="bar"><i style="width:${pct}%;background:${meta.color}"></i></span>`;
      tray.appendChild(chip);
    }
  });
}

// ---------- Update ----------
function bumpCombo(){
  combo += 1;
  runBestCombo = Math.max(runBestCombo, combo);
  if(combo>0 && combo%5===0){
    score += 5;
    document.getElementById('score').textContent = score;
    showToast('COMBO x'+combo+'! +5');
  }
  updateComboUI();
}
function breakCombo(){
  combo = 0;
  updateComboUI();
}

function update(dt){
  worldTime += dt;
  groundOffset = (groundOffset + pipeSpeed*dt*0.6) % 40;
  farOffset = (farOffset + pipeSpeed*dt*0.12);
  nearOffset = (nearOffset + pipeSpeed*dt*0.28);

  const diffCfg = DIFFICULTIES[difficulty];
  let speedMult = 1;
  if(effects.slowmo>0) speedMult = 0.6;
  pipeSpeed = (diffCfg.speed + Math.min(score*0.006, 0.18)) * speedMult;

  ['magnet','slowmo','multiplier'].forEach(k=>{
    if(effects[k]>0){
      effects[k] -= dt;
      if(effects[k]<=0){ effects[k]=0; }
    }
  });
  updatePowerupTray();

  player.vy += GRAVITY*dt;
  if(player.vy > MAX_FALL) player.vy = MAX_FALL;
  player.y += player.vy*dt;
  player.rot = Math.max(-0.5, Math.min(1.2, player.vy*1.1));
  if(player.flapAnim>0) player.flapAnim -= dt;
  if(player.shield>0) player.shield -= dt;
  if(flashT>0) flashT -= dt;
  if(shakeT>0) shakeT -= dt;

  player.trail.push({x:player.x, y:player.y, life:260});
  for(let i=player.trail.length-1;i>=0;i--){
    player.trail[i].life -= dt;
    if(player.trail[i].life<=0) player.trail.splice(i,1);
  }

  if(player.y < 26){
    player.y = 26;
    if(player.vy < 0){
      player.vy = Math.abs(player.vy)*0.5;
      playSfx('bump');
      flashT = 200;
      for(let i=0;i<8;i++) spawnParticle(player.x, player.y, '#2ec4f1', true);
    }
  }

  const groundY = CH - GROUND_H;
  if(player.y > groundY - 14){
    player.y = groundY - 14;
    endGame();
    return;
  }

  spawnTimer += dt;
  const interval = Math.max(1050, 1500 - score*8);
  if(spawnTimer > interval){ spawnTimer = 0; spawnPipe(); }

  const dx = pipeSpeed*dt;
  for(let i=pipes.length-1;i>=0;i--){
    const p = pipes[i];
    p.x -= dx;
    if(p.moving){
      const gapH = diffCfg.gap;
      const margin = 70;
      const minY = margin + gapH/2;
      const maxY = CH - GROUND_H - margin - gapH/2;
      let ny = p.baseGapY + Math.sin(worldTime*p.moveFreq + p.movePhase)*p.moveAmp;
      p.gapY = Math.max(minY, Math.min(maxY, ny));
    }
    if(!p.passed && p.x + PIPE_W/2 < player.x){
      p.passed = true;
      const gain = effects.multiplier>0 ? 2 : 1;
      score += gain;
      document.getElementById('score').textContent = score;
      bumpCombo();
    }
    if(p.x < -PIPE_W - 20){ pipes.splice(i,1); continue; }

    if(!p.hit){
      const gapH = diffCfg.gap;
      const withinX = Math.abs(p.x - player.x) < (PIPE_W/2 + 16);
      if(withinX){
        const topEdge = p.gapY - gapH/2;
        const botEdge = p.gapY + gapH/2;
        if(player.y - 14 < topEdge || player.y + 14 > botEdge){
          p.hit = true;
          if(player.shield > 0){
            playSfx('bump');
            vibrate(40);
            flashT = 200;
            shakeT = 150;
            for(let k=0;k<8;k++) spawnParticle(player.x, player.y, '#ffd23f', true);
          } else {
            breakCombo();
            endGame();
            return;
          }
        }
      }
    }
  }

  for(let i=pickups.length-1;i>=0;i--){
    const c = pickups[i];
    c.x -= dx;

    if(effects.magnet>0 && !c.taken){
      const ddx = player.x - c.x, ddy = player.y - c.y;
      const dist = Math.sqrt(ddx*ddx+ddy*ddy);
      if(dist < 160 && dist > 1){
        c.x += (ddx/dist) * dt*0.35;
        c.y += (ddy/dist) * dt*0.35;
      }
    }

    if(c.x < -40){ pickups.splice(i,1); continue; }
    if(!c.taken && Math.abs(c.x-player.x) < 22 && Math.abs(c.y-player.y) < 22){
      c.taken = true;
      runPickups += 1;
      bumpCombo();
      if(c.kind==='shield'){
        player.shield = 2600;
        runShields += 1;
        score += 2;
        playSfx('booster');
        showToast('WAAH! SHIELD!');
        for(let k=0;k<14;k++) spawnParticle(c.x, c.y, '#ffd23f', true);
      } else {
        effects[c.kind] = EFFECT_META[c.kind].dur;
        score += 3;
        playSfx('booster');
        vibrate(25);
        showToast(EFFECT_META[c.kind].label+'!');
        for(let k=0;k<14;k++) spawnParticle(c.x, c.y, EFFECT_META[c.kind].color, true);
      }
      document.getElementById('score').textContent = score;
      pickups.splice(i,1);
    }
  }

  for(let i=particles.length-1;i>=0;i--){
    const pt = particles[i];
    pt.x += pt.vx*dt*0.05; pt.y += pt.vy*dt*0.05; pt.vy += 0.002*dt;
    pt.life -= dt;
    if(pt.life<=0) particles.splice(i,1);
  }
}

// ---------- Draw helpers ----------
function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}

function drawSky(){
  const t = currentTheme;
  const g = ctx.createLinearGradient(0,0,0,CH);
  g.addColorStop(0, t.top);
  g.addColorStop(0.45, t.mid);
  g.addColorStop(0.75, t.low);
  g.addColorStop(1, t.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CW,CH);

  if(t.moon){
    ctx.save();
    const mx = CW*0.78, my = CH*0.16, mr = 34;
    const glow = ctx.createRadialGradient(mx,my,mr*0.2,mx,my,mr*3.2);
    glow.addColorStop(0, 'rgba(255,230,190,0.35)');
    glow.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(mx,my,mr*3.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff2d6';
    ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(90,50,90,0.25)';
    ctx.beginPath(); ctx.arc(mx-10,my-6,mr,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if(t.sun){
    ctx.save();
    const mx = CW*0.75, my = CH*0.18, mr = 38;
    const glow = ctx.createRadialGradient(mx,my,mr*0.3,mx,my,mr*3.6);
    glow.addColorStop(0, 'rgba(255,220,150,0.45)');
    glow.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(mx,my,mr*3.6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = t.sunColor || '#ffd23f';
    ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if(t.stars){
    stars.forEach(s=>{
      const tw = 0.5 + Math.sin(worldTime*s.speed + s.phase)*0.5;
      ctx.globalAlpha = 0.35 + tw*0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function drawSkyline(list, offset, color, alpha, groundY, isNear){
  ctx.save();
  ctx.globalAlpha = alpha;
  const span = (list.length ? (list[list.length-1].x + list[list.length-1].w + 60) : CW);
  list.forEach(b=>{
    let bx = ((b.x - offset) % span + span) % span - 60;
    ctx.fillStyle = color;
    ctx.fillRect(bx, groundY-b.h, b.w, b.h);
    b.windows.forEach(w=>{
      if(!w.lit) return;
      const flicker = isNear ? (Math.sin(worldTime*0.002 + w.x*7 + w.y*3) > -0.7) : true;
      if(!flicker) return;
      ctx.fillStyle = isNear ? 'rgba(255,210,120,0.85)' : 'rgba(255,210,120,0.5)';
      ctx.fillRect(bx+w.x, groundY-b.h+w.y, 5, 7);
    });
    if(isNear && b.neon){
      ctx.save();
      ctx.shadowColor = '#ff3d7f';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff3d7f';
      ctx.fillRect(bx+b.w*0.3, groundY-b.h-6, b.w*0.4, 4);
      ctx.restore();
    }
  });
  ctx.restore();
}

function drawGround(){
  const groundY = CH-GROUND_H;
  const g = ctx.createLinearGradient(0,groundY,0,CH);
  g.addColorStop(0, '#2c1550');
  g.addColorStop(1, '#160a24');
  ctx.fillStyle = g;
  ctx.fillRect(0, groundY, CW, GROUND_H);

  ctx.fillStyle = 'rgba(255,61,127,0.7)';
  ctx.fillRect(0, groundY, CW, 3);
  ctx.save();
  ctx.shadowColor = '#ff3d7f';
  ctx.shadowBlur = 8;
  ctx.fillRect(0, groundY, CW, 3);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22,16]);
  ctx.lineDashOffset = -groundOffset;
  ctx.beginPath();
  ctx.moveTo(0, groundY+16);
  ctx.lineTo(CW, groundY+16);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(46,196,241,0.14)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10,10]);
  ctx.lineDashOffset = -groundOffset*1.6;
  ctx.beginPath();
  ctx.moveTo(0, groundY+40);
  ctx.lineTo(CW, groundY+40);
  ctx.stroke();
  ctx.setLineDash([]);
}

function stripedRect(c,x,y,w,h,base,stripe){
  c.fillStyle = base;
  c.fillRect(x,y,w,h);
  c.save();
  c.beginPath(); c.rect(x,y,w,h); c.clip();
  c.fillStyle = stripe;
  const step = 16;
  for(let sx=-h; sx<w+h; sx+=step*2){
    c.save();
    c.translate(x+sx, y);
    c.rotate(Math.PI/4);
    c.fillRect(-step/2, -h, step, h*3);
    c.restore();
  }
  c.restore();
}

function drawPipe(p){
  const gapH = DIFFICULTIES[difficulty].gap;
  const topEdge = p.gapY - gapH/2;
  const botEdge = p.gapY + gapH/2;
  const groundY = CH-GROUND_H;
  const x0 = p.x-PIPE_W/2;

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.fillRect(x0+4, 0, PIPE_W, 6);
  ctx.restore();

  const baseTop = p.hit ? '#7a2040' : (p.moving ? '#c9264f' : '#ff3d7f');
  const stripeTop = p.hit ? 'rgba(255,255,255,0.25)' : 'rgba(245,240,255,0.9)';
  const baseBot = p.hit ? '#0e6e8f' : (p.moving ? '#1596c2' : '#2ec4f1');
  const stripeBot = p.hit ? 'rgba(255,255,255,0.25)' : 'rgba(245,240,255,0.9)';

  ctx.save();
  const gTop = ctx.createLinearGradient(x0,0,x0+PIPE_W,0);
  gTop.addColorStop(0, baseTop);
  gTop.addColorStop(0.5, p.hit ? '#8f2a4d' : '#ff6b98');
  gTop.addColorStop(1, baseTop);
  ctx.fillStyle = gTop;
  roundRect(ctx, x0, 0, PIPE_W, Math.max(0,topEdge-12), 6);
  ctx.fill();
  stripedRect(ctx, x0-4, Math.max(0,topEdge-16), PIPE_W+8, 16, p.hit?'#5c1830':'#c9264f', stripeTop);
  ctx.restore();

  ctx.save();
  const gBot = ctx.createLinearGradient(x0,0,x0+PIPE_W,0);
  gBot.addColorStop(0, baseBot);
  gBot.addColorStop(0.5, p.hit ? '#1592ba' : '#6fdcff');
  gBot.addColorStop(1, baseBot);
  ctx.fillStyle = gBot;
  roundRect(ctx, x0, botEdge+12, PIPE_W, Math.max(0,groundY-botEdge-12), 6);
  ctx.fill();
  stripedRect(ctx, x0-4, botEdge, PIPE_W+8, 16, p.hit?'#0b5670':'#1596c2', stripeBot);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  const glowGrad = ctx.createLinearGradient(0, topEdge, 0, topEdge+18);
  glowGrad.addColorStop(0, 'rgba(255,210,63,0.35)');
  glowGrad.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x0-4, topEdge-6, PIPE_W+8, 24);
  ctx.restore();

  if(p.moving){
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2195', p.x, topEdge-20);
    ctx.restore();
  }
}

function drawPickup(c){
  ctx.save();
  ctx.translate(c.x, c.y);
  const bob = Math.sin(worldTime*0.006 + c.x)*4;
  ctx.translate(0,bob);

  if(c.kind==='shield'){
    const spin = Math.sin(worldTime*0.004 + c.x);
    const sx = Math.max(0.25, Math.abs(spin));
    ctx.scale(sx,1);
    ctx.save();
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 12;
    const g = ctx.createRadialGradient(-3,-3,1,0,0,12);
    g.addColorStop(0,'#fff2c0');
    g.addColorStop(0.5,'#ffd23f');
    g.addColorStop(1,'#c98f00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0,0,11,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#8a5f00';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else {
    const meta = EFFECT_META[c.kind];
    ctx.save();
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = meta.color;
    ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#160a24';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbol = c.kind==='magnet' ? 'M' : c.kind==='slowmo' ? 'S' : '2x';
    ctx.fillText(symbol, 0, 0.5);
  }
  ctx.restore();
}

function drawPlayer(){
  player.trail.forEach((t)=>{
    const a = Math.max(0, t.life/260)*0.18;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff3d7f';
    ctx.beginPath();
    ctx.arc(t.x-6, t.y, 9, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  const skin = getSkinStyle();

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rot*0.6);
  if(shakeT>0){ ctx.translate((Math.random()-0.5)*4,(Math.random()-0.5)*4); }

  ctx.save();
  ctx.rotate(-player.rot*0.6);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 42, 14, 4, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  if(player.shield>0){
    ctx.save();
    const pulse = 0.3 + Math.sin(worldTime*0.01)*0.12;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 10;
    ctx.setLineDash([6,5]);
    ctx.lineDashOffset = -worldTime*0.02;
    ctx.beginPath();
    ctx.arc(0,0,25,0,Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  if(effects.magnet>0){
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#2ec4f1';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0,0,40,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  const flap = player.flapAnim>0 ? Math.min(1, player.flapAnim/220) : 0;
  const squash = 1 + flap*0.12;

  ctx.save();
  ctx.scale(1/squash, squash);

  // cape (skin) or scarf (default) trailing behind
  if(skin.cape){
    ctx.fillStyle = '#2ec4f1';
    ctx.beginPath();
    ctx.moveTo(-10,-8);
    ctx.quadraticCurveTo(-30 - flap*10, 0, -24 - flap*16, 18);
    ctx.quadraticCurveTo(-16,10,-9,4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(-10,-8);
    ctx.lineTo(-16,-6);
    ctx.lineTo(-10,-2);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#2ec4f1';
    ctx.beginPath();
    ctx.moveTo(-10,-6);
    ctx.quadraticCurveTo(-24 - flap*10, -2, -20 - flap*14, 8);
    ctx.quadraticCurveTo(-14,4,-9,2);
    ctx.closePath();
    ctx.fill();
  }

  const torsoG = ctx.createLinearGradient(-11,-8,11,12);
  torsoG.addColorStop(0,skin.torso1);
  torsoG.addColorStop(1,skin.torso2);
  ctx.fillStyle = torsoG;
  if(skin.golden){ ctx.save(); ctx.shadowColor='#ffd23f'; ctx.shadowBlur=10; }
  roundRect(ctx,-11,-8,22,20,7);
  ctx.fill();
  if(skin.golden) ctx.restore();

  ctx.fillStyle = skin.golden ? '#fff2c0' : '#2ec4f1';
  roundRect(ctx,-11,-8,6,20,4);
  ctx.fill();

  ctx.strokeStyle = skin.torso2;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const armAngle = -0.3 - flap*1.1;
  ctx.beginPath();
  ctx.moveTo(-9,-4); ctx.lineTo(-9 + Math.cos(armAngle)*14, -4 + Math.sin(armAngle)*14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9,-4); ctx.lineTo(9 - Math.cos(armAngle)*14, -4 + Math.sin(armAngle)*14);
  ctx.stroke();

  ctx.save();
ctx.beginPath();
ctx.arc(0,-18,11,0,Math.PI*2);
ctx.clip();                      // circle ke andar hi image dikhegi
if(faceImg.complete && faceImg.naturalWidth){
  ctx.drawImage(faceImg, -11,-29, 22,22);  // x,y,width,height — head ke circle ke around fit
} else {
  // image load hone tak fallback color
  ctx.fillStyle = '#f2b98a';
  ctx.fillRect(-11,-29,22,22);
}
ctx.restore();

  ctx.fillStyle = '#241019';
  ctx.beginPath();
  ctx.arc(0,-21,11,Math.PI,Math.PI*2.1);
  ctx.fill();

  ctx.fillStyle = skin.cap;
  ctx.beginPath();
  ctx.ellipse(0,-25,11,5,0,0,Math.PI*2);
  ctx.fill();
  ctx.fillRect(-11,-28,22,5);
  ctx.beginPath();
  ctx.ellipse(8,-23,7,3,0,0,Math.PI*2);
  ctx.fill();

  if(skin.sunglasses){
    ctx.fillStyle = '#1a0b2e';
    roundRect(ctx,-7,-20,14,5,2);
    ctx.fill();
    ctx.fillStyle = 'rgba(46,196,241,0.5)';
    ctx.fillRect(-6,-19,5,3);
    ctx.fillRect(2,-19,5,3);
  } else {
    ctx.fillStyle = '#241019';
    ctx.beginPath(); ctx.arc(4,-18,1.6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#241019';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(2,-14, 2.4, 0.1, Math.PI-0.3);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

function draw(){
  ctx.save();
  if(shakeT>0){
    ctx.translate((Math.random()-0.5)*shakeT*0.04,(Math.random()-0.5)*shakeT*0.04);
  }
  ctx.clearRect(0,0,CW,CH);
  drawSky();
  const groundY = CH-GROUND_H;
  drawSkyline(skylineFar, farOffset, '#3a1c66', 0.45, groundY, false);
  drawSkyline(skylineNear, nearOffset, '#2d1454', 0.7, groundY, true);

  pipes.forEach(drawPipe);
  pickups.forEach(c=>{ if(!c.taken) drawPickup(c); });
  drawGround();
  drawPlayer();

  particles.forEach(p=>{
    ctx.save();
    ctx.globalAlpha = Math.max(0,p.life/500);
    if(p.glow){ ctx.shadowColor = p.color; ctx.shadowBlur = 8; }
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  if(flashT>0){
    ctx.fillStyle = 'rgba(46,196,241,0.08)';
    ctx.fillRect(0,0,CW,CH);
  }

  const vg = ctx.createRadialGradient(CW/2,CH/2,CH*0.35,CW/2,CH/2,CH*0.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');
  vg.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,CW,CH);

  ctx.restore();
}

// ---------- Loop ----------
function loop(now){
  const dt = Math.min(40, now-lastTime);
  lastTime = now;
  if(state==='playing'){
    update(dt);
    draw();
    requestAnimationFrame(loop);
  } else if(state==='dead'){
    draw();
  }
}

function idleDraw(now){
  if(!idleDraw.last) idleDraw.last = now;
  const dt = Math.min(40, now-idleDraw.last);
  idleDraw.last = now;
  worldTime += dt;
  farOffset += 0.006*dt;
  nearOffset += 0.014*dt;
  player.flapAnim = 220 - (now%1400)/1400*220;
  player.rot = Math.sin(now*0.002)*0.2;
  draw();
  if(state==='menu') requestAnimationFrame(idleDraw);
}

// ---------- Score share ----------
async function shareScore(){
  const c = document.createElement('canvas');
  c.width = 720; c.height = 900;
  const g = c.getContext('2d');
  const bgGrad = g.createLinearGradient(0,0,0,c.height);
  bgGrad.addColorStop(0,'#2a1150'); bgGrad.addColorStop(1,'#160a24');
  g.fillStyle = bgGrad; g.fillRect(0,0,c.width,c.height);

  g.textAlign = 'center';
  g.fillStyle = '#ff3d7f';
  g.font = 'bold 64px sans-serif';
  g.fillText('FLY DIMO FLY', c.width/2, 150);

  g.fillStyle = '#ffd23f';
  g.font = 'bold 140px sans-serif';
  g.fillText(String(score), c.width/2, 400);
  g.fillStyle = '#f5f0ff';
  g.font = '32px sans-serif';
  g.fillText('POINTS', c.width/2, 450);

  const BEST = Store.get('flyDimoBest', 0);
  g.fillStyle = '#2ec4f1';
  g.font = 'bold 34px sans-serif';
  g.fillText('Best: '+BEST + (runBestCombo>0 ? '   •   Combo: x'+runBestCombo : ''), c.width/2, 520);

  // mini dimo drawing
  g.save();
  g.translate(c.width/2, 640);
  g.scale(3,3);
  g.fillStyle = '#ff3d7f';
  g.beginPath(); g.roundRect ? g.roundRect(-11,-8,22,20,7) : g.rect(-11,-8,22,20); g.fill();
  g.fillStyle = '#f2b98a';
  g.beginPath(); g.arc(0,-18,11,0,Math.PI*2); g.fill();
  g.fillStyle = '#ffd23f';
  g.beginPath(); g.ellipse(0,-25,11,5,0,0,Math.PI*2); g.fill();
  g.fillRect(-11,-28,22,5);
  g.restore();

  g.fillStyle = 'rgba(245,240,255,0.6)';
  g.font = '24px sans-serif';
  g.fillText('Can you beat me?', c.width/2, 820);

  c.toBlob(async (blob)=>{
    if(!blob) return;
    const file = new File([blob], 'fly-dimo-fly-score.png', {type:'image/png'});
    if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
      try{
        await navigator.share({ files:[file], title:'Fly Dimo Fly', text:'I scored '+score+' on Fly Dimo Fly! Can you beat me?' });
        return;
      }catch(e){ /* fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fly-dimo-fly-score.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

// ---------- UI wiring ----------
document.getElementById('playBtn').addEventListener('click', (e)=>{ e.stopPropagation(); startGame(); });
document.getElementById('retryBtn').addEventListener('click', (e)=>{ e.stopPropagation(); startGame(); });
document.getElementById('backToMenuBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  state = 'menu';
  document.getElementById('gameOverPanel').classList.add('hidden');
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('best').textContent = describeBest();
  requestAnimationFrame(idleDraw);
});
document.getElementById('shareBtn').addEventListener('click', (e)=>{ e.stopPropagation(); shareScore(); });

document.getElementById('openLeaderboard').addEventListener('click', (e)=>{
  e.stopPropagation();
  renderLeaderboard();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('leaderboardPanel').classList.remove('hidden');
});
document.getElementById('closeLeaderboard').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('leaderboardPanel').classList.add('hidden');
  document.getElementById('overlay').classList.remove('hidden');
});
document.getElementById('openAchievements').addEventListener('click', (e)=>{
  e.stopPropagation();
  renderAchievements();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('achievementsPanel').classList.remove('hidden');
});
document.getElementById('closeAchievements').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('achievementsPanel').classList.add('hidden');
  document.getElementById('overlay').classList.remove('hidden');
});

document.querySelectorAll('#modePicker .picker-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    document.querySelectorAll('#modePicker .picker-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    mode = btn.dataset.mode;
    document.getElementById('best').textContent = describeBest();
  });
});
document.querySelectorAll('#diffPicker .picker-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    document.querySelectorAll('#diffPicker .picker-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    document.getElementById('best').textContent = describeBest();
  });
});

function describeBest(){
  const BEST = Store.get('flyDimoBest', 0);
  if(mode==='daily'){
    const dKey = 'flyDimoDailyBest_'+todayKey()+'_'+difficulty;
    const dBest = Store.get(dKey, 0);
    return `Today's Best (${DIFFICULTIES[difficulty].label}): ${dBest}  •  All-time Best: ${BEST}`;
  }
  return BEST>0 ? ('Best: '+BEST) : '';
}

// ---------- Init ----------
resize();
buildSkylines();
resetGame();
renderSkinRow();
document.getElementById('best').textContent = describeBest();
requestAnimationFrame(idleDraw);
