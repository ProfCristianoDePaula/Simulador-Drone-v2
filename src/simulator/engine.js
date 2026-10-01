import {createSceneCapture,createCaptureDelivery} from './capture.js';
import {createMissionScenery} from '../training/scenery.js';
import {clamp,rad,deg} from '../core/math.js';
import {createFlightState} from './state.js';
import {createSafetyRules} from './safety.js';
import {createFlightDynamics} from './physics.js';

const $ = id => document.getElementById(id);
let notify = text => {
  $("boot").hidden = false;
  $("boot").textContent = text;
};

export async function bootSimulator(options={}){
  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js");
  } catch {
    THREE = await import("https://unpkg.com/three@0.160.1/build/three.module.js");
  }


  const distance = (x,z) => Math.hypot(x-S.homeX,z-S.homeZ);
  const tabNames = [
    "Safety","Control","Camera","Transmission","RTH","Sensores","GPS",
    "Bateria","Mapa","QuickShots","ActiveTrack","Waypoints","Calibração","Guia","Ajuda","Fontes"
  ];
  const S = createFlightState();
  if(options.mission) Object.assign(S,options.mission.initial,{paused:true});
  let missionReady=!options.mission;
  let missionScenery=null;
  const mapState = {cx:0,cz:0,scale:.7,follow:true,planning:false};
  const geo = {origin:null,busy:false,message:options.mission?"Área controlada da missão":"Aguardando GPS",tiles:new Map()};
  function mapCaption(){
    $("mapCaption").textContent=geo.origin
      ? `SATÉLITE · GPS ±${Math.round(geo.origin.accuracy)} m · ${mapState.planning?"toque para criar pontos":"arraste / pinça"}`
      : geo.message;
  }
  function locate(){
    if(options.mission){notify("Missão usa cenário controlado, sem GPS real.");return;}
    if(geo.busy)return;
    if(S.flying){notify("Pouse antes de atualizar o ponto de partida.");return}
    if(!window.isSecureContext){geo.message="GPS exige HTTPS ou localhost";mapCaption();notify(geo.message);return}
    if(!navigator.geolocation){geo.message="GPS indisponível neste navegador";mapCaption();return}
    geo.busy=true;geo.message="Obtendo localização…";mapCaption();
    navigator.geolocation.getCurrentPosition(pos=>{
      geo.busy=false;
      if(S.flying){notify("Pouse e toque em GPS novamente para definir a origem.");return}
      const {latitude:lat,longitude:lon,accuracy}=pos.coords;
      if(Math.abs(lat)>85){geo.message="Localização fora da cobertura do mapa";mapCaption();return}
      reset();geo.origin={lat,lon,accuracy};geo.tiles.clear();
      mapState.follow=true;clearFlightTiles();swapView(false);mapCaption();
      notify(`Ponto de partida definido pelo GPS (precisão ±${Math.round(accuracy)} m).`);
    },error=>{
      geo.busy=false;geo.message=({1:"GPS não autorizado. Permita a localização e toque em GPS.",2:"Localização indisponível. Ative o GPS e tente novamente.",3:"Tempo do GPS esgotado. Toque em GPS para tentar novamente."})[error.code]||"Falha no GPS";
      mapCaption();notify(geo.message);
    },{enableHighAccuracy:true,timeout:20000,maximumAge:0});
  }
  function satellite(){
    mc.fillStyle="#233440";mc.fillRect(0,0,mw,mh);
    if(!geo.origin)return;
    const {lat,lon}=geo.origin,cos=Math.cos(rad(lat));
    const zoom=clamp(Math.round(Math.log2(156543.033928*cos*mapState.scale)),2,19);
    const n=2**zoom,ppm=256*n/(40075016.68557849*cos),ratio=mapState.scale/ppm;
    const ox=(lon+180)/360*n*256;
    const oy=(1-Math.asinh(Math.tan(rad(lat)))/Math.PI)/2*n*256;
    const cx=ox+mapState.cx*ppm,cy=oy+mapState.cz*ppm;
    const left=cx-mw/(2*ratio),top=cy-mh/(2*ratio);
    for(let y=Math.floor(top/256);y<=(top+mh/ratio)/256;y++){
      if(y<0||y>=n)continue;
      for(let x=Math.floor(left/256);x<=(left+mw/ratio)/256;x++){
        const tx=((x%n)+n)%n,key=`${zoom}/${y}/${tx}`;
        let tile=geo.tiles.get(key);
        if(!tile){
          tile={img:new Image(),ok:false,failed:false};geo.tiles.set(key,tile);
          tile.img.onload=()=>{tile.ok=true};tile.img.onerror=()=>{tile.failed=true};
          tile.img.src=`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${key}`;
        }
        const px=(x*256-left)*ratio,py=(y*256-top)*ratio,size=256*ratio;
        if(tile.ok)mc.drawImage(tile.img,px,py,size+.5,size+.5);
        else {mc.fillStyle="#c6d6df";mc.font="11px system-ui";mc.textAlign="left";mc.fillText(tile.failed?"Imagem indisponível":"Carregando…",px+8,py+24)}
      }
    }
    if(geo.tiles.size>256){for(const key of [...geo.tiles.keys()].slice(0,geo.tiles.size-192))geo.tiles.delete(key)}
  }
  const axes = {left:{x:0,y:0},right:{x:0,y:0}};
  const keys = new Set();
  let toastTimer;
  let lastWarning = "";
  let warningTime = 0;

  notify = text => {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>$("toast").hidden=true,5500);
  };
  function warn(text){
    const t=performance.now();
    if(text!==lastWarning || t-warningTime>5000){
      lastWarning=text;warningTime=t;notify(text);
    }
  }
  const {effectiveH,effectiveD,sensorsAvailable} = createSafetyRules(S);
  function resetInputs(){
    keys.clear();
    for(const side of ["left","right"]){
      axes[side].x=axes[side].y=0;
      $(side+"Stick").querySelector(".knob").style.transform="translate(0,0)";
    }
  }
  function cancelAuto(text){
    S.auto=null;
    if(text)notify(text);
  }

  // ---------- CENA 3D E MAPA: MESMA GEOMETRIA ----------
  const renderer = new THREE.WebGLRenderer({
    antialias:true,preserveDrawingBuffer:true,powerPreference:"high-performance"
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
  $("view3d").appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background=new THREE.Color("#a9d1e2");
  scene.fog=new THREE.Fog("#a9d1e2",300,1050);

  const camera=new THREE.PerspectiveCamera(75,1,.15,1800);
  const ambient=new THREE.HemisphereLight("#e4f5ff","#688043",2.1);
  const sun=new THREE.DirectionalLight("#fff0d6",2.6);
  sun.position.set(-180,350,120);
  scene.add(ambient,sun);

  const worldCanvas=document.createElement("canvas");
  worldCanvas.width=worldCanvas.height=1600;
  const wc=worldCanvas.getContext("2d");
  wc.fillStyle="#729258";wc.fillRect(0,0,1600,1600);
  let seed=123456;
  function rand(){
    seed=(1664525*seed+1013904223)>>>0;
    return seed/4294967296;
  }
  for(let i=0;i<7000;i++){
    wc.fillStyle=i%2?"#ffffff0a":"#2030100d";
    wc.fillRect(rand()*1600,rand()*1600,2+rand()*6,2+rand()*6);
  }
  function surfaceRect(x,z,w,d,color){
    wc.fillStyle=color;wc.fillRect(x-w/2+800,z-d/2+800,w,d);
  }
  for(let x=-680;x<=680;x+=170){
    for(let z=-680;z<=680;z+=170){
      if(Math.abs(x)<160&&Math.abs(z)<240)continue;
      surfaceRect(x,z,150,145,["#819c59","#8ba661","#698e57","#a3a667"][Math.floor(rand()*4)]);
    }
  }
  surfaceRect(0,-120,1600,22,"#555f5b");
  surfaceRect(180,0,22,1600,"#555f5b");
  for(let x=-780;x<800;x+=22)surfaceRect(x,-120,10,.8,"#e6dec5");
  for(let z=-780;z<800;z+=22)surfaceRect(180,z,.8,10,"#e6dec5");
  surfaceRect(0,0,28,28,"#bac5bd");
  wc.strokeStyle="#f5f8ee";wc.lineWidth=2;
  wc.beginPath();wc.arc(800,800,10,0,Math.PI*2);wc.stroke();
  wc.fillStyle="#f7fff3";wc.font="bold 19px Arial";
  wc.textAlign="center";wc.textBaseline="middle";wc.fillText("H",800,800);

  const texture=new THREE.CanvasTexture(worldCanvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(1600,1600),
    new THREE.MeshLambertMaterial({map:texture})
  );
  ground.rotation.x=-Math.PI/2;
  scene.add(ground);
  const trainingScenery=new THREE.Group();scene.add(trainingScenery);

  const obstacles=[];
  const materials = {
    trunk:new THREE.MeshLambertMaterial({color:"#65513a"}),
    leaf:new THREE.MeshLambertMaterial({color:"#345f38"}),
    roof:new THREE.MeshLambertMaterial({color:"#875749"})
  };
  function addBox(x,z,w,d,h,color){
    const body=new THREE.Mesh(
      new THREE.BoxGeometry(w,h,d),
      new THREE.MeshLambertMaterial({color})
    );
    body.position.set(x,h/2,z);
    trainingScenery.add(body);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+1,1,d+1),materials.roof);
    roof.position.set(x,h+.5,z);trainingScenery.add(roof);
    obstacles.push({x,z,w,d,h:h+1});
    surfaceRect(x,z,w,d,"#a28c77");
  }
  [
    [105,-215,36,28,18],[260,-260,48,36,25],[-240,-300,42,35,20],
    [-320,160,36,28,15],[280,230,42,34,24],[70,290,28,24,12],
    [-410,-60,30,24,16],[450,100,42,35,25],[-120,410,48,30,20]
  ].forEach(a=>addBox(...a,"#c6bca5"));

  for(let i=0;i<85;i++){
    const x=(rand()-.5)*1250,z=(rand()-.5)*1250;
    if(Math.hypot(x,z)<60||Math.abs(z+120)<25||Math.abs(x-180)<25)continue;
    const h=7+rand()*7,r=2.7+rand()*2;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.6,.9,h*.55,6),materials.trunk);
    trunk.position.set(x,h*.275,z);trainingScenery.add(trunk);
    const top=new THREE.Mesh(new THREE.ConeGeometry(r,h*.8,7),materials.leaf);
    top.position.set(x,h*.65,z);trainingScenery.add(top);
    obstacles.push({x,z,w:r*2,d:r*2,h:h*1.05});
    wc.beginPath();wc.fillStyle="#315f3e";
    wc.arc(x+800,z+800,r,0,Math.PI*2);wc.fill();
  }
  texture.needsUpdate=true;

  const vehicle=new THREE.Group();
  const carBody=new THREE.Mesh(
    new THREE.BoxGeometry(7,2.4,3.6),
    new THREE.MeshLambertMaterial({color:"#ff8a22"})
  );
  carBody.position.y=1.6;vehicle.add(carBody);
  const cab=new THREE.Mesh(
    new THREE.BoxGeometry(3.8,1.6,3.2),
    new THREE.MeshLambertMaterial({color:"#90bec7"})
  );
  cab.position.set(-.5,3.5,0);vehicle.add(cab);
  for(const x of [-2.3,2.3]){
    for(const z of [-1.9,1.9]){
      const wheel=new THREE.Mesh(
        new THREE.CylinderGeometry(.85,.85,.6,12),
        new THREE.MeshLambertMaterial({color:"#242b30"})
      );
      wheel.rotation.x=Math.PI/2;wheel.position.set(x,.85,z);vehicle.add(wheel);
    }
  }
  vehicle.position.set(80,0,-120);scene.add(vehicle);
  if(options.mission)missionScenery=createMissionScenery(THREE,scene,trainingScenery,obstacles,options.mission);

  // Local east/south metre coordinates share the minimap's Mercator origin.
  const flightTiles=new Map(),flightGroup=new THREE.Group();scene.add(flightGroup);
  let flightOrigin=null,flightQueue=[],flightActive=0,flightLast=-Infinity;
  const flightLoader=new THREE.TextureLoader().setCrossOrigin("anonymous");
  function geoPosition(x=S.x,z=S.z){
    if(!geo.origin)return null;
    const {lat,lon}=geo.origin,c=Math.cos(rad(lat)),R=6378137;
    return {lat:deg(Math.atan(Math.sinh(Math.asinh(Math.tan(rad(lat)))-z/(R*c)))),
      lon:((lon+deg(x/(R*c))+540)%360)-180};
  }
  function disposeFlightTile(tile){
    tile.dead=true;
    if(tile.mesh){flightGroup.remove(tile.mesh);tile.mesh.geometry.dispose();tile.mesh.material.dispose()}
    if(tile.texture)tile.texture.dispose();
  }
  function clearFlightTiles(){
    for(const tile of flightTiles.values())disposeFlightTile(tile);
    flightTiles.clear();flightQueue=[];flightOrigin=geo.origin;flightLast=-Infinity;
  }
  function loadFlightQueue(){
    while(flightActive<6&&flightQueue.length){
      const tile=flightQueue.shift();if(tile.dead)continue;
      flightActive++;
      tile.texture=flightLoader.load(tile.url,texture=>{
        flightActive--;
        if(tile.dead){texture.dispose();loadFlightQueue();return}
        texture.colorSpace=THREE.SRGBColorSpace;
        texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
        const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(tile.size,tile.size),material);
        mesh.rotation.x=-Math.PI/2;
        mesh.position.set(tile.x,tile.zoom===18?.025:0,tile.z);
        tile.mesh=mesh;flightGroup.add(mesh);tile.ready=true;loadFlightQueue();
      },undefined,()=>{flightActive--;tile.failed=true;loadFlightQueue()});
    }
  }
  function updateFlightTerrain(now){
    const live=!!geo.origin;
    trainingScenery.visible=!live;ground.visible=!live;
    // The orange training target is shown only while explicitly selected.
    vehicle.visible=!live||S.selected;
    if(!live){$("flightGeo").textContent="Cenário de treino · "+geo.message;return}
    if(flightOrigin!==geo.origin)clearFlightTiles();
    if(now-flightLast<250)return;flightLast=now;
    const {lat,lon}=geo.origin,c=Math.cos(rad(lat)),keep=new Set(),pending=[];
    // Broad coverage under detailed nearby tiles prevents blank gaps during flight.
    for(const zoom of [15,18]){
      const n=2**zoom,size=40075016.68557849*c/n;
      const ox=(lon+180)/360*n,oy=(1-Math.asinh(Math.tan(rad(lat)))/Math.PI)/2*n;
      const tx=Math.floor(ox+S.x/size),ty=Math.floor(oy+S.z/size);
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
        const x=tx+dx,y=ty+dy;if(y<0||y>=n)continue;
        const key=`${zoom}/${y}/${x}`;keep.add(key);
        if(flightTiles.has(key))continue;
        const tile={zoom,size,x:(x+.5-ox)*size,z:(y+.5-oy)*size,dead:false,
          url:`https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${((x%n)+n)%n}`};
        flightTiles.set(key,tile);pending.push(tile);
      }
    }
    for(const [key,tile] of flightTiles)if(!keep.has(key)){disposeFlightTile(tile);flightTiles.delete(key)}
    pending.sort((a,b)=>(a.zoom===15?-1:1)-(b.zoom===15?-1:1)||Math.hypot(a.x-S.x,a.z-S.z)-Math.hypot(b.x-S.x,b.z-S.z));
    flightQueue.push(...pending);loadFlightQueue();
    const p=geoPosition(),tiles=[...flightTiles.values()];
    const ready=tiles.filter(t=>t.ready).length,failed=tiles.filter(t=>t.failed).length;
    $("flightGeo").textContent=`${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} · posição simulada`+
      (!ready?(failed?" · imagens indisponíveis":" · carregando satélite…"):(failed?" · cobertura parcial":""));
    scene.fog.near=600;scene.fog.far=2400;camera.far=3500;
  }

  function resize3D(){
    const r=$("view3d").getBoundingClientRect();
    if(r.width<2||r.height<2)return;
    renderer.setSize(r.width,r.height,false);
    camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize3D).observe($("view3d"));
  window.addEventListener("desktopfit",resize3D);
  resize3D();

  function updateCamera(){
    const pitch=rad(S.gimbal),y=Math.max(.85,S.h);
    camera.position.set(S.x,y,S.z);
    camera.lookAt(
      S.x+Math.sin(S.yaw)*Math.cos(pitch),
      y+Math.sin(pitch),
      S.z-Math.cos(S.yaw)*Math.cos(pitch)
    );
    camera.fov=75/S.zoom;camera.updateProjectionMatrix();
    renderer.toneMappingExposure=Math.pow(2,S.ev)*(S.light==="Dia"?1:.35);
    ambient.intensity=S.light==="Dia"?2.1:.25;
    sun.intensity=S.light==="Dia"?2.6:.12;
  }

  // ---------- MAPA CANVAS: PAN, ZOOM, PINÇA E WAYPOINTS ----------
  const mapCanvas=$("mapCanvas"),mc=mapCanvas.getContext("2d");
  const trail=[];
  let mw=1,mh=1;
  function resizeMap(){
    const r=mapCanvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(r.width<2||r.height<2)return;
    mw=r.width;mh=r.height;
    if(mapCanvas.width!==Math.round(mw*dpr)||mapCanvas.height!==Math.round(mh*dpr)){
      mapCanvas.width=Math.round(mw*dpr);mapCanvas.height=Math.round(mh*dpr);
    }
    mc.setTransform(dpr,0,0,dpr,0,0);
  }
  const toMap=(x,z)=>({
    x:mw/2+(x-mapState.cx)*mapState.scale,
    y:mh/2+(z-mapState.cz)*mapState.scale
  });
  const fromMap=(x,y)=>({
    x:mapState.cx+(x-mw/2)/mapState.scale,
    z:mapState.cz+(y-mh/2)/mapState.scale
  });
  function drawMap(){
    resizeMap();
    if(mapState.follow){mapState.cx=S.x;mapState.cz=S.z}
    satellite();

    const hp=toMap(S.homeX,S.homeZ);
    mc.strokeStyle="#087862";mc.lineWidth=1.5;mc.setLineDash([5,5]);
    mc.beginPath();mc.arc(hp.x,hp.y,effectiveD()*mapState.scale,0,Math.PI*2);mc.stroke();
    mc.setLineDash([]);

    if(trail.length>1){
      mc.strokeStyle="#0876a9";mc.lineWidth=2;mc.beginPath();
      trail.forEach((p,i)=>{
        const q=toMap(p.x,p.z);
        i?mc.lineTo(q.x,q.y):mc.moveTo(q.x,q.y);
      });mc.stroke();
    }
    if(S.waypoints.length){
      mc.strokeStyle="#af4aa2";mc.lineWidth=2;mc.setLineDash([6,4]);mc.beginPath();
      S.waypoints.forEach((p,i)=>{
        const q=toMap(p.x,p.z);i?mc.lineTo(q.x,q.y):mc.moveTo(q.x,q.y);
      });mc.stroke();mc.setLineDash([]);
      S.waypoints.forEach((p,i)=>{
        const q=toMap(p.x,p.z);
        mc.beginPath();mc.fillStyle="#fff";mc.arc(q.x,q.y,11,0,Math.PI*2);mc.fill();
        mc.strokeStyle="#8e4482";mc.stroke();
        mc.fillStyle="#7e356f";mc.font="bold 12px Arial";mc.textAlign="center";
        mc.textBaseline="middle";mc.fillText(i+1,q.x,q.y);
      });
    }
    mc.beginPath();mc.fillStyle="#087e61";mc.arc(hp.x,hp.y,11,0,Math.PI*2);mc.fill();
    mc.fillStyle="white";mc.font="bold 12px Arial";mc.textAlign="center";
    mc.textBaseline="middle";mc.fillText("H",hp.x,hp.y);

    const tp=toMap(vehicle.position.x,vehicle.position.z);
    if(!geo.origin||S.selected){mc.fillStyle="#ff831e";mc.fillRect(tp.x-5,tp.y-4,10,8)}
    const dp=toMap(S.x,S.z);
    mc.save();mc.translate(dp.x,dp.y);mc.rotate(S.yaw);
    mc.beginPath();mc.moveTo(0,-12);mc.lineTo(8,9);mc.lineTo(0,5);mc.lineTo(-8,9);
    mc.closePath();mc.fillStyle="#0788c5";mc.fill();
    mc.strokeStyle="white";mc.lineWidth=2;mc.stroke();mc.restore();
    mc.font="bold 12px Arial";mc.textAlign="left";mc.fillStyle="#ffffff";
    mc.fillText("N ↑",10,S.mapFull?100:18);
    const meters=mapState.scale>1?20:mapState.scale>.3?50:100;
    const y=mh-27;
    mc.strokeStyle="#ffffff";mc.lineWidth=2;mc.beginPath();
    mc.moveTo(10,y);mc.lineTo(10+meters*mapState.scale,y);mc.stroke();
    mc.font="11px Arial";mc.fillText(meters+" m",10,y-7);
  }

  function mapZoom(factor,ax=mw/2,ay=mh/2){
    mapState.follow=false;
    const before=fromMap(ax,ay);
    mapState.scale=clamp(mapState.scale*factor,.08,5);
    mapState.cx=before.x-(ax-mw/2)/mapState.scale;
    mapState.cz=before.z-(ay-mh/2)/mapState.scale;
  }
  const mapPointers=new Map();
  let mapGesture=null;
  function pointerLocation(e){
    const r=mapCanvas.getBoundingClientRect();
    return {x:e.clientX-r.left,y:e.clientY-r.top};
  }
  mapCanvas.addEventListener("pointerdown",e=>{
    e.preventDefault();mapCanvas.setPointerCapture(e.pointerId);
    const p=pointerLocation(e);mapPointers.set(e.pointerId,p);
    if(mapPointers.size===1)mapGesture={start:p,last:p,moved:false,pinched:false};
    else if(mapGesture)mapGesture.pinched=true;
  });
  mapCanvas.addEventListener("pointermove",e=>{
    if(!mapPointers.has(e.pointerId))return;
    const old=[...mapPointers.values()];
    const p=pointerLocation(e);mapPointers.set(e.pointerId,p);
    const now=[...mapPointers.values()];
    if(now.length>=2&&old.length>=2){
      const d0=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y);
      const d1=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y);
      if(d0>5)mapZoom(d1/d0,(now[0].x+now[1].x)/2,(now[0].y+now[1].y)/2);
      if(mapGesture)mapGesture.pinched=true;
    }else if(mapGesture&&!mapGesture.pinched){
      const dx=p.x-mapGesture.last.x,dy=p.y-mapGesture.last.y;
      if(Math.hypot(p.x-mapGesture.start.x,p.y-mapGesture.start.y)>5)mapGesture.moved=true;
      if(mapGesture.moved){
        mapState.follow=false;
        mapState.cx-=dx/mapState.scale;mapState.cz-=dy/mapState.scale;
      }
      mapGesture.last=p;
    }
  });
  function mapRelease(e,cancel=false){
    if(!mapPointers.has(e.pointerId))return;
    const p=pointerLocation(e),g=mapGesture;
    mapPointers.delete(e.pointerId);
    if(!cancel&&g&&!g.moved&&!g.pinched){
      if(!S.mapFull){swapView()}
      else if(mapState.planning){
        const q=fromMap(p.x,p.y);
        if(S.waypoints.length>=12)notify("Máximo de 12 pontos neste exercício.");
        else if(distance(q.x,q.z)>effectiveD())notify("Ponto fora do limite de distância atual.");
        else if(S.wpHeight>effectiveH())notify("Altura do waypoint acima do limite atual.");
        else{
          S.waypoints.push({...q,h:S.wpHeight});
          notify("Waypoint "+S.waypoints.length+" adicionado. Abra WP para executar.");
        }
      }
    }
    if(!mapPointers.size)mapGesture=null;
  }
  mapCanvas.addEventListener("pointerup",e=>mapRelease(e));
  mapCanvas.addEventListener("pointercancel",e=>mapRelease(e,true));
  mapCanvas.addEventListener("wheel",e=>{
    e.preventDefault();const p=pointerLocation(e);
    mapZoom(Math.exp(-e.deltaY*.0015),p.x,p.y);
  },{passive:false});

  function swapView(force){
    S.mapFull=typeof force==="boolean"?force:!S.mapFull;
    $("screen").classList.toggle("mapFull",S.mapFull);
    mapCaption();
    requestAnimationFrame(resize3D);
  }

  // ---------- MANETES, MOUSE, TOQUE E TECLADO ----------
  for(const side of ["left","right"]){
    const el=$(side+"Stick"),knob=el.querySelector(".knob");
    let pointerId=null;
    function update(e){
      const r=el.getBoundingClientRect(),limit=r.width*.29;
      let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
      const len=Math.hypot(x,y);
      if(len>limit){x*=limit/len;y*=limit/len}
      axes[side].x=x/limit;axes[side].y=-y/limit;
      const visualScale=r.width/el.offsetWidth;
      knob.style.transform=`translate(${x/visualScale}px,${y/visualScale}px)`;
    }
    el.addEventListener("pointerdown",e=>{
      if(pointerId!==null)return;
      e.preventDefault();pointerId=e.pointerId;
      el.setPointerCapture(pointerId);update(e);
    });
    el.addEventListener("pointermove",e=>{if(e.pointerId===pointerId)update(e)});
    const release=e=>{
      if(e.pointerId!==pointerId)return;
      pointerId=null;axes[side].x=axes[side].y=0;
      knob.style.transform="translate(0,0)";
    };
    el.addEventListener("pointerup",release);
    el.addEventListener("pointercancel",release);
    el.addEventListener("lostpointercapture",release);
  }

  function pause(){
    resetInputs();S.paused=!S.paused;
    notify(S.paused?"Simulação pausada.":"Simulação retomada.");
  }
  const flightKeys=["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"];
  window.addEventListener("keydown",e=>{
    if($("settings").open||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
    if(flightKeys.includes(e.code)){e.preventDefault();keys.add(e.code)}
    if(e.repeat)return;
    if(e.code==="Space"){e.preventDefault();pause()}
    if(e.code==="KeyR")startRTH();
    if(e.code==="KeyP")photo();
    if(e.code==="KeyM")swapView();
  });
  window.addEventListener("keyup",e=>keys.delete(e.code));
  window.addEventListener("blur",()=>{
    resetInputs();S.paused=true;
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      resetInputs();S.paused=true;
    }
  });

  let holdTimer=null,longPress=false;
  const brake=$("brakeHardware");
  brake.addEventListener("pointerdown",e=>{
    e.preventDefault();brake.setPointerCapture(e.pointerId);
    longPress=false;
    holdTimer=setTimeout(()=>{longPress=true;startRTH()},950);
  });
  brake.addEventListener("pointerup",()=>{
    clearTimeout(holdTimer);
    if(!longPress)pause();
  });
  brake.addEventListener("pointercancel",()=>clearTimeout(holdTimer));
  brake.addEventListener("lostpointercapture",()=>clearTimeout(holdTimer));
  brake.addEventListener("click",e=>{if(e.detail===0)pause()});

  $("gimbal").addEventListener("input",e=>{
    S.gimbal=Number(e.target.value);
    if(S.auto?.look)notify("O modo automático está orientando a câmera para o alvo.");
  });
  $("zoom").addEventListener("input",e=>S.zoom=Number(e.target.value));

  // ---------- AUTOMAÇÃO DE VOO DIDÁTICA ----------
  function ready(){
    if(!missionReady){notify("Conclua a preparação da missão antes de decolar.");return false;}
    if(!S.power){notify("Ligue a simulação pelo botão de energia.");return false}
    if(S.crashed){notify("Colisão simulada. Use Reiniciar.");return false}
    return true;
  }
  function takeoff(){
    if(!ready())return;
    if(S.flying){S.auto={kind:"land"};S.paused=false;return}
    if(S.gps!=="Bom"||!S.homeValid){
      notify("Confirme GNSS e Home Point antes da decolagem do exercício.");return;
    }
    if(S.link!=="Bom"){notify("Restabeleça o enlace em Transmission.");return}
    if(S.battery<15){notify("Recarregue a bateria simulada antes de decolar.");return}
    S.flying=true;S.paused=false;S.auto={kind:"takeoff"};
  }
  function startRTH(){
    if(!ready()||!S.flying){notify("Decole antes de iniciar RTH.");return}
    if(S.gps!=="Bom"||!S.homeValid){notify("RTH indisponível: confira GNSS e origem.");return}
    if(S.rthH>effectiveH()){
      notify("Altura de RTH acima do teto vigente no exercício. Revise Safety e RTH.");return;
    }
    S.paused=false;
    S.auto={kind:"rth",phase:"climb",height:Math.max(S.h,S.rthH)};
    notify("RTH simulado: altitude de retorno → origem → pouso. Supervise.");
  }
  function requireFlight(){
    if(!ready())return false;
    if(!S.flying){notify("Decole antes de iniciar este modo.");return false}
    if(S.gps!=="Bom"||S.link!=="Bom"||!S.homeValid){
      notify("O exercício exige GNSS, origem e enlace disponíveis.");return false;
    }
    return true;
  }
  function aimAt(x,z,y=2){
    const d=Math.hypot(x-S.x,z-S.z);
    S.yaw=Math.atan2(x-S.x,-(z-S.z));
    S.gimbal=clamp(deg(Math.atan2(y-S.h,Math.max(.01,d))),-90,60);
  }
  function pathValid(points){
    return points.every(p=>p.h<=effectiveH()&&distance(p.x,p.z)<=effectiveD());
  }
  function startWaypoints(){
    if(!requireFlight())return;
    if(S.waypoints.length<2){notify("Adicione pelo menos dois waypoints.");return}
    if(!pathValid(S.waypoints)){notify("Revise os pontos: a rota supera os limites atuais.");return}
    S.auto={kind:"path",name:"Waypoints",points:S.waypoints.map(p=>({...p})),index:0};
    S.paused=false;mapState.planning=false;closePanel();
    notify("Waypoints iniciado. Use Pausa ou RTH para intervir.");
  }
  function startTrack(){
    if(!requireFlight())return;
    if(!S.selected){notify("Selecione o veículo laranja primeiro.");return}
    const h=Math.max(20,S.h);
    if(h>effectiveH()){notify("O teto atual não permite este exercício de acompanhamento.");return}
    S.auto={kind:"track",height:h,phase:"climb",look:true};
    S.paused=false;closePanel();
  }
  function startQuick(){
    if(!requireFlight())return;
    const ox=S.x,oz=S.z,oh=S.h;
    const tx=vehicle.position.x,tz=vehicle.position.z;
    const r=Math.max(10,Math.hypot(ox-tx,oz-tz));
    const angle=Math.atan2(oz-tz,ox-tx);
    let dx=(ox-tx)/r,dz=(oz-tz)/r;
    if(Math.hypot(dx,dz)<.1){dx=0;dz=1}
    const points=[],base=Math.max(20,oh);
    points.push({x:ox,z:oz,h:base});
    for(let i=1;i<=48;i++){
      const u=i/48;
      let x=ox,z=oz,h=base;
      if(S.shot==="Dronie"){x+=dx*80*u;z+=dz*80*u;h+=30*u}
      if(S.shot==="Rocket"){h+=45*u}
      if(S.shot==="Circle"||S.shot==="Helix"){
        const a=angle+u*Math.PI*2;
        const rr=r+(S.shot==="Helix"?25*u:0);
        x=tx+Math.cos(a)*rr;z=tz+Math.sin(a)*rr;
        if(S.shot==="Helix")h+=35*u;
      }
      if(S.shot==="Boomerang"){
        const a=angle+u*Math.PI*2,rr=r*(1+.25*Math.sin(Math.PI*u));
        x=tx+Math.cos(a)*rr;z=tz+Math.sin(a)*rr;h+=20*Math.sin(Math.PI*u);
      }
      if(S.shot==="Asteroid"){x+=dx*65*u;z+=dz*65*u;h+=40*u}
      points.push({x,z,h});
    }
    if(!pathValid(points)){
      notify("A trajetória supera os limites atuais. Ajuste limites ou posição inicial.");return;
    }
    S.selected=true;S.paused=false;
    S.auto={
      kind:"path",name:S.shot,points,index:0,look:true,
      target:{x:tx,z:tz},rocket:S.shot==="Rocket",asteroid:S.shot==="Asteroid"
    };
    closePanel();
    notify(S.shot+" iniciado. Trajetória didática, sem equivalência exata ao algoritmo DJI.");
  }

  function goTo(p,dt,speed=7){
    const dx=p.x-S.x,dz=p.z-S.z,dh=p.h-S.h,d=Math.hypot(dx,dz);
    return {
      x:d>.01?dx/d*Math.min(speed,d/dt):0,
      z:d>.01?dz/d*Math.min(speed,d/dt):0,
      y:clamp(dh/dt,-2.5,3)
    };
  }
  function reached(p){return Math.hypot(p.x-S.x,p.z-S.z)<.8&&Math.abs(p.h-S.h)<.5}
  function autopilot(dt){
    const a=S.auto;
    if(!a)return {x:0,y:0,z:0};
    if(a.kind==="takeoff"){
      if(S.h>=2.8){S.auto=null;notify("Decolagem concluída. Use os manetes.");return {x:0,y:0,z:0}}
      return {x:0,z:0,y:Math.min(2,(3-S.h)/dt)};
    }
    if(a.kind==="land")return {x:0,z:0,y:-1.8};
    if(a.kind==="rth"){
      if(a.phase==="climb"){
        if(S.h>=a.height-.4)a.phase="home";
        return {x:0,z:0,y:clamp((a.height-S.h)/dt,0,3)};
      }
      if(a.phase==="home"){
        if(distance(S.x,S.z)<.8){a.phase="land";return {x:0,z:0,y:0}}
        const p={x:S.homeX,z:S.homeZ,h:Math.max(a.height,a.clearance||0)};
        S.yaw=Math.atan2(p.x-S.x,-(p.z-S.z));
        return goTo(p,dt,8);
      }
      return {x:0,z:0,y:-1.8};
    }
    if(a.kind==="track"){
      if(a.phase==="climb"){
        if(S.h>=a.height-.5)a.phase="follow";
        return {x:0,z:0,y:clamp((a.height-S.h)/dt,0,3)};
      }
      S.targetPhase+=dt*.12;
      vehicle.position.x=80+40*Math.sin(S.targetPhase);
      vehicle.position.z=-120+16*Math.sin(S.targetPhase*.5);
      const p={
        x:vehicle.position.x-28,z:vehicle.position.z+28,
        h:Math.max(a.height,a.clearance||0)
      };
      if(!pathValid([p])){
        cancelAuto("Acompanhamento interrompido pelo limite atual.");
        return {x:0,z:0,y:0};
      }
      aimAt(vehicle.position.x,vehicle.position.z);
      return goTo(p,dt,8);
    }
    if(a.kind==="panorama"){
      S.yaw+=dt*Math.PI/5;a.time+=dt;
      if(a.time>=10)cancelAuto("Demonstração concluída. Não foi criado um panorama composto.");
      return {x:0,z:0,y:0};
    }
    if(a.kind==="path"){
      if(a.index>=a.points.length){
        if(a.asteroid){S.auto={kind:"panorama",time:0};S.gimbal=-35}
        else cancelAuto(a.name+" concluído. Aeronave pairando.");
        return {x:0,z:0,y:0};
      }
      const base=a.points[a.index];
      const p={...base,h:Math.max(base.h,a.clearance||0)};
      if(!pathValid([p])){
        cancelAuto("Rota interrompida: os limites foram alterados.");
        return {x:0,z:0,y:0};
      }
      if(reached(p)){a.index++;return {x:0,z:0,y:0}}
      if(a.look){
        aimAt(a.target.x,a.target.z);
        if(a.rocket)S.gimbal=-90;
      }else{
        S.yaw=Math.atan2(p.x-S.x,-(p.z-S.z));
      }
      return goTo(p,dt,8);
    }
    return {x:0,z:0,y:0};
  }

  const {physics} = createFlightDynamics({S,geo,obstacles,axes,keys,distance,effectiveH,effectiveD,sensorsAvailable,warn,resetInputs,notify,startRTH,autopilot});

  // ---------- FOTO E VÍDEO DA CENA WEBGL ----------
  function download(blob,name){
    const a=document.createElement("a"),url=URL.createObjectURL(blob);
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  const captures=createSceneCapture({
    canvas:renderer.domElement,render(){updateCamera();renderer.render(scene,camera);},snapshot,
    beforeCapture:options.beforeCapture,
    maxBytes:options.mission?10485760:Infinity,
    notify(text){notify(text);options.onCaptureNotice?.(text);},
    onState(active,saving){
      const button=$("recordButton");button.classList.toggle("recording",active);
      button.disabled=saving;button.setAttribute("aria-label",saving?"Salvando vídeo":active?"Parar e salvar vídeo":"Iniciar gravação de vídeo");
      button.title=button.getAttribute("aria-label");
      options.onCaptureState?.(active,saving);
    },
    save:createCaptureDelivery({download,onCapture:options.onCapture})
  });
  const photo=()=>captures.photo(),record=()=>captures.record(),stopRecord=()=>captures.stop();

  // ---------- SELEÇÃO DO ALVO NA IMAGEM ----------
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  $("view3d").addEventListener("click",e=>{
    if(S.mapFull){swapView(false);return}
    const r=renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(vehicle,true);
    if(hit.length){S.selected=true;notify("Veículo selecionado. Abra AT para iniciar ActiveTrack.")}
  });

  // ---------- MENUS ----------
  const B=(text,act,extra="")=>`<button data-act="${act}" ${extra}>${text}</button>`;
  function field(label,key,min,max,step=1){
    return `<label class="field"><span>${label}</span>
      <input data-setting="${key}" type="number" min="${min}" max="${max}"
      step="${step}" value="${S[key]}" required></label>`;
  }
  function choice(label,key,options){
    return `<label class="field"><span>${label}</span><select data-setting="${key}">
      ${options.map(v=>`<option ${S[key]===v?"selected":""}>${v}</option>`).join("")}
      </select></label>`;
  }
  function checkbox(label,key){
    return `<label class="check"><input data-setting="${key}" type="checkbox"
      ${S[key]?"checked":""}>${label}</label>`;
  }
  function openPanel(name){
    if(!tabNames.includes(name))return;
    resetInputs();S.panel=name;
    if(name==="Safety")S.safetyVisited=true;
    if(!$("settings").open)$("settings").showModal();
    renderPanel();
  }
  function closePanel(){$("settings").close();resetInputs()}
  $("settings").addEventListener("close",resetInputs);

  const calSteps={
    "Bússola":[
      "Escolha uma área aberta, afastada de metal, carros e interferência. Abra Safety → Sensors → Compass → Calibrate.",
      "Siga a rotação horizontal mostrada no DJI Fly.",
      "Siga a orientação vertical e a rotação mostradas na tela.",
      "Aguarde a confirmação. Se persistir erro em local adequado, investigue a causa antes de voar."
    ],
    "IMU":[
      "Com o drone frio, parado e em superfície plana, abra Safety → Sensors → IMU → Calibrate.",
      "Siga as posições ilustradas pelo DJI Fly, mantendo o drone imóvel durante cada medição.",
      "Aguarde a conclusão e reinicie se solicitado."
    ],
    "Gimbal":[
      "Remova o protetor e deixe a câmera livre, com o drone em uma superfície plana.",
      "Abra Control → Gimbal Calibration → Auto e aguarde sem mover o drone.",
      "Confira o horizonte, a conclusão e a ausência de avisos."
    ],
    "Controle RC 2":[
      "Com a aeronave desligada, procure RC Calibration no DJI Fly, quando disponível.",
      "Centralize os manetes e siga os movimentos completos de manetes e dials solicitados.",
      "Aguarde a conclusão. A posição desse menu pode variar com a versão."
    ]
  };
  function startGuide(){
    S.guide=0;S.checks=[false,false,false];S.safetyVisited=false;
    if(!S.flying){S.maxH=60;S.maxD=200}
    openPanel("Guia");
  }
  function guideReady(){
    if(S.guide===0)return S.checks[0];
    if(S.guide===1)return S.safetyVisited;
    if(S.guide===2)return S.maxH===200;
    if(S.guide===3)return S.maxD===20000;
    if(S.guide===4)return S.checks[1]&&S.checks[2];
    return true;
  }
  function guideCheck(i,text){
    return `<label class="check"><input type="checkbox" data-guide-check="${i}"
      ${S.checks[i]?"checked":""}>${text}</label>`;
  }
  function guideHtml(){
    if(S.guide<0)return `<h2>200 m de altura e 20 km de distância</h2>
      <p>O guia acompanha os mesmos valores usados pela simulação.</p>${B("Iniciar guia","guide",'class="primary"')}`;
    const names=["Preparar","Abrir Safety","Altura","Distância","Revisar"];
    let html=`<progress value="${S.guide}" max="5"></progress>
      <h2>${S.guide===5?"Prática concluída":`Etapa ${S.guide+1} / 5 · ${names[S.guide]}`}</h2>`;
    if(S.guide===0)html+=`<p>No equipamento real, com o drone no solo:
      ligue drone e RC 2, confirme conexão no DJI Fly, confira unidades em metros,
      versão, avisos, local e condições de operação.</p>
      ${guideCheck(0,"Entendi que devo conferir regras, espaço aéreo, vento e contato visual.")}`;
    if(S.guide===1)html+=`<p>No DJI Fly, abra ••• → Safety / Segurança →
      Flight Protection / Proteção de voo.</p>
      <p>Abra Safety neste simulador e depois retorne à aba Guia.</p>
      ${B("Abrir Safety","panel:Safety")}
      <p>${S.safetyVisited?"Safety já foi aberto.":"Aguardando você abrir Safety."}</p>`;
    if(S.guide===2)html+=`<p>Ajuste Max Altitude para 200 m.
      No RC 2 real, confirme a edição conforme solicitado.</p>
      ${field("Altura máxima (m)","maxH",20,200)}`;
    if(S.guide===3)html+=`<p>Ajuste Max Distance para 20.000 m (20 km).
      Não escolha distância ilimitada.</p>
      ${field("Distância máxima (m)","maxD",50,20000)}`;
    if(S.guide===4)html+=`${choice("Cenário didático","scenario",
      ["Normal","Teto local 60 m","Visibilidade 200 m","Restrição de firmware 30 m"])}
      <div class="note">Limites efetivos neste cenário: ${effectiveH()} m / ${effectiveD()} m.
      Os valores reduzidos são exemplos fictícios, não regras regionais.</div>
      ${guideCheck(1,"Vou revisar Home Point, RTH, sensores e bateria no equipamento.")}
      ${guideCheck(2,"Entendo que 200 m / 20 km podem não ser permitidos no local.")}`;
    if(S.guide===5)html+=`<div class="note">
      Valores configurados: <strong>${S.maxH} m / ${S.maxD} m</strong>.<br>
      Limites aplicados no cenário: <strong>${effectiveH()} m / ${effectiveD()} m</strong>.
      </div><p>Reabra Safety no RC 2 real para conferir os valores aceitos.
      A altura acima do terreno pode diferir da altura relativa à decolagem.
      Este resultado não autoriza voo.</p>${B("Repetir prática","guide")}`;
    else html+=`<div class="row">
      ${S.guide>0?B("Voltar","guide-back"):""}
      ${B(S.guide===4?"Concluir":"Continuar","guide-next",
        `class="primary" ${guideReady()?"":"disabled"}`)}
      </div>`;
    return html;
  }

  function renderPanel(){
    $("panelTitle").textContent=S.panel+" · simulação pausada durante o menu";
    $("tabs").innerHTML=tabNames.map(n=>
      B(n,"panel:"+n,`class="${S.panel===n?"active":""}"`)).join("");
    let html="";
    switch(S.panel){
      case "Safety":
        html=`<h2>Proteção de voo</h2>
          ${field("Max Altitude · altura máxima (m)","maxH",20,200)}
          ${field("Max Distance · distância máxima (m)","maxD",50,20000)}
          ${choice("Resposta a obstáculos","avoid",["Frear","Desviar","Desligado"])}
          ${choice("Cenário de limites","scenario",
            ["Normal","Teto local 60 m","Visibilidade 200 m","Restrição de firmware 30 m"])}
          <div class="note">Limites efetivos: ${effectiveH()} m / ${effectiveD()} m.
          Faixas e cenários são didáticos.</div>
          <p>Max Altitude é relativo à decolagem. Max Distance é horizontal em relação
          ao Home Point. Firmware, região, classe, conexão e condições podem impor
          limites diferentes. Um campo bloqueado deve ser investigado pelos avisos e
          suporte oficial; este simulador não ensina a contornar restrições.</p>`;
        break;
      case "Control":
        html=`<h2>RC 2 · modo de manetes 2</h2>
          ${choice("Modo de voo","mode",["Cine","Normal","Sport"])}
          <ul class="list">
            <li>Esquerdo: subir/descer e girar.</li>
            <li>Direito: avançar/recuar e deslocar lateralmente.</li>
            <li>Cine suaviza a resposta; Sport desativa a assistência de obstáculos.</li>
            <li>Dial esquerdo: gimbal. Dial direito: zoom disponível.</li>
            <li>Neste exercício: C1 centraliza o gimbal; C2 alterna mapa e câmera.</li>
          </ul>
          <p>No RC 2 real, C1/C2 são configuráveis. O botão de energia usa a sequência
          de um toque e depois manter pressionado; aqui a energia usa um clique.</p>`;
        break;
      case "Camera":
        html=`<h2>Câmera da cena 3D</h2>
          ${field("Zoom","zoom",1,3,.1)}
          ${field("Gimbal (graus)","gimbal",-90,60)}
          ${choice("Exposição didática","exposure",["Auto","Pro"])}
          ${field("Compensação visual EV","ev",-2,2,.1)}
          ${checkbox("Mostrar linhas de grade","grid")}
          <div class="row">${B(options.mission?"Registrar foto na missão":"Baixar foto PNG","photo")}${B("Gravar / parar vídeo","record")}</div>
          <p>A imagem muda com posição, altura, orientação, gimbal e zoom.
          EV altera o brilho da renderização. Não há simulação física de ISO,
          obturador, sensor ou qualidade óptica do Mini 4 Pro.</p>
          <p>Foto e vídeo capturam somente o canvas 3D, sem menus. A gravação depende
          do suporte do navegador e encerra após 2 minutos.</p>`;
        break;
      case "Transmission":
        html=`<h2>Enlace simulado</h2>
          ${choice("Estado do enlace","link",["Bom","Perdido"])}
          ${choice("Ação na perda do enlace","lossAction",["RTH","Pairar","Pousar"])}
          <p>A perda bloqueia os comandos manuais do voo e aciona a resposta escolhida.
          Você pode recuperar o enlace por este menu.</p>
          <div class="note">No equipamento real, DJI O4 é afetado por interferência,
          obstáculos e orientação das antenas. Bandas, potência e disponibilidade
          dependem da região. Bom sinal não substitui contato visual.</div>`;
        break;
      case "RTH":
        html=`<h2>Retorno à origem</h2>
          ${field("Altura de RTH (m)","rthH",20,200)}
          <p>O exercício sobe, retorna ao Home Point e pousa.
          Essa sequência é simplificada; o Advanced RTH real pode adaptar a rota.</p>
          <div class="note ${S.rthH>effectiveH()?"warning":""}">
          ${S.rthH>effectiveH()?"Altura de RTH acima do teto vigente. Revise os valores.":
          "Confira obstáculos, terreno, vento e bateria. Se não houver margem segura, mude o plano."}
          </div>${B("Iniciar RTH","rth",'class="primary"')}`;
        break;
      case "Sensores":
        html=`<h2>Obstáculos e visão</h2>
          ${choice("Resposta","avoid",["Frear","Desviar","Desligado"])}
          ${choice("Iluminação","light",["Dia","Pouca luz"])}
          <div class="note">Assistência no exercício:
          ${sensorsAvailable()?"disponível":"indisponível"}.</div>
          <p>Frear interrompe o movimento perto de obstáculos. Desviar utiliza uma
          estratégia didática de subida, quando o teto permite. Não reproduz APAS.</p>
          <p>Em Sport, pouca luz ou assistência desligada, o simulador mantém colisões
          físicas, mas não oferece essa proteção. No mundo real, fios, galhos finos,
          vidro e superfícies difíceis também podem não ser detectados.</p>`;
        break;
      case "GPS":
        html=`<h2>GNSS e Home Point</h2>
          ${choice("Qualidade do GNSS","gps",["Bom","Fraco"])}
          <div class="note">Origem ${S.homeValid?"confirmada":"não confirmada"}.
          GNSS fraco interrompe a navegação automática deste exercício.</div>
          ${B("Confirmar origem na posição atual","home")}
          <p>A origem será marcada no solo sob a posição atual. A referência de
          altura continua sendo a decolagem, em terreno plano neste cenário.</p>
          <p>No DJI Fly real, aguarde a confirmação e confira o mapa.
          A contagem de satélites isoladamente não prova posicionamento confiável.</p>`;
        break;
      case "Bateria":
        html=`<h2>Energia para retorno e pouso</h2>
          ${field("Carga simulada (%)","battery",0,100)}
          ${B("Recarregar bateria simulada","charge")}
          <div class="note warning">Neste exercício, 25% inicia retorno ou pouso;
          8% inicia pouso. São gatilhos fictícios de treinamento, não limiares
          oficiais do DJI Fly.</div>
          <p>Na operação real, a necessidade de retorno depende de distância,
          vento, carga, temperatura e outras condições. Não espere chegar a 0%.</p>`;
        break;
      case "Mapa":
        html=`<h2>Mapa da área de treinamento</h2>
          <ul class="list">
            <li>Toque na miniatura para ampliar.</li>
            <li>Arraste para deslocar; use roda do mouse ou pinça para zoom.</li>
            <li>◎ volta a acompanhar o drone.</li>
            <li>H é o Home Point; triângulo azul é o drone; veículo laranja é o alvo.</li>
            <li>O círculo tracejado representa o limite de distância atual.</li>
          </ul>
          ${B("Abrir mapa","show-map")}
          <p>Mapa próprio, em metros locais, correspondente à cena 3D.
          Não contém coordenadas geográficas, imagens de satélite ou restrições reais.</p>`;
        break;
      case "QuickShots":
        html=`<h2>Trajetórias demonstrativas</h2>
          ${choice("QuickShot","shot",["Dronie","Rocket","Circle","Helix","Boomerang","Asteroid"])}
          <p>O veículo laranja serve de referência. A aeronave deve estar no ar.
          A trajetória é conferida contra os limites antes do início.</p>
          ${B("Iniciar trajetória","quick",'class="primary"')}
          ${B("Cancelar modo automático","cancel-auto")}
          <div class="note">As rotas são aproximações didáticas. Asteroid demonstra
          afastamento, subida e giro final; não produz um panorama composto.
          A gravação é acionada separadamente.</div>`;
        break;
      case "ActiveTrack":
        html=`<h2>Acompanhar o veículo laranja</h2>
          <p>Você pode clicar no veículo na imagem 3D ou selecioná-lo aqui.
          Ao iniciar, ele se move e o drone tenta acompanhá-lo.</p>
          <div class="note">Alvo ${S.selected?"selecionado":"não selecionado"}.</div>
          <div class="row">
            ${B("Selecionar e enquadrar veículo","select-target")}
            ${B("Iniciar acompanhamento","track",'class="primary"')}
            ${B("Parar acompanhamento","cancel-auto")}
          </div>
          <p>O acompanhamento depende dos limites e pode ser interrompido por
          obstáculos. Não é o algoritmo ActiveTrack real.</p>`;
        break;
      case "Waypoints":
        html=`<h2>Planejar rota no mapa</h2>
          ${field("Altura dos novos pontos (m)","wpHeight",5,200)}
          <div class="row">
            ${B(mapState.planning?"Continuar adicionando pontos":"Adicionar pontos no mapa","plan")}
            ${B("Parar edição do mapa","stop-plan")}
            ${B("Remover último","remove-wp",S.waypoints.length?"":"disabled")}
            ${B("Limpar rota","clear-wp",S.waypoints.length?"":"disabled")}
          </div>
          <div class="card">${S.waypoints.length?
            S.waypoints.map((p,i)=>`P${i+1}: ${p.h} m`).join(" → "):
            "Nenhum ponto. Ative a edição e clique no mapa ampliado."}</div>
          ${B("Executar rota","waypoints",'class="primary"')}
          ${B("Cancelar execução","cancel-auto")}
          <p>Máximo de 12 pontos. A aeronave termina pairando.
          No DJI Fly real, revise também velocidade, câmera, ação final e perda de sinal.</p>`;
        break;
      case "Calibração":{
        const steps=calSteps[S.cal],done=S.calStep>=steps.length;
        html=`<h2>Roteiro de calibração</h2>
          ${choice("Componente","cal",Object.keys(calSteps))}
          <div class="note">${done?
            "Roteiro concluído. Nenhuma calibração real foi realizada.":steps[S.calStep]}</div>
          <progress value="${S.calStep}" max="${steps.length}"></progress>
          <div class="row">${B("Voltar","cal-back",S.calStep?"":"disabled")}
          ${B(done?"Repetir":"Próxima etapa","cal-next",
            `class="primary" ${S.flying?"disabled":""}`)}</div>
          ${S.flying?'<p>Pouse o drone simulado antes de avançar no roteiro.</p>':""}`;
        break;
      }
      case "Guia":html=guideHtml();break;
      case "Ajuda":
        html=`<h2>Primeiro voo</h2>
          <p><a class="manual-link" href="/ajuda.html?perfil=simulator#primeiro-voo" target="_blank" rel="noopener">Abrir manual interativo completo ↗</a></p>
          <ol class="list">
            <li>Feche este menu e clique em Decolar.</li>
            <li>Use W/S para altura; A/D para giro; setas para deslocamento.</li>
            <li>Ou arraste os dois manetes, inclusive com dois dedos no celular.</li>
            <li>Use o dial para inclinar a câmera. O mapa acompanha o drone.</li>
            <li>Abra ••• para Safety e o guia de 200 m / 20 km.</li>
            <li>Use RTH para voltar e pousar. Espaço pausa o exercício.</li>
          </ol>
          <p>O voo pausa durante menus e ao sair da janela. Clique em Retomar ao voltar.
          Para cancelar uma automação, use o botão abaixo.</p>
          ${B("Cancelar modo automático","cancel-auto")}
          <div class="note">A câmera é uma renderização 3D, não um vídeo do DJI.
          Física, sensores, bateria e automações são simplificados. Use este material
          para aprender controles, não para validar segurança de uma operação real.</div>`;
        break;
      case "Fontes":
        html=`<h2>Fontes, créditos e limites</h2>
          <div class="sources">
            <a href="https://www.dji.com/mini-4-pro/downloads" target="_blank" rel="noreferrer">Manuais e firmware do Mini 4 Pro</a>
            <a href="https://www.dji.com/mini-4-pro/faq" target="_blank" rel="noreferrer">Perguntas frequentes do Mini 4 Pro</a>
            <a href="https://www.dji.com/rc-2/faq" target="_blank" rel="noreferrer">DJI RC 2</a>
            <a href="https://www.decea.mil.br/drone/" target="_blank" rel="noreferrer">DECEA — Drone UAS</a>
            <a href="https://servicos.decea.mil.br/sarpas/" target="_blank" rel="noreferrer">SARPAS</a>
            <a href="https://www.anac.gov.br/assuntos/legislacao/legislacao-1/resolucoes/2026/resolucao-806" target="_blank" rel="noreferrer">ANAC — Resolução 806/2026</a>
            <a href="https://threejs.org/" target="_blank" rel="noreferrer">Three.js — biblioteca sob licença MIT</a>
          </div>
          <p>A Resolução ANAC 806/2026 prevê 120 m acima do solo para operações
          em seu escopo. Configurar 200 m ou 20 km na simulação não autoriza
          automaticamente o voo.
          Consulte as exigências aplicáveis e o acesso ao espaço aéreo.</p>
          <p>20 km (20.000 m) é um limite configurado, não uma dispensa de contato visual.
          Relevo, região, firmware e condições podem exigir valores menores.</p>
          <p>Com GPS, a câmera voa sobre imagens de satélite em perspectiva, carregadas conforme o deslocamento simulado. A superfície é plana: não reproduz relevo nem edifícios 3D do Google Earth. Sem GPS, permanece o cenário de treino fictício. O mapa usa imagens Esri World Imagery, com créditos no mapa. A localização do dispositivo define a origem; voo, alvo e rotas continuam simulados. O GPS exige permissão e HTTPS (ou localhost). As imagens precisam de internet e não são ao vivo. Material independente,
          sem vínculo com a DJI. Referências consultadas em 14/09/2026.</p>
          <p>Este arquivo não oferece autenticação de hospedagem. Aberto localmente,
          não publica um site. A biblioteca 3D é carregada de um CDN externo.</p>`;
        break;
    }
    $("panel").innerHTML=html;
  }

  // ---------- EVENTOS DOS MENUS E BOTÕES ----------
  function setMode(mode){
    S.mode=mode;
    document.querySelectorAll("[data-mode]").forEach(b=>
      b.classList.toggle("active",b.dataset.mode===mode));
  }
  function reset(){
    if(options.mission){notify("Use o painel da missão para encerrar ou iniciar outra tentativa.");return;}
    stopRecord();resetInputs();trail.length=0;
    Object.assign(S,{
      x:0,z:0,h:0,yaw:0,gimbal:-45,zoom:1,speed:0,
      power:true,flying:false,crashed:false,paused:false,auto:null,
      battery:100,lowHandled:false,criticalHandled:false,
      link:"Bom",lossHandled:false,gps:"Bom",homeValid:true,
      homeX:0,homeZ:0,selected:false,targetPhase:0,waypoints:[]
    });
    vehicle.position.set(80,0,-120);
    mapState.cx=mapState.cz=0;mapState.follow=true;mapState.planning=false;
    $("gimbal").value=-45;$("zoom").value=1;
    notify("Simulação reiniciada. Seus ajustes de limites foram mantidos.");
  }

  document.addEventListener("click",e=>{
    const mb=e.target.closest("[data-mode]");
    if(mb){setMode(mb.dataset.mode);return}
    const b=e.target.closest("[data-act]");
    if(!b||b.disabled)return;
    const act=b.dataset.act;
    if(options.mission&&["charge","guide"].includes(act)){notify("Recurso indisponível durante uma missão.");return;}
    if(act.startsWith("panel:")){openPanel(act.slice(6));return}
    switch(act){
      case "close":closePanel();break;
      case "takeoff":takeoff();break;
      case "pause":pause();break;
      case "rth":closePanel();startRTH();break;
      case "power":
        if(S.flying){notify("Pouse antes de desligar a simulação.");break}
        S.power=!S.power;notify(S.power?"Simulação ligada.":"Simulação desligada.");break;
      case "reset":reset();break;
      case "swap":swapView();break;
      case "locate":locate();break;
      case "map-in":mapZoom(1.35);break;
      case "map-out":mapZoom(1/1.35);break;
      case "map-center":mapState.follow=true;break;
      case "show-map":closePanel();swapView(true);break;
      case "center-gimbal":S.gimbal=0;$("gimbal").value=0;break;
      case "photo":photo();break;
      case "record":record();break;
      case "guide":startGuide();break;
      case "guide-next":
        if(guideReady()){S.guide=Math.min(5,S.guide+1);renderPanel()}break;
      case "guide-back":S.guide=Math.max(0,S.guide-1);renderPanel();break;
      case "charge":
        if(S.flying){notify("Pouse antes de recarregar a bateria simulada.");break}
        S.battery=100;S.lowHandled=S.criticalHandled=false;renderPanel();break;
      case "home":
        if(S.gps!=="Bom"){notify("GNSS indisponível para confirmar origem.");break}
        S.homeX=S.x;S.homeZ=S.z;S.homeValid=true;renderPanel();break;
      case "select-target":
        S.selected=true;aimAt(vehicle.position.x,vehicle.position.z);
        renderPanel();break;
      case "track":startTrack();break;
      case "quick":startQuick();break;
      case "cancel-auto":cancelAuto("Modo automático cancelado. Use os manetes.");break;
      case "plan":
        mapState.planning=true;mapState.follow=false;
        closePanel();swapView(true);
        notify("Clique no mapa para adicionar pontos. Arraste para deslocar.");break;
      case "stop-plan":mapState.planning=false;renderPanel();break;
      case "remove-wp":S.waypoints.pop();renderPanel();break;
      case "clear-wp":S.waypoints=[];renderPanel();break;
      case "waypoints":startWaypoints();break;
      case "cal-back":S.calStep=Math.max(0,S.calStep-1);renderPanel();break;
      case "cal-next":
        if(!S.flying){
          S.calStep=S.calStep>=calSteps[S.cal].length?0:S.calStep+1;
          renderPanel();
        }break;
    }
  });

  document.addEventListener("change",e=>{
    const el=e.target;
    if(el.matches("[data-guide-check]")){
      S.checks[Number(el.dataset.guideCheck)]=el.checked;renderPanel();return;
    }
    if(!el.matches("[data-setting]"))return;
    const key=el.dataset.setting;
    if(options.mission&&["battery","gps","link","light","scenario"].includes(key)){notify("Condições controladas pela missão.");renderPanel();return;}
    if(!Object.prototype.hasOwnProperty.call(S,key))return;
    if(el.type==="number"){
      if(!el.validity.valid||el.value===""){
        el.reportValidity();el.value=S[key];return;
      }
      S[key]=Number(el.value);
    }else if(el.type==="checkbox")S[key]=el.checked;
    else S[key]=el.value;
    if(options.mission){S.maxH=Math.min(S.maxH,options.mission.maxHeight);S.maxD=Math.min(S.maxD,options.mission.maxDistance);}
    if(key==="cal")S.calStep=0;
    if(key==="mode")setMode(S.mode);
    if(key==="gps"&&S.gps==="Fraco")S.homeValid=false;
    if(key==="link"&&S.link==="Bom")S.lossHandled=false;
    if(key==="battery"){
      S.lowHandled=S.battery>25?false:S.lowHandled;
      S.criticalHandled=S.battery>8?false:S.criticalHandled;
    }
    $("gimbal").value=S.gimbal;$("zoom").value=S.zoom;
    renderPanel();
  });

  // ---------- LOOP E TELEMETRIA ----------
  const project=new THREE.Vector3();
  let previous=performance.now(),trailClock=0,hudClock=0;
  function updateHUD(){
    $("h").textContent=S.h.toFixed(1);
    $("position-x").textContent=S.x.toFixed(1);
    $("position-z").textContent=S.z.toFixed(1);
    $("heading").textContent=String(Math.round((S.yaw*180/Math.PI%360+360)%360)%360);
    $("d").textContent=distance(S.x,S.z).toFixed(1);
    $("speed").textContent=(S.paused||$("settings").open?0:S.speed).toFixed(1);
    $("batteryHud").textContent=Math.round(S.battery)+"%";
    $("gpsHud").textContent=S.gps==="Bom"?"GPS 24":"GPS fraco";
    $("linkHud").textContent=S.link==="Bom"?"O4 ✓":"O4 ✕";
    $("sensorHud").textContent=sensorsAvailable()?"Sensores ✓":"Sensores ✕";
    $("modeHud").textContent=S.mode[0]+" Mode";
    $("takeoffButton").textContent=S.flying?"↓ Pousar":"↑ Decolar";
    $("pauseButton").textContent=S.paused?"Retomar":"Pausar";
    $("cameraInfo").innerHTML=
      `${captures.recording?"● REC":captures.saving?"SALVANDO":"SIM"} · ${S.zoom.toFixed(1)}×<br>Gimbal ${Math.round(S.gimbal)}°`;
    $("gridOverlay").hidden=!S.grid||S.mapFull;
    $("status").textContent=!S.power?"Desligado":
      S.crashed?"Colisão — reinicie":
      S.paused?"Pausado":
      S.auto?.kind==="rth"?"Retorno à origem":
      S.auto?.kind==="track"?"ActiveTrack simulado":
      S.auto?.kind==="path"?S.auto.name:
      S.auto?.kind==="land"?"Pousando":
      S.auto?.kind==="takeoff"?"Decolando":
      S.flying?"Voo simulado":"Pronto para decolar";
    $("targetBox").hidden=!S.selected||S.mapFull;
    if(S.selected&&!S.mapFull){
      project.set(vehicle.position.x,2.5,vehicle.position.z).project(camera);
      const visible=project.z>-1&&project.z<1&&Math.abs(project.x)<1&&Math.abs(project.y)<1;
      $("targetBox").hidden=!visible;
      if(visible){
        $("targetBox").style.left=(project.x*.5+.5)*100+"%";
        $("targetBox").style.top=(-project.y*.5+.5)*100+"%";
      }
    }
  }
  function snapshot(){return {paused:S.paused||$("settings").open,power:S.power,x:S.x,z:S.z,h:S.h,yaw:S.yaw,gimbal:S.gimbal,zoom:S.zoom,speed:S.speed,battery:S.battery,flying:S.flying,crashed:S.crashed,power:S.power,exposure:S.exposure,ev:S.ev,grid:S.grid,mode:S.mode,gps:S.gps,link:S.link,lossAction:S.lossAction,homeValid:S.homeValid,rthH:S.rthH,maxH:S.maxH,maxD:S.maxD,avoid:S.avoid,light:S.light,calibrated:S.calStep>=calSteps[S.cal].length,auto:S.auto?.name||S.auto?.kind||'',recording:captures.recording,capturePending:captures.saving};}
  function frame(now){
    requestAnimationFrame(frame);
    const dt=Math.min(.05,(now-previous)/1000);previous=now;
    const active=S.power&&!S.crashed&&!S.paused&&!$("settings").open&&!document.hidden;
    if(active){
      physics(dt);
      trailClock+=dt;
      if(S.flying&&trailClock>.35){
        trailClock=0;trail.push({x:S.x,z:S.z});
        if(trail.length>2500)trail.shift();
      }
    }
    if(!S.flying)S.speed=0;
    updateFlightTerrain(now);
    updateCamera();
    renderer.render(scene,camera);
    drawMap();
    if(options.mission){mc.font="bold 12px system-ui";mc.textAlign="center";for(const [i,g] of options.mission.goals.entries()){if(g.x===undefined)continue;const q=toMap(g.x,g.z);mc.fillStyle="#ffba60";mc.beginPath();mc.arc(q.x,q.y,5,0,Math.PI*2);mc.fill();mc.fillText(String(i+1),q.x,q.y-9);}}
    hudClock+=dt;
    if(hudClock>.1){hudClock=0;updateHUD()}
    options.onTick?.(active?dt:0,snapshot());
  }
  $("boot").hidden=true;
  notify("Pronto. Clique em Decolar e use os manetes ou o teclado.");
  swapView(false);
  if(options.mission){mapCaption();$("flightCredit").hidden=true;$("mapCredit").hidden=true;}else locate();
  requestAnimationFrame(frame);
  return {snapshot,start(){missionReady=true;S.paused=false;},pause(){S.paused=true;resetInputs();},highlight(index){missionScenery?.highlight(index);},inject(values){Object.assign(S,values);},takePhoto:photo,toggleRecording:record,stopRecording:stopRecord,flushCaptures:()=>captures.flush()};
}

