import {goalCriteria} from './criteria.js';
import {navigationGuidance} from './navigation.js';
import {createMissionPanel} from './panel.js';
import '../ui/viewport.js';
import {bootSimulator} from '../simulator/engine.js';
import {missionById,preChecklist,postChecklist} from './catalog.js';
import {createEvaluator} from './evaluator.js';
import {getClient,authMessage} from '../services/supabase.js';
import {saveDraft,getDraft,deleteDraft} from './drafts.js';
const root=document.getElementById('training-content');
const missionPanel=createMissionPanel({panel:document.getElementById('training-panel'),toggle:document.getElementById('mission-panel-toggle'),close:document.getElementById('mission-panel-close'),stepLabel:document.getElementById('mission-panel-step')});
const params=new URLSearchParams(location.search),assignmentId=params.get('atividade');
let mission,client,user,bridge,evaluator,attempt,draftKey,phase='prep',clock=0,sampleClock=0,saveClock=0,lastGoal=-1,crashLogged=false;
let payload={events:[],pre:[],post:[],quiz:-1,report:'',initial:null};let media=[];let busy=false;
const mediaUrls=new Map();
function renderCaptures(){
 let gallery=document.getElementById('mission-captures');
 if(!gallery){gallery=el('section','','mission-captures');gallery.id='mission-captures';root.append(gallery);}
 gallery.replaceChildren(el('h2',`Capturas da missão (${media.length}/30)`));
 gallery.append(el('p',assignmentId?'Confira suas fotos e vídeos. Eles serão enviados ao finalizar a entrega.':'Treino sem envio ao banco. Baixe as capturas que quiser guardar antes de sair.'));
 if(!media.length){gallery.append(el('p','Nenhuma captura ainda. Inicie a missão e use Foto ou o botão de gravação.'));return;}
 for(const [index,item] of media.entries()){
  if(!mediaUrls.has(item.id))mediaUrls.set(item.id,URL.createObjectURL(item.blob));const url=mediaUrls.get(item.id);
  const card=el('div','','capture-card'),label=`${item.kind==='photo'?'Foto':'Vídeo'} ${index+1}`,preview=el(item.kind==='photo'?'img':'video','');
  if(item.kind==='photo'){preview.alt=label;preview.loading='lazy';}else{preview.controls=true;preview.preload='metadata';preview.playsInline=true;preview.setAttribute('aria-label',label);}
  preview.src=url;const download=el('a',`Baixar ${label.toLowerCase()}`);download.href=url;download.download=`mini4-${mission.id}-${index+1}.${item.kind==='photo'?'png':item.blob.type.includes('mp4')?'mp4':'webm'}`;
  card.append(el('strong',`${label} · ${(item.blob.size/1048576).toFixed(2)} MB`),preview,download);gallery.append(card);
 }
}
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
function status(text){let box=document.getElementById('training-status');if(!box){box=el('p','');box.id='training-status';box.setAttribute('role','status');root.append(box);}box.textContent=text;}
function button(label,handler){const b=el('button',label);b.addEventListener('click',async()=>{if(busy)return;busy=true;b.disabled=true;try{await handler();}catch(error){status(authMessage(error));}finally{busy=false;b.disabled=false;}});return b;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
function heading(){root.replaceChildren(el('span',assignmentId?'ATIVIDADE AVALIADA':'TREINO — SEM NOTA OFICIAL','badge'),el('h1',mission.title));missionPanel.setPhase(phase);}
function checks(items,values){const box=el('div','');items.forEach((text,i)=>{const label=el('label','');const input=el('input','');input.type='checkbox';input.checked=!!values[i];input.addEventListener('change',()=>values[i]=input.checked);label.append(input,document.createTextNode(text));box.append(label);});return box;}
function persist(){if(!draftKey)return Promise.resolve();return saveDraft(draftKey,{attempt,payload,media,missionId:mission.id,phase,clock});}
function feed(event){payload.events.push(event);evaluator.feed(event);}
function recordingState(active,saving){
 const control=document.getElementById('mission-record-video');
 if(control){control.disabled=saving;control.textContent=saving?'Finalizando arquivo de vídeo…':active?'Parar e salvar vídeo':'Gravar vídeo';control.setAttribute('aria-pressed',String(active));}
 if(active)status('Gravando vídeo. Clique em “Parar e salvar vídeo” para gerar o arquivo.');
 else if(saving)status('Finalizando o vídeo. Aguarde o arquivo e a prévia em Capturas da missão.');
}
function flightView(){
 heading();root.append(el('p','Conclua os objetivos na ordem. Os marcadores numerados aparecem no cenário. Menu •••: ajustes; WP: rota; QS: tomadas automáticas.'));
 const list=el('ol','');list.id='goals';mission.goals.forEach(g=>{const item=el('li',''),details=el('details','');details.append(el('summary',g.label),el('p',goalCriteria(g)));item.append(details);list.append(item);});root.append(list);
 const progress=el('progress','');progress.id='mission-progress';progress.max=mission.goals.length;root.append(progress);
 const guidance=el('p','');guidance.id='navigation-guidance';root.append(el('h2','Guia do objetivo atual'),guidance);
 const help=el('details',''),summary=el('summary','Como ler posição e comandos');help.append(summary,el('p','Coordenadas locais do simulador, em metros: a base é X 0 / Z 0. X positivo = leste; X negativo = oeste. Z negativo = norte; Z positivo = sul. H = altura. Rumo 0° = norte, 90° = leste. As setas movem o drone em relação à direção para onde ele aponta; A/D giram. W/S sobem/descem. Os números no mapa indicam os objetivos. Siga os marcadores e mantenha distância dos obstáculos; o guia indica direção, não uma rota livre de obstáculos.'));root.append(help);
 const metric=el('p','');metric.id='mission-metrics';root.append(metric);
 root.append(button('Tirar e baixar foto',async()=>{await bridge.takePhoto();}));
 const recordVideo=el('button','Gravar vídeo');recordVideo.id='mission-record-video';recordVideo.type='button';recordVideo.setAttribute('aria-pressed','false');recordVideo.addEventListener('click',()=>bridge.toggleRecording());root.append(recordVideo);
 root.append(button('Encerrar voo e preencher pós-voo',finishFlight));
 root.append(button('Abandonar tentativa',async()=>{bridge.pause();if(attempt)await rpc('academy_abandon_attempt',{tid:attempt.id});await deleteDraft(draftKey||'practice');phase='abandoned';location.assign('/painel.html');}));
 renderCaptures();
 if(!window.MediaRecorder)status('Este navegador não oferece vídeo. Use um navegador compatível nas missões de filmagem.');
}
function tick(dt,s){
 if(phase!=='flight')return;clock+=dt;sampleClock+=dt;saveClock+=dt;
 if(sampleClock>=.5||s.crashed&&!crashLogged){sampleClock=0;crashLogged||=s.crashed;feed({type:'frame',t:clock,s});}
 const p=evaluator.progress;
 missionPanel.setStep(p.index,mission.goals.length,mission.goals[p.index]?.label);
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
 if(!blob?.size)throw new Error('A captura está vazia. Faça uma nova captura.');
 if(blob.size>10485760)throw new Error('Clipe maior que 10 MB. Grave tomadas mais curtas.');
 if(media.length>=30)throw new Error('Limite de 30 evidências por tentativa.');
 const id=crypto.randomUUID();media.push({id,blob,kind});feed({type:kind,t:clock,s,local_id:id});renderCaptures();
 try{await persist();}catch{status('Captura disponível nesta página, mas o armazenamento local falhou. Baixe uma cópia e mantenha a página aberta para entregar.');return;}
 status(`${kind==='photo'?'Foto registrada':'Vídeo registrado'}. Confira a prévia em Capturas da missão. ${assignmentId?'Será enviado ao entregar.':'Use Baixar para guardar uma cópia.'}`);
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
 if(bridge.snapshot().flying)throw new Error('Pouse antes de encerrar a missão.');
 bridge.pause();status('Finalizando as capturas antes do pós-voo…');await bridge.flushCaptures();
 const s=bridge.snapshot();feed({type:'frame',t:clock,s});phase='post';showPost();await persist();
}
function showPost(message=''){
 heading();root.append(el('h2','Checklist pós-voo'));if(!payload.post.length)payload.post=Array(6).fill(false);root.append(checks(postChecklist,payload.post));
 const label=el('label','Relatório: descreva o voo, as ocorrências e o que pode melhorar (5–4.000 caracteres).'),report=el('textarea','');report.maxLength=4000;report.value=payload.report;report.addEventListener('input',()=>payload.report=report.value);label.append(report);root.append(label);
 root.append(button(assignmentId?'Enviar evidências e finalizar':'Concluir treino',submit));
 root.append(button('Voltar ao voo',()=>{if(phase==='recovered')throw new Error('Tentativa interrompida não pode retomar a física. Entregue o registro ou abandone pelo painel.');phase='flight';flightView();bridge.start();}));
 renderCaptures();
 if(message)status(message);
}
async function submit(){
 if(!payload.post.every(Boolean)||payload.report.trim().length<5)throw new Error('Conclua o pós-voo e escreva pelo menos 5 caracteres.');
 if(!assignmentId){phase='done';heading();const p=evaluator.progress;root.append(el('h2','Treino concluído'),el('p',`${p.index}/${mission.goals.length} objetivos${p.critical?' · Falha crítica: refaça o exercício.':''}. Treino sem nota oficial.`),button('Treinar novamente',()=>location.reload()));renderCaptures();return;}
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
 renderCaptures();document.querySelector('#mission-captures p').textContent='Capturas enviadas com a entrega. Você também pode baixar uma cópia.';
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
  bridge=await bootSimulator({mission,onTick:tick,onCapture:capture,onCaptureNotice:status,onCaptureState:recordingState,beforeCapture(){if(phase!=='flight')throw new Error('Inicie a missão antes de fotografar ou gravar.');if(media.length>=30)throw new Error('Limite de 30 evidências por tentativa.');}});
  if(phase==='recovered')showPost('Registro recuperado. Você pode reenviar uma entrega que falhou. Voos interrompidos no ar devem ser abandonados no painel.');else prep();
 }catch(error){root.replaceChildren(el('h1','Não foi possível iniciar'));status(authMessage(error));}
}
window.addEventListener('beforeunload',event=>{if(['flight','post'].includes(phase)){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{for(const url of mediaUrls.values())URL.revokeObjectURL(url);mediaUrls.clear();});
init();
