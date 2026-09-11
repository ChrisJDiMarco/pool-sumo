export const BOARD = 4.7, RADIUS = .285, TOP = 2.55, CENTER = 1.18, MAX_SPEED = 5.7;
export const STEP = 1 / 120;
export function initialBalls() {
  return [[-2.7,-.65],[-1.8,2.4],[2.5,1.4],[2.7,.65],[1.8,-2.4],[-2.5,-1.4]].map(([x,z],id)=>({id,team:id<3?0:1,x,z,y:TOP+RADIUS,vx:0,vz:0,vy:0,off:false,landed:false}));
}
export function cloneBalls(balls) { return balls.map(b=>({...b})); }
export function shoot(balls,shot) {
  if(!shot || !Number.isInteger(shot.id) || !Number.isFinite(shot.angle) || !Number.isFinite(shot.power)) return false;
  const b=balls.find(b=>b.id===shot.id);
  if(!b||b.off) return false;
  const speed=Math.max(0,Math.min(1,shot.power))*MAX_SPEED;
  b.vx=Math.cos(shot.angle)*speed;b.vz=Math.sin(shot.angle)*speed;return true;
}
function slow(b,amount){const v=Math.hypot(b.vx,b.vz);if(v<=amount){b.vx=0;b.vz=0;}else{b.vx*=1-amount/v;b.vz*=1-amount/v;}}
export function step(balls,dt=STEP,onEvent=()=>{}) {
  for(const b of balls){
    b.x+=b.vx*dt;b.z+=b.vz*dt;
    if(!b.off){
      slow(b,2.45*dt);
      if(Math.hypot(b.x,b.z)>BOARD+.025){b.off=true;b.vx*=.67;b.vz*=.67;onEvent('out',b,1);}
    }
    if(b.off){
      b.vy-=9.8*dt;b.y+=b.vy*dt;
      if(b.y<RADIUS){b.y=RADIUS;const impact=Math.abs(b.vy);b.vy=impact>.65?impact*.26:0;b.landed=true;slow(b,4*dt);if(impact>.65)onEvent('floor',b,impact);}
      if(b.y<TOP-.25 && Math.hypot(b.x,b.z)<2.40+RADIUS){const a=Math.atan2(b.z,b.x);b.x=Math.cos(a)*(2.40+RADIUS);b.z=Math.sin(a)*(2.40+RADIUS);b.vx=Math.cos(a)*.3;b.vz=Math.sin(a)*.3;}
      const d=Math.hypot(b.x,b.z);if(d>6.05){b.x*=6.05/d;b.z*=6.05/d;b.vx*=.25;b.vz*=.25;}
    }
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j];if(a.off!==b.off||Math.abs(a.y-b.y)>RADIUS*1.3)continue;
    let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d>=2*RADIUS)continue;
    if(d<1e-6){dx=1;dz=0;d=1;}
    const nx=dx/d,nz=dz/d,overlap=2*RADIUS-Math.min(d,2*RADIUS);
    a.x-=nx*overlap*.501;a.z-=nz*overlap*.501;b.x+=nx*overlap*.501;b.z+=nz*overlap*.501;
    const rel=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
    if(rel<0){const impulse=-rel*.95;a.vx-=impulse*nx;a.vz-=impulse*nz;b.vx+=impulse*nx;b.vz+=impulse*nz;if(-rel>.1)onEvent('hit',a,-rel);}
  }
}
export function settled(balls){return balls.every(b=>Math.hypot(b.vx,b.vz)<.02 && (!b.off || (b.y<=RADIUS+.0001&&Math.abs(b.vy)<.01)));}
export function leader(balls){
  const near=balls.filter(b=>!b.off&&Math.hypot(b.x,b.z)<=CENTER).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
  if(!near.length)return null;
  const opponent=near.find(b=>b.team!==near[0].team);
  if(opponent&&Math.abs(Math.hypot(near[0].x,near[0].z)-Math.hypot(opponent.x,opponent.z))<.018)return null;
  return near[0];
}
export function respawn(balls){
  const positions=[];
  for(const b of balls.filter(b=>b.off)){
    let chosen=null;
    for(let i=0;i<36;i++){
      const angle=(b.team===0?Math.PI/2:-Math.PI/2)+(i%2?1:-1)*Math.ceil(i/2)*.17;
      const r=BOARD-.65,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(balls.every(o=>o.id===b.id||o.off||Math.hypot(x-o.x,z-o.z)>2*RADIUS+.08)){chosen={x,z};break;}
    }
    if(!chosen)throw new Error('No free return position');
    positions.push({id:b.id,from:{x:b.x,y:b.y,z:b.z},to:{x:chosen.x,y:TOP+RADIUS,z:chosen.z}});
    Object.assign(b,chosen,{y:TOP+RADIUS,vx:0,vz:0,vy:0,off:false,landed:false});
  }return positions;
}
// This receives only the public board at the start of a round. Never the human's planned shot.
export function chooseRival(balls,random=Math.random){
  let best=null,bestValue=-Infinity;
  for(const b of balls.filter(b=>b.team===1&&!b.off)){
    const targets=[{x:0,z:0},...balls.filter(o=>o.team===0&&!o.off),{x:.6,z:.4},{x:-.6,z:-.4}];
    for(const target of targets){
      const distance=Math.hypot(target.x-b.x,target.z-b.z),base=Math.atan2(target.z-b.z,target.x-b.x);
      const natural=Math.min(1,Math.sqrt(2*2.45*distance)/MAX_SPEED);
      for(const offset of [0,-.10,.10])for(const p of [natural*.84,natural,Math.min(1,natural+.2)]){
        const shot={id:b.id,angle:base+offset,power:Math.max(.1,p)},copy=cloneBalls(balls);shoot(copy,shot);
        for(let k=0;k<420;k++){step(copy);if(k>30&&settled(copy))break;}
        const who=leader(copy),own=copy.filter(o=>o.team===1&&!o.off),enemy=copy.filter(o=>o.team===0&&!o.off);
        const distanceOwn=Math.min(8,...own.map(o=>Math.hypot(o.x,o.z)));
        let value=(who?.team===1?8:who?.team===0?-7:0)-distanceOwn*1.4+own.length*.75-enemy.length*.65;
        value+=random()*.5;
        if(value>bestValue){bestValue=value;best=shot;}
      }
    }
  }
  return best;
}
