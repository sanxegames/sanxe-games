"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const bossSprite = new Image();
bossSprite.src = "assets/boss-static.png?v=3";

const BOSS_FRAME_NAMES=["idle_1","idle_2","idle_3","idle_4","pickup_1","pickup_2","pickup_3","lift_1","lift_2","lift_3","throw_1","throw_2","recovery_1","recovery_2","recovery_3","barrelroll_1","barrelroll_2","barrelroll_3","barrelroll_4","barrel_fly"];
const bossImgs={};
for(const name of BOSS_FRAME_NAMES){const img=new Image();img.src=`assets/boss-anim/${name}.png?v=3`;bossImgs[name]=img;}
const BOSS_ANIM={
  idle:{frames:["idle_1","idle_2","idle_3","idle_4"],dur:.22,loop:true},
  pickup:{frames:["pickup_1","pickup_2","pickup_3"],dur:.12,next:"lift"},
  lift:{frames:["lift_1","lift_2","lift_3"],dur:.12,next:"throw"},
  throw:{frames:["throw_1","throw_2"],dur:.11},
  recovery:{frames:["recovery_1","recovery_2","recovery_3"],dur:.15,next:"idle"}
};
const BOSS_SCALE=.64, BOSS_CX=330, BOSS_FOOT_Y=83;
const BOSS_FRAME_SCALE={"idle_1":1.015,"idle_2":1.002,"idle_3":0.975,"idle_4":1.009,"pickup_1":1.093,"pickup_2":1.068,"pickup_3":1.081,"lift_1":0.887,"lift_2":0.848,"lift_3":0.81,"throw_1":0.836,"throw_2":0.86,"recovery_1":0.886,"recovery_2":0.901,"recovery_3":0.912};
const BOSS_FEET_X={"idle_1":95,"idle_2":100,"idle_3":102,"idle_4":99,"pickup_1":88,"pickup_2":98,"pickup_3":73,"lift_1":88,"lift_2":93,"lift_3":94,"throw_1":108,"throw_2":117,"recovery_1":110,"recovery_2":115,"recovery_3":117};
const BOSS_INTRO_DURATION=2.8, BOSS_INTRO_HOLD=.32, BOSS_INTRO_SCREEN_FRACTION=.7, BOSS_IDLE_NATIVE_H=189, BOSS_FOCAL_UP=60;
const BOSS_LAND_DURATION=.45, BOSS_INTRO_SHAKE=7, BOSS_INTRO_FLASHES=[[.05,.15],[.3,.4],[.55,.65]];
function bossIntroPose(){
  if(bossIntro<=0)return {mul:1,feetX:BOSS_CX,feetY:BOSS_FOOT_Y,flash:false};
  const p=1-bossIntro/BOSS_INTRO_DURATION, tSec=BOSS_INTRO_DURATION-bossIntro;
  const t=Math.min(1,Math.max(0,(p-BOSS_INTRO_HOLD)/(1-BOSS_INTRO_HOLD))), e=t*t*(3-2*t);
  const mul=BOSS_INTRO_SCREEN_FRACTION*H_CANVAS/(BOSS_IDLE_NATIVE_H*BOSS_SCALE);
  const m=mul+(1-mul)*e;
  const cx=W/2+(BOSS_CX-W/2)*e, cy=(H_CANVAS/2-TOP_MARGIN)+((BOSS_FOOT_Y-BOSS_FOCAL_UP)-(H_CANVAS/2-TOP_MARGIN))*e;
  const amp=p<BOSS_INTRO_HOLD?BOSS_INTRO_SHAKE:BOSS_INTRO_SHAKE*(1-e)*(1-e);
  return {mul:m,feetX:cx+Math.sin(tSec*95)*amp,feetY:cy+BOSS_FOCAL_UP*m+Math.cos(tSec*83)*amp*.6,flash:BOSS_INTRO_FLASHES.some(([a,b])=>tSec>=a&&tSec<b)};
}
const tintCanvas=document.createElement("canvas"), tintCtx=tintCanvas.getContext("2d");
function drawWhiteSprite(img,dx,dy,w,h){
  tintCanvas.width=Math.ceil(w);tintCanvas.height=Math.ceil(h);
  tintCtx.imageSmoothingEnabled=false;tintCtx.drawImage(img,0,0,w,h);
  tintCtx.globalCompositeOperation="source-atop";tintCtx.fillStyle="#fff";tintCtx.fillRect(0,0,tintCanvas.width,tintCanvas.height);
  ctx.drawImage(tintCanvas,dx,dy);
}
let bossState="idle",bossFrame=0,bossTimer=0,bossIntro=0,bossLand=0;
function bossPace(){return Math.min(3,Math.max(1,1.45/spawnInterval));}
const BOSS_LINES=["¡ES UN RETRASO PUNTUAL!","¡ESO YA ESTABA PREVISTO!","¡LA CULPA ES DE LA OPOSICIÓN!","¡OBRAS PARA SU COMODIDAD!","¡NO ES UN RETRASO, ES UNA DEMORA!","¡ESTO YA LO HEREDAMOS!","¡EL PRÓXIMO SALE YA!","¡INVERSIÓN RÉCORD!","¡EL TREN NO LLEGA TARDE, TÚ HAS LLEGADO DEMASIADO PRONTO!","¡NO ESTÁ AVERIADO, ESTÁ REFLEXIONANDO!","¡EL TREN ESTÁ EN HORA, PERO EN OTRA ZONA HORARIA!","¡LA CULPA ES DEL GOBIERNO ANTERIOR!","¡EL 100% DE LOS TRENES QUE LLEGAN LLEGAN!","¡CERO RETRASOS REGISTRADOS!\n¡SE HA CAÍDO EL SISTEMA!"];
const BUBBLE_DURATION=2.6;
let bubbleT=0,bubbleText="",bubbleLast=-1;
function sayLine(){
  if(bubbleT>0||Math.random()>=.9)return;
  bubbleLast=(bubbleLast+1+Math.floor(Math.random()*(BOSS_LINES.length-1)))%BOSS_LINES.length;
  bubbleText=BOSS_LINES[bubbleLast];bubbleT=BUBBLE_DURATION;
}
function wrapBubble(t,maxW){
  const out=[];
  for(const seg of t.split("\n")){
    const lines=[""];
    for(const w of seg.split(" ")){const cur=lines[lines.length-1],test=cur?cur+" "+w:w;if(cur&&ctx.measureText(test).width>maxW)lines.push(w);else lines[lines.length-1]=test;}
    out.push(...lines);
  }
  return out;
}
const PA_MESSAGES=["ESTIMADOS VIAJEROS: SU TREN SALE POR LA VÍA 6","RETRASO POR OBRAS PREVISTAS PARA SU COMODIDAD","POR CAUSAS AJENAS A NUESTRA VOLUNTAD","SE RUEGA ESQUIVAR LOS BARRILES CON CALMA","INCIDENCIA PUNTUAL EN LA LÍNEA. GRACIAS POR SU PACIENCIA","SU TIEMPO ES IMPORTANTE PARA NOSOTROS. ESPERE.","ESCALERAS MECÁNICAS FUERA DE SERVICIO (OTRA VEZ)","AVISO: LOS BARRILES VERDES BAJAN POR LA ESCALERA"];
function paMessage(n){return PA_MESSAGES[n<=PA_MESSAGES.length?n-1:1+((n-PA_MESSAGES.length-1)%(PA_MESSAGES.length-1))];}
function updateBossAnim(dt){
  if(bossIntro>0){
    const prev=bossIntro, holdEnd=BOSS_INTRO_DURATION*(1-BOSS_INTRO_HOLD);
    bossIntro=Math.max(0,bossIntro-dt);
    if(prev>holdEnd&&bossIntro<=holdEnd)sfxWhoosh();
    if(bossIntro===0){bossLand=BOSS_LAND_DURATION;sfxThud();sfxDingDong(.35);}
  }
  if(bossLand>0)bossLand=Math.max(0,bossLand-dt);
  if(bubbleT>0)bubbleT=Math.max(0,bubbleT-dt);
  const anim=BOSS_ANIM[bossState];
  const pace=bossState==="idle"?1:bossPace();
  bossTimer+=dt*pace;
  if(bossTimer>=anim.dur){
    bossTimer-=anim.dur;bossFrame++;
    if(bossFrame>=anim.frames.length){
      if(anim.loop)bossFrame=0;
      else if(anim.next){bossState=anim.next;bossFrame=0;}
      else bossFrame=anim.frames.length-1;
    }
  }
  if(bossState==="idle"&&spawnClock>0&&spawnClock<=.95/bossPace()){bossState="pickup";bossFrame=0;bossTimer=0;}
}

