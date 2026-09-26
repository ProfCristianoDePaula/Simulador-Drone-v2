import {goalCriteria} from './criteria.js';
import {navigationGuidance} from './navigation.js';
import '../ui/viewport.js';
import {bootSimulator} from '../simulator/engine.js';
import {missionById,preChecklist,postChecklist} from './catalog.js';
import {createEvaluator} from './evaluator.js';
import {getClient,authMessage} from '../services/supabase.js';
import {saveDraft,getDraft,deleteDraft} from './drafts.js';
const root=document.getElementById('training-content');
const params=new URLSearchParams(location.search),assignmentId=params.get('atividade');
let mission,client,user,bridge,evaluator,attempt,draftKey,phase='prep',clock=0,sampleClock=0,saveClock=0,lastGoal=-1,crashLogged=false;
let payload={events:[],pre:[],post:[],quiz:-1,report:'',initial:null};let media=[];let busy=false;
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
function status(text){let box=document.getElementById('training-status');if(!box){box=el('p','');box.id='training-status';box.setAttribute('role','status');root.append(box);}box.textContent=text;}
function button(label,handler){const b=el('button',label);b.addEventListener('click',async()=>{if(busy)return;busy=true;b.disabled=true;try{await handler();}catch(error){status(authMessage(error));}finally{busy=false;b.disabled=false;}});return b;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
function heading(){root.replaceChildren(el('span',assignmentId?'ATIVIDADE AVALIADA':'TREINO — SEM NOTA OFICIAL','badge'),el('h1',mission.title));}
function checks(items,values){const box=el('div','');items.forEach((text,i)=>{const label=el('label','');const input=el('input','');input.type='checkbox';input.checked=!!values[i];input.addEventListener('change',()=>values[i]=input.checked);label.append(input,document.createTextNode(text));box.append(label);});return box;}
function persist(){if(!draftKey)return Promise.resolve();return saveDraft(draftKey,{attempt,payload,media,missionId:mission.id,phase,clock});}
function feed(event){payload.events.push(event);evaluator.feed(event);}
function flightView(){
 heading();root.append(el('p','Conclua os objetivos na ordem. Os marcadores numerados aparecem no cenário. Menu •••: ajustes; WP: rota; QS: tomadas automáticas.'));
 const list=el('ol','');list.id='goals';mission.goals.forEach(g=>{const item=el('li',''),details=el('details','');details.append(el('summary',g.label),el('p',goalCriteria(g)));item.append(details);list.append(item);});root.append(list);
 const progress=el('progress','');progress.id='mission-progress';progress.max=mission.goals.length;root.append(progress);
 const guidance=el('p','');guidance.id='navigation-guidance';root.append(el('h2','Guia do objetivo atual'),guidance);
 const help=el('details',''),summary=el('summary','Como ler posição e comandos');help.append(summary,el('p','Coordenadas locais do simulador, em metros: a base é X 0 / Z 0. X positivo = leste; X negativo = oeste. Z negativo = norte; Z positivo = sul. H = altura. Rumo 0° = norte, 90° = leste. As setas movem o drone em relação à direção para onde ele aponta; A/D giram. W/S sobem/descem. Os números no mapa indicam os objetivos. Siga os marcadores e mantenha distância dos obstáculos; o guia indica direção, não uma rota livre de obstáculos.'));root.append(help);
 const metric=el('p','');metric.id='mission-metrics';root.append(metric);
 root.append(button('Encerrar voo e preencher pós-voo',finishFlight));
 root.append(button('Abandonar tentativa',async()=>{bridge.pause();if(attempt)await rpc('academy_abandon_attempt',{tid:attempt.id});await deleteDraft(draftKey||'practice');phase='abandoned';location.assign('/painel.html');}));
 if(!window.MediaRecorder)status('Este navegador não oferece vídeo. Use um navegador compatível nas missões de filmagem.');
}
function tick(dt,s){
 if(phase!=='flight')return;clock+=dt;sampleClock+=dt;saveClock+=dt;
 if(sampleClock>=.5||s.crashed&&!crashLogged){sampleClock=0;crashLogged||=s.crashed;feed({type:'frame',t:clock,s});}
 const p=evaluator.progress;
 const stepStatus=document.getElementById('mission-step-status');
 if(stepStatus){const g=mission.goals[p.index];stepStatus.textContent=s.paused?'Avaliação pausada — retome o voo':!s.power?'Avaliação parada — ligue o controle':g?`Etapa ${p.index+1}/${mission.goals.length} · ${g.label} · ${p.hold.toFixed(1)}/${g.seconds} s`:'Todos os objetivos concluídos';}
 if(p.index!==lastGoal){lastGoal=p.index;bridge?.highlight(p.index);const list=document.getElementById('goals');if(list)[...list.children].forEach((n,i)=>n.className=i<p.index?'done':i===p.index?'current':'');
  if(mission.id==='fachada'&&p.index===3)bridge?.inject({light:'Pouca luz'});
  if(mission.id==='contingencia'){
   if(p.index===1)bridge?.inject({link:'Perdido',lossHandled:false});
   if(p.index===2)bridge?.inject({link:'Bom',gps:'Fraco',homeValid:false,windX:.6,windZ:.2});
   if(p.index===3)bridge?.inject({link:'Bom',gps:'Bom',homeValid:true,windX:0,windZ:0,battery:24,lowHandled:false});
  }
 }
 const guidance=document.getElementById('navigation-guidance');if(guidance)guidance.textContent=navigationGuidance(mission.goals[p.index],s,p);
 const meter=document.getElementById('mission-progress');if(meter)meter.value=p.index;
 const metrics=document.getElementById('mission-metrics');if(metrics)metrics.textContent=`${p.index}/${mission.goals.length} objetivos · ${Math.floor(clock)} s · H ${s.h.toFixed(1)} m · X ${s.x.toFixed(0)} / Z ${s.z.toFixed(0)}${p.critical?' · Falha crítica registrada':''}`;
 if(saveClock>=3){saveClock=0;persist().catch(()=>status('Falha no armazenamento local. Mantenha esta página aberta até concluir a entrega.'));}
 if(clock>=mission.maxDuration){bridge.pause();phase='expired';heading();root.append(el('p','Tempo máximo alcançado. Encerre esta tentativa e peça outra ao professor.'),button('Encerrar tentativa expirada',async()=>{if(attempt)await rpc('academy_abandon_attempt',{tid:attempt.id});if(draftKey)await deleteDraft(draftKey);phase='abandoned';location.assign('/painel.html');}));}
}
async function capture(blob,kind,s){
 if(phase!=='flight')throw new Error('Inicie a missão antes de capturar evidências.');
 if(blob.size>10485760)throw new Error('Clipe maior que 10 MB. Grave tomadas mais curtas.');
 if(media.length>=30)throw new Error('Limite de 30 evidências por tentativa.');
 const id=crypto.randomUUID();media.push({id,blob,kind});feed({type:kind,t:clock,s,local_id:id});await persist();
 status(`${kind==='photo'?'Foto registrada':'Vídeo registrado'} localmente. ${assignmentId?'Será enviado ao entregar.':'Treino sem envio ao banco.'}`);
}
function prep(){
 heading();root.append(el('p',mission.brief));const briefing=el('details','');briefing.append(el('summary','Plano de voo e critérios de todas as etapas'));const steps=el('ol','');mission.goals.forEach(g=>steps.append(el('li',g.label+' — '+goalCriteria(g))));briefing.append(steps);root.append(briefing,el('h2','Checklist pré-voo')); 
 payload.pre=Array(6).fill(false);root.append(checks(preChecklist,payload.pre));
 const label=el('label',mission.quiz.question),select=el('select','');const placeholder=el('option','Selecione…');placeholder.value='';select.append(placeholder);
 mission.quiz.choices.forEach((text,i)=>{const option=el('option',text);option.value=String(i);select.append(option);});select.addEventListener('change',()=>payload.quiz=Number(select.value));label.append(select);root.append(label);
 root.append(button('Iniciar missão',async()=>{
  if(!payload.pre.every(Boolean)||select.value==='')throw new Error('Conclua o checklist e responda à pergunta.');
  const s=bridge.snapshot();if(s.battery<50||s.gps!=='Bom'||!s.homeValid||s.rthH>s.maxH)throw new Error('Revise bateria, GNSS, origem e altura de RTH.');
  if(mission.id==='contingencia'&&s.lossAction!=='Pairar')throw new Error('No menu Transmission, configure perda de enlace para Pairar.');
  if(assignmentId){attempt=await rpc('academy_start_attempt',{aid:assignmentId});draftKey=`${user.id}:${attempt.id}`;}
  payload.initial=s;phase='flight';clock=0;evaluator=createEvaluator(mission);feed({type:'frame',t:0,s});flightView();bridge.start();await persist();
 }));
}
async function finishFlight(){
 const s=bridge.snapshot();if(s.flying)throw new Error('Pouse antes de encerrar a missão.');if(s.recording)throw new Error('Pare a gravação antes de encerrar.');
 bridge.pause();feed({type:'frame',t:clock,s});phase='post';showPost();await persist();
}
function showPost(message=''){
 heading();root.append(el('h2','Checklist pós-voo'));if(!payload.post.length)payload.post=Array(6).fill(false);root.append(checks(postChecklist,payload.post));
 const label=el('label','Relatório: descreva o voo, as ocorrências e o que pode melhorar (5–4.000 caracteres).'),report=el('textarea','');report.maxLength=4000;report.value=payload.report;report.addEventListener('input',()=>payload.report=report.value);label.append(report);root.append(label);
 root.append(button(assignmentId?'Enviar evidências e finalizar':'Concluir treino',submit));
 root.append(button('Voltar ao voo',()=>{if(phase==='recovered')throw new Error('Tentativa interrompida não pode retomar a física. Entregue o registro ou abandone pelo painel.');phase='flight';flightView();bridge.start();}));
 if(message)status(message);
}
async function submit(){
 if(!payload.post.every(Boolean)||payload.report.trim().length<5)throw new Error('Conclua o pós-voo e escreva pelo menos 5 caracteres.');
 if(!assignmentId){phase='done';heading();const p=evaluator.progress;root.append(el('h2','Treino concluído'),el('p',`${p.index}/${mission.goals.length} objetivos${p.critical?' · Falha crítica: refaça o exercício.':''}. Treino sem nota oficial.`),button('Treinar novamente',()=>location.reload()));return;}
 status('Enviando evidências. Não feche esta página…');await persist();
 for(const item of media){
  let event=payload.events.find(e=>e.local_id===item.id);if(event.evidence_id)continue;
  const contentType=item.kind==='photo'?'image/png':item.blob.type.split(';')[0]||'video/webm';
  const extension=contentType==='image/png'?'png':contentType==='video/mp4'?'mp4':'webm';
  const path=`${user.id}/${attempt.id}/${item.id}.${extension}`;
  const {error}=await client.storage.from('academy-evidence').upload(path,item.blob,{contentType,upsert:false});
  if(error&&!/already exists|duplicate/i.test(error.message))throw error;
  event.evidence_id=await rpc('academy_register_evidence',{tid:attempt.id,file_path:path,file_kind:item.kind});await persist();
 }
 const result=await rpc('academy_submit_attempt',{tid:attempt.id,submission:payload});phase='done';await deleteDraft(draftKey);heading();root.append(el('h2',`${result.score}/100 pontos`),el('p',result.passed?'Aprovado':'Refazer — consulte os critérios no painel'));
 for(const [key,label] of Object.entries({preFlight:'Pré-voo',piloting:'Pilotagem',objectives:'Objetivos',postFlight:'Pós-voo'}))root.append(el('p',`${label}: ${result.breakdown[key]} pontos`));
 root.append(el('p','Entrega confirmada pelo Supabase.'));const link=el('a','Ver meu histórico');link.href='/painel.html';root.append(link);
}
async function init(){
 try{
  mission=missionById(params.get('missao')||'primeiro-voo');
  if(assignmentId){client=await getClient();const auth=await client.auth.getUser();if(!auth.data.user){location.replace('/');return;}user=auth.data.user;
   const {data,error}=await client.from('academy_assignments').select('mission_id,mission_version').eq('id',assignmentId).single();if(error)throw error;
   const version=await client.from('academy_missions').select('config').eq('id',data.mission_id).eq('version',data.mission_version).single();if(version.error)throw version.error;mission=version.data.config;
   const resume=params.get('tentativa');if(resume){const saved=await getDraft(`${user.id}:${resume}`);if(!saved)throw new Error('Registro local não encontrado neste dispositivo. Encerre a tentativa pelo painel e peça outra ao professor.');attempt=saved.attempt;if(attempt.assignment_id!==assignmentId)throw new Error('Atividade diferente.');payload=saved.payload;media=saved.media;clock=saved.clock;draftKey=`${user.id}:${resume}`;phase='recovered';}
  }
  if(!mission)throw new Error('Missão não encontrada.');
  evaluator=createEvaluator(mission);payload.events.forEach(e=>evaluator.feed(e));
  bridge=await bootSimulator({mission,onTick:tick,onCapture:capture});
  if(phase==='recovered')showPost('Registro recuperado. Você pode reenviar uma entrega que falhou. Voos interrompidos no ar devem ser abandonados no painel.');else prep();
 }catch(error){root.replaceChildren(el('h1','Não foi possível iniciar'));status(authMessage(error));}
}
window.addEventListener('beforeunload',event=>{if(['flight','post'].includes(phase)){event.preventDefault();event.returnValue='';}});
init();
