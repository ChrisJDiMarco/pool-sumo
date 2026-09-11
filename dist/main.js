import {createScene} from './scene.js?v=10';
import {initialBalls,cloneBalls,shoot,step,settled,respawn,leader,chooseRival,STEP,TOP,RADIUS,MAX_SPEED} from './physics.js?v=10';
const $=id=>document.getElementById(id),canvas=$('board');
const state={balls:initialBalls(),scores:[0,0],round:1,phase:'ready',remaining:5,selected:null,angle:-Math.PI/3,power:.45,locked:false,shot:null,rival:null,phaseTime:0,paused:false,returns:[],toastTime:0};
let view,drag=null,accumulator=0,last=performance.now(),audioContext=null,soundOn=false,frameTotal=0,frameCount=0,fps=60,lastSound=0;
const dialogs=[$('how'),$('result'),$('confirm')];
for(const dialog of dialogs)dialog.addEventListener('close',()=>canvas.focus({preventScroll:true}));
function paused(){return document.hidden||state.paused||dialogs.some(d=>d.open);}
function sound(kind='hit',strength=1){
  if(!soundOn||!audioContext)return;const now=audioContext.currentTime;if(now-lastSound<.028)return;lastSound=now;
  const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.type=kind==='out'?'sine':'triangle';const base=kind==='score'?660:kind==='floor'?170:kind==='out'?270:1100;
  osc.frequency.setValueAtTime(base,now);osc.frequency.exponentialRampToValueAtTime(kind==='score'?990:base*.45,now+.11);gain.gain.setValueAtTime(Math.min(.15,.018+strength*.018),now);gain.gain.exponentialRampToValueAtTime(.001,now+.14);osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+.15);
}
function announce(text,seconds=2.2){$('toast').textContent=text;$('toast').classList.add('show');state.toastTime=seconds;$('sr-state').textContent=text;}
function setPips(id,score){$(id).replaceChildren(...Array.from({length:5},(_,i)=>{const e=document.createElement('i');if(i<score)e.className='filled';return e;}));}
function prepareRound(first=false){
  state.phase=first?'ready':'planning';state.remaining=5;state.phaseTime=0;state.selected=null;state.locked=false;state.shot=null;state.power=.45;state.returns=[];
  // Commit from an immutable public snapshot before the human has chosen this round's shot.
  state.rival=chooseRival(cloneBalls(state.balls));
}
function reset(){for(const d of dialogs)if(d.open)d.close();Object.assign(state,{balls:initialBalls(),scores:[0,0],round:1,phase:'ready',selected:null,paused:false,toastTime:0});accumulator=0;drag=null;$('toast').classList.remove('show');prepareRound(true);updateHUD();}
function selectBall(id){
  if(paused()||!['ready','planning'].includes(state.phase)||state.locked)throw new Error('You cannot select a marble now.');
  const b=state.balls.find(b=>b.id===id&&b.team===0&&!b.off);if(!b)throw new Error('Choose an available red marble (0, 1, or 2).');
  if(state.phase==='ready')state.phase='planning';canvas.focus({preventScroll:true});state.selected=id;state.angle=Math.atan2(-b.z,-b.x);sound('hit',.3);updateHUD();return b;
}
function lockShot(input){
  if(paused()||state.phase!=='planning'||state.locked)throw new Error('A shot can only be locked during planning.');
  if(!input||!Number.isInteger(input.id)||!Number.isFinite(input.angle)||!Number.isFinite(input.power)||input.power<0||input.power>1)throw new Error('Provide a red marble id, a finite angle in radians, and power from 0 to 1.');
  const b=state.balls.find(b=>b.id===input.id&&b.team===0&&!b.off);if(!b)throw new Error('That red marble is unavailable.');
  state.selected=input.id;state.angle=input.angle;state.power=input.power;state.shot={...input};state.locked=true;sound('hit',.5);updateHUD();return snapshot();
}
function launch(){
  drag=null;state.phase='rolling';state.phaseTime=0;accumulator=0;
  shoot(state.balls,state.shot);shoot(state.balls,state.rival);state.selected=null;state.locked=false;sound('hit',2);updateHUD();
}
function finishRound(){
  state.phase='scoring';state.phaseTime=0;
  state.floorMoves=state.balls.filter(b=>b.off).map(b=>({id:b.id,angle:Math.atan2(b.z,b.x),radius:Math.hypot(b.x,b.z),x:(b.team===0?-1:1)*(4.9+(b.id%3)*.24),z:.2+(b.id%3)*.72}));
  const owner=leader(state.balls);
  if(owner){state.scores[owner.team]++;sound('score',2);announce(owner.team===0?'Your center. Your point.':'Rival takes the center.',2.4);}
  else announce('Center is open. No point.',2.2);
  updateHUD();
}
function endMatch(){state.phase='over';$('result-title').textContent=state.scores[0]>=5?'You own the center.':'The rival takes this one.';$('result-score').textContent=`You ${state.scores[0]} · Rival ${state.scores[1]}`;$('result').showModal();updateHUD();}
function updateHUD(){
  $('red-score').textContent=state.scores[0];$('blue-score').textContent=state.scores[1];setPips('red-pips',state.scores[0]);setPips('blue-pips',state.scores[1]);
  $('round-label').textContent=`ROUND ${String(state.round).padStart(2,'0')}`;
  $('countdown').textContent=state.phase==='rolling'?'↗':state.phase==='scoring'?'•':state.phase==='returning'?'↺':state.phase==='over'?'✓':Math.max(1,Math.ceil(state.remaining));
  $('clock-label').textContent=state.paused?'PAUSED':state.phase==='rolling'?'IN MOTION':state.phase==='scoring'?'SETTLED':state.phase==='returning'?'RETURNING':state.phase==='over'?'FINISHED':'SECONDS';
  $('clock').style.setProperty('--angle',`${(1-state.remaining/5)*300+25}deg`);
  const planning=['ready','planning'].includes(state.phase);
  $('red-status').textContent=state.phase==='ready'?'CHOOSE A BALL':planning?(state.locked?'✓ LOCKED IN':'AIMING'):state.phase==='rolling'?'IN PLAY':'READY';
  $('blue-status').textContent=state.phase==='ready'?'COMPUTER':planning?'🔒 LOCKED IN':state.phase==='rolling'?'IN PLAY':'COMPUTER';
  const owner=leader(state.balls),center=$('center-status');center.classList.toggle('holding',!!owner&&state.phase!=='rolling');
  center.style.setProperty('--owner',owner?.team===1?'#1976d2':'#ff5c49');
  center.textContent=state.phase==='rolling'?'Both shots. One center.':owner?(owner.team===0?'You hold the center':'Rival holds the center'):'First to 5 · Own the center';
  $('hint').textContent=state.paused?'Paused · Click to resume':state.phase==='ready'?'Choose a red marble to begin':state.phase==='planning'?(state.locked?'Shot locked. Watch their move.':'Pull back. Release to lock in.'):state.phase==='rolling'?'Closest inside the circle scores':state.phase==='scoring'?'Knocked-out marbles return next round':state.phase==='over'?'Play again':'Back to the table…';
}
function pointerDown(e){
  if(e.button!==undefined&&e.button!==0||paused()||state.locked||!['ready','planning'].includes(state.phase))return;
  const near=state.balls.filter(b=>b.team===0&&!b.off).map(b=>({b,p:view.project(b.x,b.y,b.z)})).sort((a,b)=>Math.hypot(e.clientX-a.p.x,e.clientY-a.p.y)-Math.hypot(e.clientX-b.p.x,e.clientY-b.p.y));
  const chosen=near[0];if(!chosen)return;const screenRadius=Math.max(23,canvas.clientWidth*.018);if(Math.hypot(e.clientX-chosen.p.x,e.clientY-chosen.p.y)>screenRadius)return;
  const point=view.boardPoint(e.clientX,e.clientY);if(!point)return;e.preventDefault();selectBall(chosen.b.id);drag={id:e.pointerId,start:point,moved:false};canvas.setPointerCapture(e.pointerId);
}
function pointerMove(e){
  if(!drag||e.pointerId!==drag.id||state.phase!=='planning'||state.locked)return;const p=view.boardPoint(e.clientX,e.clientY);if(!p)return;
  const dx=drag.start.x-p.x,dz=drag.start.z-p.z,distance=Math.hypot(dx,dz);if(distance>.035){state.angle=Math.atan2(dz,dx);state.power=Math.min(1,distance/2.15);drag.moved=true;}
}
function pointerUp(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(moved&&state.phase==='planning'&&!state.locked&&!paused())lockShot({id:state.selected,angle:state.angle,power:state.power});}
canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',()=>{drag=null;});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!dialogs.some(d=>d.open)){state.paused=!state.paused;drag=null;updateHUD();return;}
  if(paused()||!['ready','planning'].includes(state.phase)||state.locked||e.target instanceof HTMLButtonElement)return;
  if(['1','2','3'].includes(e.key)){e.preventDefault();selectBall(Number(e.key)-1);return;}
  if(state.selected===null)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')state.angle-=.075;if(e.key==='ArrowRight')state.angle+=.075;if(e.key==='ArrowUp')state.power=Math.min(1,state.power+.04);if(e.key==='ArrowDown')state.power=Math.max(.04,state.power-.04);if(e.key===' ')lockShot({id:state.selected,angle:state.angle,power:state.power});}
});
$('sound').addEventListener('click',async()=>{soundOn=!soundOn;if(soundOn){audioContext??=new(window.AudioContext||window.webkitAudioContext)();await audioContext.resume();sound('hit',1);}document.body.classList.toggle('sound-on',soundOn);$('sound').setAttribute('aria-pressed',String(soundOn));$('sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');});
$('help').onclick=()=>{drag=null;$('how').showModal();};$('how').querySelector('.close').onclick=()=>$('how').close();$('play').onclick=()=>$('how').close();
$('restart').onclick=()=>{if(state.phase==='ready'||state.phase==='over')reset();else $('confirm').showModal();};$('cancel-reset').onclick=()=>$('confirm').close();$('confirm-reset').onclick=reset;$('rematch').onclick=reset;
$('hint').onclick=()=>{if(state.paused){state.paused=false;updateHUD();}else if(state.phase==='over')reset();else if(state.phase==='ready')selectBall(1);};
window.addEventListener('resize',()=>view?.resize());
document.addEventListener('visibilitychange',()=>{last=performance.now();drag=null;});
function snapshot(){return {phase:state.phase,round:state.round,scores:[...state.scores],remaining:state.remaining,locked:state.locked,paused:paused(),balls:state.balls.map(b=>({id:b.id,team:b.team===0?'you':'rival',x:b.x,z:b.z,y:b.y,off:b.off})),fps:Math.round(fps)};}
function registerTools(){
  const context=document.modelContext;if(!context?.registerTool)return;
  const specs=[{name:'read_pool_sumo',description:'Read the public board, score, and phase. Rival shot plans are secret.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>snapshot()},
    {name:'lock_pool_sumo_shot',description:'During planning, choose a red marble and lock a shot. Angle is in radians in the board X/Z plane; power is 0 to 1. This starts the round when the game is ready.',inputSchema:{type:'object',properties:{id:{type:'integer',minimum:0,maximum:2},angle:{type:'number'},power:{type:'number',minimum:0,maximum:1}},required:['id','angle','power'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!input||!Number.isInteger(input.id)||input.id<0||input.id>2||!Number.isFinite(input.angle)||!Number.isFinite(input.power)||input.power<0||input.power>1)throw new Error('Invalid shot');if(state.phase==='ready')selectBall(input.id);return lockShot(input);}},
    {name:'restart_pool_sumo',description:'Reset the match and scores to start a new game against the computer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{reset();return snapshot();}}];
  for(const s of specs){try{Promise.resolve(context.registerTool(s)).catch(e=>console.warn('Optional game tool unavailable:',e.message));}catch(e){console.warn('Optional game tool unavailable:',e.message);}}
}
// A public read-only board snapshot helps accessible clients and automation inspect the same game.
window.poolSumo=Object.freeze({getState:snapshot});
function tick(now){
  const elapsed=(now-last)/1000,dt=Math.min(elapsed,.055);last=now;frameTotal+=elapsed;frameCount++;if(frameCount>=60){fps=frameCount/frameTotal;frameCount=0;frameTotal=0;}
  if(!paused()){
    if(state.toastTime>0){state.toastTime-=dt;if(state.toastTime<=0)$('toast').classList.remove('show');}
    if(state.phase==='planning'){state.remaining=Math.max(0,state.remaining-dt);if(state.remaining===0)launch();}
    else if(state.phase==='rolling'){
      state.phaseTime+=dt;accumulator+=dt;while(accumulator>=STEP){step(state.balls,STEP,(kind,b,strength)=>sound(kind,strength));accumulator-=STEP;}
      if(state.phaseTime>.6&&settled(state.balls))finishRound();
      else if(state.phaseTime>10){for(const b of state.balls){b.vx=b.vz=b.vy=0;if(b.off)b.y=RADIUS;}finishRound();}
    }else if(state.phase==='scoring'){
      state.phaseTime+=dt;
      for(const m of state.floorMoves??[]){const t=Math.min(1,state.phaseTime/.8),e=t*t*(3-2*t),target=Math.atan2(m.z,m.x);let delta=target-m.angle;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;const a=m.angle+delta*e,r=m.radius+(Math.hypot(m.x,m.z)-m.radius)*e;state.balls[m.id].x=Math.cos(a)*r;state.balls[m.id].z=Math.sin(a)*r;}
      if(state.phaseTime>3.6){if(state.scores.some(n=>n>=5))endMatch();else{state.returns=respawn(state.balls).map(p=>({...p,t:0}));state.phase='returning';state.phaseTime=0;}}
    }else if(state.phase==='returning'){
      state.phaseTime+=dt;for(const r of state.returns)r.t=Math.min(1,state.phaseTime/.9);if(state.phaseTime>1){state.round++;prepareRound();}
    }
  }
  const aim=state.selected!==null&&['ready','planning'].includes(state.phase)?{id:state.selected,angle:state.angle,power:state.power}:null;
  view.render(state.balls,aim,state.phase==='rolling'?null:leader(state.balls),state.returns);
  $('power').hidden=!aim;if(aim){const b=state.balls[aim.id],p=view.project(b.x-Math.cos(aim.angle)*.7,TOP+.06,b.z-Math.sin(aim.angle)*.7);$('power').style.left=`${Math.max(8,Math.min(canvas.clientWidth-120,p.x))}px`;$('power').style.top=`${Math.min(canvas.clientHeight-120,p.y+15)}px`;$('power').querySelector('i').style.width=`${aim.power*100}%`;$('power').querySelector('b').textContent=Math.round(aim.power*100);}
  // Avoid rebuilding HUD DOM on every graphics frame.
  if(Math.floor(now/100)!==tick.lastHUD){updateHUD();tick.lastHUD=Math.floor(now/100);}
  requestAnimationFrame(tick);
}
try{view=await createScene(canvas);prepareRound(true);updateHUD();registerTools();$('loading').classList.add('done');setTimeout(()=>$('loading').remove(),600);requestAnimationFrame(tick);}catch(error){console.error(error);$('loading').replaceChildren();const message=document.createElement('p');message.textContent='The table could not load. Check your connection and enable WebGL, then reload.';$('loading').append(message);}
