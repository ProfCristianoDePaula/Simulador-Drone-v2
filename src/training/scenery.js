export function createMissionScenery(THREE,scene,group,obstacles,mission){
  group.clear();obstacles.length=0;
  const makeBox=(x,z,w,d,h,color)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));mesh.position.set(x,h/2,z);group.add(mesh);obstacles.push({x,z,w,d,h});return mesh;};
  if(mission.scene==='roof'){makeBox(0,-77,38,34,13,'#8ab4c8');makeBox(-12,-77,3,3,18,'#607786');for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(6,.2,8),new THREE.MeshLambertMaterial({color:'#174b70'}));p.position.set(-8+i*6,13.2,-78);group.add(p);}}
  if(mission.scene==='tower'){makeBox(0,-60,6,6,45,'#899aa8');for(let h=8;h<45;h+=10){const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.3,6,24),new THREE.MeshLambertMaterial({color:'#d58b60'}));ring.position.set(0,h,-60);ring.rotation.x=Math.PI/2;group.add(ring);}}
  if(mission.scene==='facade')makeBox(0,-78,46,14,28,'#d2bea1');
  if(mission.scene==='construction'){makeBox(0,-80,15,14,15,'#b7a58a');makeBox(25,-78,18,14,21,'#b6bcb9');makeBox(-25,-65,20,10,1,'#ccad78');}
  if(mission.scene==='event'){makeBox(-55,-90,25,8,5,'#a55d87');for(let i=0;i<25;i++){const person=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.7,6),new THREE.MeshLambertMaterial({color:i%2?'#dd8f57':'#80acc6'}));person.position.set(-68+(i%5)*6,.85,-76+Math.floor(i/5)*5);group.add(person);}}
  if(['rural','survey','emergency'].includes(mission.scene))for(let i=0;i<16;i++){const x=(i%2?1:-1)*(70+(i%4)*12),z=-20-Math.floor(i/2)*18;makeBox(x,z,3,3,5+i%3,'#4b7450');}
  const markers=mission.goals.map((goal,i)=>{
    if(!['point','photo'].includes(goal.kind))return null;
    const mesh=new THREE.Mesh(goal.kind==='photo'?new THREE.SphereGeometry(1.5,12,8):new THREE.TorusGeometry(goal.radius,.25,8,28),new THREE.MeshBasicMaterial({color:'#ffb658',transparent:true,opacity:.9}));mesh.position.set(goal.x,goal.h,goal.z);group.add(mesh);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#102f36';ctx.fillRect(0,0,128,64);ctx.fillStyle='#ffffff';ctx.font='bold 32px sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1),64,44);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas)}));label.position.set(goal.x,goal.h+5,goal.z);label.scale.set(8,4,1);group.add(label);return mesh;
  });
  for(const z of mission.zones){const circle=new THREE.Mesh(new THREE.CircleGeometry(z.radius,40),new THREE.MeshBasicMaterial({color:'#e34c5f',transparent:true,opacity:.45,side:THREE.DoubleSide}));circle.rotation.x=-Math.PI/2;circle.position.set(z.x,.15,z.z);group.add(circle);}
  return {highlight(index){markers.forEach((mesh,i)=>{if(mesh){mesh.material.color.set(i<index?'#4cdc9b':i===index?'#ffffff':'#ffb658');mesh.material.opacity=i<index?.3:1;}});}};
}