const UI = {
  score: document.querySelector("#score"), time: document.querySelector("#time"), lives: document.querySelector("#lives"),
  overlay: document.querySelector("#overlay"), title: document.querySelector("#overlay-title"), text: document.querySelector("#overlay-text"),
  start: document.querySelector("#start"), sound: document.querySelector("#sound"), pause: document.querySelector("#pause"), restart: document.querySelector("#restart"), level: document.querySelector("#level"), status: document.querySelector("#game-status")
};
const W=960,H=600, TOP_MARGIN=140, H_CANVAS=H+TOP_MARGIN, GRAVITY=1550, MOVE=210, JUMP=395, PLAYER_W=28, PLAYER_H=38;
const keyboardKeys=new Set(), touchKeys=new Set(), activePointers=new Map();
const FIXED_STEP=1/120, MAX_FRAME_TIME=.15;
let state="title", last=0, accumulator=0, elapsed=0, score=0, lives=3, spawnClock=0, barrelId=0, soundOn=true, audioCtx;

const START_LIVES=3, BARREL_SPEED_BASE=135, BARREL_SPEED_STEP=24, BARREL_SPEED_MAX=520;
const SPAWN_START_BASE=2.7, SPAWN_START_STEP=.2, SPAWN_START_FLOOR=.8, SPAWN_MIN_BASE=1.6, SPAWN_MIN_STEP=.11, SPAWN_MIN_FLOOR=.5;
const LADDER_FROM_LEVEL=8, LADDER_CHANCE_BASE=.3, LADDER_CHANCE_STEP=.04, LADDER_CHANCE_MAX=.6, LADDER_BARREL_SPEED=150;
function ladderChance(n){return Math.min(LADDER_CHANCE_MAX,LADDER_CHANCE_BASE+(n-LADDER_FROM_LEVEL)*LADDER_CHANCE_STEP);}
function levelParams(n){const k=n-1;return {barrelSpeed:Math.min(BARREL_SPEED_MAX,BARREL_SPEED_BASE+k*BARREL_SPEED_STEP),spawnStart:Math.max(SPAWN_START_FLOOR,SPAWN_START_BASE-k*SPAWN_START_STEP),spawnMin:Math.max(SPAWN_MIN_FLOOR,SPAWN_MIN_BASE-k*SPAWN_MIN_STEP),spawnDecay:.005};}
let spawnInterval=SPAWN_START_BASE;
let level=1, difficulty=levelParams(1);
function setLevel(n){level=n;difficulty=levelParams(n);}

const platforms=[
  {x:35,y:550,w:890,h:18,dir:-1}, {x:105,y:455,w:820,h:16,dir:1},
  {x:35,y:360,w:820,h:16,dir:-1}, {x:105,y:265,w:820,h:16,dir:1},
  {x:35,y:170,w:820,h:16,dir:-1}, {x:280,y:83,w:645,h:16,dir:1}
];
const ladders=[
  {x:745,y:455,h:95},{x:210,y:360,h:95},{x:720,y:265,h:95},{x:265,y:170,h:95},{x:700,y:83,h:87}
];
const goal={x:865,y:39,w:28,h:44};
let player, barrels=[];

