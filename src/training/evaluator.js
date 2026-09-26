export function targetVisible(goal,s){
  const dx=goal.x-s.x,dz=goal.z-s.z,dy=goal.h-s.h,range=Math.hypot(dx,dz,dy);
  if(range<5||range>(goal.radius||65))return false;
  const yaw=Math.atan2(dx,-dz),pitch=Math.atan2(dy,Math.hypot(dx,dz));
  const angle=Math.abs(Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw)));
  return angle<0.3/Math.max(1,s.zoom||1)&&Math.abs(pitch-(s.gimbal*Math.PI/180))<0.3/Math.max(1,s.zoom||1);
}
export function matchesGoal(goal,event){
  const s=event.s;
  if(!s||s.crashed)return false;
  switch(goal.kind){
    case 'point':return s.flying&&Math.hypot(s.x-goal.x,s.z-goal.z)<goal.radius&&Math.abs(s.h-goal.h)<goal.tolerance&&s.speed<4;
    case 'land':return !s.flying&&s.h<0.5&&Math.hypot(s.x,s.z)<goal.radius;
    case 'mode':return s.flying&&s.mode===goal.value;
    case 'auto':return s.flying&&s.auto===goal.value;
    case 'photo':return event.type==='photo'&&s.flying&&targetVisible(goal,s);
    case 'video':return s.flying&&s.recording&&s.mode===goal.value;
    case 'calibration':return !s.flying&&s.calibrated;
    case 'manual':return s.flying&&!s.auto&&s.speed>0.3;
    case 'link':return s.flying&&s.link==='Perdido'&&s.lossAction==='Pairar'&&s.speed<1;
    case 'gps':return s.flying&&s.gps==='Fraco'&&s.h>5&&s.h<40;
    case 'setting':return s.power&&(goal.minimum!==undefined?Number(s[goal.key])>=goal.minimum:s[goal.key]===goal.value);
    default:return false;
  }
}
export function createEvaluator(mission){
  let index=0,hold=0,lastT=0,airborne=false,critical=false,flightTime=0;
  const completed=[];
  return {feed(event){
    const dt=event.type==='frame'?Math.max(0,Math.min(1,event.t-lastT)):0;
    if(event.type==='frame')lastT=event.t;
    const s=event.s;airborne||=s.flying;if(s.flying)flightTime+=dt;
    critical||=s.crashed||mission.zones.some(z=>s.flying&&Math.hypot(s.x-z.x,s.z-z.z)<z.radius);
    const goal=mission.goals[index];if(!goal)return;
    const matches=matchesGoal(goal,event)&&(goal.kind!=='land'||airborne);
    if(matches){hold+=dt;if(goal.seconds===0||hold>=goal.seconds){completed.push({index,t:event.t});index++;hold=0;}}
    else if(event.type==='frame'&&goal.kind!=='photo')hold=0;
  },get progress(){return {index,hold,completed:[...completed],critical,flightTime};}};
}
