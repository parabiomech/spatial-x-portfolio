import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {ATTACK_Z,BALL_HEIGHT,DEFENDER_Z,LISTENER_HEIGHT,targetWorldPosition} from './spatial.js?v=46';

// The scan is the spatial reference. The only added scene object is the cue ball.
export class CourtView {
  constructor(host) {
    this.host=host;
    this.renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.setClearColor(0x101820);
    host.append(this.renderer.domElement);
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#101820');
    this.camera=new THREE.PerspectiveCamera(68,1,.03,1000);
    this.camera.position.set(0,LISTENER_HEIGHT,DEFENDER_Z);
    this.camera.rotation.order='YXZ';
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    this.controls.enableRotate=true;this.controls.enablePan=true;
    this.controls.screenSpacePanning=true;
    this.controls.target.set(0,LISTENER_HEIGHT,DEFENDER_Z+5);
    this.controls.enableDamping=true;
    this.controls.minDistance=.3; this.controls.maxDistance=90;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x666666,2));
    this.spark=null; this.hall=null; this.splat=null;
    this.ball=new THREE.Group();this.ball.renderOrder=999;this.ball.visible=false;this.scene.add(this.ball);
    this.ballOverlay=document.createElement('div');this.ballOverlay.className='spatial-ball';this.ballOverlay.hidden=true;this.ballOverlay.setAttribute('aria-hidden','true');host.append(this.ballOverlay);
    this.ball.add(new THREE.Mesh(new THREE.SphereGeometry(.18,24,18),new THREE.MeshBasicMaterial({color:0x1475ed,transparent:true,depthTest:false,depthWrite:false})));
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.15,.24,48),new THREE.MeshBasicMaterial({color:0x15c9ff,transparent:true,opacity:0,side:THREE.DoubleSide,depthTest:false,depthWrite:false}));
    this.ring.rotation.x=-Math.PI/2;this.ring.renderOrder=998;this.scene.add(this.ring);
    this.loadBall();
    this.listenerYaw=Math.PI;this.listenerMode=true;this.rotatePointer=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{if(!this.listenerMode||e.button!==0)return;this.rotatePointer={id:e.pointerId,x:e.clientX};this.renderer.domElement.setPointerCapture(e.pointerId);});
    this.renderer.domElement.addEventListener('pointermove',e=>{if(!this.rotatePointer||e.pointerId!==this.rotatePointer.id)return;const width=this.host.clientWidth||1;this.listenerYaw-=(e.clientX-this.rotatePointer.x)/width*Math.PI*1.65;this.rotatePointer.x=e.clientX;this.controls.target.set(this.camera.position.x+Math.sin(this.listenerYaw)*5,this.camera.position.y,this.camera.position.z-Math.cos(this.listenerYaw)*5);this.camera.lookAt(this.controls.target);this.controls.update();});
    this.renderer.domElement.addEventListener('pointerup',e=>{if(e.pointerId===this.rotatePointer?.id)this.rotatePointer=null;});
    this.controls.update();
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    this.animate=this.animate.bind(this);this.animate();
    this.loadScan();
  }
  resize(){const r=this.host.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();if(this.dataset==='ring'||this.dataset==='ring8')this.birdView();}
  attach(host){if(!host)return;this.observer.unobserve(this.host);this.host=host;host.append(this.renderer.domElement,this.ballOverlay);this.observer.observe(host);this.resize();}
  overview(){this.listenerMode=false;this.controls.enableRotate=true;this.camera.fov=75;this.camera.updateProjectionMatrix();this.camera.up.set(0,1,0);this.camera.position.set(0,13,DEFENDER_Z-1);this.controls.target.set(0,0,DEFENDER_Z);this.controls.update();}
  birdView(){this.listenerMode=false;this.controls.enableRotate=false;const height=6.8,aspect=this.camera.aspect||1;this.camera.fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(4.2/(height*aspect))),68,115);this.camera.updateProjectionMatrix();this.camera.up.set(0,1,0);this.camera.position.set(0,height,DEFENDER_Z-.35);this.controls.target.set(0,0,DEFENDER_Z);this.controls.update();}
  listenerView(){this.listenerMode=true;this.controls.enableRotate=false;this.listenerYaw=Math.PI;this.camera.fov=68;this.camera.updateProjectionMatrix();this.camera.up.set(0,1,0);this.camera.position.set(0,LISTENER_HEIGHT,DEFENDER_Z);this.controls.target.set(0,LISTENER_HEIGHT,DEFENDER_Z+5);this.controls.update();}
  taskView(){if(this.dataset==='ring'||this.dataset==='ring8')this.birdView();else this.listenerView();}
  async loadBall(){
    try{
      const manager=new THREE.LoadingManager();
      manager.setURLModifier(url=>{const name=url.split(/[\\/]/).pop();return name==='ballO6.jpg'||name==='ballO6_normal.jpg'?'./assets/ball/'+name:url;});
      const loader=new THREE.TextureLoader(manager);
      const [texture,model]=await Promise.all([loader.loadAsync('./assets/ball/ballO6.jpg'),new FBXLoader(manager).loadAsync('./assets/ball/ballO6.fbx')]);
      texture.colorSpace=THREE.SRGBColorSpace;
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const holder=new THREE.Group();holder.add(model);holder.scale.setScalar(.36/Math.max(size.x,size.y,size.z));
      // Match the working playground: an unlit albedo remains blue in the splat renderer.
      model.traverse(child=>{if(child.isMesh){child.material=new THREE.MeshBasicMaterial({color:child.geometry?.getAttribute('uv')?0xffffff:0x2879d5,map:child.geometry?.getAttribute('uv')?texture:null,side:THREE.DoubleSide,transparent:true,depthTest:false,depthWrite:false});child.renderOrder=999;}});
      this.ball.clear();this.ball.add(holder);
    }catch(e){console.warn('FBX ball fallback',e);}
  }
  async loadScan(){
    try {
      const {SparkRenderer,SplatMesh}=await import('./vendor/spark.module.js');
      this.spark=new SparkRenderer({renderer:this.renderer});this.scene.add(this.spark);
      this.hall=new THREE.Group();
      // Match playground/spatial-audio: flip, yaw 89°, scale 2.59, height 2.3.
      this.hall.rotation.set(Math.PI,THREE.MathUtils.degToRad(89),0,'YXZ');
      this.hall.scale.setScalar(2.59);this.hall.position.set(-.62,2.3,.35);this.scene.add(this.hall);
      // Correct the scanned court's slight clockwise skew around its centre.
      this.hall.rotateOnWorldAxis(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(1.5));
      this.splat=new SplatMesh({url:'./assets/stadium.sog'});this.hall.add(this.splat);
      await this.splat.initialized;
      const bounds=this.splat.getBoundingBox();
      const status=document.getElementById('scene-status');
      if(status)status.textContent=`기존 playground 경기장 스캔 · ${this.splat.numSplats.toLocaleString()}개 점 · 공간 정합 검수 전`;
    } catch(e) {
      const status=document.getElementById('scene-status');
      if(status)status.textContent='경기장 스캔을 불러오지 못했습니다. 연결을 확인해 주세요.';
      console.error('SOG load failed',e);
    }
  }
  setDataset(dataset,targets=[]){this.dataset=dataset;this.targets=targets;this.hideTarget();this.taskView();}
  hideTarget(){this.ball.visible=false;this.ballOverlay.hidden=true;this.bounceStart=null;this.ring.material.opacity=0;this.trajectory=null;}
  reveal(index,kind='impact',technique='F',duration=2,physics={}){
    const t=this.targets?.find(x=>x.index===index);if(!t)return;
    this.hideTarget();
    const point=targetWorldPosition(this.dataset,t);
    this.ball.position.set(point.x,point.y,point.z);this.ball.visible=true;this.ballOverlay.hidden=false;this.motionIndex=index;this.motionKind=kind;this.bounceStart=performance.now();
    if(kind==='trajectory')this.trajectory={start:performance.now(),duration:Math.max(.3,duration)*1000,endX:point.x,endZ:point.z,technique,speed:Number(physics.speed)||1,height:Number(physics.height)||.6,angle:Number(physics.angle)||12};
  }
  toggleScan(show){if(this.hall)this.hall.visible=show;return this.splat?.numSplats||0;}
  animate(){requestAnimationFrame(this.animate);if(document.hidden)return;
    if(this.ball.visible&&this.bounceStart!==null){const t=(performance.now()-this.bounceStart)/1000;if(this.motionKind==='impact'){const cycle=t%.72,p=cycle/.72;this.ball.position.y=BALL_HEIGHT+Math.max(0,.32*4*p*(1-p));this.ring.position.set(this.ball.position.x,BALL_HEIGHT-.18,this.ball.position.z);this.ring.scale.setScalar(1+Math.min(1,cycle/.25)*2);this.ring.material.opacity=cycle<.3?(.3-cycle)*1.8:0;}else if(this.motionKind==='shake'){this.ball.position.y=BALL_HEIGHT+Math.sin(t*18)*.055;this.ball.rotation.z=Math.sin(t*21)*.2;}else if(this.motionKind==='trajectory'&&this.trajectory){const q=Math.min(1,(performance.now()-this.trajectory.start)/this.trajectory.duration*this.trajectory.speed),m=this.trajectory;this.ball.position.x=m.endX*q;this.ball.position.z=ATTACK_Z+(m.endZ-ATTACK_Z)*q;const arc=m.technique==='F'?.04:m.technique==='2B'?Math.abs(Math.sin(q*Math.PI*2))*.32:Math.abs(Math.sin(q*Math.PI*3))*.38;this.ball.position.y=BALL_HEIGHT+arc*m.height/.6+Math.sin(m.angle*Math.PI/180)*q*.08;this.ball.rotation.x+=.13;if(q>=1)this.trajectory=null;}}
    this.controls.update();this.renderer.render(this.scene,this.camera);
    if(this.ball.visible){const p=this.ball.position.clone().project(this.camera),r=this.host.getBoundingClientRect();this.ballOverlay.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1.15||Math.abs(p.y)>1.15;if(!this.ballOverlay.hidden){this.ballOverlay.style.left=((p.x+1)*r.width/2)+'px';this.ballOverlay.style.top=((1-p.y)*r.height/2)+'px';this.ballOverlay.classList.toggle('impact',this.motionKind==='impact');}}
  }
}