function reset(full=true){
  if(full){setLevel(1);lives=START_LIVES;score=0;}
  elapsed=0;
  releaseInputs();accumulator=0;
  player={x:90,y:510,w:PLAYER_W,h:PLAYER_H,vx:0,vy:0,onGround:false,onLadder:false,jumping:false,ladderCooldown:0,invuln:1.2,facing:1};
  barrels=[];spawnClock=1.2;spawnInterval=difficulty.spawnStart;bossState="idle";bossFrame=0;bossTimer=0;updateHud();
}
function updateControls(){UI.pause.disabled=state!=="playing"&&state!=="paused";UI.pause.textContent=state==="paused"?"CONTINUAR":"PAUSA";UI.restart.disabled=state==="title";}
function focusGame(){canvas.focus({preventScroll:true});}
function startGame(){reset(true);bossIntro=BOSS_INTRO_DURATION;bossLand=0;spawnClock=BOSS_INTRO_DURATION+1;sfxRoar();state="playing";updateControls();UI.status.textContent=`Partida iniciada. Línea 1, ${lives} abonos.`;bubbleT=0;UI.overlay.classList.add("hidden");last=performance.now();focusGame();beep(440,.06);}
function startNextLevel(){
  setLevel(level+1);reset(false);bossIntro=0;bossLand=BOSS_LAND_DURATION;spawnClock=1.6;bubbleT=0;sfxThud();sfxDingDong(.3);
  state="playing";updateControls();UI.status.textContent=`Línea ${level}. Los barriles van más rápido.`;
  UI.overlay.classList.add("hidden");last=performance.now();focusGame();beep(440,.06);
}
function primaryAction(){if(state==="paused")resumeGame();else if(state==="levelclear")startNextLevel();else startGame();}
function pauseGame(){
  if(state!=="playing")return;
  state="paused";releaseInputs();accumulator=0;UI.title.textContent="PARTIDA EN PAUSA";UI.text.textContent="La obra queda congelada. Continúa cuando estés listo.";
  UI.status.textContent="Partida en pausa.";updateControls();
  UI.start.textContent="CONTINUAR";UI.overlay.classList.remove("hidden");
  if(!document.hidden)requestAnimationFrame(()=>UI.start.focus());
}
function resumeGame(){
  if(state!=="paused")return;
  state="playing";accumulator=0;last=performance.now();updateControls();UI.status.textContent="Partida reanudada.";UI.overlay.classList.add("hidden");focusGame();beep(520,.04);
}
function levelComplete(){
  const bonus=Math.max(0,3000-Math.floor(elapsed*20));score+=bonus;updateHud();
  state="levelclear";updateControls();UI.title.textContent=`¡Has cogido el tren de la línea ${level}!`;
  UI.text.textContent=`Has llegado al andén con ${Math.floor(elapsed)} min de retraso (+${bonus}). Puntuación: ${score}. En la línea ${level+1} los barriles van más rápido.`;
  UI.status.textContent=`Línea ${level} superada. ${score} puntos, ${Math.floor(elapsed)} minutos de retraso.`;
  UI.start.textContent="SIGUIENTE LÍNEA";UI.overlay.classList.remove("hidden");releaseInputs();requestAnimationFrame(()=>UI.start.focus());beep(740,.25);
}
function showEnd(){
  state="lost";updateControls();UI.title.textContent="Servicio suspendido";
  UI.text.textContent=`Comunicado oficial: el incidente en la línea ${level} no ha revestido gravedad. Puntuación: ${score}.`;
  UI.status.textContent=`Servicio suspendido en la línea ${level}. ${score} puntos.`;
  UI.start.textContent="JUGAR DE NUEVO";UI.overlay.classList.remove("hidden");releaseInputs();requestAnimationFrame(()=>UI.start.focus());beep(130,.25);
}
function loseLife(){
  if(player.invuln>0)return false;
  lives=Math.max(0,lives-1);beep(100,.18);updateHud();
  if(lives===0){showEnd();return true;}
  UI.status.textContent=`Golpe recibido. Quedan ${lives} vidas.`;
  player={x:90,y:510,w:PLAYER_W,h:PLAYER_H,vx:0,vy:0,onGround:false,onLadder:false,jumping:false,ladderCooldown:0,invuln:1.8,facing:1};barrels=[];spawnClock=1;bossState="idle";bossFrame=0;bossTimer=0;
  releaseInputs();return true;
}
function updateHud(){UI.level.textContent=String(level);UI.score.textContent=String(score).padStart(6,"0");UI.time.textContent=`${Math.floor(elapsed)} MIN`;UI.lives.textContent="♥".repeat(lives);}
function beep(freq,duration){
  if(!soundOn)return;
  try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;audioCtx??=new AudioCtor();if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type="square";o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}
}
function audioNow(){
  if(!soundOn)return null;
  try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return null;audioCtx??=new AudioCtor();if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});return audioCtx;}catch{return null;}
}
function noiseSource(ac,dur){
  const n=Math.floor(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=Math.random()*2-1;
  const s=ac.createBufferSource();s.buffer=buf;return s;
}
function sfxRoar(){
  const ac=audioNow();if(!ac)return;
  try{
    const t=ac.currentTime,d=.9;
    const src=noiseSource(ac,d),lp=ac.createBiquadFilter(),ng=ac.createGain();
    lp.type="lowpass";lp.frequency.setValueAtTime(900,t);lp.frequency.exponentialRampToValueAtTime(140,t+d);
    ng.gain.setValueAtTime(.0001,t);ng.gain.exponentialRampToValueAtTime(.22,t+.08);ng.gain.exponentialRampToValueAtTime(.0001,t+d);
    src.connect(lp);lp.connect(ng);ng.connect(ac.destination);src.start(t);
    const o=ac.createOscillator(),og=ac.createGain(),lfo=ac.createOscillator(),lg=ac.createGain();
    o.type="sawtooth";o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(42,t+d);
    lfo.frequency.value=22;lg.gain.value=14;lfo.connect(lg);lg.connect(o.frequency);
    og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.12,t+.1);og.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(og);og.connect(ac.destination);o.start(t);lfo.start(t);o.stop(t+d);lfo.stop(t+d);
  }catch{}
}
function sfxWhoosh(){
  const ac=audioNow();if(!ac)return;
  try{
    const t=ac.currentTime,d=1.7,o=ac.createOscillator(),g=ac.createGain();
    o.type="triangle";o.frequency.setValueAtTime(520,t);o.frequency.exponentialRampToValueAtTime(70,t+d);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09,t+.15);g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d);
  }catch{}
}
function sfxDingDong(delay=0){
  const ac=audioNow();if(!ac)return;
  try{
    const t=ac.currentTime+delay;
    for(const [f,o] of [[880,0],[660,.32]]){
      const osc=ac.createOscillator(),g=ac.createGain();
      osc.type="sine";osc.frequency.value=f;
      g.gain.setValueAtTime(.0001,t+o);g.gain.exponentialRampToValueAtTime(.18,t+o+.02);g.gain.exponentialRampToValueAtTime(.0001,t+o+.6);
      osc.connect(g);g.connect(ac.destination);osc.start(t+o);osc.stop(t+o+.62);
    }
  }catch{}
}
function sfxThud(){
  const ac=audioNow();if(!ac)return;
  try{
    const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(38,t+.3);
    g.gain.setValueAtTime(.4,t);g.gain.exponentialRampToValueAtTime(.0001,t+.32);
    o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+.34);
    const src=noiseSource(ac,.14),lp=ac.createBiquadFilter(),ng=ac.createGain();
    lp.type="lowpass";lp.frequency.value=420;ng.gain.setValueAtTime(.22,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.14);
    src.connect(lp);lp.connect(ng);ng.connect(ac.destination);src.start(t);
  }catch{}
}
function overlaps(a,b,pad=0){return a.x+pad<b.x+b.w&&a.x+a.w-pad>b.x&&a.y+pad<b.y+b.h&&a.y+a.h-pad>b.y;}
function isPressed(code){return keyboardKeys.has(code)||touchKeys.has(code);}
function currentLadder(direction=0){
  const feet=player.y+player.h;
  return ladders.find(l=>player.x+player.w/2>l.x-10&&player.x+player.w/2<l.x+34&&feet>=l.y-.5&&feet<=l.y+l.h+.5&&
    (player.onLadder||(direction<0&&feet>l.y+.5)||(direction>0&&feet<l.y+l.h-.5)));
}
function update(dt){
  if(state!=="playing")return;
  elapsed+=dt;spawnClock-=dt;player.invuln=Math.max(0,player.invuln-dt);player.ladderCooldown=Math.max(0,player.ladderCooldown-dt);updateBossAnim(dt);
  const vertical=(isPressed("ArrowDown")||isPressed("KeyS"))-(isPressed("ArrowUp")||isPressed("KeyW"));
  const ladder=currentLadder(vertical);
  player.onLadder=!!ladder&&(player.onLadder||(vertical!==0&&player.ladderCooldown===0));
  const left=isPressed("ArrowLeft")||isPressed("KeyA"),right=isPressed("ArrowRight")||isPressed("KeyD");
  player.vx=(right-left)*MOVE;if(player.vx)player.facing=Math.sign(player.vx);
  if(player.onLadder&&ladder){player.jumping=false;player.vy=vertical*170;player.x+=(ladder.x+2-player.x)*Math.min(1,dt*10);}
  else player.vy+=GRAVITY*dt;
  player.x+=player.vx*dt;player.y+=player.vy*dt;player.x=Math.max(26,Math.min(W-player.w-25,player.x));
  player.onGround=false;
  if(player.onLadder&&ladder){
    const feet=player.y+player.h;
    if((vertical<0&&feet<=ladder.y)||(vertical>0&&feet>=ladder.y+ladder.h)){
      player.y=(vertical<0?ladder.y:ladder.y+ladder.h)-player.h;player.vy=0;player.onLadder=false;player.onGround=true;
    }
  }
  if(player.vy>=0&&!player.onLadder){for(const p of platforms){if(player.x+player.w>p.x&&player.x<p.x+p.w&&player.y+player.h>=p.y&&player.y+player.h-player.vy*dt<=p.y+5){player.y=p.y-player.h;player.vy=0;player.onGround=true;break;}}}
  if(player.onGround)player.jumping=false;
  if(player.y>H+30&&loseLife())return;
  if(overlaps(player,goal)){levelComplete();return;}
  if(spawnClock<=0){barrels.push({id:barrelId++,x:390,y:15,w:25,h:25,vx:0,vy:0,level:6,falling:true,spin:0});spawnInterval=Math.max(difficulty.spawnMin,difficulty.spawnStart-elapsed*difficulty.spawnDecay);spawnClock=spawnInterval;beep(180,.035);sayLine();bossState="recovery";bossFrame=0;bossTimer=0;}
  for(const b of barrels){
    if(b.falling){
      const targetLevel=b.level-1;
      const targetY=targetLevel>=0?platforms[targetLevel].y:H+120;
      if(b.onLadder)b.y+=LADDER_BARREL_SPEED*dt;
      else{
        if(targetLevel>=0){
          const target=platforms[targetLevel];
          const landingX=Math.max(target.x+2,Math.min(target.x+target.w-b.w-2,b.x));
          b.x+=(landingX-b.x)*Math.min(1,dt*9);
        }
        b.vy+=GRAVITY*dt;b.y+=b.vy*dt;
      }
      if(b.y+b.h>=targetY){
        if(targetLevel<0){b.y=H+200;}
        else{
          const p=platforms[targetLevel];
          b.level=targetLevel;b.y=p.y-b.h;b.vy=0;b.falling=false;b.onLadder=false;
          b.x=Math.max(p.x+2,Math.min(p.x+p.w-b.w-2,b.x));
          b.vx=difficulty.barrelSpeed*p.dir;
        }
      }
    }else{
      const p=platforms[b.level], prevCx=b.x+b.w/2;
      b.x+=b.vx*dt;
      if(level>=LADDER_FROM_LEVEL){
        const cx=b.x+b.w/2, ladder=ladders.find(l=>l.y===p.y&&(prevCx-(l.x+15))*(cx-(l.x+15))<=0&&prevCx!==cx);
        if(ladder&&Math.random()<ladderChance(level)){b.falling=true;b.onLadder=true;b.viaLadder=true;b.vy=0;b.x=ladder.x+15-b.w/2;}
      }
      if(!b.falling&&(b.x<p.x-4||b.x+b.w>p.x+p.w+4)){b.falling=true;b.vy=40;}
    }
    b.spin+=b.vx*dt/10;
    if(overlaps(player,b,5)&&loseLife())return;
    if(!b.scored){
      const centerGap=Math.abs(player.x+player.w/2-(b.x+b.w/2));
      const playerBottom=player.y+player.h;
      if(player.jumping&&player.vy<0&&centerGap<50&&playerBottom<=b.y+8&&playerBottom>b.y-55)b.jumpCandidate=true;
      if(player.jumping&&b.jumpCandidate&&player.vy>=0&&centerGap<75&&playerBottom<b.y+12){b.scored=true;b.jumpCandidate=false;score+=150;beep(620,.05);}
      else if(centerGap>110||!player.jumping)b.jumpCandidate=false;
    }
  }
  barrels=barrels.filter(b=>b.y<H+80);updateHud();
}
function jump(){if(state==="playing"&&(player.onGround||player.onLadder)){player.onLadder=false;player.jumping=true;player.ladderCooldown=.24;player.vy=-JUMP;player.onGround=false;beep(380,.05);}}

