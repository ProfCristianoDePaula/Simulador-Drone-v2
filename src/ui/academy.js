import {renderUsersTable} from './admin-users.js';
import {academicTable,decorate,icon,badge,sectionHeading} from './academic-table.js';
import {goalCriteria} from '../training/criteria.js';
import {getClient,authMessage} from '../services/supabase.js';
import {courseMissions} from '../training/catalog.js';
import {element as el,link,field,choice,csvCell} from './dom.js';
const main=document.getElementById('academy'),notice=document.getElementById('notice');
const roleNames={student:'Aluno',teacher:'Professor',superadmin:'Administrador'};
const helpLink=el('a','Ajuda e manual');helpLink.href='/ajuda.html';helpLink.id='help-link';document.querySelector('header nav').prepend(decorate(helpLink,'activities'));
let client,profile,classes=[],assignments=[],attempts=[],students=[];
function button(text,fn){const b=el('button',text);b.addEventListener('click',async()=>{b.disabled=true;notice.textContent='';try{await fn();}catch(error){notice.textContent=authMessage(error);}finally{b.disabled=false;}});return b;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
async function query(request){const {data,error}=await request;if(error)throw error;return data;}
function card(title,name='classes'){const n=el('section','','card');n.append(decorate(el('h2',title),name));return n;}
function formSubmit(form,label,fn){const submit=el('button',label);submit.type='submit';form.append(submit);form.addEventListener('submit',async event=>{event.preventDefault();if(submit.disabled)return;submit.disabled=true;notice.textContent='';try{await fn();}catch(error){notice.textContent=authMessage(error);}finally{submit.disabled=false;}});}
function modal(title){const d=el('dialog','','academy-dialog'),heading=el('h2',title),body=el('div');d.append(heading,button('Fechar',()=>{d.close();d.remove();}),body);document.body.append(d);d.showModal();return {dialog:d,body};}
function missionLink(id,assignment){return `/missao.html?${assignment?`atividade=${encodeURIComponent(assignment)}`:`missao=${encodeURIComponent(id)}`}`;}
function gradeOf(aid,uid){const list=attempts.filter(t=>t.assignment_id===aid&&t.student_id===uid&&t.status==='submitted');if(!list.length)return null;const a=assignments.find(x=>x.id===aid);const sorted=list.toSorted((a,b)=>new Date(b.submitted_at)-new Date(a.submitted_at));return a.grade_rule==='latest'?sorted[0]:sorted.reduce((best,t)=>(t.review_score??t.score)>(best.review_score??best.score)?t:best);}
async function loadAcademic(){
 [classes,assignments,attempts]=await Promise.all([
  query(client.from('academy_classes').select('id,name,teacher_id,archived').order('created_at',{ascending:false})),
  query(client.from('academy_assignments').select('*').order('created_at',{ascending:false})),
  query(client.from('academy_attempts').select('id,assignment_id,student_id,status,score,review_score,passed,critical,submitted_at,started_at,feedback,additional_attempt').order('started_at',{ascending:false}))
 ]);
 students=profile.role==='teacher'?await query(client.from('academy_profiles').select('id,full_name,email').eq('role','student')):[];
}
async function render(){
 helpLink.href='/ajuda.html?perfil='+(profile.role==='teacher'?'teacher':'student');
 main.replaceChildren();document.body.dataset.role=profile.role;document.getElementById('role-label').replaceChildren(icon(profile.role),document.createTextNode('PAINEL DO '+roleNames[profile.role].toUpperCase()));document.getElementById('welcome').textContent=`Olá, ${profile.full_name||profile.email}`;
 document.getElementById('panel-description').textContent=profile.role==='superadmin'?'Administre acessos e perfis. Professores cuidam das turmas; alunos acompanham suas atividades.':profile.role==='teacher'?'Organize suas turmas, prepare atividades e acompanhe a evolução de cada piloto.':'Seu próximo voo começa aqui. Acompanhe as atividades e pratique para evoluir com segurança.';
 if(!profile.active){main.append(el('p','Seu acesso acadêmico foi desativado. Procure o administrador.'));return;}
 if(profile.role==='superadmin'){await renderAdmin();return;}
 await loadAcademic();const navigation=el('nav','','workspace-nav');navigation.setAttribute('aria-label','Seções do painel');for(const [id,label] of [['classes','Turmas'],['activities','Atividades'],['history','Histórico'],['missions','Missões']]){const a=decorate(el('a',label),id);a.href='#'+id;navigation.append(a);}main.append(navigation);
 const summary=el('div','','summary');for(const [value,label,name] of [[classes.filter(c=>!c.archived).length,'Turmas ativas','classes'],[assignments.length,'Atividades','activities'],[attempts.filter(t=>t.status==='submitted').length,'Tentativas entregues','history']]){const tile=el('a','','summary-tile');tile.href='#'+name;const copy=el('div');copy.append(el('strong',String(value)),el('span',label));tile.append(icon(name),copy,icon('arrow'));summary.append(tile);}main.append(summary);
 const tools=el('section','','grid');
 if(profile.role==='teacher'){
  const create=card('Criar turma'),form=el('form'),name=field('Nome da turma');name.input.required=true;name.input.maxLength=100;form.append(name.box);formSubmit(form,'Criar',async()=>{await rpc('academy_create_class',{class_name:name.input.value.trim()});await render();});create.append(form);tools.append(create);
 }else{
  const join=card('Entrar em turma'),form=el('form'),code=field('Código do professor');code.input.required=true;code.input.pattern='[A-Fa-f0-9]{12}';code.input.maxLength=12;form.append(code.box);formSubmit(form,'Entrar',async()=>{const result=await rpc('academy_join_class',{invite_code:code.input.value.trim()});if(!result.ok)throw Error(result.message);await render();});join.append(form);tools.append(join);
 }
 const free=card('Prática sem nota','missions');free.append(el('p','Explore livremente ou treine uma missão antes da avaliação.'),decorate(link('Simulador livre','/simulador.html'),'arrow'));tools.append(free);main.append(tools);
 renderClasses();renderAssignments();renderAttempts();renderMissions();
}
function panel(id,title,description){const section=el('section','','data-section');section.id=id;sectionHeading(section,title,description,id);main.append(section);return section;}
function secondary(text,fn){const node=button(text,fn);node.className='secondary-action';return node;}
function renderClasses(){
 const section=panel('classes','Minhas turmas',profile.role==='teacher'?'Gerencie alunos, códigos de entrada e atividades de cada turma.':'Consulte suas turmas e as atividades atribuídas.');
 academicTable({container:section,title:'Lista de turmas',columns:['Turma','Situação','Atividades','Ações'],filters:[['active','Ativa'],['archived','Arquivada']],empty:'Nenhuma turma por aqui. Use o formulário acima para começar.',rows:classes.map(c=>({search:c.name,status:c.archived?'archived':'active',cells:[el('strong',c.name),badge(c.archived?'Arquivada':'Ativa',c.archived),assignments.filter(a=>a.class_id===c.id).length,profile.role==='teacher'?decorate(secondary('Gerenciar turma',()=>manageClass(c)),'classes'):link('Ver atividades','#activities')]}))});
}
function renderAssignments(){
 const student=profile.role==='student',section=panel('activities',student?'Minhas atividades':'Atividades atribuídas',student?'Consulte os prazos, acompanhe sua nota e inicie a próxima missão.':'Abra o relatório para acompanhar notas e entregas dos alunos.');
 const rows=assignments.map(a=>{
  const c=classes.find(c=>c.id===a.class_id),current=student?gradeOf(a.id,profile.id):null,open=student?attempts.find(t=>t.assignment_id===a.id&&t.student_id===profile.id&&t.status==='flying'):null;
  const closed=!!c?.archived,late=!!a.due_at&&new Date(a.due_at)<=new Date(),state=open?'progress':current?(current.passed?'passed':'retry'):closed?'archived':late?'closed':student?'pending':'open';
  const labels={progress:'Em andamento',passed:'Aprovado',retry:'Refazer',archived:'Turma arquivada',closed:'Prazo encerrado',pending:'Sem entrega',open:'Aberta'},tools=el('div','','row-actions');
  if(student){if(open)tools.append(link('Recuperar entrega',missionLink(a.mission_id,a.id)+'&tentativa='+open.id),secondary('Encerrar tentativa',async()=>{await rpc('academy_abandon_attempt',{tid:open.id});await render();}));else if(!closed&&!late)tools.append(decorate(link('Realizar missão',missionLink(a.mission_id,a.id)),'arrow'));else tools.append(el('span','Indisponível','cell-muted'));}
  else tools.append(decorate(secondary('Ver relatório',()=>showGradebook(a)),'activities'));
  const title=el('div','','cell-title');title.append(el('strong',a.title),el('small',a.max_attempts+' tentativas · '+(a.grade_rule==='best'?'Melhor nota':'Última nota')));
  return {search:a.title+' '+(c?.name||'')+' '+labels[state],status:state,cells:[title,c?.name||'Turma',a.due_at?new Date(a.due_at).toLocaleString('pt-BR'):'Sem prazo',badge(labels[state],['archived','closed','retry'].includes(state)),student?(current?(current.review_score??current.score)+'/100':'—'):attempts.filter(t=>t.assignment_id===a.id&&t.status==='submitted').length,tools]};
 });
 academicTable({container:section,title:student?'Suas atividades avaliadas':'Atividades das suas turmas',columns:['Atividade','Turma','Prazo','Situação',student?'Nota':'Tentativas entregues','Ações'],rows,filters:student?[['pending','Sem entrega'],['progress','Em andamento'],['passed','Aprovado'],['retry','Refazer'],['closed','Prazo encerrado'],['archived','Turma arquivada']]:[['open','Aberta'],['closed','Prazo encerrado'],['archived','Turma arquivada']],empty:'Nenhuma atividade atribuída ainda.'});
}
function renderAttempts(){
 const teacher=profile.role==='teacher',section=panel('history',teacher?'Acompanhamento dos alunos':'Histórico de tentativas',teacher?'Busque por aluno ou atividade e abra a tentativa para consultar evidências e revisar a nota.':'Confira resultados, evidências e comentários do professor.');
 academicTable({container:section,title:'Tentativas registradas',columns:[...(teacher?['Aluno']:[]),'Atividade','Início','Situação','Nota','Ações'],filters:[['flying','Em andamento'],['submitted','Entregue'],['abandoned','Abandonada']],empty:'As tentativas aparecerão aqui quando uma missão for iniciada.',rows:attempts.map(t=>{
  const a=assignments.find(a=>a.id===t.assignment_id),person=students.find(s=>s.id===t.student_id),name=person?.full_name||person?.email||'Aluno',title=el('div','','cell-title');title.append(el('strong',a?.title||'Atividade'));if(t.feedback)title.append(el('small',t.feedback));
  return {search:(a?.title||'')+' '+name+' '+(person?.email||'')+' '+(t.feedback||''),status:t.status,cells:[...(teacher?[name]:[]),title,new Date(t.started_at).toLocaleString('pt-BR'),badge(t.status==='submitted'?'Entregue':t.status==='flying'?'Em andamento':'Abandonada',t.status==='abandoned'),t.status==='submitted'?(t.review_score??t.score)+'/100':'—',decorate(secondary('Ver tentativa',()=>showAttempt(t)),'history')]};
 })});
}
function renderMissions(){
 const section=panel('missions','Missões para praticar','Treine sem nota oficial. Abra o plano de voo para consultar os objetivos e as tolerâncias.');
 academicTable({container:section,title:'Catálogo de '+courseMissions.length+' missões',columns:['Missão','Objetivos','Plano de voo','Ações'],rows:courseMissions.map(m=>{
  const title=el('div','','cell-title');title.append(el('small','MISSÃO '+String(m.order).padStart(2,'0')),el('strong',m.title));const details=el('details','','mission-details'),steps=el('ol');for(const g of m.goals)steps.append(el('li',g.label+' — '+goalCriteria(g)));details.append(el('summary','Ver briefing e critérios'),el('p',m.brief),steps);
  return {search:m.title+' '+m.brief+' '+m.order,cells:[title,m.goals.length+' etapas',details,decorate(link('Treinar sem nota',missionLink(m.id)),'missions')]};
 })});
}
async function manageClass(c){
 const {dialog,body}=modal(c.name);
 const invite=await query(client.from('academy_invites').select('code,enabled').eq('class_id',c.id).single());
 body.append(el('p',`Código: ${invite.code} — ${invite.enabled?'entrada aberta':'entrada pausada'}`));
 body.append(button('Renovar código',async()=>{await rpc('academy_update_invite',{cid:c.id,rotate_code:true,allow_join:invite.enabled});dialog.remove();await manageClass(c);}),button(invite.enabled?'Pausar entrada':'Liberar entrada',async()=>{await rpc('academy_update_invite',{cid:c.id,rotate_code:false,allow_join:!invite.enabled});dialog.remove();await manageClass(c);}));
 const edit=el('form'),name=field('Nome da turma','text',c.name),archived=choice('Situação',[['false','Ativa'],['true','Arquivada']],String(c.archived));name.input.required=true;name.input.maxLength=100;edit.append(name.box,archived.box);formSubmit(edit,'Salvar turma',async()=>{await rpc('academy_edit_class',{cid:c.id,new_name:name.input.value,is_archived:archived.input.value==='true'});dialog.remove();await render();});body.append(edit);
 const members=await query(client.from('academy_memberships').select('student_id,academy_profiles!academy_memberships_student_id_fkey(id,email,full_name)').eq('class_id',c.id));body.append(el('h3',`${members.length} alunos`));
 academicTable({container:body,title:'Alunos matriculados',columns:['Aluno','E-mail','Ações'],empty:'Nenhum aluno matriculado. Adicione um aluno abaixo ou compartilhe o código.',rows:members.map(m=>({search:(m.academy_profiles.full_name||'')+' '+m.academy_profiles.email,cells:[m.academy_profiles.full_name||'Aluno',m.academy_profiles.email,secondary('Remover matrícula',async()=>{await rpc('academy_remove_student',{cid:c.id,uid:m.student_id});dialog.remove();await manageClass(c);})]}))});
 const add=el('form'),email=field('E-mail de aluno cadastrado','email');email.input.required=true;add.append(email.box);formSubmit(add,'Adicionar aluno',async()=>{await rpc('academy_add_student',{cid:c.id,student_email:email.input.value});dialog.remove();await manageClass(c);});body.append(add);
 if(!c.archived){const assign=el('form');assign.append(el('h3','Atribuir missão'));const mission=choice('Missão',courseMissions.map(m=>[m.id,m.title])),title=field('Título da atividade'),due=field('Prazo (opcional)','datetime-local'),limit=field('Máximo de tentativas','number','3'),pass=field('Nota mínima','number','70'),rule=choice('Nota aproveitada',[['best','Melhor nota'],['latest','Última nota']]);title.input.required=true;title.input.maxLength=150;limit.input.min=1;limit.input.max=20;pass.input.min=0;pass.input.max=100;assign.append(mission.box,title.box,due.box,limit.box,pass.box,rule.box);formSubmit(assign,'Atribuir à turma',async()=>{await rpc('academy_assign',{cid:c.id,mid:mission.input.value,title:title.input.value,deadline:due.input.value?new Date(due.input.value).toISOString():null,attempt_limit:Number(limit.input.value),passing:Number(pass.input.value),rule:rule.input.value});dialog.remove();await render();});body.append(assign);}
}
async function showGradebook(a){
 const {body}=modal(a.title);const members=await query(client.from('academy_memberships').select('student_id,academy_profiles!academy_memberships_student_id_fkey(email,full_name)').eq('class_id',a.class_id));
 const rows=[['Aluno','E-mail','Nota','Situação']];const table=el('table','','academic-table');
 for(const member of members){const t=gradeOf(a.id,member.student_id);rows.push([member.academy_profiles.full_name,member.academy_profiles.email,t?(t.review_score??t.score):'',t?(t.passed?'Aprovado':'Refazer'):'Pendente']);}
 for(const [i,row] of rows.entries()){const tr=el('tr');row.forEach(value=>tr.append(el(i===0?'th':'td',String(value))));table.append(tr);}const wrap=el('div','','academic-table-wrap');wrap.tabIndex=0;wrap.append(table);body.append(wrap,button('Exportar CSV',()=>{const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=link('','');a.href=url;a.download='relatorio-turma.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
}
async function showAttempt(attempt){
 const {body,dialog}=modal('Detalhes da tentativa');const t=await query(client.from('academy_attempts').select('*').eq('id',attempt.id).single());
 const student=await query(client.from('academy_profiles').select('full_name,email').eq('id',t.student_id).single());body.append(el('p',`${student.full_name||'Aluno'} — ${student.email}`),el('p',`Estado: ${t.status} · Nota automática: ${t.score??'—'} · Nota revisada: ${t.review_score??'—'}`));
 if(t.breakdown){for(const [key,title] of Object.entries({preFlight:'Pré-voo',piloting:'Pilotagem',objectives:'Objetivos',postFlight:'Pós-voo'}))body.append(el('p',`${title}: ${t.breakdown[key]}`));if(t.critical)body.append(el('p','Falha crítica registrada. Esta tentativa exige refazer.'));}
 if(t.payload){body.append(el('h3','Relatório do aluno'),el('p',t.payload.report||'Sem relatório'));const canvas=el('canvas');canvas.width=600;canvas.height=350;canvas.style.width='100%';canvas.setAttribute('aria-label','Percurso da tentativa');const ctx=canvas.getContext('2d');ctx.fillStyle='#15363a';ctx.fillRect(0,0,600,350);const events=t.payload.events.filter(e=>e.type==='frame');const scale=250/Math.max(80,...events.flatMap(e=>[Math.abs(e.s.x),Math.abs(e.s.z)]));ctx.strokeStyle='#78e2ae';ctx.beginPath();events.forEach((e,i)=>{const x=300+e.s.x*scale,y=175+e.s.z*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();body.append(el('h3','Percurso'),canvas);}
 const evidence=await query(client.from('academy_evidence').select('path,kind').eq('attempt_id',t.id));for(const item of evidence){const {data,error}=await client.storage.from('academy-evidence').createSignedUrl(item.path,300);if(error)throw error;const a=link(item.kind==='photo'?'Abrir foto':'Abrir vídeo',data.signedUrl);a.target='_blank';a.rel='noopener';body.append(a);}
 if(profile.role==='teacher'){const form=el('form'),score=field('Nota revisada (vazio mantém cálculo automático)','number',t.review_score??''),feedback=field('Justificativa / comentário','text',t.feedback),retry=choice('Liberar tentativa adicional',[['false','Não'],['true','Sim']],String(t.additional_attempt));score.input.min=0;score.input.max=100;score.input.step='.01';feedback.input.required=true;feedback.input.minLength=5;feedback.input.maxLength=2000;form.append(score.box,feedback.box,retry.box);formSubmit(form,'Salvar revisão',async()=>{await rpc('academy_review_attempt',{tid:t.id,new_score:score.input.value===''?null:Number(score.input.value),comment:feedback.input.value,allow_retry:retry.input.value==='true'});dialog.remove();await render();});body.append(form);}
}
async function renderAdmin(){
 document.getElementById('free-nav').hidden=true;
 const section=card('Gerenciar usuários','superadmin');section.append(el('p','Promova alunos a professores, altere perfis ou desative o acesso acadêmico. A administração não participa das turmas.'));
 main.append(section);await renderUsersTable({client,container:section,profile});
 const logs=await query(client.from('academy_audit_log').select('action,created_at').eq('action','manage_user').order('created_at',{ascending:false}).limit(20));const audit=card('Últimas alterações de usuários','history');for(const log of logs)audit.append(el('p',`${new Date(log.created_at).toLocaleString('pt-BR')} · Permissões atualizadas`));main.append(audit);
}
async function init(){try{client=await getClient();const {data,error}=await client.auth.getUser();if(error||!data.user){location.replace('/');return;}const session=await client.auth.getSession();const response=await fetch('/api/session',{headers:{Authorization:`Bearer ${session.data.session.access_token}`}});if(!response.headers.get('content-type')?.includes('application/json')){const error=new Error('Este servidor não está executando a API do painel. O Live Server (porta 5500) serve apenas arquivos. Abra a versão online ou execute npm run dev na pasta C:\\Projeto\\Drone e use o endereço exibido no terminal.');error.code='API_UNAVAILABLE';throw error;}const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível validar a sessão.');profile=result;client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('/');});await render();}catch(error){main.replaceChildren(el('h2','Não foi possível carregar a área acadêmica'),el('p',error.code==='API_UNAVAILABLE'?'Use o servidor da aplicação para acessar sua conta.':'Não foi possível validar seu acesso. Consulte a mensagem abaixo.'));if(error.code==='API_UNAVAILABLE')main.append(link('Abrir Mini 4 Lab online','https://simulador-drone-v2.vercel.app/painel'));notice.textContent=authMessage(error);}}
document.getElementById('logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)notice.textContent=authMessage(error);else location.replace('/');});
document.getElementById('refresh').addEventListener('click',()=>render().catch(error=>notice.textContent=authMessage(error)));
for(const [id,name] of [['free-nav','missions'],['refresh','refresh'],['logout','logout']])decorate(document.getElementById(id),name);
init();
