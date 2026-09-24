export function createFlightState(){
  return {
    power:true,flying:false,crashed:false,paused:false,
    x:0,z:0,h:0,yaw:0,gimbal:-45,zoom:1,speed:0,
    maxH:200,maxD:20000,rthH:60,mode:"Normal",avoid:"Frear",
    light:"Dia",gps:"Bom",homeValid:true,homeX:0,homeZ:0,
    link:"Bom",lossAction:"RTH",lossHandled:false,
    battery:100,lowHandled:false,criticalHandled:false,
    grid:true,exposure:"Auto",ev:0,
    scenario:"Normal",auto:null,selected:false,targetPhase:0,
    shot:"Dronie",waypoints:[],wpHeight:40,
    guide:-1,checks:[false,false,false],safetyVisited:false,
    cal:"Bússola",calStep:0,panel:"Safety",
    mapFull:false
  };
}
