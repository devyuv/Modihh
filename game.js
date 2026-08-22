/* ================= Fly Dimo Fly ================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
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
}
window.addEventListener('resize', resize);

// ---------- SFX ----------
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

// ---------- Constants ----------
const GRAVITY = 0.0016;
const FLAP_V = -0.62;
const MAX_FALL = 0.85;
const PIPE_W = 76;
const PIPE_GAP = 190;
const PIPE_SPEED0 = 0.24;
const GROUND_H = 64;

let BEST = 0;
try{ BEST = parseInt(localStorage.getItem('flyDimoBest')||'0',10) || 0; }catch(e){ BEST = 0; }

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

// ---------- State ----------
let state = 'menu';
let score = 0;
let pipeSpeed = PIPE_SPEED0;
let pipes = [];
let coins = [];
let particles = [];
let spawnTimer = 0;
let lastTime = 0;
let worldTime = 0;
let groundOffset = 0;
let farOffset = 0;
let nearOffset = 0;
let shakeT = 0;
let flashT = 0;

const player = {
  x: 0, y: 0, vy: 0,
  rot: 0,
  shield: 0,
  flapAnim: 0,
  trail: []
};

function laneStartX(){ return CW*0.28; }

function resetGame(){
  score = 0;
  pipeSpeed = PIPE_SPEED0;
  pipes = [];
  coins = [];
  particles = [];
  spawnTimer = 0;
  shakeT = 0; flashT = 0;
  player.x = laneStartX();
  player.y = CH*0.42;
  player.vy = 0;
  player.rot = 0;
  player.shield = 0;
  player.flapAnim = 0;
  player.trail = [];
  document.getElementById('score').textContent = '0';
}

function spawnPipe(){
  const margin = 70;
  const minY = margin + PIPE_GAP/2;
  const maxY = CH - GROUND_H - margin - PIPE_GAP/2;
  const gapY = minY + Math.random()*Math.max(10, maxY-minY);
  pipes.push({ x: CW+PIPE_W, gapY, passed:false, hit:false });
  if(Math.random() < 0.5){
    coins.push({ x: CW+PIPE_W+ (Math.random()>0.5?20:-20), y: gapY + (Math.random()-0.5)*40, taken:false });
  }
}

function flap(){
  if(state==='menu' || state==='dead'){
    startGame();
    return;
  }
  player.vy = FLAP_V;
  player.flapAnim = 220;
}

// ---------- Input ----------
canvas.addEventListener('touchstart', (e)=>{ e.preventDefault(); flap(); }, {passive:false});
canvas.addEventListener('mousedown', flap);
window.addEventListener('keydown', (e)=>{
  if(e.key===' ' || e.key==='ArrowUp'){ e.preventDefault(); flap(); }
});
document.getElementById('playBtn').addEventListener('click', (e)=>{ e.stopPropagation(); startGame(); });

function startGame(){
  unlockAudio();
  resetGame();
  state = 'playing';
  document.getElementById('overlay').style.display = 'none';
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function endGame(){
  state = 'dead';
  playSfx('caught');
  shakeT = 380;
  if(score > BEST){
    BEST = score;
    try{ localStorage.setItem('flyDimoBest', String(BEST)); }catch(e){}
  }
  setTimeout(()=>{
    document.getElementById('overlay').style.display = 'flex';
    document.getElementById('finalStat').textContent = 'Score: '+score;
    document.getElementById('finalStat').classList.add('show');
    document.getElementById('best').textContent = 'Best: '+BEST;
    document.querySelector('#overlay h1').textContent = 'CAUGHT!';
    document.getElementById('playBtn').textContent = 'FLY AGAIN';
    document.querySelector('#overlay .sub').textContent = "Constable Dhakkan's barricade got you. Try threading the gap a little cleaner.";
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
  particles.push({ x,y, vx:(Math.random()-0.5)*6, vy:-Math.random()*4-1, life:420+Math.random()*220, color, glow: !!glow });
}

// ---------- Update ----------
function update(dt){
  worldTime += dt;
  groundOffset = (groundOffset + pipeSpeed*dt*0.6) % 40;
  farOffset = (farOffset + pipeSpeed*dt*0.12);
  nearOffset = (nearOffset + pipeSpeed*dt*0.28);

  pipeSpeed = PIPE_SPEED0 + Math.min(score*0.006, 0.18);

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
    if(!p.passed && p.x + PIPE_W/2 < player.x){
      p.passed = true;
      score += 1;
      document.getElementById('score').textContent = score;
    }
    if(p.x < -PIPE_W - 20){ pipes.splice(i,1); continue; }

    if(!p.hit){
      const withinX = Math.abs(p.x - player.x) < (PIPE_W/2 + 16);
      if(withinX){
        const topEdge = p.gapY - PIPE_GAP/2;
        const botEdge = p.gapY + PIPE_GAP/2;
        if(player.y - 14 < topEdge || player.y + 14 > botEdge){
          p.hit = true;
          if(player.shield > 0){
            playSfx('bump');
            flashT = 200;
            shakeT = 150;
            for(let k=0;k<8;k++) spawnParticle(player.x, player.y, '#ffd23f', true);
          } else {
            endGame();
            return;
          }
        }
      }
    }
  }

  for(let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    c.x -= dx;
    if(c.x < -40){ coins.splice(i,1); continue; }
    if(!c.taken && Math.abs(c.x-player.x) < 22 && Math.abs(c.y-player.y) < 22){
      c.taken = true;
      player.shield = 2600;
      score += 2;
      document.getElementById('score').textContent = score;
      playSfx('booster');
      showToast('WAAH! SHIELD!');
      for(let k=0;k<14;k++) spawnParticle(c.x, c.y, '#ffd23f', true);
      coins.splice(i,1);
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
  const g = ctx.createLinearGradient(0,0,0,CH);
  g.addColorStop(0, '#2a1150');
  g.addColorStop(0.45, '#3a1a5e');
  g.addColorStop(0.75, '#5c1f4f');
  g.addColorStop(1, '#1a0b2e');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,CW,CH);

  // moon
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

  // stars
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

function drawSkyline(list, offset, color, alpha, groundY, isNear){
  ctx.save();
  ctx.globalAlpha = alpha;
  const span = (list.length ? (list[list.length-1].x + list[list.length-1].w + 60) : CW);
  list.forEach(b=>{
    let bx = ((b.x - offset) % span + span) % span - 60;
    ctx.fillStyle = color;
    ctx.fillRect(bx, groundY-b.h, b.w, b.h);
    // windows
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
  const topEdge = p.gapY - PIPE_GAP/2;
  const botEdge = p.gapY + PIPE_GAP/2;
  const groundY = CH-GROUND_H;
  const x0 = p.x-PIPE_W/2;

  // shadow cast on ground/gap
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.fillRect(x0+4, 0, PIPE_W, 6);
  ctx.restore();

  const baseTop = p.hit ? '#7a2040' : '#ff3d7f';
  const stripeTop = p.hit ? 'rgba(255,255,255,0.25)' : 'rgba(245,240,255,0.9)';
  const baseBot = p.hit ? '#0e6e8f' : '#2ec4f1';
  const stripeBot = p.hit ? 'rgba(255,255,255,0.25)' : 'rgba(245,240,255,0.9)';

  // top barricade body
  ctx.save();
  const gTop = ctx.createLinearGradient(x0,0,x0+PIPE_W,0);
  gTop.addColorStop(0, baseTop);
  gTop.addColorStop(0.5, p.hit ? '#8f2a4d' : '#ff6b98');
  gTop.addColorStop(1, baseTop);
  ctx.fillStyle = gTop;
  roundRect(ctx, x0, 0, PIPE_W, Math.max(0,topEdge-12), 6);
  ctx.fill();
  // warning cap
  stripedRect(ctx, x0-4, Math.max(0,topEdge-16), PIPE_W+8, 16, p.hit?'#5c1830':'#c9264f', stripeTop);
  ctx.restore();

  // bottom barricade body
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

  // subtle glow near gap edges to hint the safe zone
  ctx.save();
  ctx.globalAlpha = 0.5;
  const glowGrad = ctx.createLinearGradient(0, topEdge, 0, topEdge+18);
  glowGrad.addColorStop(0, 'rgba(255,210,63,0.35)');
  glowGrad.addColorStop(1, 'rgba(255,210,63,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x0-4, topEdge-6, PIPE_W+8, 24);
  ctx.restore();
}

function drawCoin(c){
  ctx.save();
  ctx.translate(c.x, c.y);
  const bob = Math.sin(worldTime*0.006 + c.x)*4;
  ctx.translate(0,bob);
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
  ctx.beginPath();
  ctx.arc(0,0,11,0,Math.PI*2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#8a5f00';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(){
  // motion trail
  player.trail.forEach((t,i)=>{
    const a = Math.max(0, t.life/260)*0.18;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff3d7f';
    ctx.beginPath();
    ctx.arc(t.x-6, t.y, 9, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rot*0.6);
  if(shakeT>0){ ctx.translate((Math.random()-0.5)*4,(Math.random()-0.5)*4); }

  // ground shadow (world space, drawn before rotate would be more accurate,
  // but a subtle static shadow beneath still reads fine for this scale)
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

  const flap = player.flapAnim>0 ? Math.min(1, player.flapAnim/220) : 0;
  const squash = 1 + flap*0.12;

  ctx.save();
  ctx.scale(1/squash, squash);

  // scarf
  ctx.fillStyle = '#2ec4f1';
  ctx.beginPath();
  ctx.moveTo(-10,-6);
  ctx.quadraticCurveTo(-24 - flap*10, -2, -20 - flap*14, 8);
  ctx.quadraticCurveTo(-14,4,-9,2);
  ctx.closePath();
  ctx.fill();

  // torso with gradient
  const torsoG = ctx.createLinearGradient(-11,-8,11,12);
  torsoG.addColorStop(0,'#ff6b98');
  torsoG.addColorStop(1,'#ff3d7f');
  ctx.fillStyle = torsoG;
  roundRect(ctx,-11,-8,22,20,7);
  ctx.fill();

  // backpack accent
  ctx.fillStyle = '#2ec4f1';
  roundRect(ctx,-11,-8,6,20,4);
  ctx.fill();

  // arms
  ctx.strokeStyle = '#ff3d7f';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  const armAngle = -0.3 - flap*1.1;
  ctx.beginPath();
  ctx.moveTo(-9,-4); ctx.lineTo(-9 + Math.cos(armAngle)*14, -4 + Math.sin(armAngle)*14);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9,-4); ctx.lineTo(9 - Math.cos(armAngle)*14, -4 + Math.sin(armAngle)*14);
  ctx.stroke();

  // head
  const headG = ctx.createRadialGradient(-3,-21,2,0,-18,12);
  headG.addColorStop(0,'#ffd3a8');
  headG.addColorStop(1,'#f2b98a');
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(0,-18,11,0,Math.PI*2);
  ctx.fill();

  // hair
  ctx.fillStyle = '#241019';
  ctx.beginPath();
  ctx.arc(0,-21,11,Math.PI,Math.PI*2.1);
  ctx.fill();

  // cap
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.ellipse(0,-25,11,5,0,0,Math.PI*2);
  ctx.fill();
  ctx.fillRect(-11,-28,22,5);
  ctx.beginPath();
  ctx.ellipse(8,-23,7,3,0,0,Math.PI*2);
  ctx.fill();

  // face
  ctx.fillStyle = '#241019';
  ctx.beginPath(); ctx.arc(4,-18,1.6,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#241019';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(2,-14, 2.4, 0.1, Math.PI-0.3);
  ctx.stroke();

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
  coins.forEach(c=>{ if(!c.taken) drawCoin(c); });
  drawGround();
  drawPlayer();

  particles.forEach(p=>{
    ctx.save();
    ctx.globalAlpha = Math.max(0,p.life/500);
    if(p.glow){
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  });

  if(flashT>0){
    ctx.fillStyle = 'rgba(46,196,241,0.08)';
    ctx.fillRect(0,0,CW,CH);
  }

  // vignette
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

// idle preview
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

resize();
buildSkylines();
resetGame();
document.getElementById('best').textContent = BEST>0 ? ('Best: '+BEST) : '';
requestAnimationFrame(idleDraw);
