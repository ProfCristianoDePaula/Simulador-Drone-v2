import {clamp} from '../core/math.js';
export function createFlightDynamics({S,geo,obstacles,axes,keys,distance,effectiveH,effectiveD,sensorsAvailable,warn,resetInputs,notify,startRTH,autopilot}){
  function obstacleAt(x,z,h,margin){
    if(geo.origin)return undefined; // No invented collisions on real imagery.
    return obstacles.find(b=>
      Math.abs(x-b.x)<b.w/2+margin &&
      Math.abs(z-b.z)<b.d/2+margin && h<b.h+margin
    );
  }
  function move(v,dt){
    let nx=S.x+v.x*dt,nz=S.z+v.z*dt,nh=S.h+v.y*dt;
    if(v.y>0&&nh>effectiveH()){
      nh=Math.max(S.h,effectiveH());
      warn("Limite de altura do exercício atingido.");
      if(S.auto&&S.auto.kind!=="rth")S.auto=null;
    }
    const oldD=distance(S.x,S.z),newD=distance(nx,nz);
    if(newD>effectiveD()&&newD>oldD){
      if(oldD<=effectiveD()){
        const factor=effectiveD()/newD;
        nx=S.homeX+(nx-S.homeX)*factor;
        nz=S.homeZ+(nz-S.homeZ)*factor;
      }else{nx=S.x;nz=S.z}
      warn("Limite de distância: aproxime a aeronave da origem.");
      if(S.auto&&S.auto.kind!=="rth")S.auto=null;
    }

    if(Math.hypot(v.x,v.z)>.01 && sensorsAvailable()){
      const obstacle=obstacleAt(nx,nz,nh,5);
      if(obstacle){
        nx=S.x;nz=S.z;
        if(S.avoid==="Desviar"&&obstacle.h+6<=effectiveH()){
          nh=Math.min(obstacle.h+6,S.h+2.5*dt);
          if(S.auto)S.auto.clearance=Math.max(S.auto.clearance||0,obstacle.h+6);
          warn("Desvio didático: freando e subindo acima do obstáculo.");
        }else{
          nh=S.h;
          if(S.auto)S.auto=null;
          warn("Obstáculo detectado: movimento interrompido.");
        }
      }
    }
    if(nh>0 && obstacleAt(nx,nz,nh,.6)){
      S.crashed=true;S.flying=false;S.auto=null;resetInputs();
      notify("Colisão simulada. Use Reiniciar para tentar novamente.");
      return;
    }
    S.speed=Math.hypot(nx-S.x,nz-S.z)/dt;
    S.x=nx;S.z=nz;S.h=Math.max(0,nh);
    if(S.h<=0 && v.y<0){
      S.flying=false;S.auto=null;S.speed=0;
      notify("Pouso concluído.");
    }
  }

  function physics(dt){
    if(!S.flying)return;
    if(S.link==="Perdido"&&!S.lossHandled){
      S.lossHandled=true;
      if(S.lossAction==="RTH")startRTH();
      else if(S.lossAction==="Pousar")S.auto={kind:"land"};
      else S.auto=null;
      notify("Perda de enlace simulada. Ação selecionada: "+S.lossAction+".");
    }
    if(S.link==="Bom")S.lossHandled=false;
    if((S.gps!=="Bom"||!S.homeValid)&&
       S.auto&&["rth","track","path"].includes(S.auto.kind)){
      S.auto=null;notify("Navegação automática interrompida: confira GNSS e origem.");
    }

    if(S.battery<=8&&!S.criticalHandled){
      S.criticalHandled=true;S.auto={kind:"land"};
      notify("Cenário crítico de bateria: pouso automático didático.");
    }else if(S.battery<=25&&!S.lowHandled){
      S.lowHandled=true;
      if(S.gps==="Bom"&&S.homeValid)startRTH();
      else S.auto={kind:"land"};
      notify("Reserva baixa no exercício. Retorno ou pouso iniciado.");
    }

    let v;
    if(S.auto)v=autopilot(dt);
    else if(S.link==="Perdido")v={x:0,y:0,z:0};
    else{
      const lx=clamp(axes.left.x+(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0),-1,1);
      const ly=clamp(axes.left.y+(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0),-1,1);
      let rx=clamp(axes.right.x+(keys.has("ArrowRight")?1:0)-(keys.has("ArrowLeft")?1:0),-1,1);
      let ry=clamp(axes.right.y+(keys.has("ArrowUp")?1:0)-(keys.has("ArrowDown")?1:0),-1,1);
      const len=Math.hypot(rx,ry);if(len>1){rx/=len;ry/=len}
      const speed=S.mode==="Cine"?3:S.mode==="Sport"?14:7;
      S.yaw+=lx*dt*(S.mode==="Cine"?.65:1.1);
      v={
        x:(Math.sin(S.yaw)*ry+Math.cos(S.yaw)*rx)*speed,
        z:(-Math.cos(S.yaw)*ry+Math.sin(S.yaw)*rx)*speed,
        y:ly*(S.mode==="Cine"?1.5:3)
      };
    }
    if(S.windX||S.windZ){v.x+=(S.windX||0);v.z+=(S.windZ||0);}
    move(v,dt);
    S.battery=Math.max(0,S.battery-dt*(.016+S.speed*.001));
  }

  return {physics};
}