function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function text(t,x,y,size=16,color="#f7f0d5",align="left"){ctx.font=`bold ${size}px "Courier New"`;ctx.textAlign=align;ctx.fillStyle="#050814";ctx.fillText(t,x+2,y+2);ctx.fillStyle=color;ctx.fillText(t,x,y);}
function drawDeparturesBoard(){
  const x=20,y=14,w=200,h=70;
  rect(x-3,y-3,w+6,h+6,"#303b61");rect(x,y,w,h,"#050814");rect(x,y,w,18,"#1b3a8a");
  text("SALIDAS",x+w/2,y+14,13,"#f7f0d5","center");
  const blink=Math.floor(performance.now()/550)%2===0;
  text(`LÍNEA ${level}`,x+10,y+39,13,"#ffd34e");
  text("RETRASADO",x+w-10,y+39,13,blink?"#ff4d61":"#7a2a36","right");
  text("PRÓXIMO TREN",x+10,y+59,12,"#aab4d5");
  text("SIN FECHA",x+w-10,y+59,12,"#ffd34e","right");
}
function drawBackground(){
  ctx.fillStyle="#0b1021";ctx.fillRect(0,0,W,H);
  for(let i=0;i<55;i++){const x=(i*173)%W,y=(i*79)%H;rect(x,y,2,2,i%4?"#263257":"#31d7c7");}
  drawDeparturesBoard();
  for(let x=30;x<W;x+=90){rect(x,120,8,450,"#17213c");for(let y=126;y<550;y+=50){ctx.strokeStyle="#27345b";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+65,y+45);ctx.moveTo(x+65,y);ctx.lineTo(x,y+45);ctx.stroke();}}
}
function drawWorld(){
  for(const p of platforms){rect(p.x,p.y,p.w,p.h,"#d9465b");for(let x=p.x+6;x<p.x+p.w-5;x+=28)rect(x,p.y+5,17,4,"#ffd34e");}
  for(const l of ladders){rect(l.x,l.y,5,l.h,"#31d7c7");rect(l.x+25,l.y,5,l.h,"#31d7c7");for(let y=l.y+7;y<l.y+l.h;y+=15)rect(l.x,y,30,4,"#31d7c7");}
  drawTrain();
  drawSigns();
}
function drawTrain(){
  const x=838,y=42,w=118,h=41,glow=.5+.5*Math.sin(performance.now()/260);
  rect(x,y+h-5,w,5,"#101629");                            // bogies
  for(const wx of [x+10,x+34,x+72,x+96]){rect(wx,y+h-4,12,4,"#6b7590");}
  rect(x,y,w-12,h-5,"#c9d2e8");                           // car body
  rect(x+w-12,y+8,12,h-13,"#c9d2e8");rect(x+w-12,y+8,12,3,"#e8eefc"); // nose
  rect(x,y,w-12,4,"#8d98b8");rect(x,y+h-14,w,4,"#31d7c7"); // roof + stripe
  for(const wx of [x+6,x+55,x+82]){rect(wx,y+9,18,11,"#101629");rect(wx+2,y+11,14,3,"#31d7c7");}
  rect(goal.x,y+8,goal.w,h-13,"#0e8f86");                  // open door
  rect(goal.x+3,y+11,goal.w-6,h-19,"#ffd34e");rect(goal.x+goal.w/2-1,y+11,2,h-19,"#101629");
  rect(x+w-3,y+16,4,6,glow>.5?"#fff6b0":"#ffd34e");        // headlight
  rect(x+w-18,y+4,6,4,"#d9465b");rect(x+4,y+4,6,4,"#d9465b");
  text("VÍA 6",goal.x+goal.w/2,y-6,13,"#31d7c7","center");
}
const LADDER_SIGNS=["FUERA DE SERVICIO","EN OBRAS","AVERIADA","FUERA DE SERVICIO","EN OBRAS"];
function drawSigns(){
  ctx.save();ctx.textAlign="center";
  ctx.font='bold 11px "Courier New"';
  ladders.forEach((l,i)=>{
    const t=LADDER_SIGNS[i%LADDER_SIGNS.length],w=Math.ceil(ctx.measureText(t).width)+14,x=Math.round(l.x+15-w/2),y=l.y-18;
    rect(x,y,w,14,"#ffd34e");rect(x,y,w,2,"#101629");rect(x,y+12,w,2,"#101629");
    ctx.fillStyle="#101629";ctx.fillText(t,x+w/2,y+11);
  });
  ctx.font='bold 10px "Courier New"';
  platforms.forEach((p,i)=>{
    const t=`ANDÉN ${i+1}`,w=Math.ceil(ctx.measureText(t).width)+10,x=p.x+6,y=p.y+p.h+2;
    rect(x,y,w,12,"#1b3a8a");rect(x,y,w,1,"#6fa0ff");
    ctx.fillStyle="#f7f0d5";ctx.fillText(t,x+w/2,y+10);
  });
  ctx.restore();
}
const PLAYER_PAL={"K":"#17121f","H":"#ffd34e","h":"#d9992a","W":"#fff3b0","S":"#f2b184","s":"#c98557","E":"#101629","M":"#a8473d","O":"#f08a3c","o":"#c0612a","q":"#8e4318","V":"#31d7c7","v":"#1fa89a","B":"#3d5a9c","b":"#28396b","R":"#7a4326","r":"#4d2a18","G":"#f7f0d5","g":"#b9b3a0"};
const PLAYER_FRAMES={
  idle:[["................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....",".....KSSSSK.....","....KOOooOoK....","...KqOOooOoK....","...KqVVooVvK....","...KgOOGGOoK....","....KooooooK....","....KBBBBBBK....","....KbbKBBK.....","....KbbKBBKK....","...KrrrKRRRRK...","....KKK.KKKK...."],["................","................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....","....KOSSSSoK....","...KqOOooOoK....","...KqVVooVvK....","...KgOOGGOoK....","....KooooooK....","....KBBBBBBK....","....KbbKBBK.....","....KbbKBBKK....","...KrrrKRRRRK...","....KKK.KKKK...."]],
  run:[["................","................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....","....KOSSSSoKK...","....KOooOOoqgK..","....KooVVVvKgK..","...KGGOOOOoKK...","....KooooooK....","....KBBBBBBK....","....KbbKBBK.....","..KKbbK.KBBKK...",".KrrrrK.KRRRRK..","..KKKK...KKKK..."],["................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....",".....KSSSSK.....","....KOOooOoK....","....KOOooOoK....","....KVVVoovK....","....KOOOOGGK....","....KooooooK....","....KBBBBBBK....",".....KbbBBKKK...",".....KbbKBRRRK..","....KrrrrKKKK...",".....KKKK......."],["................","................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....","....KOSSSSoK....","...KqOOOOooKK...","..KgKVVVVVooGK..","..KgKOOOOOoKGK..","...KKooooooKK...","....KBBBBBBK....","....KBBKbbK.....","..KKBBK.KbbKK...",".KRRRRK.KrrrrK..","..KKKK...KKKK..."],["................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","....KssssssKKK..","....KsSSSESSK...","....KsSSSMMK....",".....KSSSSK.....","....KOOooOoK....","....KOOooOoK....","....KVVVoovK....","....KOOOOGGK....","....KooooooK....","....KBBBBBBK....",".....KBBbbKKK...",".....KBBKbrrrK..","....KRRRRKKKK...",".....KKKK......."]],
  jump:[["................",".....KKKKK......","....KHWHHHK.....","...KHWWHHHHK....","...KHHHHHhhKKK..","...KHhhhhhhhhhK.","..KKKssssssKKK..",".KggKsSSSESSGK..","..KqKsSSSMMoGK..","...KqKSSSSoKK...","....KOOOoooK....","....KOOOOOoK....","....KVVVVVvK....","....KOOOOOoK....","....KooooooK....","....KBBBBBBK....","...KKbbKBBBKKK..","..KrrbK.KBBRRRK.","...KKK...KKKKK..","................"]],
  climb:[["................",".....KKKKKK.....","....KHWHHHHK....","...KHWWHHHHHK...","...KHHHHHHhhK...","..KhhhhhhhhhhK..","...KKssssssKK...","..KGGSESSESK....","..KoKSSMMSSK....","..KooKSSSSKK....","...KoOOOOOOoK...","....KOOOOOOoK...","....KVVVVVVoK...","....KOOOOOOGK...","....KooooooK....","....KBBBBBBK....","...KKBBKKBBK....","..KRRRBKKBBK....","...KKKKKRRRRK...","........KKKK...."],["................",".....KKKKKK.....","....KHWHHHHK....","...KHWWHHHHHK...","...KHHHHHHhhK...","..KhhhhhhhhhhK..","...KKssssssKK...","....KSESSESGGK..","....KSSMMSSKoK..","....KKSSSSKooK..","...KoOOOOOOoK...","...KoOOOOOOK....","...KoVVVVVVK....","...KGOOOOOOK....","....KooooooK....","....KBBBBBBK....","....KBBKKBBKK...","....KBBKKBRRRK..","...KRRRRKKKKK...","....KKKK........"]]
};
const PLAYER_SCALE=2, playerSprites={};
for(const [name,list] of Object.entries(PLAYER_FRAMES)){
  playerSprites[name]=list.map(rows=>{
    const c=document.createElement("canvas");c.width=16*PLAYER_SCALE;c.height=20*PLAYER_SCALE;
    const g=c.getContext("2d");
    rows.forEach((line,y)=>{for(let x=0;x<line.length;x++){const k=line[x];if(k!==".")g.fillStyle=PLAYER_PAL[k],g.fillRect(x*PLAYER_SCALE,y*PLAYER_SCALE,PLAYER_SCALE,PLAYER_SCALE);}});
    return c;
  });
}
function playerSprite(){
  if(player.onLadder)return playerSprites.climb[Math.floor(Math.abs(player.y)/7)%2];
  if(!player.onGround)return playerSprites.jump[0];
  if(Math.abs(player.vx)>0)return playerSprites.run[Math.floor(elapsed*14)%4];
  return playerSprites.idle[Math.floor(elapsed*2.2)%2];
}
function drawPlayer(){
  if(player.invuln>0&&Math.floor(player.invuln*10)%2)return;
  const flip=player.facing<0?-1:1, cx=Math.round(player.x+player.w/2), by=Math.round(player.y+player.h);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(cx,by-20*PLAYER_SCALE);ctx.scale(flip,1);
  ctx.drawImage(playerSprite(),-8*PLAYER_SCALE,0);ctx.restore();
}
const LADDER_BARREL_TINT="#3cff7a", ladderBarrelFrames={};
function ladderBarrelFrame(name,img){
  if(!ladderBarrelFrames[name]){
    const c=document.createElement("canvas");c.width=img.naturalWidth;c.height=img.naturalHeight;
    const g=c.getContext("2d");
    g.drawImage(img,0,0);
    g.globalCompositeOperation="hue";g.fillStyle=LADDER_BARREL_TINT;g.fillRect(0,0,c.width,c.height);
    g.globalCompositeOperation="source-atop";g.fillStyle="rgba(120,255,160,.22)";g.fillRect(0,0,c.width,c.height);
    g.globalCompositeOperation="destination-in";g.drawImage(img,0,0);
    ladderBarrelFrames[name]=c;
  }
  return ladderBarrelFrames[name];
}
function drawBarrel(b){
  const x=Math.round(b.x),y=Math.round(b.y);
  const name="barrelroll_"+((Math.floor(Math.abs(b.spin)/6)%4)+1), img=bossImgs[name];
  if(img&&img.complete&&img.naturalWidth){
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(b.viaLadder?ladderBarrelFrame(name,img):img,x-3,y-3,b.w+6,b.h+6);ctx.restore();
    return;
  }
  ctx.save();ctx.translate(x+12,y+12);ctx.rotate(b.spin*.08);rect(-12,-12,24,24,"#a85a31");rect(-12,-8,24,4,"#e19a4f");rect(-12,5,24,4,"#e19a4f");rect(-3,-12,6,24,"#71321f");ctx.restore();
}
function drawBoss(){
  const anim=BOSS_ANIM[bossState];
  const frameKey=anim.frames[Math.min(bossFrame,anim.frames.length-1)];
  const img=bossImgs[frameKey];
  if(img&&img.complete&&img.naturalWidth){
    const idleBob=bossState==="idle"?Math.sin(elapsed*2.4)*3:0;
    const pose=bossIntroPose();
    const land=bossIntro<=0&&bossLand>0?bossLand/BOSS_LAND_DURATION:0;
    const sxk=1+.1*land, syk=1-.12*land;
    const scale=BOSS_SCALE*(BOSS_FRAME_SCALE[frameKey]??1)*pose.mul;
    const w=img.naturalWidth*scale*sxk, h=img.naturalHeight*scale*syk;
    const dx=pose.feetX-(BOSS_FEET_X[frameKey]??img.naturalWidth/2)*scale*sxk, dy=pose.feetY-h+idleBob;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    if(pose.flash)drawWhiteSprite(img,dx,dy,w,h);else ctx.drawImage(img,dx,dy,w,h);
    ctx.restore();
    if(bossIntro<=0){
      if(bubbleT>0){
        ctx.save();ctx.globalAlpha=Math.min(1,bubbleT/.25);
        ctx.font='bold 21px "Courier New"';
        const lines=wrapBubble(bubbleText,520),lw=Math.max(...lines.map(l=>Math.ceil(ctx.measureText(l).width)));
        const w=lw+28,bx=BOSS_CX+30,bh=12+26*lines.length,by=-46-bh;
        rect(bx-3,by-3,w+6,bh+6,"#050814");rect(bx,by,w,bh,"#f7f0d5");
        ctx.fillStyle="#050814";ctx.beginPath();ctx.moveTo(bx+8,by+bh+3);ctx.lineTo(bx+40,by+bh+3);ctx.lineTo(bx+6,by+bh+24);ctx.closePath();ctx.fill();
        ctx.fillStyle="#f7f0d5";ctx.beginPath();ctx.moveTo(bx+12,by+bh);ctx.lineTo(bx+35,by+bh);ctx.lineTo(bx+9,by+bh+17);ctx.closePath();ctx.fill();
        ctx.fillStyle="#101629";ctx.textAlign="left";lines.forEach((l,i)=>ctx.fillText(l,bx+14,by+27+i*26));
        ctx.restore();
      }
    }
    return;
  }
  if(bossSprite.complete&&bossSprite.naturalWidth){
    const cx=330,cy=170,w=280,h=Math.round(280*bossSprite.naturalHeight/bossSprite.naturalWidth);
    const bob=Math.sin(elapsed*2.4)*5;
    const scaleY=1+Math.sin(elapsed*2.4)*0.018;
    const sway=Math.sin(elapsed*1.1)*0.03;
    ctx.save();
    ctx.imageSmoothingEnabled=false;
    ctx.translate(cx,cy);
    ctx.rotate(sway);
    ctx.scale(1,scaleY);
    ctx.drawImage(bossSprite,-w/2,-h/2+bob,w,h);
    ctx.restore();
    return;
  }
  // Retrato satírico en píxel, dibujado con rectángulos — respaldo si la imagen no carga.
  const x=200,y=-8;
  rect(x+18,y+150,232,66,"#3b292c");
  rect(x-14,y+160,46,95,"#6c4840");rect(x+228,y+160,46,95,"#6c4840");
  rect(x-20,y+248,58,34,"#56373a");rect(x+222,y+248,58,34,"#56373a");
  rect(x+30,y+165,204,44,"#4d3234");
  rect(x+58,y+58,15,38,"#c57f68");rect(x+197,y+58,15,38,"#c57f68");
  rect(x+61,y+64,8,20,"#b66d5d");rect(x+201,y+64,8,20,"#b66d5d");
  rect(x+68,y+16,134,132,"#d99879");
  rect(x+74,y+20,122,120,"#dea083");
  rect(x+96,y+148,64,14,"#c8896e");
  rect(x+66,y+2,138,20,"#2f2523");
  rect(x+66,y+20,18,18,"#2f2523");rect(x+184,y+20,18,18,"#2f2523");
  rect(x+150,y+16,24,10,"#dea083");rect(x+96,y+18,12,8,"#dea083");
  rect(x+82,y-2,46,6,"#3d2e2b");rect(x+142,y-2,46,6,"#3d2e2b");
  rect(x+92,y+6,36,4,"#4a3936");rect(x+142,y+6,36,4,"#4a3936");
  rect(x+90,y+56,32,6,"#5c4038");rect(x+148,y+56,32,6,"#5c4038");
  rect(x+114,y+53,10,5,"#5c4038");rect(x+148,y+53,10,5,"#5c4038");
  rect(x+92,y+66,26,14,"#eee5dc");rect(x+152,y+66,26,14,"#eee5dc");
  rect(x+100,y+68,12,11,"#5f7787");rect(x+160,y+68,12,11,"#5f7787");
  rect(x+103,y+71,6,6,"#171b25");rect(x+163,y+71,6,6,"#171b25");
  rect(x+104,y+72,2,2,"#f7f0d5");rect(x+164,y+72,2,2,"#f7f0d5");
  rect(x+126,y+82,20,26,"#d1906f");
  rect(x+124,y+106,24,6,"#b66d5d");
  rect(x+122,y+108,6,5,"#a55d5d");rect(x+142,y+108,6,5,"#a55d5d");
  rect(x+108,y+112,54,7,"#725155");
  rect(x+112,y+121,46,7,"#a55d5d");rect(x+118,y+125,30,3,"#8d514c");
  rect(x+82,y+130,16,12,"#8a7267");rect(x+188,y+130,16,12,"#8a7267");
  rect(x+96,y+138,96,10,"#8a7267");
  rect(x+88,y+132,4,4,"#b5a6a3");rect(x+196,y+134,4,4,"#b5a6a3");rect(x+110,y+140,4,4,"#b5a6a3");rect(x+168,y+141,4,4,"#b5a6a3");
  rect(x+95,y+150,80,26,"#2c2426");
  rect(x+100,y+150,70,14,"#e2eef5");rect(x+106,y+153,58,7,"#b7d2e6");
  rect(x+120,y+150,30,10,"#17213c");rect(x+128,y+158,14,42,"#17213c");rect(x+131,y+162,8,34,"#26355e");
}
function render(){
  ctx.fillStyle="#0b1021";ctx.fillRect(0,0,W,H_CANVAS);
  ctx.save();
  let rx=0,ry=0;
  if(bossIntro>0){if(1-bossIntro/BOSS_INTRO_DURATION<BOSS_INTRO_HOLD){rx=Math.sin(bossIntro*120)*1.6;ry=Math.cos(bossIntro*97)*1.6;}}
  else if(bossLand>0){const k=bossLand/BOSS_LAND_DURATION,a=7*k*k;rx=Math.sin(bossLand*130)*a;ry=Math.cos(bossLand*110)*a;}
  ctx.translate(Math.round(rx),Math.round(TOP_MARGIN+ry));
  drawBackground();drawWorld();drawBoss();for(const b of barrels)drawBarrel(b);if(player)drawPlayer();
  if(state==="playing"&&bossIntro<=0&&elapsed<(level===1?BOSS_INTRO_DURATION:0)+3.4){
    const msg=`LÍNEA ${level} · ${paMessage(level)}`;
    ctx.font='bold 16px "Courier New"';const tw=Math.ceil(ctx.measureText(msg).width);
    rect(W/2-tw/2-14,108,tw+28,28,"rgba(8,12,28,.85)");
    text(msg,W/2,128,16,"#ffd34e","center");
  }
  ctx.restore();
}
function loop(ts){
  const frameTime=Math.min(MAX_FRAME_TIME,(ts-last)/1000||0);last=ts;
  if(state==="playing"){
    accumulator+=frameTime;
    while(accumulator>=FIXED_STEP){update(FIXED_STEP);accumulator-=FIXED_STEP;if(state!=="playing"){accumulator=0;break;}}
  }else accumulator=0;
  render();requestAnimationFrame(loop);
}

