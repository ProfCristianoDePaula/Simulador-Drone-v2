import {renderUsersTable} from './admin-users.js';
import {goalCriteria} from '../training/criteria.js';
import {getClient,authMessage} from '../services/supabase.js';
import {courseMissions} from '../training/catalog.js';
import {element as el,link,field,choice,csvCell} from './dom.js';
const main=document.getElementById('academy'),notice=document.getElementById('notice');
const roleNames={student:'Aluno',teacher:'Professor',superadmin:'Administrador'};
let client,profile,classes=[],assignments=[],attempts=[],usersPage=0;
function button(text,fn){const b=el('button',text);b.addEventListener('click',async()=>{b.disabled=true;notice.textContent='';try{await fn();}catch(error){notice.textContent=authMessage(error);}finally{b.disabled=false;}});return b;}
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
async function query(request){const {data,error}=await request;if(error)throw error;return data;}
function card(title){const n=el('section','','card');n.append(el('h2',title));return n;}
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
}
async function render(){
 main.replaceChildren();document.body.dataset.role=profile.role;document.getElementById('role-label').textContent=roleNames[profile.role];document.getElementById('welcome').textContent=`Olá, ${profile.full_name||profile.email}`;
 document.getElementById('panel-description').textContent=profile.role==='superadmin'?'Administre acessos e perfis. Professores cuidam das turmas; alunos acompanham suas atividades.':profile.role==='teacher'?'Organize suas turmas, prepare atividades e acompanhe a evolução de cada piloto.':'Seu próximo voo começa aqui. Acompanhe as atividades e pratique para evoluir com segurança.';
 if(!profile.active){main.append(el('p','Seu acesso acadêmico foi desativado. Procure o administrador.'));return;}
 if(profile.role==='superadmin'){await renderAdmin();return;}
 await loadAcademic();const navigation=el('nav','','workspace-nav');for(const [id,label] of [['classes','Turmas'],['activities','Atividades'],['history','Histórico'],['missions','Missões']]){const a=el('a',label);a.href='#'+id;navigation.append(a);}main.append(navigation);
 const summary=el('div','','summary');summary.append(card(`${classes.filter(c=>!c.archived).length} turmas ativas`),card(`${assignments.length} atividades`),card(`${attempts.filter(t=>t.status==='submitted').length} entregas`));main.append(summary);
 const tools=el('section','','grid');
 if(profile.role==='teacher'){
  const create=card('Criar turma'),form=el('form'),name=field('Nome da turma');name.input.required=true;name.input.maxLength=100;form.append(name.box);formSubmit(form,'Criar',async()=>{await rpc('academy_create_class',{class_name:name.input.value.trim()});await render();});create.append(form);tools.append(create);
 }else{
  const join=card('Entrar em turma'),form=el('form'),code=field('Código do professor');code.input.required=true;code.input.pattern='[A-Fa-f0-9]{12}';code.input.maxLength=12;form.append(code.box);formSubmit(form,'Entrar',async()=>{const result=await rpc('academy_join_class',{invite_code:code.input.value.trim()});if(!result.ok)throw Error(result.message);await render();});join.append(form);tools.append(join);
 }
 const free=card('Prática sem nota');free.append(el('p','Explore livremente ou treine uma missão antes da avaliação.'),link('Simulador livre','/simulador.html'));tools.append(free);main.append(tools);
 const list=el('section');list.id='classes';list.append(el('h2','Minhas turmas'));const grid=el('div','','grid');
 for(const c of classes){const node=card(c.name);node.append(el('span',c.archived?'Arquivada':'Ativa','badge'));if(profile.role==='teacher')node.append(button('Gerenciar turma',()=>manageClass(c)));grid.append(node);}if(!classes.length)grid.append(el('p','Você ainda não participa de turmas.'));list.append(grid);main.append(list);
 renderAssignments();renderAttempts();renderMissions();
}
function renderAssignments(){
 const section=el('section');section.id='activities';section.append(el('h2',profile.role==='student'?'Minhas atividades':'Atividades atribuídas'));const grid=el('div','','grid');
 for(const a of assignments){const node=card(a.title),c=classes.find(c=>c.id===a.class_id);node.append(el('p',`${c?.name||'Turma'} · ${a.due_at?new Date(a.due_at).toLocaleString('pt-BR'):'Sem prazo'} · ${a.max_attempts} tentativas · ${a.grade_rule==='best'?'Melhor nota':'Última nota'}`));
  if(profile.role==='student'){const current=gradeOf(a.id,profile.id);node.append(el('p',current?`Nota: ${current.review_score??current.score}/100 · ${current.passed?'Aprovado':'Refazer'}`:'Sem entrega'));const open=attempts.find(t=>t.assignment_id===a.id&&t.student_id===profile.id&&t.status==='flying');if(open)node.append(link('Recuperar entrega local',missionLink(a.mission_id,a.id)+`&tentativa=${open.id}`),button('Encerrar tentativa interrompida',async()=>{await rpc('academy_abandon_attempt',{tid:open.id});await render();}));else if(!c?.archived&&(!a.due_at||new Date(a.due_at)>new Date()))node.append(link('Realizar missão',missionLink(a.mission_id,a.id)));}
  else node.append(button('Relatório da atividade',()=>showGradebook(a)));
  grid.append(node);
 }if(!assignments.length)grid.append(el('p','Nenhuma atividade atribuída.'));section.append(grid);main.append(section);
}
function renderAttempts(){
 const section=el('section');section.id='history';section.append(el('h2',profile.role==='student'?'Histórico de tentativas':'Entregas para acompanhamento'));const list=el('div','','grid');
 for(const t of attempts.slice(0,100)){const a=assignments.find(a=>a.id===t.assignment_id),n=card(a?.title||'Atividade');n.append(el('p',`${new Date(t.started_at).toLocaleString('pt-BR')} · ${t.status==='submitted'?`${t.review_score??t.score}/100`:t.status==='flying'?'Em andamento':'Abandonada'}`));if(t.feedback)n.append(el('p',t.feedback));n.append(button('Ver tentativa',()=>showAttempt(t)));list.append(n);}if(!attempts.length)list.append(el('p','Nenhuma tentativa registrada.'));section.append(list);main.append(section);
}
function renderMissions(){const section=el('section');section.id='missions';section.append(el('h2',`Explore as ${courseMissions.length} missões`));const grid=el('div','','grid mission-grid');for(const m of courseMissions){const n=card(m.title);n.append(el('span',`MISSÃO ${m.order} · ATÉ 100 PONTOS`,'badge'),el('p',`${m.goals.length} objetivos · ${m.brief}`),link('Treinar sem nota',missionLink(m.id)));const details=el('details'),summary=el('summary','Plano de voo e tolerâncias'),steps=el('ol');for(const goal of m.goals)steps.append(el('li',goal.label+' — '+goalCriteria(goal)));details.append(summary,steps);n.insertBefore(details,n.lastChild);grid.append(n);}section.append(grid);main.append(section);}
async function manageClass(c){
 const {dialog,body}=modal(c.name);
 const invite=await query(client.from('academy_invites').select('code,enabled').eq('class_id',c.id).single());
 body.append(el('p',`Código: ${invite.code} — ${invite.enabled?'entrada aberta':'entrada pausada'}`));
 body.append(button('Renovar código',async()=>{await rpc('academy_update_invite',{cid:c.id,rotate_code:true,allow_join:invite.enabled});dialog.remove();await manageClass(c);}),button(invite.enabled?'Pausar entrada':'Liberar entrada',async()=>{await rpc('academy_update_invite',{cid:c.id,rotate_code:false,allow_join:!invite.enabled});dialog.remove();await manageClass(c);}));
 const edit=el('form'),name=field('Nome da turma','text',c.name),archived=choice('Situação',[['false','Ativa'],['true','Arquivada']],String(c.archived));name.input.required=true;name.input.maxLength=100;edit.append(name.box,archived.box);formSubmit(edit,'Salvar turma',async()=>{await rpc('academy_edit_class',{cid:c.id,new_name:name.input.value,is_archived:archived.input.value==='true'});dialog.remove();await render();});body.append(edit);
 const members=await query(client.from('academy_memberships').select('student_id,academy_profiles!academy_memberships_student_id_fkey(id,email,full_name)').eq('class_id',c.id));body.append(el('h3',`${members.length} alunos`));
 for(const m of members){const row=el('p',`${m.academy_profiles.full_name||'Aluno'} — ${m.academy_profiles.email}`);row.append(button('Remover matrícula',async()=>{await rpc('academy_remove_student',{cid:c.id,uid:m.student_id});dialog.remove();await manageClass(c);}));body.append(row);}
 const add=el('form'),email=field('E-mail de aluno cadastrado','email');email.input.required=true;add.append(email.box);formSubmit(add,'Adicionar aluno',async()=>{await rpc('academy_add_student',{cid:c.id,student_email:email.input.value});dialog.remove();await manageClass(c);});body.append(add);
 if(!c.archived){const assign=el('form');assign.append(el('h3','Atribuir missão'));const mission=choice('Missão',courseMissions.map(m=>[m.id,m.title])),title=field('Título da atividade'),due=field('Prazo (opcional)','datetime-local'),limit=field('Máximo de tentativas','number','3'),pass=field('Nota mínima','number','70'),rule=choice('Nota aproveitada',[['best','Melhor nota'],['latest','Última nota']]);title.input.required=true;title.input.maxLength=150;limit.input.min=1;limit.input.max=20;pass.input.min=0;pass.input.max=100;assign.append(mission.box,title.box,due.box,limit.box,pass.box,rule.box);formSubmit(assign,'Atribuir à turma',async()=>{await rpc('academy_assign',{cid:c.id,mid:mission.input.value,title:title.input.value,deadline:due.input.value?new Date(due.input.value).toISOString():null,attempt_limit:Number(limit.input.value),passing:Number(pass.input.value),rule:rule.input.value});dialog.remove();await render();});body.append(assign);}
}
async function showGradebook(a){
 const {body}=modal(a.title);const members=await query(client.from('academy_memberships').select('student_id,academy_profiles!academy_memberships_student_id_fkey(email,full_name)').eq('class_id',a.class_id));
 const rows=[['Aluno','E-mail','Nota','Situação']];const table=el('table');
 for(const member of members){const t=gradeOf(a.id,member.student_id);rows.push([member.academy_profiles.full_name,member.academy_profiles.email,t?(t.review_score??t.score):'',t?(t.passed?'Aprovado':'Refazer'):'Pendente']);}
 for(const [i,row] of rows.entries()){const tr=el('tr');row.forEach(value=>tr.append(el(i===0?'th':'td',String(value))));table.append(tr);}body.append(table,button('Exportar CSV',()=>{const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=link('','');a.href=url;a.download='relatorio-turma.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));
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
 const section=card('Gerenciar usuários');section.append(el('p','Promova alunos a professores, altere perfis ou desative o acesso acadêmico. A administração não participa das turmas.'));
 main.append(section);await renderUsersTable({client,container:section,profile});
 const logs=await query(client.from('academy_audit_log').select('action,created_at').eq('action','manage_user').order('created_at',{ascending:false}).limit(20));const audit=card('Últimas alterações de usuários');for(const log of logs)audit.append(el('p',`${new Date(log.created_at).toLocaleString('pt-BR')} · Permissões atualizadas`));main.append(audit);
}
async function init(){try{client=await getClient();const {data,error}=await client.auth.getUser();if(error||!data.user){location.replace('/');return;}const session=await client.auth.getSession();const response=await fetch('/api/session',{headers:{Authorization:`Bearer ${session.data.session.access_token}`}});if(!response.headers.get('content-type')?.includes('application/json')){const error=new Error('Este servidor não está executando a API do painel. O Live Server (porta 5500) serve apenas arquivos. Abra a versão online ou execute npm run dev na pasta C:\\Projeto\\Drone e use o endereço exibido no terminal.');error.code='API_UNAVAILABLE';throw error;}const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível validar a sessão.');profile=result;client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')location.replace('/');});await render();}catch(error){main.replaceChildren(el('h2','Não foi possível carregar a área acadêmica'),el('p',error.code==='API_UNAVAILABLE'?'Use o servidor da aplicação para acessar sua conta.':'Não foi possível validar seu acesso. Consulte a mensagem abaixo.'));if(error.code==='API_UNAVAILABLE')main.append(link('Abrir Mini 4 Lab online','https://simulador-drone-v2.vercel.app/painel'));notice.textContent=authMessage(error);}}
document.getElementById('logout').addEventListener('click',async()=>{const {error}=await client.auth.signOut();if(error)notice.textContent=authMessage(error);else location.replace('/');});
document.getElementById('refresh').addEventListener('click',()=>render().catch(error=>notice.textContent=authMessage(error)));
init();
