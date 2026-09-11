import * as T from './vendor/three.module.js';
import {BOARD,RADIUS,TOP,CENTER} from './physics.js?v=10';
export async function createScene(canvas){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-7,7,4,-4,.1,70);
  const load=new T.TextureLoader();
  const [felt,wood]=await Promise.all([load.loadAsync('./assets/target-felt.png'),load.loadAsync('./assets/honey-maple.png')]);
  for(const texture of [felt,wood]){texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();}
  felt.repeat.set(4,4);wood.repeat.set(.55,.65);
  const endgrain=wood.clone();endgrain.repeat.set(.55,.65);endgrain.rotation=Math.PI/2;endgrain.needsUpdate=true;
  // A photographed-style panoramic room gives curved window and furnishing reflections.
  const room=await load.loadAsync('./assets/room-environment.png');room.colorSpace=T.SRGBColorSpace;room.mapping=T.EquirectangularReflectionMapping;
  const reflectionRoom=new T.Scene();reflectionRoom.background=room;
  const windowCard=new T.Mesh(new T.PlaneGeometry(5,4),new T.MeshBasicMaterial({color:new T.Color(5,4.9,4.7),side:T.DoubleSide}));windowCard.position.set(-5,7,5);windowCard.lookAt(0,0,0);reflectionRoom.add(windowCard);
  const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(reflectionRoom,.01).texture;room.dispose();windowCard.geometry.dispose();windowCard.material.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight('#fef5e8','#877767',.35));
  const sun=new T.DirectionalLight('#fff1df',2.8);sun.position.set(5.5,8,-4);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:1,far:30});sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0003;sun.shadow.normalBias=.014;sun.shadow.radius=5;sun.shadow.blurSamples=12;scene.add(sun);
  const fill=new T.DirectionalLight('#fff2e3',.3);fill.position.set(0,6,10);scene.add(fill);
  const wooden=new T.MeshStandardMaterial({map:wood,color:'#f5dfca',roughness:.48,metalness:0,bumpMap:wood,bumpScale:.018,envMapIntensity:1});
  const profile=[[0,TOP-.65],[BOARD-.055,TOP-.65],[BOARD-.018,TOP-.635],[BOARD,TOP-.605],[BOARD,TOP-.045],[BOARD-.018,TOP-.015],[BOARD-.055,TOP],[0,TOP]].map(([r,y])=>new T.Vector2(r,y));
  const table=new T.Mesh(new T.LatheGeometry(profile,192),wooden);table.castShadow=true;table.receiveShadow=true;scene.add(table);
  const pedestal=new T.Mesh(new T.CylinderGeometry(2.40,2.40,TOP-.65,128),new T.MeshStandardMaterial({map:endgrain,color:'#dcbfa0',roughness:.65,bumpMap:endgrain,bumpScale:.018,envMapIntensity:.9}));pedestal.position.y=(TOP-.65)/2;pedestal.castShadow=pedestal.receiveShadow=true;scene.add(pedestal);
  const surface=new T.Mesh(new T.CircleGeometry(BOARD-.065,192),new T.MeshStandardMaterial({map:felt,color:'#c6dbda',roughness:1,bumpMap:felt,bumpScale:.045,envMapIntensity:.7}));surface.rotation.x=-Math.PI/2;surface.position.y=TOP+.004;surface.receiveShadow=true;scene.add(surface);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.27}));floor.rotation.x=-Math.PI/2;floor.position.y=.001;floor.receiveShadow=false;scene.add(floor);
  const ring=(r,width,color)=>{const m=new T.Mesh(new T.RingGeometry(r-width,r,128),new T.MeshBasicMaterial({color,transparent:true,opacity:.83,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.y=TOP+.011;scene.add(m);return m;};
  const scoring=ring(CENTER,.016,'#eddfb2');
  const centerDot=new T.Mesh(new T.CircleGeometry(.024,16),new T.MeshBasicMaterial({color:'#ecdeb5'}));centerDot.rotation.x=-Math.PI/2;centerDot.position.y=TOP+.014;scene.add(centerDot);
  const selection=ring(RADIUS*1.35,.028,'#ff9c87'),holding=ring(RADIUS*1.25,.025,'#ffe4a1');selection.visible=holding.visible=false;
  for(const [start,color] of [[Math.PI/2-.11,'#ff9687'],[-Math.PI/2-.11,'#679deb']]){
    const arc=new T.Mesh(new T.RingGeometry(BOARD-.40,BOARD-.365,80,1,start,.22),new T.MeshBasicMaterial({color,transparent:true,opacity:.68,side:T.DoubleSide}));arc.rotation.x=Math.PI/2;arc.position.y=TOP+.015;scene.add(arc);
  }
  const materials=[new T.MeshPhysicalMaterial({color:'#ff4930',roughness:.085,metalness:.18,clearcoat:1,clearcoatRoughness:.075,envMapIntensity:2.4}),new T.MeshPhysicalMaterial({color:'#0058dc',roughness:.08,metalness:.2,clearcoat:1,clearcoatRoughness:.065,envMapIntensity:2.5})];
  // A gentle lower-hemisphere tint represents room occlusion without flattening clearcoat reflections.
  const tintCanvas=document.createElement('canvas');tintCanvas.width=2;tintCanvas.height=128;const tint=tintCanvas.getContext('2d'),tg=tint.createLinearGradient(0,0,0,128);tg.addColorStop(0,'#ffffff');tg.addColorStop(.35,'#ffffff');tg.addColorStop(.62,'#c6c6c6');tg.addColorStop(1,'#777777');tint.fillStyle=tg;tint.fillRect(0,0,2,128);const tintMap=new T.CanvasTexture(tintCanvas);tintMap.colorSpace=T.SRGBColorSpace;for(const m of materials)m.map=tintMap;
  const marbleGeometry=new T.SphereGeometry(RADIUS,48,32);
  const marbles=Array.from({length:6},(_,id)=>{const m=new T.Mesh(marbleGeometry,materials[id<3?0:1]);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;});
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=64;
  const ctx=shadowCanvas.getContext('2d'),grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(0,0,0,.85)');grad.addColorStop(.35,'rgba(0,0,0,.5)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const shadowTexture=new T.CanvasTexture(shadowCanvas);
  const shadows=marbles.map(()=>{const m=new T.Mesh(new T.PlaneGeometry(.95,.95),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:.65}));m.rotation.x=-Math.PI/2;scene.add(m);return m;});
  const baseCanvas=document.createElement('canvas');baseCanvas.width=baseCanvas.height=128;const bc=baseCanvas.getContext('2d'),bg=bc.createRadialGradient(64,64,0,64,64,64);bg.addColorStop(0,'rgba(0,0,0,.8)');bg.addColorStop(.70,'rgba(0,0,0,.65)');bg.addColorStop(.84,'rgba(0,0,0,.3)');bg.addColorStop(1,'rgba(0,0,0,0)');bc.fillStyle=bg;bc.fillRect(0,0,128,128);const baseShadow=new T.CanvasTexture(baseCanvas);
  const contact=new T.Mesh(new T.PlaneGeometry(6.3,6.3),new T.MeshBasicMaterial({map:baseShadow,transparent:true,opacity:.65,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.009;scene.add(contact);
  const tableShade=new T.Mesh(new T.PlaneGeometry(12.5,10.5),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.6,depthWrite:false}));tableShade.rotation.x=-Math.PI/2;tableShade.position.set(-1.25,.005,1.5);scene.add(tableShade);
  const aimGroup=new T.Group();scene.add(aimGroup);
  const dotGeometry=new T.SphereGeometry(.027,8,6),dotMaterial=new T.MeshBasicMaterial({color:'#fff8e9'});
  const aimDots=Array.from({length:30},()=>{const m=new T.Mesh(dotGeometry,dotMaterial);aimGroup.add(m);return m;});
  const tether=new T.Mesh(new T.CylinderGeometry(.016,.016,1,8),new T.MeshBasicMaterial({color:'#ffb3a1'}));aimGroup.add(tether);
  const tip=new T.Mesh(new T.ConeGeometry(.075,.18,3),dotMaterial);aimGroup.add(tip);
  aimGroup.visible=false;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-TOP),up=new T.Vector3(0,1,0);
  let width=0,height=0;
  function resize(){width=canvas.clientWidth;height=canvas.clientHeight;renderer.setSize(width,height,false);const aspect=width/height;const span=aspect<1?11.6/aspect:Math.max(8.15,11.6/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.position.set(0,10,14);camera.lookAt(0,aspect<1?1.85:2.05,0);camera.updateProjectionMatrix();}
  resize();
  function boardPoint(clientX,clientY){const rect=canvas.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.ray.intersectPlane(plane,new T.Vector3());}
  function project(x,y,z){const p=new T.Vector3(x,y,z).project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
  function render(balls,aim,owner,returns=[]){
    for(const b of balls){const m=marbles[b.id];m.position.set(b.x,b.y,b.z);const flight=returns.find(r=>r.id===b.id);if(flight){const t=flight.t,e=1-Math.pow(1-t,3);m.position.set(T.MathUtils.lerp(flight.from.x,flight.to.x,e),T.MathUtils.lerp(flight.from.y,flight.to.y,e)+Math.sin(t*Math.PI)*1.2,T.MathUtils.lerp(flight.from.z,flight.to.z,e));}

      const sh=shadows[b.id];sh.position.set(m.position.x,b.off?.008:TOP+.013,m.position.z);sh.material.opacity=b.off?.9:.8;sh.visible=!flight&&(!b.off||b.y<.8);
    }
    holding.visible=!!owner;if(owner){holding.position.x=owner.x;holding.position.z=owner.z;}
    selection.visible=!!aim;aimGroup.visible=!!aim;
    if(aim){const b=balls.find(b=>b.id===aim.id);selection.position.set(b.x,TOP+.014,b.z);
      const dx=Math.cos(aim.angle),dz=Math.sin(aim.angle),length=.65+aim.power*3.3;
      for(let i=0;i<aimDots.length;i++){const d=.4+i*.13;aimDots[i].visible=d<length;aimDots[i].position.set(b.x+dx*d,TOP+.027,b.z+dz*d);}
      tip.position.set(b.x+dx*length,TOP+.03,b.z+dz*length);tip.quaternion.setFromUnitVectors(up,new T.Vector3(dx,0,dz));
      const pull=.25+aim.power*1.9;tether.position.set(b.x-dx*pull/2,TOP+.03,b.z-dz*pull/2);tether.scale.set(1,pull,1);tether.quaternion.setFromUnitVectors(up,new T.Vector3(dx,0,dz));
    }
    renderer.render(scene,camera);
  }
  return {render,resize,boardPoint,project,renderer,camera,scene};
}