function releaseInputs(){keyboardKeys.clear();touchKeys.clear();activePointers.clear();}

addEventListener("keydown",e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.("input, textarea, select, [contenteditable='true']"))return;
  if(e.target?.closest?.("button, a")&&["Enter","Space"].includes(e.code))return;
  if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code))e.preventDefault();
  keyboardKeys.add(e.code);
  if(e.code==="Space"&&!e.repeat)jump();
  if(e.code==="KeyR"&&!e.repeat)startGame();
  if(e.code==="KeyP"&&!e.repeat)(state==="paused"?resumeGame():pauseGame());
  if(e.code==="Enter"&&!e.repeat&&state!=="playing"){e.preventDefault();primaryAction();}
});
addEventListener("keyup",e=>keyboardKeys.delete(e.code));
document.querySelectorAll("[data-key]").forEach(btn=>{const code=btn.dataset.key;const down=e=>{e.preventDefault();activePointers.set(e.pointerId,code);touchKeys.add(code);try{btn.setPointerCapture(e.pointerId);}catch{}if(code==="Space")jump();};const up=e=>{e.preventDefault();activePointers.delete(e.pointerId);if(![...activePointers.values()].includes(code))touchKeys.delete(code);};btn.addEventListener("pointerdown",down);btn.addEventListener("pointerup",up);btn.addEventListener("pointercancel",up);btn.addEventListener("lostpointercapture",up);});
addEventListener("blur",()=>{releaseInputs();pauseGame();});
document.addEventListener("visibilitychange",()=>{releaseInputs();if(document.hidden)pauseGame();else last=performance.now();});
UI.start.addEventListener("click",primaryAction);UI.sound.addEventListener("click",()=>{soundOn=!soundOn;UI.sound.textContent=`SONIDO: ${soundOn?"SÍ":"NO"}`;UI.sound.setAttribute("aria-pressed",String(soundOn));if(soundOn)beep(520,.06);});
UI.pause.addEventListener("click",()=>state==="paused"?resumeGame():pauseGame());
UI.restart.addEventListener("click",startGame);
function fitGame(){
  const cabinet=document.querySelector(".cabinet"),screen=document.querySelector(".screen"),hud=document.querySelector(".hud");
  const style=getComputedStyle(cabinet),border=screen.offsetWidth-screen.clientWidth;
  const viewportHeight=window.visualViewport?.height||window.innerHeight;
  const surroundingHeight=cabinet.offsetHeight-screen.offsetHeight;
  const canvasHeight=Math.max(100,viewportHeight-surroundingHeight-border-hud.offsetHeight-6);
  const availableWidth=cabinet.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  screen.style.width=`${Math.min(availableWidth,canvasHeight*W/H_CANVAS+border)}px`;
}
addEventListener("resize",fitGame);
window.visualViewport?.addEventListener("resize",fitGame);
reset(true);updateControls();requestAnimationFrame(fitGame);requestAnimationFrame(loop);
